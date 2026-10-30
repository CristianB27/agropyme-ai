"""Evalúa la línea base de rendimiento de maize, yuca y ñame (Fase B).

Las predicciones usan únicamente medianas calculadas con el conjunto de
entrenamiento (<= 2018). La llave principal es municipio y sistema para maize,
y municipio para yuca y ñame. Si una fila de prueba no tiene historia para su
llave, se usa como respaldo la mediana de entrenamiento del departamento.
"""

from pathlib import Path

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / 'data' / 'processed'
REPORTS = ROOT / 'ml' / 'reports'

COD_DEP_BOLIVAR = 13
CARIBE_COD_DEP = {8, 13, 20, 23, 44, 47, 70, 88}
ENTRENAMIENTO_HASTA = 2018
PRUEBA_DESDE = 2019
CULTIVOS = {
    'MAIZ': 'maiz',
    'YUCA': 'yuca',
    'NAME': 'name',
}
LLAVES_PREDICCION = {
    'MAIZ': ['cod_mun', 'sistema'],
    'YUCA': ['cod_mun'],
    'NAME': ['cod_mun'],
}
ESCENARIO_TODOS = 'TODOS'
ESCENARIO_SIN_MEDIO_SEMESTRE = 'SIN_MEDIO_SEMESTRE'
ORIGEN_HISTORIA = 'HISTORIA'
ORIGEN_RESPALDO = 'RESPALDO_DEPARTAMENTO'
COLUMNAS_REQUERIDAS = {
    'cod_dep',
    'departamento',
    'cod_mun',
    'municipio',
    'anio',
    'semestre',
    'rendimiento_t_ha',
    'conjunto',
}


def validar_columnas(dataframe: pd.DataFrame, cultivo: str) -> None:
    """Verifica que el dataset tenga las columnas necesarias para evaluar."""
    faltantes = COLUMNAS_REQUERIDAS - set(dataframe.columns)
    llaves = set(LLAVES_PREDICCION[cultivo])
    faltantes |= llaves - set(dataframe.columns)
    if faltantes:
        raise ValueError(
            f'{cultivo}: faltan columnas necesarias para la línea base: '
            f'{sorted(faltantes)}'
        )


def validar_corte_temporal(dataframe: pd.DataFrame, cultivo: str) -> None:
    """Impide usar años de prueba para construir las medianas de entrenamiento."""
    entrenamiento = dataframe[dataframe['conjunto'].eq('ENTRENAMIENTO')]
    prueba = dataframe[dataframe['conjunto'].eq('PRUEBA')]
    if entrenamiento['anio'].max() > ENTRENAMIENTO_HASTA:
        raise ValueError(
            f'{cultivo}: hay años > {ENTRENAMIENTO_HASTA} marcados como entrenamiento'
        )
    if prueba['anio'].min() < PRUEBA_DESDE:
        raise ValueError(
            f'{cultivo}: hay años < {PRUEBA_DESDE} marcados como prueba'
        )


def aplicar_escenario(
    dataframe: pd.DataFrame,
    cultivo: str,
    escenario: str,
) -> pd.DataFrame:
    """Aplica el filtro de cobertura al escenario solicitado.

    El escenario sin medio semestre solo aplica a yuca y excluye las unidades
    ``n_semestres == 1`` tanto del entrenamiento como de la prueba. Así la
    comparación no deja datos de medio semestre dentro de las medianas.
    """
    if escenario == ESCENARIO_TODOS:
        return dataframe.copy()
    if escenario != ESCENARIO_SIN_MEDIO_SEMESTRE:
        raise ValueError(f'Escenario desconocido: {escenario!r}')
    if cultivo != 'YUCA':
        raise ValueError(
            'El escenario SIN_MEDIO_SEMESTRE solo está definido para yuca'
        )
    if 'n_semestres' not in dataframe.columns:
        raise ValueError('YUCA: falta la columna n_semestres')
    return dataframe[dataframe['n_semestres'].eq(2)].copy()


def extraer_medianas(
    entrenamiento: pd.DataFrame,
    cultivo: str,
) -> tuple[pd.Series, pd.Series]:
    """Calcula medianas por llave de predicción y por departamento."""
    llaves = LLAVES_PREDICCION[cultivo]
    historia = entrenamiento.groupby(llaves, dropna=False)['rendimiento_t_ha'].median()
    departamento = entrenamiento.groupby('cod_dep', dropna=False)['rendimiento_t_ha'].median()
    return historia, departamento


def _mapear_mediana_historia(
    prueba: pd.DataFrame,
    historia: pd.Series,
    cultivo: str,
) -> pd.Series:
    """Aplica la mediana por llave sin confundir filas repetidas."""
    llaves = LLAVES_PREDICCION[cultivo]
    if len(llaves) == 1:
        return prueba[llaves[0]].map(historia)

    lookup = historia.to_dict()
    valores = [
        lookup.get(tuple(fila), np.nan)
        for fila in prueba[llaves].itertuples(index=False, name=None)
    ]
    return pd.Series(valores, index=prueba.index, dtype=float)


def predecir_linea_base(
    dataframe: pd.DataFrame,
    cultivo: str,
    escenario: str = ESCENARIO_TODOS,
) -> pd.DataFrame:
    """Predice cada fila de prueba y registra de dónde salió cada valor."""
    if cultivo not in CULTIVOS:
        raise ValueError(f'Cultivo no soportado: {cultivo!r}')
    validar_columnas(dataframe, cultivo)
    validar_corte_temporal(dataframe, cultivo)
    datos = aplicar_escenario(dataframe, cultivo, escenario)

    entrenamiento = datos[datos['conjunto'].eq('ENTRENAMIENTO')].copy()
    prueba = datos[datos['conjunto'].eq('PRUEBA')].copy()
    if entrenamiento.empty:
        raise ValueError(f'{cultivo}: el entrenamiento quedó vacío')
    if prueba.empty:
        raise ValueError(f'{cultivo}: la prueba quedó vacía')

    historia, departamento = extraer_medianas(entrenamiento, cultivo)
    mediana_historia = _mapear_mediana_historia(prueba, historia, cultivo)
    mediana_departamento = prueba['cod_dep'].map(departamento)
    usa_respaldo = mediana_historia.isna()
    prediccion = mediana_historia.where(~usa_respaldo, mediana_departamento)

    sin_respaldo = prediccion.isna()
    if sin_respaldo.any():
        departamentos = sorted(prueba.loc[sin_respaldo, 'cod_dep'].unique().tolist())
        raise ValueError(
            f'{cultivo}: no existe mediana de entrenamiento para los '
            f'departamentos {departamentos}'
        )

    resultado = prueba.copy()
    resultado['cultivo'] = cultivo
    resultado['escenario'] = escenario
    resultado['mediana_historia_t_ha'] = mediana_historia
    resultado['mediana_departamento_t_ha'] = mediana_departamento
    resultado['rendimiento_predicho_t_ha'] = prediccion
    resultado['origen_prediccion'] = np.where(
        usa_respaldo,
        ORIGEN_RESPALDO,
        ORIGEN_HISTORIA,
    )
    resultado['error_absoluto_t_ha'] = (
        resultado['rendimiento_t_ha'] - resultado['rendimiento_predicho_t_ha']
    ).abs()
    resultado['error_porcentual'] = (
        resultado['error_absoluto_t_ha'] / resultado['rendimiento_t_ha'] * 100
    )
    resultado['region_caribe'] = resultado['cod_dep'].isin(CARIBE_COD_DEP)

    columnas_salida = [
        'cultivo',
        'escenario',
        'cod_dep',
        'departamento',
        'cod_mun',
        'municipio',
        'anio',
        'semestre',
    ]
    if 'sistema' in resultado.columns:
        columnas_salida.append('sistema')
    if 'n_semestres' in resultado.columns:
        columnas_salida.append('n_semestres')
    columnas_salida.extend(
        [
            'rendimiento_t_ha',
            'mediana_historia_t_ha',
            'mediana_departamento_t_ha',
            'rendimiento_predicho_t_ha',
            'origen_prediccion',
            'error_absoluto_t_ha',
            'error_porcentual',
            'region_caribe',
        ]
    )
    return resultado[columnas_salida].reset_index(drop=True)


def calcular_metricas(datos: pd.DataFrame) -> dict[str, float | int]:
    """Calcula MAE, RMSE y MAPE porcentual para las filas recibidas."""
    if datos.empty:
        raise ValueError('No se pueden calcular métricas sobre un conjunto vacío')
    real = datos['rendimiento_t_ha']
    predicho = datos['rendimiento_predicho_t_ha']
    error = real - predicho
    return {
        'filas': int(len(datos)),
        'mae_t_ha': float(error.abs().mean()),
        'rmse_t_ha': float(np.sqrt(np.mean(np.square(error)))),
        'mape_pct': float((error.abs() / real * 100).mean()),
    }


def _metricas_grupo(
    datos: pd.DataFrame,
    cultivo: str,
    escenario: str,
    corte: str,
    anio: int | None = None,
) -> dict[str, object]:
    """Construye una fila de métricas con contexto de corte y año."""
    metricas = calcular_metricas(datos)
    return {
        'cultivo': cultivo,
        'escenario': escenario,
        'corte': corte,
        'anio': anio,
        **metricas,
    }


def _grupos_por_corte(
    predicciones: pd.DataFrame,
) -> list[tuple[str, int | None, pd.DataFrame]]:
    """Divide las predicciones en los cortes geográficos y temporales."""
    grupos: list[tuple[str, int | None, pd.DataFrame]] = [
        ('TOTAL', None, predicciones)
    ]

    for anio, grupo in predicciones.groupby('anio', sort=True):
        grupos.append(('ANIO', int(anio), grupo))

    bolivar = predicciones[predicciones['cod_dep'].eq(COD_DEP_BOLIVAR)]
    if not bolivar.empty:
        grupos.append(('BOLIVAR', None, bolivar))

    caribe = predicciones[predicciones['region_caribe']]
    if not caribe.empty:
        grupos.append(('CARIBE', None, caribe))

    return grupos


def construir_metricas_cortes(
    predicciones: pd.DataFrame,
    cultivo: str,
    escenario: str,
) -> pd.DataFrame:
    """Reporta métricas total, por año, Bolívar y región Caribe."""
    filas = [
        _metricas_grupo(grupo, cultivo, escenario, corte, anio)
        for corte, anio, grupo in _grupos_por_corte(predicciones)
    ]
    return pd.DataFrame(filas)


def construir_metricas_origen(
    predicciones: pd.DataFrame,
    cultivo: str,
    escenario: str,
) -> pd.DataFrame:
    """Separa el error de filas con historia y filas con respaldo."""
    filas = []
    for corte, anio, grupo_corte in _grupos_por_corte(predicciones):
        for origen in (ORIGEN_HISTORIA, ORIGEN_RESPALDO):
            grupo = grupo_corte[grupo_corte['origen_prediccion'].eq(origen)]
            if grupo.empty:
                metricas = {
                    'filas': 0,
                    'mae_t_ha': np.nan,
                    'rmse_t_ha': np.nan,
                    'mape_pct': np.nan,
                }
            else:
                metricas = calcular_metricas(grupo)
            filas.append(
                {
                    'cultivo': cultivo,
                    'escenario': escenario,
                    'corte': corte,
                    'anio': anio,
                    'origen_prediccion': origen,
                    **metricas,
                }
            )
    return pd.DataFrame(filas)


def construir_resumen_respaldo(
    predicciones: pd.DataFrame,
    cultivo: str,
    escenario: str,
) -> dict[str, object]:
    """Calcula cobertura y porcentaje de filas que usaron respaldo."""
    total = len(predicciones)
    con_respaldo = int(
        predicciones['origen_prediccion'].eq(ORIGEN_RESPALDO).sum()
    )
    return {
        'cultivo': cultivo,
        'escenario': escenario,
        'filas_prueba': total,
        'filas_con_historia': total - con_respaldo,
        'filas_con_respaldo': con_respaldo,
        'pct_filas_con_respaldo': (
            100 * con_respaldo / total if total else np.nan
        ),
    }


def construir_resumen_markdown(
    cortes: pd.DataFrame,
    origen: pd.DataFrame,
    respaldo: pd.DataFrame,
) -> str:
    """Construye un resumen corto de los resultados de Fase B."""
    totales = cortes[cortes['corte'].eq('TOTAL')].copy()
    lineas = [
        '# Línea base de rendimiento (Fase B)',
        '',
        'Las medianas se calculan únicamente con entrenamiento (2007-2018) '
        'y se evalúan en prueba (2019-2024).',
        '',
        '## Métricas totales',
        '',
        '| Cultivo | Escenario | Filas | MAE (t/ha) | RMSE (t/ha) | MAPE (%) |',
        '|---|---|---:|---:|---:|---:|',
    ]
    for fila in totales.itertuples(index=False):
        lineas.append(
            f'| {fila.cultivo} | {fila.escenario} | {fila.filas} | '
            f'{fila.mae_t_ha:.3f} | {fila.rmse_t_ha:.3f} | '
            f'{fila.mape_pct:.2f} |'
        )

    lineas.extend(
        [
            '',
            '## Uso del respaldo y error por origen',
            '',
            '| Cultivo | Escenario | Con historia | Con respaldo | '
            'Respaldo (%) | MAE hist. | RMSE hist. | MAPE hist. (%) | '
            'MAE resp. | RMSE resp. | MAPE resp. (%) |',
            '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
        ]
    )
    for fila in respaldo.itertuples(index=False):
        errores = origen[
            origen['cultivo'].eq(fila.cultivo)
            & origen['escenario'].eq(fila.escenario)
            & origen['corte'].eq('TOTAL')
        ].set_index('origen_prediccion')
        historia = errores.loc[ORIGEN_HISTORIA]
        respaldo_error = errores.loc[ORIGEN_RESPALDO]
        lineas.append(
            f'| {fila.cultivo} | {fila.escenario} | '
            f'{fila.filas_con_historia} | {fila.filas_con_respaldo} | '
            f'{fila.pct_filas_con_respaldo:.2f} | '
            f'{historia["mae_t_ha"]:.3f} | {historia["rmse_t_ha"]:.3f} | '
            f'{historia["mape_pct"]:.2f} | '
            f'{respaldo_error["mae_t_ha"]:.3f} | '
            f'{respaldo_error["rmse_t_ha"]:.3f} | '
            f'{respaldo_error["mape_pct"]:.2f} |'
        )

    lineas.extend(
        [
            '',
            'El detalle por año de prueba, Bolívar y Caribe está en '
            '`metricas_linea_base_cortes.csv`. El error por origen incluye '
            'MAE, RMSE y MAPE en `metricas_linea_base_origen.csv`.',
            '',
        ]
    )
    return '\n'.join(lineas)


def evaluar_cultivos(directorio: Path = PROCESSED) -> tuple[pd.DataFrame, ...]:
    """Evalúa los tres cultivos y devuelve predicciones, cortes y resúmenes."""
    predicciones = []
    metricas_cortes = []
    metricas_origen = []
    resúmenes_respaldo = []

    for cultivo, archivo in CULTIVOS.items():
        ruta = directorio / f'modelo_{archivo}.pkl'
        if not ruta.exists():
            raise FileNotFoundError(
                f'No existe {ruta}. Ejecuta antes ml/src/preparar_modelo.py.'
            )
        datos = pd.read_pickle(ruta)
        escenarios = [ESCENARIO_TODOS]
        if cultivo == 'YUCA':
            escenarios.append(ESCENARIO_SIN_MEDIO_SEMESTRE)

        for escenario in escenarios:
            pred = predecir_linea_base(datos, cultivo, escenario)
            predicciones.append(pred)
            metricas_cortes.append(
                construir_metricas_cortes(pred, cultivo, escenario)
            )
            metricas_origen.append(
                construir_metricas_origen(pred, cultivo, escenario)
            )
            resúmenes_respaldo.append(
                construir_resumen_respaldo(pred, cultivo, escenario)
            )

    return (
        pd.concat(predicciones, ignore_index=True),
        pd.concat(metricas_cortes, ignore_index=True),
        pd.concat(metricas_origen, ignore_index=True),
        pd.DataFrame(resúmenes_respaldo),
    )


def main() -> None:
    """Ejecuta Fase B y guarda métricas, predicciones y resumen auditable."""
    REPORTS.mkdir(parents=True, exist_ok=True)
    predicciones, cortes, origen, respaldo = evaluar_cultivos()

    predicciones.to_csv(
        REPORTS / 'predicciones_linea_base.csv',
        index=False,
        encoding='utf-8-sig',
    )
    cortes.to_csv(
        REPORTS / 'metricas_linea_base_cortes.csv',
        index=False,
        encoding='utf-8-sig',
    )
    origen.to_csv(
        REPORTS / 'metricas_linea_base_origen.csv',
        index=False,
        encoding='utf-8-sig',
    )
    respaldo.to_csv(
        REPORTS / 'resumen_respaldo_linea_base.csv',
        index=False,
        encoding='utf-8-sig',
    )
    (REPORTS / 'resumen_linea_base.md').write_text(
        construir_resumen_markdown(cortes, origen, respaldo),
        encoding='utf-8',
    )

    print('Métricas de la línea base por corte:')
    print(cortes.to_string(index=False))
    print('\nMétricas separadas por origen de la predicción:')
    print(origen.to_string(index=False))
    print('\nUso del respaldo departamental:')
    print(respaldo.to_string(index=False))


if __name__ == '__main__':
    main()
