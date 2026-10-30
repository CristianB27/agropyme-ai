"""Prepara features temporales para los modelos de rendimiento de MAÍZ.

El rendimiento histórico es el mismo semestre del año anterior por
``cod_mun--sistema``. El clima es el semestre calendario inmediatamente
anterior: A usa B del año previo y B usa A del mismo año. Los semestres se
interpreten en UTC. La geografía es DANE MGN 2023; no se inventan
centroides para códigos ausentes.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / 'data' / 'processed'
MODELO_MAIZ = PROCESSED / 'modelo_maiz.pkl'
COORDENADAS = PROCESSED / 'coordenadas_municipales_dane.csv'
CLIMA_MUNICIPIOS = PROCESSED / 'clima_era5_land_municipios.csv'
SALIDA = PROCESSED / 'features_maiz.pkl'
SALIDA_CSV = PROCESSED / 'features_maiz.csv'
REPORTE = PROCESSED / 'resumen_features_maiz.csv'
FILAS_ESPERADAS_MAIZ = 36_013

LLAVE_UNIDAD = ['cod_dep', 'cod_mun', 'anio', 'semestre', 'sistema']
PREDICTORES_PERMITIDOS = {
    'departamento',
    'municipio',
    'sistema',
    'anio',
    'semestre',
    'rendimiento_lag1_t_ha',
    'temperatura_2m_media_c',
    'soil_moisture_0_to_7cm_media',
}
COLUMNAS_GEOMETRIA = [
    'cod_dep',
    'cod_mun',
    'departamento',
    'municipio',
    'latitud_centroide',
    'longitud_centroide',
    'celda_x',
    'celda_y',
    'fuente_geografia',
]
COLUMNAS_CLIMA = [
    'cod_mun',
    'anio',
    'semestre',
    'temperatura_2m_media_c',
    'soil_moisture_0_to_7cm_media',
]


def periodo_clima_precedente(anio: int, semestre: str) -> tuple[int, str]:
    """Devuelve el semestre calendario inmediatamente anterior en UTC."""
    if semestre == 'A':
        return anio - 1, 'B'
    if semestre == 'B':
        return anio, 'A'
    raise ValueError(f'Semestre inválido: {semestre!r}')


def construir_rezago_rendimiento(modelo: pd.DataFrame) -> pd.DataFrame:
    """Agrega el rendimiento del mismo semestre del año inmediatamente anterior.

    Se hace un join explícito por año calendario: si el año previo no existe
    para la llave, el rezago queda faltante. No se desplaza una observación
    antigua para rellenar un año ausente. Se conservan el año, la fuente y el
    conjunto de la observación que originó el rezago para poder auditarlo.
    """
    llave_base = ['cod_dep', 'cod_mun', 'semestre', 'sistema']
    historia = modelo[
        llave_base + ['anio', 'rendimiento_t_ha', 'fuente', 'conjunto']
    ].copy()
    historia['anio_destino'] = historia['anio'] + 1
    historia = historia.rename(
        columns={
            'anio': 'anio_lag1_fuente',
            'fuente': 'fuente_lag1',
            'conjunto': 'conjunto_lag1_fuente',
            'rendimiento_t_ha': 'rendimiento_lag1_operativo_t_ha',
        }
    )
    destino = modelo.copy()
    destino['anio_destino'] = destino['anio']
    resultado = destino.merge(
        historia,
        on=llave_base + ['anio_destino'],
        how='left',
        validate='one_to_one',
    ).drop(columns=['anio_destino'])

    # La evaluación final no puede usar ningún rendimiento observado a partir
    # de 2019. Por tanto, 2019 sí conserva el rezago de 2018 y los años
    # 2020--2024 quedan sin rezago (se imputan dentro de cada fold).
    fuente_fuera_prueba = resultado['anio_lag1_fuente'].gt(2018)
    resultado['rendimiento_lag1_t_ha'] = resultado[
        'rendimiento_lag1_operativo_t_ha'
    ].mask(fuente_fuera_prueba)
    resultado['lag1_fuente_fuera_prueba'] = fuente_fuera_prueba
    return resultado


def unir_geografia(
    modelo: pd.DataFrame,
    coordenadas: pd.DataFrame,
) -> pd.DataFrame:
    """Une MGN 2023 sin descartar ni imputar municipios sin geometría."""
    if coordenadas['cod_mun'].duplicated().any():
        raise ValueError('coordenadas_municipales_dane.csv tiene cod_mun duplicados')

    geografia = coordenadas[COLUMNAS_GEOMETRIA].copy()
    geografia = geografia.rename(
        columns={
            'departamento': 'departamento_mgn',
            'municipio': 'municipio_mgn',
        }
    )
    resultado = modelo.merge(
        geografia,
        on=['cod_dep', 'cod_mun'],
        how='left',
        validate='many_to_one',
    )
    resultado['geografia_mgn_2023'] = resultado['fuente_geografia'].notna()
    resultado['departamento'] = resultado['departamento_mgn'].fillna(
        resultado['departamento']
    )
    resultado['municipio'] = resultado['municipio_mgn'].fillna(
        resultado['municipio']
    )
    return resultado


def unir_clima(
    features: pd.DataFrame,
    clima_municipios: pd.DataFrame,
) -> pd.DataFrame:
    """Une el semestre climático inmediatamente anterior a cada fila."""
    if clima_municipios.duplicated(['cod_mun', 'anio', 'semestre']).any():
        raise ValueError(
            'clima_era5_land_municipios.csv tiene municipality-period duplicados'
        )

    periodos = [
        periodo_clima_precedente(int(anio), str(semestre))
        for anio, semestre in zip(features['anio'], features['semestre'])
    ]
    destino = features.copy()
    destino['anio_clima'] = [periodo[0] for periodo in periodos]
    destino['semestre_clima'] = [periodo[1] for periodo in periodos]
    clima = clima_municipios[COLUMNAS_CLIMA].rename(
        columns={
            'anio': 'anio_clima_fuente',
            'semestre': 'semestre_clima_fuente',
        }
    )
    resultado = destino.merge(
        clima,
        left_on=['cod_mun', 'anio_clima', 'semestre_clima'],
        right_on=['cod_mun', 'anio_clima_fuente', 'semestre_clima_fuente'],
        how='left',
        validate='many_to_one',
    )
    emparejadas = resultado['anio_clima_fuente'].notna()
    if not (
        resultado.loc[emparejadas, 'anio_clima']
        == resultado.loc[emparejadas, 'anio_clima_fuente']
    ).all():
        raise AssertionError('El join climático no preservó el período solicitado')
    if not (
        resultado.loc[emparejadas, 'semestre_clima']
        == resultado.loc[emparejadas, 'semestre_clima_fuente']
    ).all():
        raise AssertionError('El join climático no preservó el semestre solicitado')

    resultado['lag1_faltante'] = resultado['rendimiento_lag1_t_ha'].isna()
    resultado['temperatura_faltante'] = resultado[
        'temperatura_2m_media_c'
    ].isna()
    resultado['suelo_faltante'] = resultado[
        'soil_moisture_0_to_7cm_media'
    ].isna()
    return resultado


def validar_features(
    features: pd.DataFrame,
    modelo: pd.DataFrame,
) -> None:
    """Valida cardinalidad, claves y valores de la tabla de features."""
    if features.duplicated(LLAVE_UNIDAD).any():
        raise ValueError('features_maiz contiene llaves de unidad duplicadas')
    if len(features) != len(modelo):
        raise ValueError(
            f'features_maiz tiene {len(features)} filas; se esperaban {len(modelo)}'
        )
    original = modelo[LLAVE_UNIDAD].sort_values(LLAVE_UNIDAD).reset_index(drop=True)
    preparado = features[LLAVE_UNIDAD].sort_values(LLAVE_UNIDAD).reset_index(drop=True)
    if not original.equals(preparado):
        raise ValueError('El join de features alteró las filas o claves del modelo')

    if not np.isfinite(features['rendimiento_t_ha']).all():
        raise ValueError('Hay rendimientos no finitos en features_maiz')
    if (features['rendimiento_t_ha'] <= 0).any():
        raise ValueError('Hay rendimientos no positivos en features_maiz')

    if not PREDICTORES_PERMITIDOS.issubset(features.columns):
        faltantes = sorted(PREDICTORES_PERMITIDOS - set(features.columns))
        raise ValueError(f'Faltan features permitidas: {faltantes}')

    if features['anio_lag1_fuente'].notna().any():
        delay = features['anio'] - features['anio_lag1_fuente']
        if not delay.dropna().eq(1).all():
            raise ValueError('Hay rezagos que no corresponden al año calendario anterior')
    if features.loc[
        features['conjunto'].eq('PRUEBA') & features['anio'].ge(2020),
        'rendimiento_lag1_t_ha',
    ].notna().any():
        raise ValueError('La prueba final usa un rezago observado a partir de 2019')
    if not features.loc[
        features['conjunto'].eq('PRUEBA') & features['anio'].eq(2019),
        'anio_lag1_fuente',
    ].dropna().le(2018).all():
        raise ValueError('El rezago de 2019 no está congelado en información <= 2018')


def construir_resumen_features(features: pd.DataFrame) -> pd.DataFrame:
    """Resume cobertura y faltantes por conjunto de evaluación."""
    filas: list[dict[str, object]] = []
    grupos = [('TOTAL', features)]
    grupos.extend(
        (str(conjunto), grupo)
        for conjunto, grupo in features.groupby('conjunto', sort=True)
    )
    for conjunto, grupo in grupos:
        filas.append(
            {
                'conjunto': conjunto,
                'filas': int(len(grupo)),
                'municipios': int(grupo['cod_mun'].nunique()),
                'filas_lag1_faltante': int(grupo['lag1_faltante'].sum()),
                'filas_lag1_operativo_faltante': int(
                    grupo['rendimiento_lag1_operativo_t_ha'].isna().sum()
                ),
                'filas_lag1_fuente_fuera_prueba': int(
                    grupo['lag1_fuente_fuera_prueba'].sum()
                ),
                'filas_temperatura_faltante': int(
                    grupo['temperatura_faltante'].sum()
                ),
                'filas_suelo_faltante': int(grupo['suelo_faltante'].sum()),
                'filas_sin_geografia_mgn_2023': int(
                    (~grupo['geografia_mgn_2023']).sum()
                ),
                'codigos_sin_geografia_mgn_2023': ', '.join(
                    str(codigo)
                    for codigo in sorted(
                        grupo.loc[
                            ~grupo['geografia_mgn_2023'], 'cod_mun'
                        ].unique()
                    )
                ),
                'codigos_sin_clima': ', '.join(
                    str(codigo)
                    for codigo in sorted(
                        grupo.loc[
                            grupo['temperatura_faltante']
                            | grupo['suelo_faltante'],
                            'cod_mun',
                        ].unique()
                    )
                ),
            }
        )
    return pd.DataFrame(filas)


def main() -> None:
    """Construye, valida y guarda la tabla de features de MAÍZ."""
    requeridos = [MODELO_MAIZ, COORDENADAS, CLIMA_MUNICIPIOS]
    faltantes = [str(ruta) for ruta in requeridos if not ruta.exists()]
    if faltantes:
        raise FileNotFoundError(
            'Faltan insumos de Fase C: ' + ', '.join(faltantes)
        )

    modelo = pd.read_pickle(MODELO_MAIZ)
    coordenadas = pd.read_csv(COORDENADAS)
    clima = pd.read_csv(CLIMA_MUNICIPIOS)

    features = construir_rezago_rendimiento(modelo)
    features = unir_geografia(features, coordenadas)
    features = unir_clima(features, clima)
    validar_features(features, modelo)
    if len(features) != FILAS_ESPERADAS_MAIZ:
        raise AssertionError(
            f'features_maiz tiene {len(features)} filas; '
            f'se esperaba {FILAS_ESPERADAS_MAIZ}'
        )

    resumen = construir_resumen_features(features)
    PROCESSED.mkdir(parents=True, exist_ok=True)
    features.to_pickle(SALIDA)
    features.to_csv(SALIDA_CSV, index=False, encoding='utf-8-sig')
    resumen.to_csv(REPORTE, index=False, encoding='utf-8-sig')

    print('Features de MAÍZ:')
    print(resumen.to_string(index=False))
    print(SALIDA)
    print(SALIDA_CSV)
    print(REPORTE)


if __name__ == '__main__':
    main()
