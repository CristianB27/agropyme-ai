from pathlib import Path
import sys

import numpy as np
import pandas as pd
import pytest


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ml' / 'src'))

import evaluar_modelos_maiz as em  # noqa: E402
import descargar_clima_era5_land as clima  # noqa: E402


def fila(
    *,
    anio: int,
    cod_mun: int = 1,
    sistema: str = 'TRADICIONAL',
    conjunto: str = 'ENTRENAMIENTO',
    rendimiento: float = 2.0,
    lag: float | None = 1.5,
    temperatura: float | None = 20.0,
    suelo: float | None = 0.3,
) -> dict[str, object]:
    return {
        'cod_dep': 13,
        'cod_mun': cod_mun,
        'anio': anio,
        'semestre': 'A',
        'sistema': sistema,
        'departamento': 'BOLIVAR',
        'municipio': 'CARTAGENA',
        'rendimiento_t_ha': rendimiento,
        'conjunto': conjunto,
        'rendimiento_lag1_t_ha': lag,
        'temperatura_2m_media_c': temperatura,
        'soil_moisture_0_to_7cm_media': suelo,
    }


def test_hay_tres_configuraciones_por_modelo() -> None:
    candidatos = em.configuraciones()

    assert len(candidatos) == 9
    conteo = pd.Series([candidato['modelo'] for candidato in candidatos]).value_counts()
    assert conteo.to_dict() == {modelo: 3 for modelo in em.MODELOS}


def test_folds_son_expansivos_y_no_incluyen_el_anio_validado() -> None:
    filas = [
        fila(anio=anio, cod_mun=1)
        for anio in range(2013, 2019)
    ]
    filas.extend(fila(anio=anio, cod_mun=2) for anio in range(2013, 2019))
    features = pd.DataFrame(filas)

    folds = em.crear_folds(features)

    assert [fold['anio_validacion'] for fold in folds] == list(em.ANIOS_VALIDACION)
    for fold in folds:
        assert fold['anio_max_entrenamiento'] == fold['anio_validacion'] - 1
        assert fold['entrenamiento']['anio'].max() < fold['anio_validacion']
        assert set(fold['validacion']['anio']) == {fold['anio_validacion']}


def test_imputacion_se_ajusta_solo_con_el_entrenamiento_del_fold() -> None:
    entrenamiento = pd.DataFrame(
        [
            fila(anio=2013, lag=1.0),
            fila(anio=2013, cod_mun=2, lag=3.0),
        ]
    )
    validacion = pd.DataFrame([fila(anio=2014, lag=np.nan)])
    pipeline = em.construir_pipeline('Ridge', {'alpha': 1.0})

    pipeline.fit(entrenamiento[em.PREDICTORES], entrenamiento['rendimiento_t_ha'])
    imputador = pipeline.named_steps['preprocesador'].named_transformers_[
        'numericas'
    ].named_steps['imputador']
    indice_lag = em.NUMERICAS.index('rendimiento_lag1_t_ha')

    assert imputador.statistics_[indice_lag] == pytest.approx(2.0)
    assert np.isnan(validacion.loc[0, 'rendimiento_lag1_t_ha'])


def test_se_rechazan_filas_de_prueba_distintas() -> None:
    referencia = pd.DataFrame([fila(anio=2019, conjunto='PRUEBA')])
    candidato = pd.DataFrame(
        [fila(anio=2019, conjunto='PRUEBA', cod_mun=2)]
    )

    with pytest.raises(AssertionError, match='mismas filas'):
        em._validar_filas_identicas(referencia, candidato, 'Ridge')


def test_celda_climatica_incompleta_se_marca_como_faltante() -> None:
    payloads = []
    for variable in clima.VARIABLES:
        payloads.append(
            (
                'fuente_sintetica',
                variable,
                [
                    {
                        'celda_x': 1,
                        'celda_y': 1,
                        'anio': 2006,
                        'semestre': 'B',
                        'suma': 100.0,
                        'conteo': 10,
                    }
                ],
            )
        )
    consolidado = clima._consolidar_celdas(payloads, {(1, 1)})

    assert 'temperatura_2m_media_c' in consolidado.columns
    assert 'soil_moisture_0_to_7cm_media' in consolidado.columns
    assert 'temperatura_2m_media_c_media' not in consolidado.columns

    cobertura = clima.validar_cobertura_celdas(
        consolidado,
        {(1, 1), (2, 2)},
    )
    faltantes = cobertura[
        cobertura['celda_x'].eq(2)
        & ~cobertura['semestre_presente']
    ]
    assert len(faltantes) == len(clima.periodos_clima_requeridos())
    assert set(
        zip(faltantes['anio'].astype(int), faltantes['semestre'].astype(str))
    ) == clima.periodos_clima_requeridos()
