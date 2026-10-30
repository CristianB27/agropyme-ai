"""Prepara centroides municipales oficiales del Marco Geoestadístico Nacional.

La fuente es el GeoJSON municipal MGN 2023 publicado por DANE. Cada municipio
se asigna a la celda ERA5-Land de 0.1 grados más cercana. No se usan
coordenadas escritas manualmente ni servicios de geocodificación.
"""

from __future__ import annotations

import json
from pathlib import Path
from zipfile import ZipFile

import pandas as pd
import requests
from shapely.geometry import shape


ROOT = Path(__file__).resolve().parents[2]
CACHE_DANE = ROOT / 'data' / 'cache' / 'dane' / 'mgn_2023'
ARCHIVO_DANE = CACHE_DANE / 'MGN_ADM_MPIO_GRAFICO2023geojson.zip'
SALIDA = ROOT / 'data' / 'processed' / 'coordenadas_municipales_dane.csv'
REPORTE_COBERTURA = (
    ROOT / 'data' / 'processed' / 'reporte_cobertura_maiz_dane.csv'
)
URL_DANE = (
    'https://geoportal.dane.gov.co/descargas/mgn_2023/'
    'MGN_ADM_MPIO_GRAFICO2023geojson.zip'
)
PASO_GRID = 0.1


def descargar_geojson_dane(destino: Path = ARCHIVO_DANE) -> Path:
    """Descarga el paquete DANE una sola vez y de forma atómica."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    if destino.exists() and destino.stat().st_size > 0:
        return destino

    temporal = destino.with_suffix(destino.suffix + '.tmp')
    with requests.get(URL_DANE, stream=True, timeout=180) as respuesta:
        respuesta.raise_for_status()
        with temporal.open('wb') as archivo:
            for parte in respuesta.iter_content(chunk_size=1024 * 1024):
                if parte:
                    archivo.write(parte)
    temporal.replace(destino)
    return destino


def indice_celda_era5(latitud: float, longitud: float) -> tuple[int, int]:
    """Convierte una coordenada al índice (x=longitud, y=latitud) de ERA5-Land."""
    x = int(round((longitud + 180.0) / PASO_GRID))
    y = int(round((latitud + 90.0) / PASO_GRID))
    if not 0 <= x < 3600 or not 0 <= y <= 1800:
        raise ValueError(
            f'Coordenada fuera de la grilla ERA5-Land: {latitud}, {longitud}'
        )
    return x, y


def leer_geojson_dane(archivo: Path = ARCHIVO_DANE) -> pd.DataFrame:
    """Calcula programáticamente el centroide de cada geometría municipal."""
    with ZipFile(archivo) as paquete:
        nombres_geojson = [
            nombre for nombre in paquete.namelist() if nombre.endswith('.geojson')
        ]
        if len(nombres_geojson) != 1:
            raise ValueError(
                f'El ZIP DANE debe contener un GeoJSON; encontró {nombres_geojson}'
            )
        with paquete.open(nombres_geojson[0]) as flujo:
            geojson = json.load(flujo)

    filas: list[dict[str, object]] = []
    for feature in geojson.get('features', []):
        propiedades = feature['properties']
        geometria = shape(feature['geometry'])
        centroide = geometria.centroid
        x, y = indice_celda_era5(centroide.y, centroide.x)
        filas.append(
            {
                'cod_dep': int(propiedades['dpto_ccdgo']),
                'cod_mun': int(propiedades['mpio_cdpmp']),
                'departamento': propiedades['dpto_cnmbr'],
                'municipio': propiedades['mpio_cnmbr'],
                'tipo_municipio': propiedades['mpio_tipo'],
                'latitud_centroide': float(centroide.y),
                'longitud_centroide': float(centroide.x),
                'celda_x': x,
                'celda_y': y,
                'fuente_geografia': 'DANE MGN 2023 - GeoJSON municipal',
                'url_fuente': URL_DANE,
            }
        )

    datos = pd.DataFrame(filas)
    if datos.empty:
        raise ValueError('El GeoJSON DANE no contiene municipios')
    if datos['cod_mun'].duplicated().any():
        duplicados = datos.loc[datos['cod_mun'].duplicated(), 'cod_mun'].tolist()
        raise ValueError(f'Códigos municipales DANE duplicados: {duplicados[:10]}')
    if not datos[['latitud_centroide', 'longitud_centroide']].notna().all().all():
        raise ValueError('Hay centroides DANE nulos')
    return datos.sort_values(['cod_dep', 'cod_mun']).reset_index(drop=True)


def construir_reporte_cobertura_maiz(
    coordenadas: pd.DataFrame,
    modelo_maiz: pd.DataFrame,
) -> pd.DataFrame:
    """Reporta códigos EVA MAÍZ que no existen en el MGN 2023.

    No se asigna un centroide aproximado ni una geografía posterior. Las filas
    sin cobertura permanecen en el modelado y su clima se imputa dentro de cada
    fold usando únicamente estadísticas de entrenamiento.
    """
    requeridos = set(modelo_maiz['cod_mun'].unique())
    disponibles = set(coordenadas['cod_mun'].unique())
    faltantes = sorted(requeridos - disponibles)

    if not faltantes:
        return pd.DataFrame(
            columns=[
                'cod_dep',
                'cod_mun',
                'departamento',
                'municipio',
                'estado',
                'filas_entrenamiento',
                'filas_prueba',
                'anios',
                'motivo',
            ]
        )

    datos = modelo_maiz[modelo_maiz['cod_mun'].isin(faltantes)].copy()
    filas: list[dict[str, object]] = []
    for cod_mun, grupo in datos.groupby('cod_mun', sort=True):
        etiquetas = grupo[['cod_dep', 'departamento', 'municipio']].drop_duplicates()
        if len(etiquetas) != 1:
            raise ValueError(
                f'El código MAÍZ {cod_mun} tiene metadatos municipales inconsistentes'
            )
        etiqueta = etiquetas.iloc[0]
        filas.append(
            {
                'cod_dep': int(etiqueta['cod_dep']),
                'cod_mun': int(cod_mun),
                'departamento': etiqueta['departamento'],
                'municipio': etiqueta['municipio'],
                'estado': 'SIN_GEOGRAFIA_MGN_2023',
                'filas_entrenamiento': int(
                    grupo['conjunto'].eq('ENTRENAMIENTO').sum()
                ),
                'filas_prueba': int(grupo['conjunto'].eq('PRUEBA').sum()),
                'anios': ', '.join(str(anio) for anio in sorted(grupo['anio'].unique())),
                'motivo': (
                    'Código no presente en el Marco Geoestadístico Nacional 2023; '
                    'no se asigna geografía aproximada.'
                ),
            }
        )
    return pd.DataFrame(filas)


def main() -> None:
    """Descarga, valida y guarda las coordenadas municipales."""
    descargar_geojson_dane()
    coordenadas = leer_geojson_dane()
    SALIDA.parent.mkdir(parents=True, exist_ok=True)

    # Primero se escribe el archivo principal aun cuando EVA contenga unidades
    # administrativas posteriores al corte MGN 2023.
    coordenadas.to_csv(SALIDA, index=False, encoding='utf-8-sig')

    reporte = pd.DataFrame(
        columns=[
            'cod_dep',
            'cod_mun',
            'departamento',
            'municipio',
            'estado',
            'filas_entrenamiento',
            'filas_prueba',
            'anios',
            'motivo',
        ]
    )
    ruta_modelo = ROOT / 'data' / 'processed' / 'modelo_maiz.pkl'
    if ruta_modelo.exists():
        reporte = construir_reporte_cobertura_maiz(
            coordenadas,
            pd.read_pickle(ruta_modelo),
        )
    reporte.to_csv(REPORTE_COBERTURA, index=False, encoding='utf-8-sig')

    celdas = coordenadas[['celda_x', 'celda_y']].drop_duplicates().shape[0]
    print(f'Coordenadas DANE guardadas: {len(coordenadas)} municipios, {celdas} celdas.')
    print(f'Unidades MAÍZ sin geografía MGN 2023: {len(reporte)}.')
    if not reporte.empty:
        print(reporte.to_string(index=False))
    print(SALIDA)
    print(REPORTE_COBERTURA)


if __name__ == '__main__':
    main()
