from pathlib import Path
import sys

import numpy as np
import pandas as pd
import pytest


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ml' / 'src'))

import diagnostico_inferencia_maiz as di  # noqa: E402


def fila(
    *,
    cod_mun: int = 13001,
    anio: int = 2019,
    real: float = 2.0,
    base: float = 2.0,
    rf: float = 2.0,
    cod_dep: int = 13,
) -> dict[str, object]:
    return {
        'cod_dep': cod_dep,
        'cod_mun': cod_mun,
        'anio': anio,
        'semestre': 'A',
        'sistema': 'TRADICIONAL',
        'rendimiento_t_ha': real,
        'prediccion_linea_base_t_ha': base,
        'prediccion_random_forest_t_ha': rf,
    }


def test_rango_reutiliza_recorte_en_cero_de_inferencia() -> None:
    esperado, inferior, superior = di.construir_rango_desde_residuales(
        np.array([0.5, 2.0]),
        q10=-1.0,
        q90=0.5,
    )

    assert np.allclose(esperado, [0.5, 2.0])
    assert np.allclose(inferior, [0.0, 1.0])
    assert np.allclose(superior, [1.0, 2.5])


def test_cobertura_es_consistente_en_total_y_por_anio() -> None:
    prueba = pd.DataFrame(
        [
            fila(anio=2019, real=1.0, rf=2.0),
            fila(anio=2019, real=5.0, rf=2.0),
            fila(anio=2020, real=2.0, rf=2.0),
        ]
    )

    cobertura, detalle = di.calcular_cobertura_rango(prueba, q10=-1.0, q90=1.0)

    total = cobertura[cobertura['corte'].eq('TOTAL')].iloc[0]
    ano_2019 = cobertura[cobertura['anio'].eq(2019)].iloc[0]
    assert total['filas'] == 3
    assert total['dentro_rango'] == 2
    assert total['cobertura_pct'] == pytest.approx(200 / 3)
    assert ano_2019['filas'] == 2
    assert ano_2019['dentro_rango'] == 1
    assert ano_2019['cobertura_pct'] == pytest.approx(50.0)
    assert len(detalle) == 3
    assert int(detalle['dentro_rango'].sum()) == 2
    assert detalle.loc[detalle['anio'].eq(2020), 'dentro_rango'].iloc[0]


def test_metricas_bolivar_separan_rf_y_linea_base() -> None:
    prueba = pd.DataFrame(
        [
            fila(real=1.0, base=2.0, rf=1.5),
            fila(real=3.0, base=2.0, rf=2.5),
        ]
    )

    metricas = di.calcular_metricas_bolivar_anual(prueba).set_index('modelo')

    assert metricas.loc['LineaBase', 'mae_t_ha'] == pytest.approx(1.0)
    assert metricas.loc['RandomForest', 'mae_t_ha'] == pytest.approx(0.5)
    assert metricas.loc['RandomForest', 'rmse_t_ha'] == pytest.approx(0.5)


def test_bootstrap_es_reproducible_y_conserva_signo_de_mejora() -> None:
    prueba = pd.DataFrame(
        [
            fila(cod_mun=1, real=1.0, base=2.0, rf=1.0),
            fila(cod_mun=2, real=2.0, base=3.0, rf=2.0),
            fila(cod_mun=3, real=3.0, base=4.0, rf=3.0),
            fila(cod_mun=4, real=4.0, base=5.0, rf=4.0),
        ]
    )

    detalle_1, resumen_1 = di.calcular_bootstrap_diferencia_mae(
        prueba,
        num_resampleos=100,
        semilla=7,
    )
    detalle_2, resumen_2 = di.calcular_bootstrap_diferencia_mae(
        prueba,
        num_resampleos=100,
        semilla=7,
    )

    pd.testing.assert_frame_equal(detalle_1, detalle_2)
    pd.testing.assert_frame_equal(resumen_1, resumen_2)
    assert resumen_1.iloc[0]['diferencia_mae_t_ha'] == pytest.approx(1.0)
    assert (detalle_1['diferencia_mae_t_ha'] > 0).all()


def test_rechaza_modelo_distinto_al_rf_congelado() -> None:
    parametros = {
        'max_depth': None,
        'min_samples_leaf': 1,
        'n_estimators': 200,
    }
    seleccion = pd.DataFrame(
        [
            {
                'modelo': 'RandomForest',
                'seleccionada': True,
                'parametros': '{"max_depth": null, "min_samples_leaf": 1, '
                '"n_estimators": 200}',
                'configuracion': 'RandomForest|max_depth=None|'
                'min_samples_leaf=1|n_estimators=200',
            }
        ]
    )
    metadatos = {
        'modelo_para_inferencia': 'RandomForest',
        'modelo_seleccionado_por_folds': 'RandomForest',
        'parametros_inferencia': parametros,
        'configuracion_seleccionada_por_folds': (
            'RandomForest|max_depth=None|min_samples_leaf=1|n_estimators=200'
        ),
    }

    assert di.validar_configuracion_congelada(metadatos, seleccion) == parametros
    metadatos['modelo_para_inferencia'] = 'HistGradientBoosting'
    with pytest.raises(ValueError, match='Random Forest'):
        di.validar_configuracion_congelada(metadatos, seleccion)
