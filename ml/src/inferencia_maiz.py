"""Prepara inferencia de rendimiento esperado para MAÍZ (Fase D).

La selección del modelo se toma exclusivamente de los folds expansivos
2014--2018. La prueba 2019--2024, ya evaluada en Fase C, solo se consulta
para aplicar el veto de despliegue acordado: no se usa para reconfigurar,
comparar como criterio de selección ni cambiar el modelo final.

La tabla de inferencia usa únicamente historia de entrenamiento (2007--2018).
Cada valor resume las observaciones históricas del grupo municipio, sistema y
semestre. El rango típico de error usa los percentiles 10 y 90 de los
residuales out-of-fold 2014--2018 del modelo final; su cobertura real en la
prueba 2019--2024 fue 60,5 %. La mejora del modelo sobre la línea base no se
distingue del azar en la prueba (IC 95 % de la diferencia de MAE: -0,010 a
0,028 t/ha), por lo que el valor se presenta como referencia histórica y no
como predicción.
"""

from __future__ import annotations

import argparse
import json
import unicodedata
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

import evaluar_linea_base as eb
import evaluar_modelos_maiz as em


ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / 'data' / 'processed'
REPORTS = ROOT / 'ml' / 'reports'
FEATURES_MAIZ = PROCESSED / 'features_maiz.pkl'

ARCHIVO_SELECCION = REPORTS / 'seleccion_hiperparametros_maiz.csv'
ARCHIVO_METRICAS_PRUEBA = REPORTS / 'metricas_modelos_maiz.csv'
ARCHIVO_TABLA_ESPERADA = REPORTS / 'rendimiento_esperado_maiz.csv'
ARCHIVO_VALIDACION_FINAL = REPORTS / 'validacion_folds_candidatos_finales_maiz.csv'
ARCHIVO_SELECCION_FINAL = REPORTS / 'seleccion_modelo_final_maiz.csv'
ARCHIVO_METADATOS = REPORTS / 'metadatos_inferencia_maiz.json'
ARCHIVO_RESUMEN = REPORTS / 'resumen_fase_c.md'

COBERTURA_RANGO = 0.80
CLAVES_GRUPO = [
    'cod_dep',
    'departamento',
    'cod_mun',
    'municipio',
    'sistema',
    'semestre',
]
CONFIGURACION_LINEA_BASE = 'mediana_municipio_sistema'


def normalizar_texto(valor: object) -> str:
    """Normaliza mayúsculas, espacios y acentos para comparar nombres."""
    texto = unicodedata.normalize('NFKD', str(valor))
    sin_acentos = ''.join(
        caracter
        for caracter in texto
        if not unicodedata.combining(caracter)
    )
    return ' '.join(sin_acentos.strip().upper().split())


def _predecir_linea_base_fold(
    entrenamiento: pd.DataFrame,
    validacion: pd.DataFrame,
) -> np.ndarray:
    """Predice el fold con medianas ajustadas solo al entrenamiento."""
    historia, departamento = eb.extraer_medianas(entrenamiento, 'MAIZ')
    mediana_historia = eb._mapear_mediana_historia(
        validacion,
        historia,
        'MAIZ',
    )
    mediana_departamento = validacion['cod_dep'].map(departamento)
    prediccion = mediana_historia.where(mediana_historia.notna(), mediana_departamento)
    if prediccion.isna().any():
        raise ValueError('La línea base no tiene respaldo para alguna fila del fold')
    return prediccion.to_numpy(dtype=float)


def _metricas_fold(
    real: pd.Series,
    predicho: np.ndarray,
) -> dict[str, float | int]:
    """Calcula las métricas con la función compartida de la línea base."""
    return eb.calcular_metricas(
        pd.DataFrame(
            {
                'rendimiento_t_ha': real.to_numpy(),
                'rendimiento_predicho_t_ha': np.asarray(predicho),
            }
        )
    )


def evaluar_candidatos_finales(
    features: pd.DataFrame,
    folds: list[dict[str, Any]],
    seleccion: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Evalúa línea base y una configuración por modelo en los mismos folds."""
    filas_metricas: list[dict[str, object]] = []
    filas_predicciones: list[pd.DataFrame] = []

    for fold in folds:
        entrenamiento = fold['entrenamiento']
        validacion = fold['validacion']
        predicho_base = _predecir_linea_base_fold(entrenamiento, validacion)
        metricas_base = _metricas_fold(
            validacion['rendimiento_t_ha'],
            predicho_base,
        )
        filas_metricas.append(
            {
                'modelo': 'LineaBase',
                'configuracion': CONFIGURACION_LINEA_BASE,
                'anio_validacion': int(fold['anio_validacion']),
                'filas_entrenamiento': int(len(entrenamiento)),
                'filas_validacion': int(len(validacion)),
                **metricas_base,
            }
        )
        detalle_base = validacion[
            em.LLAVE_UNIDAD + ['rendimiento_t_ha']
        ].copy()
        detalle_base['modelo'] = 'LineaBase'
        detalle_base['configuracion'] = CONFIGURACION_LINEA_BASE
        detalle_base['rendimiento_predicho_t_ha'] = predicho_base
        filas_predicciones.append(detalle_base)

    seleccionadas = seleccion[seleccion['seleccionada'].eq(True)]
    if set(seleccionadas['modelo']) != set(em.MODELOS):
        raise AssertionError('Debe existir una configuración elegida por modelo')

    for fila in seleccionadas.itertuples(index=False):
        modelo = str(fila.modelo)
        parametros = json.loads(str(fila.parametros))
        pipeline = em.construir_pipeline(modelo, parametros)
        for fold in folds:
            entrenamiento = fold['entrenamiento']
            validacion = fold['validacion']
            pipeline.fit(
                entrenamiento[em.PREDICTORES],
                entrenamiento['rendimiento_t_ha'],
            )
            predicho = pipeline.predict(validacion[em.PREDICTORES])
            metricas = _metricas_fold(
                validacion['rendimiento_t_ha'],
                predicho,
            )
            filas_metricas.append(
                {
                    'modelo': modelo,
                    'configuracion': str(fila.configuracion),
                    'anio_validacion': int(fold['anio_validacion']),
                    'filas_entrenamiento': int(len(entrenamiento)),
                    'filas_validacion': int(len(validacion)),
                    **metricas,
                }
            )
            detalle = validacion[
                em.LLAVE_UNIDAD + ['rendimiento_t_ha']
            ].copy()
            detalle['modelo'] = modelo
            detalle['configuracion'] = str(fila.configuracion)
            detalle['rendimiento_predicho_t_ha'] = predicho
            filas_predicciones.append(detalle)

    metricas = pd.DataFrame(filas_metricas)
    predicciones = pd.concat(filas_predicciones, ignore_index=True)
    predicciones['error_absoluto_t_ha'] = (
        predicciones['rendimiento_t_ha']
        - predicciones['rendimiento_predicho_t_ha']
    ).abs()
    return metricas, predicciones



def resumir_validacion(metricas: pd.DataFrame) -> pd.DataFrame:
    """Agrega métricas por modelo; la entrada contiene solo folds."""
    agregado = (
        metricas.groupby(['modelo', 'configuracion'], as_index=False)
        .agg(
            mae_medio=('mae_t_ha', 'mean'),
            rmse_medio=('rmse_t_ha', 'mean'),
            mape_medio=('mape_pct', 'mean'),
            mae_desviacion=('mae_t_ha', 'std'),
            folds=('anio_validacion', 'nunique'),
        )
    )
    return agregado.sort_values(
        [
            'mae_medio',
            'rmse_medio',
            'mape_medio',
            'mae_desviacion',
            'modelo',
        ],
        kind='stable',
    ).reset_index(drop=True)


def seleccionar_modelo_por_folds(resumen: pd.DataFrame) -> pd.Series:
    """Elige un modelo exclusivamente por desempeño promedio en folds."""
    candidatos = resumen[resumen['modelo'].ne('LineaBase')].copy()
    if candidatos.empty:
        raise ValueError('No hay modelos candidatos para seleccionar')
    return candidatos.sort_values(
        [
            'mae_medio',
            'rmse_medio',
            'mape_medio',
            'mae_desviacion',
            'modelo',
        ],
        kind='stable',
    ).iloc[0]


def aplicar_veto_despliegue(
    candidato_folds: pd.Series,
    metricas_prueba: pd.DataFrame,
) -> tuple[str, str, bool]:
    """Aplica el veto acordado sin usar la prueba para rankear modelos.

    La prueba no modifica el candidato elegido por folds. Solo se consulta si
    algún modelo tiene MAE de prueba inferior al de la línea base. Si ninguno
    lo mejora, la línea base pasa a ser el modelo de inferencia.
    """
    requeridas = {'modelo', 'mae_t_ha'}
    faltantes = requeridas - set(metricas_prueba.columns)
    if faltantes:
        raise ValueError(
            f'Faltan columnas en métricas de prueba: {sorted(faltantes)}'
        )
    base = metricas_prueba[metricas_prueba['modelo'].eq('LineaBase')]
    if len(base) != 1:
        raise ValueError('Se requiere exactamente una fila de línea base en prueba')
    mae_base = float(base.iloc[0]['mae_t_ha'])
    modelos = metricas_prueba[metricas_prueba['modelo'].ne('LineaBase')]
    alguno_mejora = bool((modelos['mae_t_ha'] < mae_base).any())
    if str(candidato_folds['modelo']) == 'LineaBase':
        return (
            'LineaBase',
            'La línea base ganó la validación en folds y se mantiene.',
            False,
        )
    if alguno_mejora:
        return (
            str(candidato_folds['modelo']),
            (
                'El candidato se mantiene por ser el mejor en MAE medio de folds; '
                'la prueba solo confirma que al menos un modelo supera el MAE '
                'de la línea base y no participa del ranking.'
            ),
            False,
        )
    return (
        'LineaBase',
        (
            'Ningún modelo supera el MAE de la línea base en la prueba; '
            'se aplica el veto acordado y la línea base queda para inferencia.'
        ),
        True,
    )


def construir_perfiles_historicos(entrenamiento: pd.DataFrame) -> pd.DataFrame:
    """Resume el perfil mediano de cada grupo con historia real."""
    perfiles = (
        entrenamiento.groupby(CLAVES_GRUPO, dropna=False)
        .agg(
            filas_historicas=('anio', 'size'),
            anio_inicio=('anio', 'min'),
            anio_fin=('anio', 'max'),
            anio_perfil=('anio', 'median'),
            rendimiento_historico_mediano_t_ha=('rendimiento_t_ha', 'median'),
            rendimiento_lag1_t_ha=('rendimiento_lag1_t_ha', 'median'),
            temperatura_2m_media_c=('temperatura_2m_media_c', 'median'),
            soil_moisture_0_to_7cm_media=(
                'soil_moisture_0_to_7cm_media',
                'median',
            ),
        )
        .reset_index()
    )
    if perfiles.duplicated(CLAVES_GRUPO).any():
        raise AssertionError('Los perfiles históricos tienen grupos duplicados')
    return perfiles


def _intervalo_residual(
    predicciones_folds: pd.DataFrame,
    modelo: str,
) -> tuple[float, float, float]:
    """Obtiene quantiles firmados del error out-of-fold del modelo final."""
    errores = predicciones_folds[
        predicciones_folds['modelo'].eq(modelo)
    ].copy()
    if errores.empty:
        raise ValueError(f'No hay predicciones de folds para {modelo}')
    residuales = (
        errores['rendimiento_t_ha']
        - errores['rendimiento_predicho_t_ha']
    )
    q10 = float(residuales.quantile(0.10))
    q90 = float(residuales.quantile(0.90))
    mae = float(errores['error_absoluto_t_ha'].mean())
    return q10, q90, mae


def _predecir_linea_base_perfiles(
    perfiles: pd.DataFrame,
    entrenamiento: pd.DataFrame,
) -> np.ndarray:
    """Aplica la línea base por municipio-sistema a los perfiles."""
    historia, departamento = eb.extraer_medianas(entrenamiento, 'MAIZ')
    mediana_historia = eb._mapear_mediana_historia(
        perfiles,
        historia,
        'MAIZ',
    )
    mediana_departamento = perfiles['cod_dep'].map(departamento)
    prediccion = mediana_historia.where(mediana_historia.notna(), mediana_departamento)
    if prediccion.isna().any():
        raise ValueError('La línea base no tiene respaldo para algún perfil')
    return prediccion.to_numpy(dtype=float)


def preparar_tabla_esperada(
    entrenamiento: pd.DataFrame,
    perfiles: pd.DataFrame,
    modelo: str,
    parametros: dict[str, Any],
    q10_residual: float,
    q90_residual: float,
) -> tuple[pd.DataFrame, Any]:
    """Predice perfiles históricos y añade el rango empírico de validación."""
    if modelo == 'LineaBase':
        predicho = _predecir_linea_base_perfiles(perfiles, entrenamiento)
        pipeline = None
        configuracion = CONFIGURACION_LINEA_BASE
    else:
        pipeline = em.construir_pipeline(modelo, parametros)
        pipeline.fit(
            entrenamiento[em.PREDICTORES],
            entrenamiento['rendimiento_t_ha'],
        )
        configuracion = em.identificador_configuracion(modelo, parametros)
        entrada = perfiles[CLAVES_GRUPO].copy()
        entrada['anio'] = perfiles['anio_perfil']
        entrada['rendimiento_lag1_t_ha'] = perfiles['rendimiento_lag1_t_ha']
        entrada['temperatura_2m_media_c'] = perfiles['temperatura_2m_media_c']
        entrada['soil_moisture_0_to_7cm_media'] = perfiles[
            'soil_moisture_0_to_7cm_media'
        ]
        predicho = pipeline.predict(entrada[em.PREDICTORES])

    if not np.isfinite(predicho).all():
        raise ValueError('La inferencia produjo valores no finitos')
    tabla = perfiles.copy()
    tabla['rendimiento_esperado_t_ha'] = np.maximum(predicho, 0.0)
    tabla['rango_inferior_t_ha'] = np.maximum(
        tabla['rendimiento_esperado_t_ha'] + q10_residual,
        0.0,
    )
    tabla['rango_superior_t_ha'] = np.maximum(
        tabla['rendimiento_esperado_t_ha'] + q90_residual,
        tabla['rango_inferior_t_ha'],
    )
    tabla['modelo_inferencia'] = modelo
    tabla['configuracion_inferencia'] = configuracion
    tabla['metodo_rango'] = 'intervalo_empirico_residuales_out_of_fold_q10_q90'
    tabla['cobertura_rango_objetivo'] = COBERTURA_RANGO
    columnas = [
        'cod_dep',
        'departamento',
        'cod_mun',
        'municipio',
        'sistema',
        'semestre',
        'rendimiento_esperado_t_ha',
        'rango_inferior_t_ha',
        'rango_superior_t_ha',
        'filas_historicas',
        'anio_inicio',
        'anio_fin',
        'rendimiento_historico_mediano_t_ha',
        'modelo_inferencia',
        'configuracion_inferencia',
        'metodo_rango',
        'cobertura_rango_objetivo',
    ]
    tabla = tabla[columnas].sort_values(
        ['cod_dep', 'cod_mun', 'sistema', 'semestre'],
        kind='stable',
    ).reset_index(drop=True)
    if tabla.duplicated(CLAVES_GRUPO).any():
        raise AssertionError('La tabla de inferencia tiene grupos duplicados')
    return tabla, pipeline


def predecir_rendimiento_maiz(
    municipio: str,
    semestre: str,
    sistema: str,
    *,
    cod_mun: int | None = None,
    tabla: pd.DataFrame | None = None,
    ruta_tabla: Path = ARCHIVO_TABLA_ESPERADA,
) -> dict[str, object]:
    """Inferencia MAÍZ: municipio, semestre y sistema → esperado y rango.

    ``cod_mun`` es un desambiguador opcional para nombres de municipio que
    existen en más de un departamento. Si no se entrega y hay más de una
    coincidencia, se informa el error en vez de escoger arbitrariamente.
    """
    if tabla is None:
        if not ruta_tabla.exists():
            raise FileNotFoundError(
                f'No existe {ruta_tabla}. Ejecuta antes ml/src/inferencia_maiz.py.'
            )
        tabla = pd.read_csv(ruta_tabla)
    requeridas = set(CLAVES_GRUPO) | {
        'rendimiento_esperado_t_ha',
        'rango_inferior_t_ha',
        'rango_superior_t_ha',
    }
    faltantes = requeridas - set(tabla.columns)
    if faltantes:
        raise ValueError(f'Faltan columnas en la tabla de inferencia: {sorted(faltantes)}')

    municipio_normalizado = normalizar_texto(municipio)
    semestre_normalizado = normalizar_texto(semestre)
    sistema_normalizado = normalizar_texto(sistema)
    candidatos = tabla[
        tabla['municipio'].map(normalizar_texto).eq(municipio_normalizado)
        & tabla['semestre'].map(normalizar_texto).eq(semestre_normalizado)
        & tabla['sistema'].map(normalizar_texto).eq(sistema_normalizado)
    ].copy()
    if cod_mun is not None:
        candidatos = candidatos[candidatos['cod_mun'].eq(int(cod_mun))]
    if candidatos.empty:
        raise KeyError(
            'No existe una combinación con historia para municipio, semestre '
            'y sistema recibidos.'
        )
    if len(candidatos) > 1:
        opciones = candidatos[
            ['cod_dep', 'departamento', 'cod_mun', 'municipio']
        ].to_dict('records')
        raise ValueError(
            'El municipio es ambiguo; use cod_mun para desambiguar. '
            f'Opciones: {opciones}'
        )
    fila = candidatos.iloc[0]
    return {
        'cod_dep': int(fila['cod_dep']),
        'departamento': str(fila['departamento']),
        'cod_mun': int(fila['cod_mun']),
        'municipio': str(fila['municipio']),
        'sistema': str(fila['sistema']),
        'semestre': str(fila['semestre']),
        'rendimiento_esperado_t_ha': float(fila['rendimiento_esperado_t_ha']),
        'rango_inferior_t_ha': float(fila['rango_inferior_t_ha']),
        'rango_superior_t_ha': float(fila['rango_superior_t_ha']),
        'modelo_inferencia': str(fila['modelo_inferencia']),
    }


def _parametros_modelo(
    seleccion: pd.DataFrame,
    modelo: str,
) -> dict[str, Any]:
    """Obtiene la configuración ya seleccionada para un modelo."""
    if modelo == 'LineaBase':
        return {}
    filas = seleccion[
        seleccion['modelo'].eq(modelo)
        & seleccion['seleccionada'].eq(True)
    ]
    if len(filas) != 1:
        raise ValueError(f'No hay una configuración seleccionada para {modelo}')
    return json.loads(str(filas.iloc[0]['parametros']))


def _resumen_prueba(metricas_prueba: pd.DataFrame) -> str:
    """Construye las filas de la tabla de métricas de prueba."""
    lineas = [
        '| Modelo | Filas | MAE (t/ha) | RMSE (t/ha) | MAPE (%) |',
        '|---|---:|---:|---:|---:|',
    ]
    for fila in metricas_prueba.itertuples(index=False):
        lineas.append(
            f'| {fila.modelo} | {fila.filas:,} | {fila.mae_t_ha:.3f} | '
            f'{fila.rmse_t_ha:.3f} | {fila.mape_pct:.2f} |'
        )
    return '\n'.join(lineas)


def construir_resumen(
    metricas_folds: pd.DataFrame,
    metricas_prueba: pd.DataFrame,
    modelo_folds: str,
    modelo_inferencia: str,
    motivo: str,
    veto: bool,
    filas_clima_faltante: int,
    filas_clima_celda: int,
    filas_clima_sin_mgn: int,
    municipios_clima_celda: int,
    codigos_clima_sin_mgn: int,
    filas_tabla: int,
    q10: float,
    q90: float,
) -> str:
    """Construye el resumen solicitado de Fases C y D."""
    filas_folds = metricas_folds.copy()
    lineas = [
        '# Resumen de MAÍZ: Fases C y D',
        '',
        '## Resultado de la prueba 2019-2024 (Fase C)',
        '',
        _resumen_prueba(metricas_prueba),
        '',
        (
            'La prueba se evaluó una sola vez con 11,154 filas idénticas para '
            'la línea base y los tres modelos.'
        ),
        '',
        '## Selección y modelo de inferencia (Fase D)',
        '',
        (
            f'El modelo elegido exclusivamente por MAE medio en folds fue '
            f'**{modelo_folds}**. El modelo que queda para inferencia es '
            f'**{modelo_inferencia}**.'
        ),
        '',
        motivo,
        '',
        (
            'La prueba no se usó para reconfigurar ni para rankear modelos; '
            'el CSV de prueba solo se consultó para aplicar el veto global '
            'acordado. Por eso, una métrica superior en prueba de otro modelo '
            'no reemplaza al ganador de folds.'
        ),
        '',
    ]
    base_prueba = metricas_prueba[
        metricas_prueba['modelo'].eq('LineaBase')
    ].iloc[0]
    candidato_prueba = metricas_prueba[
        metricas_prueba['modelo'].eq(modelo_folds)
    ]
    if not candidato_prueba.empty:
        fila_candidato = candidato_prueba.iloc[0]
        lineas.append(
            f'En la prueba, {modelo_folds} obtuvo MAE {fila_candidato.mae_t_ha:.3f}, '
            f'RMSE {fila_candidato.rmse_t_ha:.3f} y MAPE '
            f'{fila_candidato.mape_pct:.2f}; la línea base obtuvo '
            f'{base_prueba.mae_t_ha:.3f}, {base_prueba.rmse_t_ha:.3f} y '
            f'{base_prueba.mape_pct:.2f}, respectivamente.'
        )
    modelos_prueba = metricas_prueba[
        metricas_prueba['modelo'].ne('LineaBase')
    ]
    if not modelos_prueba.empty:
        mejor_prueba = modelos_prueba.sort_values(
            ['mae_t_ha', 'rmse_t_ha', 'mape_pct'],
            kind='stable',
        ).iloc[0]
        lineas.append(
            f'El menor MAE de prueba fue {mejor_prueba.mae_t_ha:.3f} de '
            f'{mejor_prueba.modelo}; no se adoptó porque la prueba no participa '
            'en el ranking del modelo final.'
        )
    lineas.extend(
        [
            '',
            '### Validación out-of-fold de los candidatos',
            '',
            '| Modelo | MAE medio (t/ha) | RMSE medio (t/ha) | MAPE medio (%) |',
            '|---|---:|---:|---:|',
        ]
    )
    resumen_folds = (
        filas_folds.groupby('modelo', as_index=False)
        .agg(
            mae_medio=('mae_t_ha', 'mean'),
            rmse_medio=('rmse_t_ha', 'mean'),
            mape_medio=('mape_pct', 'mean'),
        )
    )
    for fila in resumen_folds.itertuples(index=False):
        lineas.append(
            f'| {fila.modelo} | {fila.mae_medio:.3f} | '
            f'{fila.rmse_medio:.3f} | {fila.mape_medio:.2f} |'
        )
    lineas.extend(
        [
            '',
            '## Cobertura y clima faltante',
            '',
            f'- Filas totales con al menos una variable climática faltante: '
            f'**{filas_clima_faltante}**: {filas_clima_celda} filas en '
            f'{municipios_clima_celda} municipios con celdas incompletas, más '
            f'{filas_clima_sin_mgn} filas de {codigos_clima_sin_mgn} códigos '
            'sin MGN 2023.',
            '- Las medianas de la línea base se calculan dentro de cada fold; '
            'la imputación climática de los modelos también se ajusta dentro '
            'de cada fold.',
            f'- Filas de la tabla de inferencia: **{filas_tabla}**, una por '
            'combinación real municipio-sistema-semestre con historia.',
            '',
            '## Rango típico de error',
            '',
            (
                'El rango típico de error (percentiles 10 y 90 de los '
                'residuales out-of-fold 2014-2018) usa '
                f'q10={q10:.3f} y q90={q90:.3f} t/ha. Su cobertura real en '
                'la prueba 2019-2024 fue 60,5 %, por lo que no es un intervalo '
                'central del 80 % ni una banda con garantía de cobertura.'
            ),
            '',
            '## Interpretación del valor',
            '',
            (
                'La mejora del modelo sobre la línea base no se distingue del '
                'azar en la prueba: el IC 95 % de la diferencia de MAE fue '
                '-0,010 a 0,028 t/ha. Por esta razón, el valor se presenta '
                'como referencia histórica y no como predicción.'
            ),
            '',
            '## Limitaciones',
            '',
            '- La entrada de inferencia no incluye año ni clima actual: el '
            'perfil mediano histórico del grupo se congela para el esperado.',
            '- Solo se incluyen combinaciones con historia de entrenamiento; '
            'no se inventan combinaciones ni municipios sin historial.',
            '- Los nombres homónimos requieren `cod_mun` como desambiguador.',
            '- El cambio de base EVA 2007-2018 a 2019-2024 puede afectar el '
            'desempeño; la prueba no aísla ese efecto.',
            '- El rango es una guía empírica de error y no una garantía para '
            'cada municipio, sistema o semestre.',
            '',
        ]
    )
    if veto:
        lineas.insert(
            2,
            '> **VETO APLICADO:** ningún modelo superó el MAE de la línea base '
            'en la prueba; por eso la inferencia usa la línea base.',
        )
    return '\n'.join(lineas)


def main() -> None:
    """Genera la inferencia de MAÍZ sin reabrir ni recalcular la prueba."""
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
        help='Directorio de reportes de Fase C y destino de Fase D.',
    )
    args = parser.parse_args()

    if not args.features.exists():
        raise FileNotFoundError(
            f'No existe {args.features}. Ejecuta antes ml/src/preparar_features_maiz.py.'
        )
    seleccion_ruta = args.reports / 'seleccion_hiperparametros_maiz.csv'
    metricas_prueba_ruta = args.reports / 'metricas_modelos_maiz.csv'
    for ruta in [seleccion_ruta, metricas_prueba_ruta]:
        if not ruta.exists():
            raise FileNotFoundError(
                f'No existe {ruta}. Ejecuta antes ml/src/evaluar_modelos_maiz.py.'
            )

    features = pd.read_pickle(args.features)
    em.validar_features(features)
    seleccion = pd.read_csv(seleccion_ruta)
    metricas_prueba = pd.read_csv(metricas_prueba_ruta)
    folds = em.crear_folds(features)

    print('Evaluando candidatos finales únicamente en folds 2014-2018...')
    metricas_folds, predicciones_folds = evaluar_candidatos_finales(
        features,
        folds,
        seleccion,
    )
    resumen_folds = resumir_validacion(metricas_folds)
    candidato_folds = seleccionar_modelo_por_folds(resumen_folds)
    modelo_inferencia, motivo, veto = aplicar_veto_despliegue(
        candidato_folds,
        metricas_prueba,
    )
    parametros = _parametros_modelo(seleccion, modelo_inferencia)
    q10, q90, mae_validacion = _intervalo_residual(
        predicciones_folds,
        modelo_inferencia,
    )

    entrenamiento = features[
        features['conjunto'].eq('ENTRENAMIENTO')
        & features['anio'].le(em.ENTRENAMIENTO_HASTA)
    ].copy()
    perfiles = construir_perfiles_historicos(entrenamiento)
    tabla, _ = preparar_tabla_esperada(
        entrenamiento,
        perfiles,
        modelo_inferencia,
        parametros,
        q10,
        q90,
    )

    args.reports.mkdir(parents=True, exist_ok=True)
    metricas_folds.to_csv(
        args.reports / 'validacion_folds_candidatos_finales_maiz.csv',
        index=False,
        encoding='utf-8-sig',
    )
    seleccion_final = resumen_folds.copy()
    seleccion_final['seleccionado_por_folds'] = (
        seleccion_final['modelo'].eq(str(candidato_folds['modelo']))
        & seleccion_final['configuracion'].eq(str(candidato_folds['configuracion']))
    )
    seleccion_final['modelo_inferencia'] = modelo_inferencia
    seleccion_final['veto_linea_base_aplicado'] = veto
    seleccion_final['motivo'] = motivo
    seleccion_final.to_csv(
        args.reports / 'seleccion_modelo_final_maiz.csv',
        index=False,
        encoding='utf-8-sig',
    )
    tabla.to_csv(
        args.reports / 'rendimiento_esperado_maiz.csv',
        index=False,
        encoding='utf-8-sig',
    )

    mascara_clima_faltante = (
        features['temperatura_2m_media_c'].isna()
        | features['soil_moisture_0_to_7cm_media'].isna()
    )
    filas_clima_faltante = int(mascara_clima_faltante.sum())
    con_mgn = features['geografia_mgn_2023'].eq(True)
    filas_clima_celda = int((mascara_clima_faltante & con_mgn).sum())
    filas_clima_sin_mgn = int((mascara_clima_faltante & ~con_mgn).sum())
    municipios_clima_celda = int(
        features.loc[mascara_clima_faltante & con_mgn, 'cod_mun'].nunique()
    )
    codigos_clima_sin_mgn = int(
        features.loc[mascara_clima_faltante & ~con_mgn, 'cod_mun'].nunique()
    )
    metadatos = {
        'cultivo': 'MAIZ',
        'folds_validacion': list(em.ANIOS_VALIDACION),
        'criterio_seleccion': (
            'MAE medio de folds; desempates por RMSE medio, MAPE medio y '
            'desviación de MAE'
        ),
        'modelo_seleccionado_por_folds': str(candidato_folds['modelo']),
        'configuracion_seleccionada_por_folds': str(candidato_folds['configuracion']),
        'modelo_para_inferencia': modelo_inferencia,
        'parametros_inferencia': parametros,
        'veto_linea_base_aplicado': veto,
        'motivo_inferencia': motivo,
        'prueba_2019_2024': (
            'evaluada una sola vez en Fase C; consultada en Fase D solo para '
            'el veto global acordado, nunca para rankear o reconfigurar modelos'
        ),
        'mae_medio_folds_t_ha': float(candidato_folds['mae_medio']),
        'mae_pooled_out_of_fold_t_ha': mae_validacion,
        'rango': {
            'metodo': 'residuales firmados q10-q90 out-of-fold',
            'q10_t_ha': q10,
            'q90_t_ha': q90,
            'cobertura_objetivo': COBERTURA_RANGO,
        },
        'filas_tabla_inferencia': int(len(tabla)),
        'municipios_tabla_inferencia': int(tabla['cod_mun'].nunique()),
        'filas_clima_faltante': filas_clima_faltante,
        'filas_clima_celda_incompleta': filas_clima_celda,
        'municipios_clima_celda_incompleta': municipios_clima_celda,
        'filas_clima_sin_mgn_2023': filas_clima_sin_mgn,
        'codigos_clima_sin_mgn_2023': codigos_clima_sin_mgn,
        'imputacion_clima_dentro_del_fold': True,
        'perfil_inferencia': 'medianas históricas del grupo municipio-sistema-semestre',
        'ano_maximo_datos_inferencia': int(entrenamiento['anio'].max()),
    }
    (args.reports / 'metadatos_inferencia_maiz.json').write_text(
        json.dumps(metadatos, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    resumen = construir_resumen(
        metricas_folds,
        metricas_prueba,
        str(candidato_folds['modelo']),
        modelo_inferencia,
        motivo,
        veto,
        filas_clima_faltante,
        filas_clima_celda,
        filas_clima_sin_mgn,
        municipios_clima_celda,
        codigos_clima_sin_mgn,
        len(tabla),
        q10,
        q90,
    )
    (args.reports / 'resumen_fase_c.md').write_text(
        resumen,
        encoding='utf-8',
    )

    print('\nValidación out-of-fold de candidatos:')
    print(resumen_folds.to_string(index=False))
    print(f'\nModelo para inferencia: {modelo_inferencia}')
    print(motivo)
    print(f'Filas en tabla de inferencia: {len(tabla):,}')
    print(args.reports / 'rendimiento_esperado_maiz.csv')
    print(args.reports / 'resumen_fase_c.md')


if __name__ == '__main__':
    main()
