"""Diagnóstico post hoc del modelo de inferencia de MAÍZ.

Este script no selecciona, reconfigura ni recalibra el modelo. Usa el
Random Forest congelado en Fase D y la prueba 2019--2024 para medir:

1. cobertura empírica del rango q10--q90 congelado;
2. MAE y RMSE por año para Bolívar;
3. importancia de variables por permutación; y
4. un bootstrap clusterizado por municipios de la diferencia de MAE.

Todos los resultados se escriben en ``ml/reports``.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance

import evaluar_linea_base as eb
import evaluar_modelos_maiz as em


ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / 'data' / 'processed'
REPORTS = ROOT / 'ml' / 'reports'
FEATURES_MAIZ = PROCESSED / 'features_maiz.pkl'

ARCHIVO_PREDICCIONES = REPORTS / 'predicciones_modelos_maiz.csv'
ARCHIVO_SELECCION = REPORTS / 'seleccion_hiperparametros_maiz.csv'
ARCHIVO_METADATOS_INFERENCIA = REPORTS / 'metadatos_inferencia_maiz.json'

ARCHIVO_COBERTURA = REPORTS / 'cobertura_rango_prueba_maiz.csv'
ARCHIVO_COBERTURA_DETALLE = REPORTS / 'cobertura_rango_prueba_detalle_maiz.csv'
ARCHIVO_METRICAS_BOLIVAR = REPORTS / 'metricas_bolivar_anual_maiz.csv'
ARCHIVO_IMPORTANCIA = REPORTS / 'importancia_permutacion_maiz.csv'
ARCHIVO_IMPORTANCIA_DETALLE = REPORTS / 'importancia_permutacion_detalle_maiz.csv'
ARCHIVO_BOOTSTRAP = REPORTS / 'bootstrap_diferencia_mae_maiz.csv'
ARCHIVO_BOOTSTRAP_RESUMEN = REPORTS / 'bootstrap_resumen_mae_maiz.csv'
ARCHIVO_METADATOS = REPORTS / 'diagnostico_inferencia_maiz.json'
ARCHIVO_RESUMEN = REPORTS / 'resumen_diagnostico_inferencia_maiz.md'

MODELO_FINAL = 'RandomForest'
LINEA_BASE = 'LineaBase'
CONFIGURACION_LINEA_BASE = 'mediana_municipio_sistema'
NUM_REPETICIONES_PERMUTACION = 30
NUM_RESAMPLEOS_BOOTSTRAP = 5_000
SEMILLA_PERMUTACION = 20261103
SEMILLA_BOOTSTRAP = 20261104
PERCENTILES_BOOTSTRAP = (0.025, 0.975)


def validar_configuracion_congelada(
    metadatos: dict[str, Any],
    seleccion: pd.DataFrame,
) -> dict[str, Any]:
    """Verifica que RF y sus parámetros sigan congelados como en Fase D."""
    if metadatos.get('modelo_para_inferencia') != MODELO_FINAL:
        raise ValueError('El diagnóstico requiere Random Forest como modelo final')
    if metadatos.get('modelo_seleccionado_por_folds') != MODELO_FINAL:
        raise ValueError('El modelo seleccionado por folds no es Random Forest')

    seleccionadas = seleccion[
        seleccion['modelo'].eq(MODELO_FINAL)
        & seleccion['seleccionada'].eq(True)
    ]
    if len(seleccionadas) != 1:
        raise ValueError('Debe existir exactamente una configuración RF seleccionada')
    fila = seleccionadas.iloc[0]
    parametros_seleccion = json.loads(str(fila['parametros']))
    parametros_inferencia = metadatos.get('parametros_inferencia')
    if parametros_seleccion != parametros_inferencia:
        raise ValueError('Los parámetros de inferencia no coinciden con la selección')
    configuracion = em.identificador_configuracion(MODELO_FINAL, parametros_seleccion)
    if metadatos.get('configuracion_seleccionada_por_folds') != configuracion:
        raise ValueError('La configuración de inferencia no coincide con la selección')
    return parametros_seleccion


def _validar_predicciones_congeladas(
    predicciones: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Extrae y valida las predicciones RF y línea base de Fase C."""
    requeridas = {
        *em.LLAVE_UNIDAD,
        'rendimiento_t_ha',
        'modelo',
        'configuracion',
        'rendimiento_predicho_t_ha',
    }
    faltantes = requeridas - set(predicciones.columns)
    if faltantes:
        raise ValueError(f'Faltan columnas en predicciones: {sorted(faltantes)}')

    base = predicciones[predicciones['modelo'].eq(LINEA_BASE)].copy()
    rf = predicciones[predicciones['modelo'].eq(MODELO_FINAL)].copy()
    if base.empty or rf.empty:
        raise ValueError('Faltan predicciones de RF o de la línea base')
    if base['configuracion'].nunique() != 1 or str(
        base['configuracion'].iloc[0]
    ) != CONFIGURACION_LINEA_BASE:
        raise ValueError('La configuración de la línea base no es la esperada')
    if rf['configuracion'].nunique() != 1:
        raise ValueError('RF tiene más de una configuración en las predicciones')
    if base.duplicated(em.LLAVE_UNIDAD).any() or rf.duplicated(em.LLAVE_UNIDAD).any():
        raise ValueError('Hay unidades duplicadas en las predicciones')
    return base, rf


def alinear_predicciones(
    base: pd.DataFrame,
    rf: pd.DataFrame,
) -> pd.DataFrame:
    """Alinea RF y línea base por la llave de unidad de la prueba."""
    llave = em.LLAVE_UNIDAD
    izquierda = base[
        llave + ['rendimiento_t_ha', 'rendimiento_predicho_t_ha']
    ].rename(columns={'rendimiento_predicho_t_ha': 'prediccion_linea_base_t_ha'})
    derecha = rf[
        llave + ['rendimiento_t_ha', 'rendimiento_predicho_t_ha']
    ].rename(columns={'rendimiento_predicho_t_ha': 'prediccion_random_forest_t_ha'})
    prueba = izquierda.merge(
        derecha,
        on=llave,
        how='inner',
        validate='one_to_one',
        suffixes=('_base', '_rf'),
    )
    if len(prueba) != len(base) or len(prueba) != len(rf):
        raise ValueError('RF y la línea base no contienen las mismas unidades')
    if not np.allclose(
        prueba['rendimiento_t_ha_base'],
        prueba['rendimiento_t_ha_rf'],
        rtol=0.0,
        atol=1e-12,
    ):
        raise ValueError('RF y la línea base no tienen el mismo valor observado')
    prueba = prueba.rename(
        columns={'rendimiento_t_ha_base': 'rendimiento_t_ha'}
    ).drop(columns=['rendimiento_t_ha_rf'])
    return prueba.sort_values(llave, kind='stable').reset_index(drop=True)


def construir_rango_desde_residuales(
    predicho: np.ndarray,
    q10: float,
    q90: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Aplica a la predicción el mismo rango q10--q90 de la inferencia."""
    if q10 > q90:
        raise ValueError('q10 no puede ser mayor que q90')
    esperado = np.maximum(np.asarray(predicho, dtype=float), 0.0)
    inferior = np.maximum(esperado + q10, 0.0)
    superior = np.maximum(esperado + q90, inferior)
    return esperado, inferior, superior


def calcular_cobertura_rango(
    prueba: pd.DataFrame,
    q10: float,
    q90: float,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Calcula cobertura empírica total y por año sin recalibrar."""
    predicho = prueba['prediccion_random_forest_t_ha'].to_numpy(dtype=float)
    _, inferior, superior = construir_rango_desde_residuales(
        predicho,
        q10,
        q90,
    )
    real = prueba['rendimiento_t_ha'].to_numpy(dtype=float)
    diagnostico = prueba.copy()
    diagnostico['rango_inferior_t_ha'] = inferior
    diagnostico['rango_superior_t_ha'] = superior
    diagnostico['dentro_rango'] = (real >= inferior) & (real <= superior)
    diagnostico['por_debajo'] = real < inferior
    diagnostico['por_encima'] = real > superior

    grupos: list[tuple[str, int | None, pd.DataFrame]] = [
        ('TOTAL', None, diagnostico)
    ]
    grupos.extend(
        ('ANIO', int(anio), grupo)
        for anio, grupo in diagnostico.groupby('anio', sort=True)
    )
    filas: list[dict[str, object]] = []
    for corte, anio, grupo in grupos:
        dentro_grupo = grupo['dentro_rango']
        filas.append(
            {
                'corte': corte,
                'anio': anio,
                'filas': int(len(grupo)),
                'dentro_rango': int(dentro_grupo.sum()),
                'fuera_rango': int((~dentro_grupo).sum()),
                'por_debajo': int(grupo['por_debajo'].sum()),
                'por_encima': int(grupo['por_encima'].sum()),
                'cobertura_pct': float(dentro_grupo.mean() * 100),
                'q10_residual_t_ha': float(q10),
                'q90_residual_t_ha': float(q90),
                'rango_inferior_medio_t_ha': float(
                    grupo['rango_inferior_t_ha'].mean()
                ),
                'rango_superior_medio_t_ha': float(
                    grupo['rango_superior_t_ha'].mean()
                ),
            }
        )
    cobertura = pd.DataFrame(filas)
    cobertura['anio'] = cobertura['anio'].astype('Int64')
    detalle = diagnostico[
        em.LLAVE_UNIDAD
        + [
            'rendimiento_t_ha',
            'prediccion_random_forest_t_ha',
            'rango_inferior_t_ha',
            'rango_superior_t_ha',
            'dentro_rango',
            'por_debajo',
            'por_encima',
        ]
    ].copy()
    return cobertura, detalle


def calcular_metricas_bolivar_anual(
    prueba: pd.DataFrame,
) -> pd.DataFrame:
    """Calcula MAE y RMSE por año para Bolívar y cada modelo."""
    bolivar = prueba[prueba['cod_dep'].eq(eb.COD_DEP_BOLIVAR)].copy()
    if bolivar.empty:
        raise ValueError('No hay filas de prueba para Bolívar')
    modelos = [
        (LINEA_BASE, 'prediccion_linea_base_t_ha'),
        (MODELO_FINAL, 'prediccion_random_forest_t_ha'),
    ]
    filas: list[dict[str, object]] = []
    for anio, grupo in bolivar.groupby('anio', sort=True):
        for modelo, columna in modelos:
            metricas = eb.calcular_metricas(
                pd.DataFrame(
                    {
                        'rendimiento_t_ha': grupo['rendimiento_t_ha'],
                        'rendimiento_predicho_t_ha': grupo[columna],
                    }
                )
            )
            filas.append(
                {
                    'departamento': 'BOLIVAR',
                    'anio': int(anio),
                    'modelo': modelo,
                    'filas': metricas['filas'],
                    'mae_t_ha': metricas['mae_t_ha'],
                    'rmse_t_ha': metricas['rmse_t_ha'],
                }
            )
    return pd.DataFrame(filas)


def calcular_importancia_permutacion(
    pipeline: Any,
    prueba_features: pd.DataFrame,
    objetivo: pd.Series,
    *,
    num_repeticiones: int = NUM_REPETICIONES_PERMUTACION,
    semilla: int = SEMILLA_PERMUTACION,
) -> tuple[pd.DataFrame, pd.DataFrame, float]:
    """Calcula importancia sobre la prueba con la métrica de MAE."""
    resultado = permutation_importance(
        pipeline,
        prueba_features[em.PREDICTORES],
        objetivo,
        scoring='neg_mean_absolute_error',
        n_repeats=num_repeticiones,
        random_state=semilla,
        n_jobs=1,
    )
    mae_base = float(
        eb.calcular_metricas(
            pd.DataFrame(
                {
                    'rendimiento_t_ha': objetivo,
                    'rendimiento_predicho_t_ha': pipeline.predict(
                        prueba_features[em.PREDICTORES]
                    ),
                }
            )
        )['mae_t_ha']
    )
    resumen = pd.DataFrame(
        {
            'variable': em.PREDICTORES,
            'importancia_mae_t_ha': resultado.importances_mean,
            'desviacion_importancia_t_ha': resultado.importances_std,
        }
    ).sort_values(
        ['importancia_mae_t_ha', 'variable'],
        ascending=[False, True],
        kind='stable',
    )
    resumen.insert(0, 'posicion', np.arange(1, len(resumen) + 1))
    resumen['top_10'] = resumen['posicion'].le(10)
    detalle = pd.DataFrame(
        {
            'variable': np.repeat(em.PREDICTORES, num_repeticiones),
            'repeticion': np.tile(
                np.arange(1, num_repeticiones + 1),
                len(em.PREDICTORES),
            ),
            'importancia_mae_t_ha': resultado.importances.reshape(-1),
        }
    )
    return resumen, detalle, mae_base


def calcular_bootstrap_diferencia_mae(
    prueba: pd.DataFrame,
    *,
    num_resampleos: int = NUM_RESAMPLEOS_BOOTSTRAP,
    semilla: int = SEMILLA_BOOTSTRAP,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Bootstrap clusterizado por municipio de MAE base menos MAE RF."""
    datos = prueba[
        [
            'cod_dep',
            'cod_mun',
            'rendimiento_t_ha',
            'prediccion_linea_base_t_ha',
            'prediccion_random_forest_t_ha',
        ]
    ].copy()
    datos['error_absoluto_base'] = (
        datos['rendimiento_t_ha'] - datos['prediccion_linea_base_t_ha']
    ).abs()
    datos['error_absoluto_rf'] = (
        datos['rendimiento_t_ha'] - datos['prediccion_random_forest_t_ha']
    ).abs()
    agregado = datos.groupby(['cod_dep', 'cod_mun'], sort=True).agg(
        filas=('rendimiento_t_ha', 'size'),
        suma_error_base=('error_absoluto_base', 'sum'),
        suma_error_rf=('error_absoluto_rf', 'sum'),
    )
    filas = agregado['filas'].to_numpy(dtype=float)
    sumas_base = agregado['suma_error_base'].to_numpy(dtype=float)
    sumas_rf = agregado['suma_error_rf'].to_numpy(dtype=float)
    generador = np.random.default_rng(semilla)
    replicas: list[dict[str, float | int]] = []
    bloque = 250
    for inicio in range(0, num_resampleos, bloque):
        cantidad = min(bloque, num_resampleos - inicio)
        indices = generador.integers(
            0,
            len(agregado),
            size=(cantidad, len(agregado)),
        )
        filas_muestra = filas[indices].sum(axis=1)
        mae_base = sumas_base[indices].sum(axis=1) / filas_muestra
        mae_rf = sumas_rf[indices].sum(axis=1) / filas_muestra
        for indice in range(cantidad):
            replicas.append(
                {
                    'replicacion': int(inicio + indice + 1),
                    'mae_linea_base_t_ha': float(mae_base[indice]),
                    'mae_random_forest_t_ha': float(mae_rf[indice]),
                    'diferencia_mae_t_ha': float(
                        mae_base[indice] - mae_rf[indice]
                    ),
                }
            )
    detalle = pd.DataFrame(replicas)
    mae_base_observado = float(datos['error_absoluto_base'].mean())
    mae_rf_observado = float(datos['error_absoluto_rf'].mean())
    diferencia = detalle['diferencia_mae_t_ha']
    limite_inferior = float(diferencia.quantile(PERCENTILES_BOOTSTRAP[0]))
    limite_superior = float(diferencia.quantile(PERCENTILES_BOOTSTRAP[1]))
    resumen = pd.DataFrame(
        [
            {
                'metodo': 'bootstrap_percentil_95_cluster_municipios',
                'direccion_diferencia': 'MAE_linea_base_menos_MAE_RandomForest',
                'municipios': int(len(agregado)),
                'filas_prueba': int(len(datos)),
                'resampleos': int(num_resampleos),
                'semilla': int(semilla),
                'mae_linea_base_t_ha': mae_base_observado,
                'mae_random_forest_t_ha': mae_rf_observado,
                'diferencia_mae_t_ha': mae_base_observado - mae_rf_observado,
                'ic_inferior_95_t_ha': limite_inferior,
                'ic_superior_95_t_ha': limite_superior,
                'proporcion_replicaciones_mejora_rf': float((diferencia > 0).mean()),
                'proporcion_replicaciones_no_mejora': float((diferencia <= 0).mean()),
                'mejora_distinguible_del_azar_95': bool(limite_inferior > 0),
            }
        ]
    )
    return detalle, resumen


def construir_resumen(
    cobertura: pd.DataFrame,
    metricas_bolivar: pd.DataFrame,
    importancia: pd.DataFrame,
    bootstrap: pd.DataFrame,
    q10: float,
    q90: float,
) -> str:
    """Construye un resumen corto con los cuatro diagnósticos de MAÍZ."""
    total = cobertura[cobertura['corte'].eq('TOTAL')].iloc[0]
    anual = cobertura[cobertura['corte'].eq('ANIO')]
    boot = bootstrap.iloc[0]
    lineas = [
        '# Diagnóstico post hoc de inferencia de MAÍZ',
        '',
        'Diagnóstico del Random Forest congelado en la prueba 2019-2024. '
        'No se cambió el modelo, no se ajustó el rango y no se usaron la '
        'prueba para seleccionar ni recalibrar nada.',
        '',
        '## 1. Cobertura real del rango q10-q90',
        '',
        f'Los residuales congelados son q10={q10:.3f} y q90={q90:.3f} t/ha; '
        'se aplicaron a las predicciones RF de prueba con el mismo recorte en '
        'cero de la tabla de inferencia.',
        '',
        '| Corte | Año | Filas | Dentro | Cobertura (%) |',
        '|---|---:|---:|---:|---:|',
        f'| Total | — | {int(total["filas"]):,} | {int(total["dentro_rango"]):,} | '
        f'{total["cobertura_pct"]:.2f} |',
    ]
    for fila in anual.itertuples(index=False):
        lineas.append(
            f'| Año | {int(fila.anio)} | {int(fila.filas):,} | '
            f'{int(fila.dentro_rango):,} | {fila.cobertura_pct:.2f} |'
        )
    lineas.extend(
        [
            '',
            (
                f'La cobertura observada quedó '
                f'{80.0 - float(total["cobertura_pct"]):.2f} puntos porcentuales '
                'por debajo del objetivo nominal de 80 %. No se recalibró el rango.'
            ),
            '',
            '## 2. MAE y RMSE por año en Bolívar',
            '',
            '| Año | Modelo | Filas | MAE (t/ha) | RMSE (t/ha) |',
            '|---:|---|---:|---:|---:|',
        ]
    )
    for fila in metricas_bolivar.itertuples(index=False):
        lineas.append(
            f'| {int(fila.anio)} | {fila.modelo} | {int(fila.filas):,} | '
            f'{fila.mae_t_ha:.3f} | {fila.rmse_t_ha:.3f} |'
        )

    lineas.extend(
        [
            '',
            '## 3. Importancia por permutación',
            '',
            'La importancia es el aumento medio del MAE al permutar cada '
            'variable en la prueba. Solo hay 8 predictores permitidos, así que '
            'el top 10 contiene las 8 variables disponibles.',
            '',
            '| Posición | Variable | Aumento MAE (t/ha) | Desv. (t/ha) |',
            '|---:|---|---:|---:|',
        ]
    )
    for fila in importancia.head(10).itertuples(index=False):
        lineas.append(
            f'| {int(fila.posicion)} | {fila.variable} | '
            f'{fila.importancia_mae_t_ha:.4f} | '
            f'{fila.desviacion_importancia_t_ha:.4f} |'
        )
    lineas.extend(
        [
            '',
            'Un valor positivo indica que permutar la variable degradó el MAE; '
            'uno negativo indica que la permutación no lo degradó en esta prueba.',
        ]
    )

    if boot['ic_inferior_95_t_ha'] > 0:
        conclusion = (
            'El intervalo 95 % excluye cero por el lado de la mejora: la '
            'diferencia es distinguible del azar en este bootstrap.'
        )
    elif boot['ic_superior_95_t_ha'] < 0:
        conclusion = (
            'El intervalo 95 % excluye cero y favorece a la línea base: RF '
            'no es distinguible de la línea base en este bootstrap.'
        )
    else:
        conclusion = (
            'El intervalo 95 % contiene cero: con este bootstrap no se puede '
            'distinguir la mejora observada del azar.'
        )
    lineas.extend(
        [
            '',
            '## 4. Bootstrap clusterizado por municipios',
            '',
            f'- MAE línea base: {boot["mae_linea_base_t_ha"]:.4f} t/ha.',
            f'- MAE Random Forest: {boot["mae_random_forest_t_ha"]:.4f} t/ha.',
            f'- Diferencia (línea base − RF): '
            f'{boot["diferencia_mae_t_ha"]:.4f} t/ha.',
            f'- IC 95 % percentil: [{boot["ic_inferior_95_t_ha"]:.4f}, '
            f'{boot["ic_superior_95_t_ha"]:.4f}] t/ha.',
            f'- {int(boot["resampleos"]):,} remuestreos de los '
            f'{int(boot["municipios"]):,} municipios de prueba.',
            '',
            conclusion,
            '',
            '## Limitaciones',
            '',
            '- La cobertura mide el esquema empírico q10-q90 sobre esta '
            'prueba; no garantiza cobertura por municipio, año o futuro.',
            '- La importancia por permutación es asociativa, no causal; las '
            'variables categóricas de alta cardinalidad pueden ser difíciles '
            'de interpretar.',
            '- El bootstrap representa incertidumbre por municipio en la '
            'prueba, no toda la incertidumbre de un despliegue futuro.',
            '',
        ]
    )
    return '\n'.join(lineas)


def _alinear_features_con_prueba(
    features: pd.DataFrame,
    prueba: pd.DataFrame,
) -> pd.DataFrame:
    """Une las features de prueba con las predicciones por llave de unidad."""
    columnas = (
        em.LLAVE_UNIDAD
        + [columna for columna in em.PREDICTORES if columna not in em.LLAVE_UNIDAD]
        + ['rendimiento_t_ha']
    )
    prueba_features = features[columnas].copy()
    resultado = prueba_features.merge(
        prueba[
            em.LLAVE_UNIDAD
            + [
                'prediccion_linea_base_t_ha',
                'prediccion_random_forest_t_ha',
            ]
        ],
        on=em.LLAVE_UNIDAD,
        how='inner',
        validate='one_to_one',
    )
    if len(resultado) != len(prueba):
        raise ValueError('Las features y las predicciones de prueba no alinean')
    return resultado.sort_values(
        em.LLAVE_UNIDAD,
        kind='stable',
    ).reset_index(drop=True)


def main() -> None:
    """Ejecuta el diagnóstico post hoc de la inferencia de MAÍZ."""
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
        help='Directorio con artefactos de Fases C y D y destino de reportes.',
    )
    args = parser.parse_args()

    rutas = {
        'features': args.features,
        'predicciones': args.reports / ARCHIVO_PREDICCIONES.name,
        'seleccion': args.reports / ARCHIVO_SELECCION.name,
        'metadatos_inferencia': args.reports / ARCHIVO_METADATOS_INFERENCIA.name,
    }
    faltantes = [str(ruta) for ruta in rutas.values() if not ruta.exists()]
    if faltantes:
        raise FileNotFoundError(f'Faltan insumos del diagnóstico: {faltantes}')

    features = pd.read_pickle(rutas['features'])
    em.validar_features(features)
    predicciones = pd.read_csv(rutas['predicciones'])
    seleccion = pd.read_csv(rutas['seleccion'])
    metadatos_inferencia = json.loads(
        rutas['metadatos_inferencia'].read_text(encoding='utf-8')
    )
    parametros = validar_configuracion_congelada(
        metadatos_inferencia,
        seleccion,
    )
    base, rf = _validar_predicciones_congeladas(predicciones)
    prueba = alinear_predicciones(base, rf)
    if len(prueba) != int(predicciones['modelo'].eq(LINEA_BASE).sum()):
        raise ValueError('El número de filas de prueba no es el esperado')
    if not prueba['anio'].between(em.PRUEBA_DESDE, 2024).all():
        raise ValueError('Las predicciones diagnosticadas no son de 2019-2024')

    q10 = float(metadatos_inferencia['rango']['q10_t_ha'])
    q90 = float(metadatos_inferencia['rango']['q90_t_ha'])
    cobertura, detalle_cobertura = calcular_cobertura_rango(prueba, q10, q90)
    metricas_bolivar = calcular_metricas_bolivar_anual(prueba)

    entrenamiento = features[
        features['conjunto'].eq('ENTRENAMIENTO')
        & features['anio'].le(em.ENTRENAMIENTO_HASTA)
    ].copy()
    features_prueba = features[
        features['conjunto'].eq('PRUEBA')
        & features['anio'].ge(em.PRUEBA_DESDE)
    ].copy()
    prueba_features = _alinear_features_con_prueba(features_prueba, prueba)
    pipeline = em.construir_pipeline(MODELO_FINAL, parametros)
    pipeline.fit(
        entrenamiento[em.PREDICTORES],
        entrenamiento['rendimiento_t_ha'],
    )
    predicho_reentrenado = pipeline.predict(prueba_features[em.PREDICTORES])
    if not np.allclose(
        predicho_reentrenado,
        prueba_features['prediccion_random_forest_t_ha'],
        rtol=0.0,
        atol=1e-12,
    ):
        raise AssertionError(
            'El RF reentrenado no reproduce las predicciones congeladas de Fase C'
        )

    print('Calculando importancia por permutación sobre la prueba...')
    importancia, detalle_importancia, mae_rf_reentrenado = (
        calcular_importancia_permutacion(
            pipeline,
            prueba_features,
            prueba_features['rendimiento_t_ha'],
        )
    )
    mae_rf_congelado = float(
        (
            prueba_features['rendimiento_t_ha']
            - prueba_features['prediccion_random_forest_t_ha']
        ).abs().mean()
    )
    if not np.isclose(mae_rf_reentrenado, mae_rf_congelado, rtol=0.0, atol=1e-12):
        raise AssertionError('El MAE RF reentrenado no coincide con el congelado')

    print('Calculando bootstrap clusterizado por municipios...')
    bootstrap_detalle, bootstrap_resumen = calcular_bootstrap_diferencia_mae(prueba)

    args.reports.mkdir(parents=True, exist_ok=True)
    cobertura.to_csv(
        args.reports / ARCHIVO_COBERTURA.name,
        index=False,
        encoding='utf-8-sig',
    )
    detalle_cobertura.to_csv(
        args.reports / ARCHIVO_COBERTURA_DETALLE.name,
        index=False,
        encoding='utf-8-sig',
    )
    metricas_bolivar.to_csv(
        args.reports / ARCHIVO_METRICAS_BOLIVAR.name,
        index=False,
        encoding='utf-8-sig',
    )
    importancia.to_csv(
        args.reports / ARCHIVO_IMPORTANCIA.name,
        index=False,
        encoding='utf-8-sig',
    )
    detalle_importancia.to_csv(
        args.reports / ARCHIVO_IMPORTANCIA_DETALLE.name,
        index=False,
        encoding='utf-8-sig',
    )
    bootstrap_detalle.to_csv(
        args.reports / ARCHIVO_BOOTSTRAP.name,
        index=False,
        encoding='utf-8-sig',
    )
    bootstrap_resumen.to_csv(
        args.reports / ARCHIVO_BOOTSTRAP_RESUMEN.name,
        index=False,
        encoding='utf-8-sig',
    )

    boot = bootstrap_resumen.iloc[0]
    metadatos = {
        'cultivo': 'MAIZ',
        'modelo': MODELO_FINAL,
        'configuracion': metadatos_inferencia[
            'configuracion_seleccionada_por_folds'
        ],
        'parametros': parametros,
        'prueba': {
            'anio_inicial': int(prueba['anio'].min()),
            'anio_final': int(prueba['anio'].max()),
            'filas': int(len(prueba)),
            'municipios': int(prueba['cod_mun'].nunique()),
        },
        'rango_congelado': {
            'q10_residual_t_ha': q10,
            'q90_residual_t_ha': q90,
            'cobertura_objetivo': float(
                metadatos_inferencia['rango']['cobertura_objetivo']
            ),
            'recalibrado_con_prueba': False,
        },
        'cobertura_observada_pct': {
            'total': float(
                cobertura.loc[cobertura['corte'].eq('TOTAL'), 'cobertura_pct'].iloc[0]
            ),
            'por_anio': {
                str(int(fila.anio)): float(fila.cobertura_pct)
                for fila in cobertura[
                    cobertura['corte'].eq('ANIO')
                ].itertuples(index=False)
            },
        },
        'importancia_permutacion': {
            'metrica': 'aumento medio del MAE al permutar la variable',
            'repeticiones': NUM_REPETICIONES_PERMUTACION,
            'semilla': SEMILLA_PERMUTACION,
            'variables_disponibles': len(em.PREDICTORES),
            'top_10_solicitado': True,
        },
        'bootstrap': {
            'metodo': 'percentil 95 %, cluster por municipio con reemplazo',
            'resampleos': NUM_RESAMPLEOS_BOOTSTRAP,
            'semilla': SEMILLA_BOOTSTRAP,
            'direccion_diferencia': str(boot['direccion_diferencia']),
            'diferencia_mae_t_ha': float(boot['diferencia_mae_t_ha']),
            'ic_inferior_95_t_ha': float(boot['ic_inferior_95_t_ha']),
            'ic_superior_95_t_ha': float(boot['ic_superior_95_t_ha']),
            'mejora_distinguible_del_azar_95': bool(
                boot['mejora_distinguible_del_azar_95']
            ),
        },
        'modelo_modificado': False,
        'rango_modificado': False,
        'prueba_usada_para_ajustar': False,
    }
    (args.reports / ARCHIVO_METADATOS.name).write_text(
        json.dumps(metadatos, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    (args.reports / ARCHIVO_RESUMEN.name).write_text(
        construir_resumen(
            cobertura,
            metricas_bolivar,
            importancia,
            bootstrap_resumen,
            q10,
            q90,
        ),
        encoding='utf-8',
    )

    print('\nCobertura total del rango:')
    print(
        cobertura[cobertura['corte'].eq('TOTAL')][
            ['filas', 'dentro_rango', 'cobertura_pct']
        ].to_string(index=False)
    )
    print('\nBootstrap de diferencia de MAE (línea base − RF):')
    print(bootstrap_resumen.to_string(index=False))
    print(f'\nArtefactos: {args.reports}')


if __name__ == '__main__':
    main()
