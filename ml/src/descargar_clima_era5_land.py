"""Descarga ERA5-Land y lo agrega por semestre para MAÍZ (Fase C).

La fuente es el bucket público de Open-Meteo. Los archivos ``year_YYYY.om``
cubren 2006--2021 y los archivos ``chunk_NNN.om`` cubren 2022 en adelante.
No se usa la API Archive para el volumen completo: su cuota ponderada por
ubicación y día no permite descargar toda la serie municipal de forma masiva.

El tiempo se conserva en UTC. A representa enero--junio y B julio--diciembre.
Las horas se agregan por celda ERA5-Land; después se copian a los municipios
DANE MGN 2023 que usan esa celda.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import aiohttp
import fsspec
import numpy as np
import pandas as pd
from omfiles import OmFileReaderAsync


ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / 'data' / 'processed'
CACHE = ROOT / 'data' / 'cache' / 'era5_land'
CACHE_RANGOS = CACHE / 'rangos'
CHECKPOINTS = CACHE / 'checkpoints'
COORDENADAS = PROCESSED / 'coordenadas_municipales_dane.csv'
MODELO_MAIZ = PROCESSED / 'modelo_maiz.pkl'
SALIDA_CELDAS = PROCESSED / 'clima_era5_land_celdas.csv'
SALIDA_MUNICIPIOS = PROCESSED / 'clima_era5_land_municipios.csv'

BASE_URL = 'https://openmeteo.s3.amazonaws.com/data/copernicus_era5_land'
VARIABLES = {
    'temperature_2m': 'temperatura_2m_media_c',
    'soil_moisture_0_to_7cm': 'soil_moisture_0_to_7cm_media',
}
ANIOS_ANUALES = range(2006, 2022)
ANIOS_MODELO = range(2007, 2025)
HORAS_POR_CHUNK = 504
SEGUNDOS_POR_HORA = 3600
CONCURRENCIA_LECTURA = 96
CONCURRENCIA_HTTP = 256
TIMEOUT_HTTP_SEGUNDOS = 180
REINTENTOS_HTTP = 5


@dataclass(frozen=True)
class Fuente:
    """Describe un archivo fuente y su intervalo temporal UTC."""

    identificador: str
    tipo: str
    anio: int | None = None
    indice_chunk: int | None = None
    inicio: datetime | None = None
    fin: datetime | None = None
    inicio_agregacion: datetime | None = None
    fin_agregacion: datetime | None = None


def indice_chunk_para_timestamp(timestamp: int | datetime) -> int:
    """Devuelve el índice del chunk OM que contiene una marca de tiempo UTC."""
    if isinstance(timestamp, datetime):
        momento = timestamp
        if momento.tzinfo is None:
            momento = momento.replace(tzinfo=timezone.utc)
        timestamp = int(momento.timestamp())
    if timestamp < 0:
        raise ValueError('El timestamp debe ser no negativo')
    return timestamp // (HORAS_POR_CHUNK * SEGUNDOS_POR_HORA)


def periodos_clima_requeridos() -> set[tuple[int, str]]:
    """Devuelve los semestres climáticos previos a cada fila de MAÍZ.

    El período objetivo A usa el B del año anterior y B usa el A del mismo
    año. Así una fila nunca usa clima observado durante su propio semestre.
    """
    periodos: set[tuple[int, str]] = set()
    for anio in ANIOS_MODELO:
        periodos.add((anio - 1, 'B'))
        periodos.add((anio, 'A'))
    return periodos


def enumerar_fuentes() -> list[Fuente]:
    """Enumera archivos anuales y chunks sin solapar sus intervalos."""
    fuentes: list[Fuente] = []
    for anio in ANIOS_ANUALES:
        inicio = datetime(anio, 1, 1, tzinfo=timezone.utc)
        fin = datetime(anio + 1, 1, 1, tzinfo=timezone.utc)
        inicio_agregacion = max(inicio, datetime(2006, 7, 1, tzinfo=timezone.utc))
        fuentes.append(
            Fuente(
                identificador=f'year_{anio}',
                tipo='anual',
                anio=anio,
                inicio=inicio,
                fin=fin,
                inicio_agregacion=inicio_agregacion,
                fin_agregacion=fin,
            )
        )

    inicio_chunks = datetime(2022, 1, 1, tzinfo=timezone.utc)
    fin_chunks = datetime(2024, 7, 1, tzinfo=timezone.utc)
    primer_indice = indice_chunk_para_timestamp(inicio_chunks)
    ultimo_indice = indice_chunk_para_timestamp(fin_chunks - timedelta(seconds=1))
    for indice in range(primer_indice, ultimo_indice + 1):
        inicio = datetime.fromtimestamp(
            indice * HORAS_POR_CHUNK * SEGUNDOS_POR_HORA,
            tz=timezone.utc,
        )
        fin = inicio + timedelta(hours=HORAS_POR_CHUNK)
        fuentes.append(
            Fuente(
                identificador=f'chunk_{indice}',
                tipo='chunk',
                indice_chunk=indice,
                inicio=inicio,
                fin=fin,
                inicio_agregacion=max(
                    inicio, inicio_chunks if indice == primer_indice else inicio
                ),
                fin_agregacion=min(fin, fin_chunks),
            )
        )
    return fuentes


def url_fuente(variable: str, fuente: Fuente) -> str:
    """Construye la URL pública del archivo `.om`."""
    return f'{BASE_URL}/{variable}/{fuente.identificador}.om'


class RangoOpenMeteoFS(fsspec.spec.AbstractFileSystem):
    """Filesystem fsspec que descarga y cachea rangos HTTP de S3.

    ``omfiles`` entrega rangos con ``end`` exclusivo. Por eso la cabecera
    HTTP usa ``end - 1``. Cada rango se guarda de forma atómica y tiene un
    lock por clave para impedir descargas duplicadas concurrentes.
    """

    protocol = 'openmeteo_rango'
    asynchronous = True

    def __init__(self, cache_dir: Path = CACHE_RANGOS, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._session: aiohttp.ClientSession | None = None
        self._semaphore = asyncio.Semaphore(CONCURRENCIA_HTTP)
        self._locks: dict[str, asyncio.Lock] = {}
        self._sizes: dict[str, int] = {}

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=TIMEOUT_HTTP_SEGUNDOS)
            connector = aiohttp.TCPConnector(limit=CONCURRENCIA_HTTP)
            self._session = aiohttp.ClientSession(
                timeout=timeout,
                connector=connector,
            )
        return self._session

    async def _size(self, path: str) -> int:
        if path in self._sizes:
            return self._sizes[path]
        sesion = await self._get_session()
        for intento in range(REINTENTOS_HTTP):
            try:
                async with sesion.head(path) as respuesta:
                    respuesta.raise_for_status()
                    tamano = int(respuesta.headers['Content-Length'])
                self._sizes[path] = tamano
                return tamano
            except (aiohttp.ClientError, TimeoutError) as error:
                if intento + 1 == REINTENTOS_HTTP:
                    raise RuntimeError(f'No se pudo consultar el tamaño de {path}') from error
                await asyncio.sleep(2**intento)
        raise AssertionError('Flujo de reintentos inconcluso')

    async def _cat_file(
        self,
        path: str,
        start: int | None = None,
        end: int | None = None,
        **kwargs: Any,
    ) -> bytes:
        del kwargs
        inicio = 0 if start is None else int(start)
        fin = await self._size(path) if end is None else int(end)
        if fin < inicio:
            raise ValueError(f'Rango inválido para {path}: [{inicio}, {fin})')
        if fin == inicio:
            return b''

        clave = hashlib.sha256(f'{path}|{inicio}|{fin}'.encode()).hexdigest()
        destino = self.cache_dir / clave
        if destino.exists() and destino.stat().st_size == fin - inicio:
            return destino.read_bytes()

        lock = self._locks.setdefault(clave, asyncio.Lock())
        async with lock:
            if destino.exists() and destino.stat().st_size == fin - inicio:
                return destino.read_bytes()

            sesion = await self._get_session()
            datos: bytes | None = None
            for intento in range(REINTENTOS_HTTP):
                try:
                    async with self._semaphore:
                        async with sesion.get(
                            path,
                            headers={'Range': f'bytes={inicio}-{fin - 1}'},
                        ) as respuesta:
                            respuesta.raise_for_status()
                            if respuesta.status != 206:
                                raise RuntimeError(
                                    f'S3 no devolvió un rango parcial para {path}: '
                                    f'HTTP {respuesta.status}'
                                )
                            datos = await respuesta.read()
                    break
                except (aiohttp.ClientError, TimeoutError) as error:
                    if intento + 1 == REINTENTOS_HTTP:
                        raise RuntimeError(f'No se pudo descargar el rango de {path}') from error
                    await asyncio.sleep(2**intento)
            if datos is None:
                raise AssertionError('No se obtuvo el rango solicitado')
            if len(datos) != fin - inicio:
                raise RuntimeError(
                    f'Rango incompleto de {path}: esperaba {fin - inicio}, '
                    f'recibió {len(datos)}'
                )

            temporal = destino.with_name(
                f'{destino.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp'
            )
            temporal.write_bytes(datos)
            temporal.replace(destino)
            return datos

    async def close(self) -> None:
        """Cierra la sesión HTTP compartida."""
        if self._session is not None and not self._session.closed:
            await self._session.close()


def _abrir_checkpoints() -> Any:
    """Crea y abre la base SQLite de checkpoints atómicos."""
    import sqlite3

    CHECKPOINTS.mkdir(parents=True, exist_ok=True)
    conexion = sqlite3.connect(CHECKPOINTS / 'era5_land.sqlite')
    conexion.execute('PRAGMA journal_mode=WAL')
    conexion.execute('PRAGMA synchronous=NORMAL')
    conexion.execute(
        """
        CREATE TABLE IF NOT EXISTS checkpoint (
            fuente TEXT NOT NULL,
            variable TEXT NOT NULL,
            celda_y INTEGER NOT NULL,
            bloque_x INTEGER NOT NULL,
            payload TEXT NOT NULL,
            PRIMARY KEY (fuente, variable, celda_y, bloque_x)
        )
        """
    )
    conexion.commit()
    return conexion


def _guardar_checkpoint(
    conexion: Any,
    fuente: str,
    variable: str,
    celda_y: int,
    bloque_x: int,
    payload: list[dict[str, object]],
    confirmar: bool = True,
) -> None:
    """Guarda un bloque espacial; la clave primaria evita duplicados."""
    conexion.execute(
        """
        INSERT OR REPLACE INTO checkpoint
            (fuente, variable, celda_y, bloque_x, payload)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            fuente,
            variable,
            celda_y,
            bloque_x,
            json.dumps(payload, ensure_ascii=False, separators=(',', ':')),
        ),
    )
    if confirmar:
        conexion.commit()


def _checkpoints_existentes(
    conexion: Any,
    fuente: str,
    variable: str,
) -> set[tuple[int, int]]:
    """Lista los bloques ya finalizados para una fuente y variable."""
    filas = conexion.execute(
        """
        SELECT celda_y, bloque_x
        FROM checkpoint
        WHERE fuente = ? AND variable = ?
        """,
        (fuente, variable),
    ).fetchall()
    return {(int(fila[0]), int(fila[1])) for fila in filas}


def _etiquetas_temporales(fuente: Fuente, cantidad: int) -> list[tuple[int, str]]:
    """Etiqueta cada hora de una fuente con su año y semestre UTC."""
    if fuente.inicio is None:
        raise ValueError(f'La fuente {fuente.identificador} no tiene inicio')
    etiquetas: list[tuple[int, str]] = []
    for horas in range(cantidad):
        momento = fuente.inicio + timedelta(hours=horas)
        semestre = 'A' if momento.month <= 6 else 'B'
        etiquetas.append((momento.year, semestre))
    return etiquetas


def _agregar_bloque(
    valores: np.ndarray,
    fuente: Fuente,
    celda_y: int,
    bloque_x: int,
) -> list[dict[str, object]]:
    """Agrega las seis celdas de un bloque a sumas y conteos semestrales."""
    if valores.ndim != 3 or valores.shape[0] != 1 or valores.shape[1] != 6:
        raise ValueError(
            f'Forma inesperada del bloque OM: {valores.shape}; se esperaba (1, 6, T)'
        )
    etiquetas = _etiquetas_temporales(fuente, int(valores.shape[2]))
    mascaras = _mascaras_por_periodo(etiquetas)
    dentro_aggregation = _mascara_agregacion(fuente, int(valores.shape[2]))
    periodos = periodos_clima_requeridos()
    acumulado: dict[tuple[int, int, str], list[float | int]] = {}
    for offset_x in range(6):
        serie = valores[0, offset_x]
        validos = np.isfinite(serie)
        for periodo, mascara in mascaras.items():
            if periodo not in periodos:
                continue
            seleccion = mascara & dentro_aggregation & validos
            conteo = int(seleccion.sum())
            if conteo == 0:
                continue
            suma = float(serie[seleccion].sum(dtype=np.float64))
            clave = (offset_x, periodo[0], periodo[1])
            if clave not in acumulado:
                acumulado[clave] = [0.0, 0]
            acumulado[clave][0] = float(acumulado[clave][0]) + suma
            acumulado[clave][1] = int(acumulado[clave][1]) + conteo

    filas: list[dict[str, object]] = []
    for (offset_x, anio, semestre), (suma, conteo) in sorted(acumulado.items()):
        filas.append(
            {
                'celda_x': bloque_x * 6 + offset_x,
                'celda_y': celda_y,
                'anio': anio,
                'semestre': semestre,
                'suma': suma,
                'conteo': conteo,
            }
        )
    return filas


def _mascaras_por_periodo(
    etiquetas: list[tuple[int, str]],
) -> dict[tuple[int, str], np.ndarray]:
    """Construye máscaras booleanas por año/semestre."""
    resultado: dict[tuple[int, str], np.ndarray] = {}
    for periodo in set(etiquetas):
        resultado[periodo] = np.fromiter(
            (etiqueta == periodo for etiqueta in etiquetas),
            dtype=bool,
            count=len(etiquetas),
        )
    return resultado


def _mascara_agregacion(fuente: Fuente, cantidad: int) -> np.ndarray:
    """Selecciona las horas que pertenecen al intervalo sin solapamiento."""
    if fuente.inicio is None:
        raise ValueError(f'La fuente {fuente.identificador} no tiene inicio')
    inicio = fuente.inicio_agregacion or fuente.inicio
    fin = fuente.fin_agregacion or fuente.fin
    if fin is None or fin <= inicio:
        raise ValueError(f'Intervalo inválido para {fuente.identificador}')
    return np.fromiter(
        (
            inicio <= fuente.inicio + timedelta(hours=hora) < fin
            for hora in range(cantidad)
        ),
        dtype=bool,
        count=cantidad,
    )


def bloques_espaciales(
    coordenadas: pd.DataFrame,
) -> list[tuple[int, int]]:
    """Agrupa celdas en bloques espaciales OM de 1×6."""
    pares = coordenadas[['celda_x', 'celda_y']].drop_duplicates()
    return sorted(
        {
            (int(fila.celda_y), int(fila.celda_x) // 6)
            for fila in pares.itertuples(index=False)
        }
    )


async def _leer_fuente_variable(
    sistema_archivos: RangoOpenMeteoFS,
    conexion: Any,
    fuente: Fuente,
    variable: str,
    bloques: list[tuple[int, int]],
) -> None:
    """Lee y guarda todos los bloques pendientes de una fuente y variable."""
    existentes = _checkpoints_existentes(conexion, fuente.identificador, variable)
    pendientes = [bloque for bloque in bloques if bloque not in existentes]
    if not pendientes:
        return

    lector = await OmFileReaderAsync.from_fsspec(
        sistema_archivos,
        url_fuente(variable, fuente),
    )
    try:
        horas_esperadas = int(
            (fuente.fin - fuente.inicio).total_seconds() / 3600
        )
        if len(lector.shape) != 3 or lector.shape[2] != horas_esperadas:
            raise ValueError(
                f'{fuente.identificador}/{variable}: forma OM {lector.shape}; '
                f'se esperaban {horas_esperadas} horas'
            )

        semaforo = asyncio.Semaphore(CONCURRENCIA_LECTURA)
        async def leer(bloque: tuple[int, int]) -> tuple[tuple[int, int], list[dict[str, object]]]:
            celda_y, bloque_x = bloque
            async with semaforo:
                valores = await lector.read_array(
                    (
                        slice(celda_y, celda_y + 1),
                        slice(bloque_x * 6, bloque_x * 6 + 6),
                        slice(0, horas_esperadas),
                    )
                )
            return bloque, _agregar_bloque(
                valores,
                fuente,
                celda_y,
                bloque_x,
            )

        for inicio in range(0, len(pendientes), 128):
            lote = pendientes[inicio:inicio + 128]
            resultados = await asyncio.gather(*(leer(bloque) for bloque in lote))
            for (celda_y, bloque_x), payload in resultados:
                _guardar_checkpoint(
                    conexion,
                    fuente.identificador,
                    variable,
                    celda_y,
                    bloque_x,
                    payload,
                    confirmar=False,
                )
            conexion.commit()
            print(
                f'  {fuente.identificador}/{variable}: '
                f'{min(inicio + len(lote), len(pendientes))}/{len(pendientes)} bloques'
            )
    finally:
        lector.close()


def _payloads_checkpoints(
    conexion: Any,
    fuentes: list[Fuente],
    variables: list[str],
) -> list[tuple[str, str, list[dict[str, object]]]]:
    """Lee todos los checkpoints solicitados desde SQLite."""
    identificadores = [fuente.identificador for fuente in fuentes]
    marcadores = ','.join('?' for _ in identificadores)
    filas = conexion.execute(
        f"""
        SELECT fuente, variable, payload
        FROM checkpoint
        WHERE fuente IN ({marcadores}) AND variable IN (?, ?)
        ORDER BY fuente, variable, celda_y, bloque_x
        """,
        (*identificadores, *variables),
    ).fetchall()
    return [
        (str(fuente), str(variable), json.loads(payload))
        for fuente, variable, payload in filas
    ]


def _consolidar_celdas(
    payloads: list[tuple[str, str, list[dict[str, object]]]],
    celdas: set[tuple[int, int]],
) -> pd.DataFrame:
    """Consolida sumas y conteos de todas las fuentes por celda y semestre."""
    acumulado: dict[
        tuple[str, int, int, int, str],
        list[float | int],
    ] = {}
    for _fuente, variable, filas in payloads:
        for fila in filas:
            clave_celda = (int(fila['celda_x']), int(fila['celda_y']))
            if clave_celda not in celdas:
                continue
            clave = (
                variable,
                clave_celda[0],
                clave_celda[1],
                int(fila['anio']),
                str(fila['semestre']),
            )
            if clave not in acumulado:
                acumulado[clave] = [0.0, 0]
            acumulado[clave][0] = float(acumulado[clave][0]) + float(fila['suma'])
            acumulado[clave][1] = int(acumulado[clave][1]) + int(fila['conteo'])

    registros: list[dict[str, object]] = []
    for (variable, celda_x, celda_y, anio, semestre), (suma, conteo) in sorted(
        acumulado.items()
    ):
        registros.append(
            {
                'variable': variable,
                'celda_x': celda_x,
                'celda_y': celda_y,
                'anio': anio,
                'semestre': semestre,
                'suma': suma,
                'conteo': conteo,
            }
        )
    if not registros:
        raise ValueError('No hay checkpoints climáticos para consolidar')

    largo = pd.DataFrame(registros)
    consolidado = largo.pivot(
        index=['celda_x', 'celda_y', 'anio', 'semestre'],
        columns='variable',
        values=['suma', 'conteo'],
    )
    consolidado.columns = [
        f'{medida}_{variable}' for medida, variable in consolidado.columns
    ]
    consolidado = consolidado.reset_index()
    for variable, nombre in VARIABLES.items():
        consolidado[nombre] = (
            consolidado[f'suma_{variable}'] / consolidado[f'conteo_{variable}']
        )
    return consolidado.sort_values(['celda_x', 'celda_y', 'anio', 'semestre'])


def _horas_esperadas_semestre(anio: int, semestre: str) -> int:
    """Calcula las horasalendarías de un semestre natural UTC."""
    es_bisiesto = int(
        (anio % 4 == 0) and (anio % 100 != 0 or anio % 400 == 0)
    )
    if semestre == 'A':
        dias = 181 + es_bisiesto
    elif semestre == 'B':
        dias = 184
    else:
        raise ValueError(f'Semestre inválido: {semestre!r}')
    return dias * 24


def validar_cobertura_celdas(
    consolidado: pd.DataFrame,
    celdas: set[tuple[int, int]],
) -> pd.DataFrame:
    """Valida que cada celda tenga todos los semestres requeridos."""
    esperados = periodos_clima_requeridos()
    duplicados = consolidado.duplicated(
        subset=['celda_x', 'celda_y', 'anio', 'semestre']
    )
    if duplicados.any():
        raise ValueError('La consolidación climática contiene celdas/semestres duplicados')

    filas: list[dict[str, object]] = []
    for celda_x, celda_y in sorted(celdas):
        grupo = consolidado[
            consolidado['celda_x'].eq(celda_x)
            & consolidado['celda_y'].eq(celda_y)
        ]
        presentes = set(zip(grupo['anio'].astype(int), grupo['semestre'].astype(str)))
        faltantes = sorted(esperados - presentes)
        for variable in VARIABLES:
            columna_conteo = f'conteo_{variable}'
            columna_media = VARIABLES[variable]
            for (anio, semestre), fila in zip(
                zip(grupo['anio'].astype(int), grupo['semestre'].astype(str)),
                grupo[[columna_conteo, columna_media]].itertuples(index=False),
            ):
                esperado = _horas_esperadas_semestre(anio, semestre)
                filas.append(
                    {
                        'celda_x': celda_x,
                        'celda_y': celda_y,
                        'anio': anio,
                        'semestre': semestre,
                        'variable': variable,
                        'horas_esperadas': esperado,
                        'horas_validas': int(fila[0]),
                        'horas_faltantes': esperado - int(fila[0]),
                        'valor': float(fila[1]),
                        'semestre_presente': True,
                    }
                )
        for anio, semestre in faltantes:
            filas.append(
                {
                    'celda_x': celda_x,
                    'celda_y': celda_y,
                    'anio': anio,
                    'semestre': semestre,
                    'variable': 'TODAS',
                    'horas_esperadas': _horas_esperadas_semestre(anio, semestre),
                    'horas_validas': 0,
                    'horas_faltantes': _horas_esperadas_semestre(anio, semestre),
                    'valor': np.nan,
                    'semestre_presente': False,
                }
            )
    return pd.DataFrame(filas)


def _municipios_climaticos(
    coordenadas: pd.DataFrame,
    consolidado: pd.DataFrame,
) -> pd.DataFrame:
    """Copia el valor de cada celda a los municipios que la usan."""
    periodos = pd.MultiIndex.from_tuples(
        sorted(periodos_clima_requeridos()),
        names=['anio', 'semestre'],
    ).to_frame(index=False)
    municipio_periodo = coordenadas.merge(periodos, how='cross')
    columnas_clima = [
        'celda_x',
        'celda_y',
        'anio',
        'semestre',
        'temperatura_2m_media_c',
        'conteo_temperature_2m',
        'soil_moisture_0_to_7cm_media',
        'conteo_soil_moisture_0_to_7cm',
    ]
    resultado = municipio_periodo.merge(
        consolidado[columnas_clima],
        on=['celda_x', 'celda_y', 'anio', 'semestre'],
        how='left',
        validate='many_to_one',
    )
    return resultado.sort_values(['cod_mun', 'anio', 'semestre'])


def _sha256_archivo(ruta: Path) -> str:
    """Calcula el SHA-256 de un artefacto local."""
    hash_ = hashlib.sha256()
    with ruta.open('rb') as archivo:
        for parte in iter(lambda: archivo.read(1024 * 1024), b''):
            hash_.update(parte)
    return hash_.hexdigest()


def _manifiesto_fuentes(fuentes: list[Fuente]) -> pd.DataFrame:
    """Documenta las URLs, límites UTC y reglas de agregación."""
    filas: list[dict[str, object]] = []
    for fuente in fuentes:
        filas.append(
            {
                'fuente': fuente.identificador,
                'tipo': fuente.tipo,
                'url_base': BASE_URL,
                'url_temperatura': url_fuente('temperature_2m', fuente),
                'url_humedad_suelo': url_fuente('soil_moisture_0_to_7cm', fuente),
                'inicio_archivo_utc': fuente.inicio,
                'fin_archivo_utc': fuente.fin,
                'inicio_agregacion_utc': fuente.inicio_agregacion,
                'fin_agregacion_utc': fuente.fin_agregacion,
                'zona_horaria': 'UTC',
                'regla_agregacion': 'promedio aritmético de horas válidas por semestre natural',
            }
        )
    return pd.DataFrame(filas)


async def _descargar_clima(
    coordenadas: pd.DataFrame,
    variables: list[str],
    fuentes: list[Fuente],
) -> Any:
    """Descarga todas las fuentes y conserva checkpoints en SQLite."""
    conexion = _abrir_checkpoints()
    bloques = bloques_espaciales(coordenadas)
    sistema_archivos = RangoOpenMeteoFS()
    try:
        for variable in variables:
            for fuente in fuentes:
                await _leer_fuente_variable(
                    sistema_archivos,
                    conexion,
                    fuente,
                    variable,
                    bloques,
                )
    finally:
        await sistema_archivos.close()
        conexion.commit()
    return conexion


def main() -> None:
    """Ejecuta la descarga, consolida y guarda los artefactos climáticos."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--variables',
        nargs='+',
        choices=sorted(VARIABLES),
        default=sorted(VARIABLES),
        help='Variables a descargar; por defecto, las dos.',
    )
    parser.add_argument(
        '--solo-consolidar',
        action='store_true',
        help='No descarga; consolida únicamente checkpoints existentes.',
    )
    args = parser.parse_args()

    if not COORDENADAS.exists():
        raise FileNotFoundError(
            f'No existe {COORDENADAS}. Ejecuta antes ml/src/preparar_coordenadas_dane.py.'
        )
    if not MODELO_MAIZ.exists():
        raise FileNotFoundError(
            f'No existe {MODELO_MAIZ}. Ejecuta antes ml/src/preparar_modelo.py.'
        )

    coordenadas = pd.read_csv(COORDENADAS)
    modelo = pd.read_pickle(MODELO_MAIZ)
    requeridos = set(modelo['cod_mun'].astype(int).unique())
    disponibles = set(coordenadas['cod_mun'].astype(int).unique())
    faltantes = requeridos - disponibles
    if faltantes:
        print(
            f'AVISO: {len(faltantes)} códigos MAÍZ sin MGN 2023 quedan sin clima: '
            f'{sorted(faltantes)}.'
        )

    fuentes = enumerar_fuentes()
    if args.solo_consolidar:
        conexion = _abrir_checkpoints()
    else:
        conexion = asyncio.run(
            _descargar_clima(coordenadas, args.variables, fuentes)
        )

    try:
        payloads = _payloads_checkpoints(conexion, fuentes, args.variables)
        celdas = set(
            coordenadas[['celda_x', 'celda_y']]
            .drop_duplicates()
            .itertuples(index=False, name=None)
        )
        consolidado = _consolidar_celdas(payloads, celdas)
        cobertura = validar_cobertura_celdas(consolidado, celdas)
        celdas_incompletas = (
            cobertura.loc[~cobertura['semestre_presente']]
            .groupby(['celda_x', 'celda_y'], as_index=False)
            .agg(
                periodos_faltantes=('anio', 'size'),
                anios_faltantes=('anio', lambda valores: ','.join(
                    map(str, sorted(set(valores)))
                )),
            )
            .sort_values(['celda_x', 'celda_y'])
        )
        municipios_incompletos = coordenadas.merge(
            celdas_incompletas,
            on=['celda_x', 'celda_y'],
            how='inner',
            validate='many_to_one',
        )
        filas_incompletas = modelo.merge(
            municipios_incompletos[['cod_mun']].drop_duplicates(),
            on='cod_mun',
            how='inner',
            validate='many_to_one',
        )
        resumen_cobertura = pd.DataFrame(
            [
                {
                    'celdas_incompletas': int(len(celdas_incompletas)),
                    'municipios_incompletos': int(
                        municipios_incompletos['cod_mun'].nunique()
                    ),
                    'filas_maiz_incompletas': int(len(filas_incompletas)),
                    'filas_maiz_entrenamiento_incompletas': int(
                        filas_incompletas['conjunto'].eq('ENTRENAMIENTO').sum()
                    ),
                    'filas_maiz_prueba_incompletas': int(
                        filas_incompletas['conjunto'].eq('PRUEBA').sum()
                    ),
                }
            ]
        )

        municipios = _municipios_climaticos(coordenadas, consolidado)
        manifiesto = _manifiesto_fuentes(fuentes)
        PROCESSED.mkdir(parents=True, exist_ok=True)
        consolidado.to_csv(SALIDA_CELDAS, index=False, encoding='utf-8-sig')
        municipios.to_csv(SALIDA_MUNICIPIOS, index=False, encoding='utf-8-sig')
        cobertura.to_csv(
            PROCESSED / 'cobertura_clima_era5_land.csv',
            index=False,
            encoding='utf-8-sig',
        )
        celdas_incompletas.to_csv(
            PROCESSED / 'celdas_clima_incompletas.csv',
            index=False,
            encoding='utf-8-sig',
        )
        municipios_incompletos.to_csv(
            PROCESSED / 'municipios_clima_incompletos.csv',
            index=False,
            encoding='utf-8-sig',
        )
        resumen_cobertura.to_csv(
            PROCESSED / 'resumen_cobertura_clima_era5_land.csv',
            index=False,
            encoding='utf-8-sig',
        )
        manifiesto.to_csv(
            PROCESSED / 'manifiesto_fuentes_clima_era5_land.csv',
            index=False,
            encoding='utf-8-sig',
        )
        hashes = pd.DataFrame(
            [
                {
                    'archivo': ruta.name,
                    'sha256': _sha256_archivo(ruta),
                    'bytes': ruta.stat().st_size,
                }
                for ruta in (
                    SALIDA_CELDAS,
                    SALIDA_MUNICIPIOS,
                    PROCESSED / 'cobertura_clima_era5_land.csv',
                    PROCESSED / 'celdas_clima_incompletas.csv',
                    PROCESSED / 'municipios_clima_incompletos.csv',
                    PROCESSED / 'resumen_cobertura_clima_era5_land.csv',
                    PROCESSED / 'manifiesto_fuentes_clima_era5_land.csv',
                )
            ]
        )
        hashes.to_csv(
            PROCESSED / 'checksums_clima_era5_land.csv',
            index=False,
            encoding='utf-8-sig',
        )
    finally:
        conexion.close()

    horas_faltantes = int(cobertura['horas_faltantes'].clip(lower=0).sum())
    print(
        f'Clima consolidado: {len(consolidado)} celdas-semestre, '
        f'{len(municipios)} municipio-semestre, '
        f'{horas_faltantes} horas no finitas reportadas.'
    )
    print(SALIDA_CELDAS)
    print(SALIDA_MUNICIPIOS)
    if len(celdas_incompletas):
        print(
            'Cobertura incompleta aceptada: '
            f'{len(celdas_incompletas)} celdas, '
            f'{municipios_incompletos["cod_mun"].nunique()} municipios y '
            f'{len(filas_incompletas)} filas de MAÍZ; se imputarán dentro '
            'de cada fold.'
        )
        print(PROCESSED / 'celdas_clima_incompletas.csv')
        print(PROCESSED / 'municipios_clima_incompletos.csv')
        print(PROCESSED / 'resumen_cobertura_clima_era5_land.csv')


if __name__ == '__main__':
    main()
