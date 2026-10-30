from pathlib import Path
import sys

import pandas as pd
import pytest


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ml' / 'src'))

import evaluar_linea_base as eb  # noqa: E402


def fila(
    *,
    cultivo: str = 'MAIZ',
    cod_dep: int = 13,
    cod_mun: int = 13001,
    anio: int = 2018,
    conjunto: str = 'ENTRENAMIENTO',
    rendimiento: float = 2.0,
    sistema: str = 'TECNIFICADO',
    n_semestres: int = 2,
) -> dict[str, object]:
    return {
        'cod_dep': cod_dep,
        'departamento': 'BOLIVAR',
        'cod_mun': cod_mun,
        'municipio': f'MUNICIPIO {cod_mun}',
        'anio': anio,
        'semestre': 'A',
        'sistema': sistema,
        'n_semestres': n_semestres,
        'rendimiento_t_ha': rendimiento,
        'conjunto': conjunto,
    }


def test_maiz_usa_historia_por_municipio_y_sistema() -> None:
    datos = pd.DataFrame(
        [
            fila(cod_mun=1, anio=2017, rendimiento=2.0),
            fila(cod_mun=1, anio=2018, rendimiento=4.0),
            fila(cod_mun=2, anio=2018, rendimiento=10.0),
            fila(
                cod_mun=1,
                anio=2019,
                conjunto='PRUEBA',
                rendimiento=5.0,
            ),
        ]
    )

    predicciones = eb.predecir_linea_base(datos, 'MAIZ')

    assert predicciones.loc[0, 'rendimiento_predicho_t_ha'] == pytest.approx(3.0)
    assert predicciones.loc[0, 'origen_prediccion'] == eb.ORIGEN_HISTORIA


def test_maiz_usa_respaldo_si_falta_el_sistema_en_historia() -> None:
    datos = pd.DataFrame(
        [
            fila(cod_mun=1, anio=2017, rendimiento=2.0),
            fila(cod_mun=1, anio=2018, rendimiento=4.0),
            fila(cod_mun=2, anio=2018, rendimiento=10.0),
            fila(
                cod_mun=1,
                anio=2019,
                conjunto='PRUEBA',
                rendimiento=5.0,
                sistema='TRADICIONAL',
            ),
        ]
    )

    predicciones = eb.predecir_linea_base(datos, 'MAIZ')

    assert predicciones.loc[0, 'rendimiento_predicho_t_ha'] == pytest.approx(4.0)
    assert predicciones.loc[0, 'origen_prediccion'] == eb.ORIGEN_RESPALDO


@pytest.mark.parametrize('cultivo', ['YUCA', 'NAME'])
def test_yuca_y_name_usan_historia_por_municipio(cultivo: str) -> None:
    datos = pd.DataFrame(
        [
            fila(cultivo=cultivo, cod_mun=1, anio=2017, rendimiento=6.0),
            fila(cultivo=cultivo, cod_mun=2, anio=2018, rendimiento=10.0),
            fila(
                cultivo=cultivo,
                cod_mun=1,
                anio=2019,
                conjunto='PRUEBA',
                rendimiento=8.0,
            ),
            fila(
                cultivo=cultivo,
                cod_mun=3,
                anio=2019,
                conjunto='PRUEBA',
                rendimiento=9.0,
            ),
        ]
    )

    predicciones = eb.predecir_linea_base(datos, cultivo)

    historica = predicciones[predicciones['cod_mun'].eq(1)].iloc[0]
    respaldo = predicciones[predicciones['cod_mun'].eq(3)].iloc[0]
    assert historica['rendimiento_predicho_t_ha'] == pytest.approx(6.0)
    assert historica['origen_prediccion'] == eb.ORIGEN_HISTORIA
    assert respaldo['rendimiento_predicho_t_ha'] == pytest.approx(8.0)
    assert respaldo['origen_prediccion'] == eb.ORIGEN_RESPALDO


def test_las_medianas_no_usan_rendimientos_de_prueba() -> None:
    datos = pd.DataFrame(
        [
            fila(cod_mun=1, anio=2018, rendimiento=2.0),
            fila(
                cod_mun=1,
                anio=2019,
                conjunto='PRUEBA',
                rendimiento=1000.0,
            ),
        ]
    )

    predicciones = eb.predecir_linea_base(datos, 'MAIZ')

    assert predicciones.loc[0, 'rendimiento_predicho_t_ha'] == pytest.approx(2.0)


def test_etiqueta_temporal_incorrecta_falla() -> None:
    datos = pd.DataFrame(
        [fila(anio=2019, conjunto='ENTRENAMIENTO', rendimiento=2.0)]
    )

    with pytest.raises(ValueError, match='años > 2018'):
        eb.predecir_linea_base(datos, 'MAIZ')


def test_metricas_mae_rmse_y_mape() -> None:
    datos = pd.DataFrame(
        {
            'rendimiento_t_ha': [2.0, 4.0],
            'rendimiento_predicho_t_ha': [1.0, 6.0],
        }
    )

    metricas = eb.calcular_metricas(datos)

    assert metricas['mae_t_ha'] == pytest.approx(1.5)
    assert metricas['rmse_t_ha'] == pytest.approx(((1.0**2 + 2.0**2) / 2) ** 0.5)
    assert metricas['mape_pct'] == pytest.approx(50.0)


def test_resumen_reporta_porcentaje_de_filas_con_respaldo() -> None:
    datos = pd.DataFrame(
        [
            fila(cod_mun=1, anio=2018, rendimiento=2.0),
            fila(cod_mun=2, anio=2018, rendimiento=4.0),
            fila(
                cod_mun=1,
                anio=2019,
                conjunto='PRUEBA',
                rendimiento=5.0,
            ),
            fila(
                cod_mun=3,
                anio=2019,
                conjunto='PRUEBA',
                rendimiento=8.0,
            ),
        ]
    )
    predicciones = eb.predecir_linea_base(datos, 'MAIZ')

    resumen = eb.construir_resumen_respaldo(predicciones, 'MAIZ', eb.ESCENARIO_TODOS)
    metricas = eb.construir_metricas_origen(
        predicciones,
        'MAIZ',
        eb.ESCENARIO_TODOS,
    )
    historia = metricas[
        metricas['origen_prediccion'].eq(eb.ORIGEN_HISTORIA)
        & metricas['corte'].eq('TOTAL')
    ].iloc[0]
    respaldo = metricas[
        metricas['origen_prediccion'].eq(eb.ORIGEN_RESPALDO)
        & metricas['corte'].eq('TOTAL')
    ].iloc[0]

    assert resumen['filas_prueba'] == 2
    assert resumen['filas_con_historia'] == 1
    assert resumen['filas_con_respaldo'] == 1
    assert resumen['pct_filas_con_respaldo'] == pytest.approx(50.0)
    assert historia['filas'] == 1
    assert respaldo['filas'] == 1
    assert respaldo['mae_t_ha'] > historia['mae_t_ha']


def test_cortes_incluyen_anio_bolivar_y_caribe() -> None:
    datos = pd.DataFrame(
        [
            fila(cod_dep=13, cod_mun=1, anio=2018, rendimiento=2.0),
            fila(cod_dep=8, cod_mun=2, anio=2018, rendimiento=3.0),
            fila(
                cod_dep=13,
                cod_mun=1,
                anio=2019,
                conjunto='PRUEBA',
                rendimiento=4.0,
            ),
            fila(
                cod_dep=8,
                cod_mun=2,
                anio=2020,
                conjunto='PRUEBA',
                rendimiento=5.0,
            ),
        ]
    )
    predicciones = eb.predecir_linea_base(datos, 'MAIZ')

    cortes = eb.construir_metricas_cortes(
        predicciones,
        'MAIZ',
        eb.ESCENARIO_TODOS,
    )

    assert set(cortes['corte']) == {'TOTAL', 'ANIO', 'BOLIVAR', 'CARIBE'}
    assert set(cortes.loc[cortes['corte'].eq('ANIO'), 'anio']) == {2019, 2020}


def test_yuca_sin_medio_semestre_excluye_esos_datos() -> None:
    datos = pd.DataFrame(
        [
            fila(
                cultivo='YUCA',
                cod_mun=1,
                anio=2018,
                rendimiento=2.0,
                n_semestres=1,
            ),
            fila(
                cultivo='YUCA',
                cod_mun=2,
                anio=2018,
                rendimiento=4.0,
                n_semestres=2,
            ),
            fila(
                cultivo='YUCA',
                cod_mun=1,
                anio=2019,
                conjunto='PRUEBA',
                rendimiento=3.0,
                n_semestres=1,
            ),
            fila(
                cultivo='YUCA',
                cod_mun=2,
                anio=2019,
                conjunto='PRUEBA',
                rendimiento=5.0,
                n_semestres=2,
            ),
        ]
    )

    predicciones = eb.predecir_linea_base(
        datos,
        'YUCA',
        eb.ESCENARIO_SIN_MEDIO_SEMESTRE,
    )

    assert len(predicciones) == 1
    assert predicciones.loc[0, 'cod_mun'] == 2
    assert predicciones.loc[0, 'n_semestres'] == 2


def test_conteos_reales_de_filas_con_respaldo() -> None:
    _, _, _, respaldo = eb.evaluar_cultivos()
    respaldo = respaldo[respaldo['escenario'].eq(eb.ESCENARIO_TODOS)].set_index(
        'cultivo'
    )

    assert respaldo.loc['MAIZ', 'filas_con_respaldo'] == 179
    assert respaldo.loc['YUCA', 'filas_con_respaldo'] == 48
    assert respaldo.loc['NAME', 'filas_con_respaldo'] == 38
    assert respaldo.loc['MAIZ', 'pct_filas_con_respaldo'] == pytest.approx(1.604805)
    assert respaldo.loc['YUCA', 'pct_filas_con_respaldo'] == pytest.approx(1.163636)
    assert respaldo.loc['NAME', 'pct_filas_con_respaldo'] == pytest.approx(5.928237)
