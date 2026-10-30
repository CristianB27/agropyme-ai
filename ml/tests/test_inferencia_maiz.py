from pathlib import Path
import sys

import pandas as pd
import pytest


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ml' / 'src'))

import inferencia_maiz as im  # noqa: E402


def fila(
    *,
    cod_dep: int = 13,
    cod_mun: int = 13001,
    municipio: str = 'CARTAGENA',
    anio: int = 2018,
    semestre: str = 'A',
    sistema: str = 'TECNIFICADO',
    rendimiento: float = 2.0,
    conjunto: str = 'ENTRENAMIENTO',
    clima: float = 27.0,
) -> dict[str, object]:
    return {
        'cod_dep': cod_dep,
        'departamento': 'BOLIVAR',
        'cod_mun': cod_mun,
        'municipio': municipio,
        'anio': anio,
        'semestre': semestre,
        'sistema': sistema,
        'rendimiento_t_ha': rendimiento,
        'conjunto': conjunto,
        'rendimiento_lag1_t_ha': 1.8,
        'temperatura_2m_media_c': clima,
        'soil_moisture_0_to_7cm_media': 0.25,
    }


def test_seleccion_usa_solo_mae_medio_de_folds() -> None:
    resumen = pd.DataFrame(
        [
            {
                'modelo': 'LineaBase',
                'configuracion': 'base',
                'mae_medio': 0.50,
                'rmse_medio': 0.70,
                'mape_medio': 25.0,
                'mae_desviacion': 0.05,
            },
            {
                'modelo': 'RandomForest',
                'configuracion': 'rf',
                'mae_medio': 0.40,
                'rmse_medio': 0.65,
                'mape_medio': 23.0,
                'mae_desviacion': 0.04,
            },
            {
                'modelo': 'HistGradientBoosting',
                'configuracion': 'hgb',
                'mae_medio': 0.41,
                'rmse_medio': 0.60,
                'mape_medio': 22.0,
                'mae_desviacion': 0.03,
            },
        ]
    )

    elegido = im.seleccionar_modelo_por_folds(resumen)

    assert elegido['modelo'] == 'RandomForest'


def test_veto_usa_linea_base_si_ningun_modelo_mejora_mae() -> None:
    candidato = pd.Series(
        {
            'modelo': 'RandomForest',
            'configuracion': 'rf',
        }
    )
    metricas = pd.DataFrame(
        [
            {'modelo': 'LineaBase', 'mae_t_ha': 0.90},
            {'modelo': 'RandomForest', 'mae_t_ha': 0.91},
            {'modelo': 'HistGradientBoosting', 'mae_t_ha': 0.92},
        ]
    )

    modelo, motivo, veto = im.aplicar_veto_despliegue(candidato, metricas)

    assert modelo == 'LineaBase'
    assert veto is True
    assert 'Ningún modelo' in motivo


def test_prueba_no_reemplaza_ganador_de_folds() -> None:
    candidato = pd.Series(
        {
            'modelo': 'RandomForest',
            'configuracion': 'rf',
        }
    )
    metricas = pd.DataFrame(
        [
            {'modelo': 'LineaBase', 'mae_t_ha': 0.90},
            {'modelo': 'RandomForest', 'mae_t_ha': 0.91},
            {'modelo': 'HistGradientBoosting', 'mae_t_ha': 0.80},
        ]
    )

    modelo, motivo, veto = im.aplicar_veto_despliegue(candidato, metricas)

    assert modelo == 'RandomForest'
    assert veto is False
    assert 'no participa del ranking' in motivo


def test_perfiles_usan_solo_historia_recibida() -> None:
    datos = pd.DataFrame(
        [
            fila(anio=2017, semestre='A', rendimiento=1.5),
            fila(anio=2018, semestre='A', rendimiento=2.5),
            fila(anio=2019, semestre='A', rendimiento=99.0, conjunto='PRUEBA'),
        ]
    )
    entrenamiento = datos[datos['conjunto'].eq('ENTRENAMIENTO')].copy()

    perfiles = im.construir_perfiles_historicos(entrenamiento)

    assert len(perfiles) == 1
    assert perfiles.iloc[0]['filas_historicas'] == 2
    assert perfiles.iloc[0]['anio_fin'] == 2018
    assert perfiles.iloc[0]['rendimiento_historico_mediano_t_ha'] == pytest.approx(2.0)


def test_intervalo_usa_residuales_firmados_de_folds() -> None:
    predicciones = pd.DataFrame(
        {
            'modelo': ['RandomForest'] * 5,
            'rendimiento_t_ha': [1.0, 2.0, 3.0, 4.0, 5.0],
            'rendimiento_predicho_t_ha': [0.5, 2.0, 2.0, 4.0, 6.0],
            'error_absoluto_t_ha': [0.5, 0.0, 1.0, 0.0, 1.0],
        }
    )

    q10, q90, mae = im._intervalo_residual(predicciones, 'RandomForest')

    assert q10 == pytest.approx(-0.6)
    assert q90 == pytest.approx(0.8)
    assert mae == pytest.approx(0.5)


def test_tabla_esperada_tiene_rango_ordenado_y_sin_duplicados() -> None:
    datos = pd.DataFrame(
        [
            fila(anio=2017, semestre='A', rendimiento=1.5),
            fila(anio=2018, semestre='A', rendimiento=2.5),
        ]
    )
    perfiles = im.construir_perfiles_historicos(datos)

    tabla, _ = im.preparar_tabla_esperada(
        datos,
        perfiles,
        'LineaBase',
        {},
        -0.5,
        0.8,
    )

    assert len(tabla) == 1
    assert tabla.iloc[0]['rendimiento_esperado_t_ha'] == pytest.approx(2.0)
    assert tabla.iloc[0]['rango_inferior_t_ha'] == pytest.approx(1.5)
    assert tabla.iloc[0]['rango_superior_t_ha'] == pytest.approx(2.8)
    assert not tabla.duplicated(im.CLAVES_GRUPO).any()


def test_tabla_esperada_registra_configuracion_de_random_forest() -> None:
    datos = pd.DataFrame(
        [
            fila(anio=2017, semestre='A', rendimiento=1.5),
            fila(anio=2018, semestre='A', rendimiento=2.5),
        ]
    )
    perfiles = im.construir_perfiles_historicos(datos)
    parametros = {
        'max_depth': None,
        'min_samples_leaf': 1,
        'n_estimators': 20,
    }

    tabla, _ = im.preparar_tabla_esperada(
        datos,
        perfiles,
        'RandomForest',
        parametros,
        -0.5,
        0.8,
    )

    assert tabla.iloc[0]['modelo_inferencia'] == 'RandomForest'
    assert tabla.iloc[0]['configuracion_inferencia'] == (
        'RandomForest|max_depth=None|min_samples_leaf=1|n_estimators=20'
    )


def test_inferencia_normaliza_nombre_y_desambigua_cod_mun() -> None:
    tabla = pd.DataFrame(
        [
            {
                'cod_dep': 5,
                'departamento': 'ANTIOQUIA',
                'cod_mun': 5055,
                'municipio': 'ARGELIA',
                'sistema': 'TRADICIONAL',
                'semestre': 'A',
                'rendimiento_esperado_t_ha': 2.1,
                'rango_inferior_t_ha': 1.5,
                'rango_superior_t_ha': 2.7,
                'modelo_inferencia': 'RandomForest',
            },
            {
                'cod_dep': 19,
                'departamento': 'CAUCA',
                'cod_mun': 19050,
                'municipio': 'ARGELIA',
                'sistema': 'TRADICIONAL',
                'semestre': 'A',
                'rendimiento_esperado_t_ha': 3.1,
                'rango_inferior_t_ha': 2.5,
                'rango_superior_t_ha': 3.7,
                'modelo_inferencia': 'RandomForest',
            },
        ]
    )

    with pytest.raises(ValueError, match='ambiguo'):
        im.predecir_rendimiento_maiz(
            'argelia',
            'a',
            'tradicional',
            tabla=tabla,
        )

    resultado = im.predecir_rendimiento_maiz(
        'ARGELIA',
        'A',
        'TRADICIONAL',
        cod_mun=19050,
        tabla=tabla,
    )

    assert resultado['cod_dep'] == 19
    assert resultado['rendimiento_esperado_t_ha'] == pytest.approx(3.1)
