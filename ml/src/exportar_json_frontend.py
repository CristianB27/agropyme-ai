"""Exporta la referencia histórica de maíz para el frontend.

La fuente canónica es ``ml/reports/rendimiento_esperado_maiz.csv``. Este
script no entrena ni modifica el modelo: solo convierte t/ha a kg/ha, conserva
la clave DANE como texto de cinco dígitos y produce un JSON determinista.
"""

from __future__ import annotations

import argparse
import csv
import json
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
ENTRADA_POR_DEFECTO = ROOT / 'ml' / 'reports' / 'rendimiento_esperado_maiz.csv'
SALIDA_POR_DEFECTO = ROOT / 'frontend' / 'src' / 'data' / 'rendimiento_esperado_maiz.json'

METADATOS: dict[str, str] = {
    'modelo': 'Random Forest',
    'fuente': 'EVA UPRA/MADR',
    'periodo_entrenamiento': '2007-2018',
    'cultivo': 'maíz',
    'cobertura_real_prueba_2019_2024': '60,5 %',
}

COLUMNAS_REQUERIDAS = {
    'cod_mun',
    'municipio',
    'departamento',
    'sistema',
    'semestre',
    'rendimiento_esperado_t_ha',
    'rango_inferior_t_ha',
    'rango_superior_t_ha',
}


def kg_ha(valor: str, campo: str) -> int:
    """Convierte t/ha a kg/ha y redondea al entero más cercano."""
    try:
        numero = Decimal(valor)
    except InvalidOperation as error:
        raise ValueError(f'{campo} no es un número válido: {valor!r}') from error
    if not numero.is_finite() or numero < 0:
        raise ValueError(f'{campo} debe ser un valor no negativo: {valor!r}')
    return int(
        (numero * Decimal('1000')).quantize(
            Decimal('1'), rounding=ROUND_HALF_UP
        )
    )


def normalizar_cod_mun(valor: str) -> str:
    """Conserva el código DANE como texto de exactamente cinco dígitos."""
    codigo = valor.strip()
    if not codigo.isdigit() or len(codigo) > 5:
        raise ValueError(f'cod_mun inválido: {valor!r}')
    return codigo.zfill(5)


def exportar(entrada: Path, salida: Path) -> tuple[int, int]:
    with entrada.open('r', encoding='utf-8-sig', newline='') as archivo:
        lector = csv.DictReader(archivo)
        columnas = set(lector.fieldnames or [])
        faltantes = COLUMNAS_REQUERIDAS - columnas
        if faltantes:
            raise ValueError(f'Faltan columnas en el CSV: {sorted(faltantes)}')

        registros: list[dict[str, Any]] = []
        claves: set[tuple[str, str, str]] = set()
        for numero_linea, fila in enumerate(lector, start=2):
            cod_mun = normalizar_cod_mun(fila['cod_mun'])
            municipio = fila['municipio'].strip()
            departamento = fila['departamento'].strip()
            sistema = fila['sistema'].strip().upper()
            semestre = fila['semestre'].strip().upper()
            if not municipio or not departamento:
                raise ValueError(f'Línea {numero_linea}: municipio y departamento son obligatorios')
            if sistema not in {'TRADICIONAL', 'TECNIFICADO'}:
                raise ValueError(f'Línea {numero_linea}: sistema inválido {sistema!r}')
            if semestre not in {'A', 'B'}:
                raise ValueError(f'Línea {numero_linea}: semestre inválido {semestre!r}')

            esperado = kg_ha(fila['rendimiento_esperado_t_ha'], 'rendimiento_esperado_t_ha')
            minimo = kg_ha(fila['rango_inferior_t_ha'], 'rango_inferior_t_ha')
            maximo = kg_ha(fila['rango_superior_t_ha'], 'rango_superior_t_ha')
            if minimo > maximo:
                raise ValueError(f'Línea {numero_linea}: el rango mínimo excede al máximo')

            clave = (cod_mun, sistema, semestre)
            if clave in claves:
                raise ValueError(f'Línea {numero_linea}: combinación DANE-sistema-semestre duplicada')
            claves.add(clave)

            registros.append({
                'cod_mun': cod_mun,
                'municipio': municipio,
                'departamento': departamento,
                'sistema': sistema,
                'semestre': semestre,
                'esperado_kg_ha': esperado,
                'min_kg_ha': minimo,
                'max_kg_ha': maximo,
            })

    registros.sort(key=lambda registro: (
        registro['cod_mun'],
        registro['municipio'],
        registro['departamento'],
        registro['sistema'],
        registro['semestre'],
    ))
    salida.parent.mkdir(parents=True, exist_ok=True)
    contenido = {
        'metadatos': METADATOS,
        'registros': registros,
    }
    salida.write_text(
        json.dumps(contenido, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )
    municipios = len({registro['cod_mun'] for registro in registros})
    return len(registros), municipios


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--entrada', type=Path, default=ENTRADA_POR_DEFECTO)
    parser.add_argument('--salida', type=Path, default=SALIDA_POR_DEFECTO)
    args = parser.parse_args()

    registros, municipios = exportar(args.entrada, args.salida)
    print(f'Registros exportados: {registros}')
    print(f'Municipios únicos: {municipios}')
    print(args.salida)


if __name__ == '__main__':
    main()
