"""Evalúa Ridge, Random Forest e HistGradientBoosting para MAÍZ (Fase C).

Los hiperparámetros se seleccionan exclusivamente con cinco folds expansivos
2014--2018. La prueba 2019--2024 se abre una sola vez, después de congelar la
configuración elegida, y se compara con la línea base sobre las mismas filas.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

import evaluar_linea_base as eb


ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / 'data' / 'processed'
REPORTS = ROOT / 'ml' / 'reports'
FEATURES_MAIZ = PROCESSED / 'features_maiz.pkl'

ANIOS_VALIDACION = tuple(range(2014, 2019))
ENTRENAMIENTO_HASTA = 2018
PRUEBA_DESDE = 2019
RANDOM_STATE = 20261102

NUMERICAS = [
    'anio',
    'rendimiento_lag1_t_ha',
    'temperatura_2m_media_c',
    'soil_moisture_0_to_7cm_media',
]
CATEGORICAS = ['departamento', 'municipio', 'sistema', 'semestre']
PREDICTORES = NUMERICAS + CATEGORICAS
LLAVE_UNIDAD = ['cod_dep', 'cod_mun', 'anio', 'semestre', 'sistema']
MODELOS = ['Ridge', 'RandomForest', 'HistGradientBoosting']


def configuraciones() -> list[dict[str, Any]]:
    """Devuelve tres configuraciones por familia para cerrar en una sesión."""
    candidatos: list[dict[str, Any]] = []
    for alpha in [1.0, 10.0, 100.0]:
        candidatos.append(
            {
                'modelo': 'Ridge',
                'parametros': {'alpha': alpha},
            }
        )
    for profundidad, hojas in [(None, 1), (20, 1), (20, 5)]:
        candidatos.append(
            {
                'modelo': 'RandomForest',
                'parametros': {
                    'n_estimators': 200,
                    'max_depth': profundidad,
                    'min_samples_leaf': hojas,
                },
            }
        )
    for aprendizaje, hojas in [(0.05, 15), (0.10, 15), (0.10, 31)]:
        candidatos.append(
            {
                'modelo': 'HistGradientBoosting',
                'parametros': {
                    'max_iter': 250,
                    'learning_rate': aprendizaje,
                    'max_leaf_nodes': hojas,
                    'l2_regularization': 1.0,
                },
            }
        )
    return candidatos


def identificador_configuracion(modelo: str, parametros: dict[str, Any]) -> str:
    """Construye un identificador estable para cada configuración."""
    partes = [modelo]
    partes.extend(f'{clave}={valor}' for clave, valor in sorted(parametros.items()))
    return '|'.join(partes)


def construir_pipeline(modelo: str, parametros: dict[str, Any]) -> Pipeline:
    """Crea el pipeline; el imputador se ajusta exclusivamente al fold."""
    if modelo not in MODELOS:
        raise ValueError(f'Modelo no soportado: {modelo!r}')

    denso = modelo == 'HistGradientBoosting'
    pasos_numericos: list[tuple[str, Any]] = [
        ('imputador', SimpleImputer(strategy='median', add_indicator=True))
    ]
    if modelo == 'Ridge':
        pasos_numericos.append(('escalador', StandardScaler()))
    pasos_categoricos: list[tuple[str, Any]] = [
        ('imputador', SimpleImputer(strategy='most_frequent')),
        (
            'codificador',
            OneHotEncoder(
                handle_unknown='ignore',
                sparse_output=not denso,
                dtype=np.float32,
            ),
        ),
    ]
    preprocesador = ColumnTransformer(
        transformers=[
            ('numericas', Pipeline(pasos_numericos), NUMERICAS),
            ('categoricas', Pipeline(pasos_categoricos), CATEGORICAS),
        ],
        remainder='drop',
        sparse_threshold=0.30,
        verbose_feature_names_out=False,
    )

    if modelo == 'Ridge':
        estimador = Ridge(solver='lsqr', **parametros)
    elif modelo == 'RandomForest':
        estimador = RandomForestRegressor(
            n_jobs=-1,
            random_state=RANDOM_STATE,
            **parametros,
        )
    else:
        estimador = HistGradientBoostingRegressor(
            random_state=RANDOM_STATE,
            **parametros,
        )
    return Pipeline([('preprocesador', preprocesador), ('modelo', estimador)])


def validar_features(features: pd.DataFrame) -> None:
    """Verifica integridad temporal y las features permitidas."""
    requeridas = set(PREDICTORES) | {
        'cod_dep',
        'cod_mun',
        'rendimiento_t_ha',
        'conjunto',
    }
    faltantes = requeridas - set(features.columns)
    if faltantes:
        raise ValueError(f'Faltan columnas en features_maiz: {sorted(faltantes)}')
    if features.duplicated(LLAVE_UNIDAD).any():
        raise ValueError('features_maiz contiene llaves de unidad duplicadas')
    if not np.isfinite(features['rendimiento_t_ha']).all():
        raise ValueError('Hay rendimientos no finitos en features_maiz')
    if (features['rendimiento_t_ha'] <= 0).any():
        raise ValueError('Hay rendimientos no positivos en features_maiz')

    entrenamiento = features[features['conjunto'].eq('ENTRENAMIENTO')]
    prueba = features[features['conjunto'].eq('PRUEBA')]
    if entrenamiento.empty or prueba.empty:
        raise ValueError('Los conjuntos ENTRENAMIENTO y PRUEBA deben estar presentes')
    if entrenamiento['anio'].max() > ENTRENAMIENTO_HASTA:
        raise ValueError('El entrenamiento contiene años posteriores a 2018')
    if prueba['anio'].min() < PRUEBA_DESDE:
        raise ValueError('La prueba contiene años anteriores a 2019')


def crear_folds(features: pd.DataFrame) -> list[dict[str, Any]]:
    """Crea folds expansivos: entrena hasta t-1 y valida el año t."""
    folds: list[dict[str, Any]] = []
    for anio_validacion in ANIOS_VALIDACION:
        entrenamiento = features[
            features['conjunto'].eq('ENTRENAMIENTO')
            & features['anio'].lt(anio_validacion)
        ].copy()
        validacion = features[
            features['conjunto'].eq('ENTRENAMIENTO')
            & features['anio'].eq(anio_validacion)
        ].copy()
        if entrenamiento.empty or validacion.empty:
            raise ValueError(
                f'El fold {anio_validacion} no tiene entrenamiento o validación'
            )
        if entrenamiento['anio'].max() >= anio_validacion:
            raise AssertionError('El fold de entrenamiento incluye el año validado')
        folds.append(
            {
                'anio_validacion': anio_validacion,
                'anio_max_entrenamiento': int(entrenamiento['anio'].max()),
                'entrenamiento': entrenamiento,
                'validacion': validacion,
            }
        )
    return folds


def _metricas(real: pd.Series, predicho: np.ndarray) -> dict[str, float | int]:
    """Calcula las métricas con la misma función de la línea base."""
    datos = pd.DataFrame(
        {
            'rendimiento_t_ha': real.to_numpy(),
            'rendimiento_predicho_t_ha': np.asarray(predicho),
        }
    )
    return eb.calcular_metricas(datos)


def evaluar_configuraciones(
    features: pd.DataFrame,
    folds: list[dict[str, Any]],
) -> pd.DataFrame:
    """Evalúa cada configuración en los cinco folds sin abrir la prueba."""
    filas: list[dict[str, object]] = []
    for candidato in configuraciones():
        modelo = str(candidato['modelo'])
        parametros = dict(candidato['parametros'])
        identificador = identificador_configuracion(modelo, parametros)
        print(f'  {identificador}')
        for fold in folds:
            pipeline = construir_pipeline(modelo, parametros)
            entrenamiento = fold['entrenamiento']
            validacion = fold['validacion']
            pipeline.fit(
                entrenamiento[PREDICTORES],
                entrenamiento['rendimiento_t_ha'],
            )
            predicho = pipeline.predict(validacion[PREDICTORES])
            metricas = _metricas(validacion['rendimiento_t_ha'], predicho)
            filas.append(
                {
                    'configuracion': identificador,
                    'modelo': modelo,
                    'parametros': json.dumps(parametros, sort_keys=True),
                    'anio_validacion': int(fold['anio_validacion']),
                    'anio_max_entrenamiento': int(
                        fold['anio_max_entrenamiento']
                    ),
                    'filas_entrenamiento': int(len(entrenamiento)),
                    'filas_validacion': int(len(validacion)),
                    **metricas,
                }
            )
            print(
                f'    fold {fold["anio_validacion"]}: '
                f'MAE={metricas["mae_t_ha"]:.4f}, '
                f'RMSE={metricas["rmse_t_ha"]:.4f}'
            )
    return pd.DataFrame(filas)


def seleccionar_configuraciones(validacion: pd.DataFrame) -> pd.DataFrame:
    """Selecciona por MAE medio; RMSE y MAPE medio resuelven empates."""
    agregado = (
        validacion.groupby(['configuracion', 'modelo', 'parametros'], as_index=False)
        .agg(
            mae_medio=('mae_t_ha', 'mean'),
            rmse_medio=('rmse_t_ha', 'mean'),
            mape_medio=('mape_pct', 'mean'),
            mae_desviacion=('mae_t_ha', 'std'),
        )
    )
    agregado = agregado.sort_values(
        [
            'modelo',
            'mae_medio',
            'rmse_medio',
            'mape_medio',
            'mae_desviacion',
            'configuracion',
        ],
        kind='stable',
    )
    seleccionado = agregado.groupby('modelo', sort=False).head(1).copy()
    seleccionado['seleccionada'] = True
    ids_seleccionados = set(seleccionado['configuracion'])
    agregado['seleccionada'] = agregado['configuracion'].isin(ids_seleccionados)
    return agregado.sort_values(
        ['modelo', 'mae_medio', 'rmse_medio']
    ).reset_index(drop=True)


def _validar_filas_identicas(
    referencia: pd.DataFrame,
    candidato: pd.DataFrame,
    nombre: str,
) -> None:
    """Exige las mismas claves y rendimientos reales en ambas predicciones."""
    for dataframe, etiqueta in [
        (referencia, 'referencia'),
        (candidato, nombre),
    ]:
        if dataframe.duplicated(LLAVE_UNIDAD).any():
            raise ValueError(f'{etiqueta} contiene llaves duplicadas')
    izquierdo = referencia[LLAVE_UNIDAD + ['rendimiento_t_ha']].sort_values(
        LLAVE_UNIDAD
    ).reset_index(drop=True)
    derecho = candidato[LLAVE_UNIDAD + ['rendimiento_t_ha']].sort_values(
        LLAVE_UNIDAD
    ).reset_index(drop=True)
    if not izquierdo.equals(derecho):
        raise AssertionError(
            f'{nombre} no usa exactamente las mismas filas que la referencia'
        )


def _marco_prediccion(
    filas: pd.DataFrame,
    predicho: np.ndarray,
    modelo: str,
    configuracion: str,
) -> pd.DataFrame:
    """Construye el formato común de predicciones y errores."""
    resultado = filas[LLAVE_UNIDAD + ['rendimiento_t_ha']].copy()
    resultado['modelo'] = modelo
    resultado['configuracion'] = configuracion
    resultado['rendimiento_predicho_t_ha'] = np.asarray(predicho)
    resultado['error_absoluto_t_ha'] = (
        resultado['rendimiento_t_ha']
        - resultado['rendimiento_predicho_t_ha']
    ).abs()
    resultado['error_porcentual'] = (
        resultado['error_absoluto_t_ha']
        / resultado['rendimiento_t_ha']
        * 100
    )
    return resultado


def evaluar_prueba_final(
    features: pd.DataFrame,
    seleccion: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Abre 2019--2024 una vez y compara los cuatro métodos."""
    entrenamiento = features[
        features['conjunto'].eq('ENTRENAMIENTO')
        & features['anio'].le(ENTRENAMIENTO_HASTA)
    ].copy()
    prueba = features[
        features['conjunto'].eq('PRUEBA')
        & features['anio'].ge(PRUEBA_DESDE)
    ].copy()
    if entrenamiento.empty or prueba.empty:
        raise ValueError('No hay entrenamiento o prueba para la evaluación final')

    base = eb.predecir_linea_base(features, 'MAIZ')
    base = base[
        LLAVE_UNIDAD + ['rendimiento_t_ha', 'rendimiento_predicho_t_ha']
    ].copy()
    predicciones = [
        _marco_prediccion(
            prueba,
            base['rendimiento_predicho_t_ha'].to_numpy(),
            'LineaBase',
            'mediana_municipio_sistema',
        )
    ]

    seleccionadas = seleccion[seleccion['seleccionada'].eq(True)]
    if set(seleccionadas['modelo']) != set(MODELOS):
        raise AssertionError('Debe existir una configuración elegida por modelo')

    for fila in seleccionadas.itertuples(index=False):
        parametros = json.loads(str(fila.parametros))
        pipeline = construir_pipeline(str(fila.modelo), parametros)
        pipeline.fit(
            entrenamiento[PREDICTORES],
            entrenamiento['rendimiento_t_ha'],
        )
        predicho = pipeline.predict(prueba[PREDICTORES])
        predicciones.append(
            _marco_prediccion(
                prueba,
                predicho,
                str(fila.modelo),
                str(fila.configuracion),
            )
        )

    todas = pd.concat(predicciones, ignore_index=True)
    referencia = predicciones[0]
    for modelo in MODELOS:
        candidato = todas[todas['modelo'].eq(modelo)].copy()
        _validar_filas_identicas(referencia, candidato, modelo)

    filas_metricas: list[dict[str, object]] = []
    for modelo, grupo in todas.groupby('modelo', sort=False):
        metricas = eb.calcular_metricas(grupo)
        configuracion = str(grupo['configuracion'].iloc[0])
        filas_metricas.append(
            {
                'modelo': modelo,
                'configuracion': configuracion,
                **metricas,
            }
        )
    tabla = pd.DataFrame(filas_metricas)
    return todas, tabla



def construir_metadatos(
    seleccion: pd.DataFrame,
    predicciones: pd.DataFrame,
    features: pd.DataFrame,
) -> dict[str, object]:
    """Documenta el protocolo reproducible y las decisiones de esta ejecución."""
    seleccionadas = seleccion[seleccion['seleccionada'].eq(True)]
    faltantes_clima = int(
        (
            features['temperatura_2m_media_c'].isna()
            | features['soil_moisture_0_to_7cm_media'].isna()
        ).sum()
    )
    return {
        'cultivo': 'MAIZ',
        'folds_validacion': list(ANIOS_VALIDACION),
        'protocolo': (
            'folds expansivos: entrenamiento <= t-1 y validación en t; '
            'selección cerrada antes de abrir 2019--2024'
        ),
        'criterio_seleccion': (
            'MAE medio; desempates por RMSE medio, MAPE medio y desviación MAE'
        ),
        'configuraciones_por_modelo': {
            str(modelo): int((seleccion['modelo'] == modelo).sum())
            for modelo in MODELOS
        },
        'configuraciones_seleccionadas': {
            str(fila.modelo): {
                'configuracion': str(fila.configuracion),
                'parametros': json.loads(str(fila.parametros)),
                'mae_medio_validacion': float(fila.mae_medio),
                'rmse_medio_validacion': float(fila.rmse_medio),
                'mape_medio_validacion': float(fila.mape_medio),
            }
            for fila in seleccionadas.itertuples(index=False)
        },
        'filas_entrenamiento_final': int(
            features['conjunto'].eq('ENTRENAMIENTO').sum()
        ),
        'filas_prueba_por_modelo': int(
            predicciones['modelo'].eq('LineaBase').sum()
        ),
        'filas_clima_faltante': faltantes_clima,
        'imputacion_clima_dentro_del_fold': True,
    }


def construir_resumen_markdown(tabla: pd.DataFrame) -> str:
    """Construye el resumen breve de la prueba final de MAÍZ."""
    lineas = [
        '# Modelos de MAÍZ (Fase C, alcance reducido)',
        '',
        'Los hiperparámetros se seleccionaron con cinco folds expansivos '
        '2014--2018. La prueba 2019--2024 se evaluó una sola vez.',
        '',
        '| Modelo | Filas | MAE (t/ha) | RMSE (t/ha) | MAPE (%) |',
        '|---|---:|---:|---:|---:|',
    ]
    for fila in tabla.itertuples(index=False):
        lineas.append(
            f'| {fila.modelo} | {fila.filas:,} | {fila.mae_t_ha:.3f} | '
            f'{fila.rmse_t_ha:.3f} | {fila.mape_pct:.2f} |'
        )
    lineas.append('')
    return '\n'.join(lineas)




def main() -> None:
    """Ejecuta selección cerrada y una única evaluación de prueba."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--features',
        type=Path,
        default=FEATURES_MAIZ,
        help='Pickle de features de MAÍZ.',
    )
    parser.add_argument(
        '--reports',
        type=Path,
        default=REPORTS,
        help='Directorio donde se escriben los reportes.',
    )
    args = parser.parse_args()

    if not args.features.exists():
        raise FileNotFoundError(
            f'No existe {args.features}. Ejecuta antes ml/src/preparar_features_maiz.py.'
        )
    features = pd.read_pickle(args.features)
    validar_features(features)
    folds = crear_folds(features)

    print('Seleccionando 9 configuraciones en folds 2014-2018...')
    validacion = evaluar_configuraciones(features, folds)
    seleccion = seleccionar_configuraciones(validacion)
    args.reports.mkdir(parents=True, exist_ok=True)
    validacion.to_csv(
        args.reports / 'validacion_folds_modelos_maiz.csv',
        index=False,
        encoding='utf-8-sig',
    )
    seleccion.to_csv(
        args.reports / 'seleccion_hiperparametros_maiz.csv',
        index=False,
        encoding='utf-8-sig',
    )

    print('Configuraciones congeladas; evaluando prueba 2019-2024 una vez...')
    predicciones, tabla = evaluar_prueba_final(features, seleccion)
    predicciones.to_csv(
        args.reports / 'predicciones_modelos_maiz.csv',
        index=False,
        encoding='utf-8-sig',
    )
    tabla.to_csv(
        args.reports / 'metricas_modelos_maiz.csv',
        index=False,
        encoding='utf-8-sig',
    )
    (args.reports / 'resumen_modelos_maiz.md').write_text(
        construir_resumen_markdown(tabla),
        encoding='utf-8',
    )
    metadatos = construir_metadatos(seleccion, predicciones, features)
    (args.reports / 'metadatos_modelos_maiz.json').write_text(
        json.dumps(metadatos, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )

    print('\nMétricas totales sobre 2019-2024:')
    print(tabla.to_string(index=False))
    print(f'\nArtefactos: {args.reports}')


if __name__ == '__main__':
    main()
