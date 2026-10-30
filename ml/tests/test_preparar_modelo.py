from pathlib import Path
import sys

import pandas as pd
import pytest


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ml' / 'src'))

import preparar_modelo as pm  # noqa: E402


def fila(
    periodo: str,
    *,
    cultivo: str = 'YUCA',
    desagregacion: str = 'YUCA',
    cod_dep: int = 5,
    cod_mun: int = 5001,
    municipio: str = 'MEDELLIN',
    departamento: str = 'ANTIOQUIA',
    anio: int | None = None,
    area_cosechada: float = 10.0,
    produccion: float = 30.0,
) -> dict[str, object]:
    return {
        'cod_dep': cod_dep,
        'departamento': departamento,
        'cod_mun': cod_mun,
        'municipio': municipio,
        'cultivo': cultivo,
        'desagregacion': desagregacion,
        'anio': int(periodo[:4]) if anio is None else anio,
        'periodo': periodo,
        'area_cosechada': area_cosechada,
        'produccion': produccion,
        'fuente': 'prueba',
    }


def test_rendimiento_anual_se_recalcula_como_produccion_sobre_area() -> None:
    datos = pd.DataFrame(
        [
            fila('2019A', area_cosechada=10.0, produccion=30.0),
            fila(
                '2019B',
                desagregacion='YUCA CONSUMO EN FRESCO',
                area_cosechada=20.0,
                produccion=100.0,
            ),
        ]
    )

    unidades = pm.preparar_yuca(datos)

    assert len(unidades) == 1
    assert unidades.loc[0, 'area_cosechada'] == 30.0
    assert unidades.loc[0, 'produccion'] == 130.0
    assert unidades.loc[0, 'rendimiento_t_ha'] == pytest.approx(130.0 / 30.0)
    assert unidades.loc[0, 'rendimiento_t_ha'] != pytest.approx((3.0 + 5.0) / 2)


def test_n_semestres_distingue_anual_un_semestre_y_dos_semestres() -> None:
    datos = pd.DataFrame(
        [
            fila('2018', cod_mun=5001),
            fila('2019A', cod_mun=5002),
            fila('2020A', cod_mun=5003),
            fila('2020B', cod_mun=5003),
        ]
    )

    unidades = pm.preparar_yuca(datos).set_index('cod_mun')

    assert unidades.loc[5001, 'n_semestres'] == 2
    assert unidades.loc[5002, 'n_semestres'] == 1
    assert unidades.loc[5003, 'n_semestres'] == 2


def test_mezcla_anual_y_semestral_falla_antes_de_agregar() -> None:
    datos = pd.DataFrame([fila('2019'), fila('2019A')])

    with pytest.raises(ValueError, match='mezcla periodos ANUAL y A/B'):
        pm.preparar_yuca(datos)


def test_llaves_duplicadas_fallan() -> None:
    datos = pd.DataFrame([{'llave': 1, 'rendimiento_t_ha': 2.0}, {'llave': 1, 'rendimiento_t_ha': 3.0}])

    with pytest.raises(ValueError, match='llaves duplicadas'):
        pm.validar_llaves_unicas(datos, ['llave'], 'prueba')


def test_rendimientos_no_positivos_fallan() -> None:
    datos = pd.DataFrame([{'rendimiento_t_ha': 0.0}])

    with pytest.raises(ValueError, match='rendimientos no positivos'):
        pm.validar_rendimientos_positivos(datos, 'prueba')


def test_feature_prohibida_falla() -> None:
    with pytest.raises(ValueError, match='Variables prohibidas'):
        pm.validar_features_permitidas({'MAIZ': ['departamento', 'area_sembrada']})


def test_maiz_reduce_las_seis_desagregaciones_a_dos_sistemas() -> None:
    desagregaciones = [
        'MAIZ TECNIFICADO',
        'MAIZ AMARILLO TECNIFICADO',
        'MAIZ BLANCO TECNIFICADO',
        'MAIZ TRADICIONAL',
        'MAIZ AMARILLO TRADICIONAL',
        'MAIZ BLANCO TRADICIONAL',
    ]
    datos = pd.DataFrame(
        [
            fila(
                '2019A',
                cultivo='MAIZ',
                desagregacion=desagregacion,
                area_cosechada=10.0,
                produccion=20.0,
            )
            for desagregacion in desagregaciones
        ]
    )

    unidades = pm.preparar_maiz(datos).set_index('sistema')

    assert set(unidades.index) == {'TECNIFICADO', 'TRADICIONAL'}
    assert unidades.loc['TECNIFICADO', 'area_cosechada'] == 30.0
    assert unidades.loc['TRADICIONAL', 'area_cosechada'] == 30.0


def test_maiz_con_desagregacion_desconocida_falla() -> None:
    datos = pd.DataFrame(
        [fila('2019A', cultivo='MAIZ', desagregacion='MAIZ OTRO')]
    )

    with pytest.raises(ValueError, match='desagregacion no reconocidos'):
        pm.preparar_maiz(datos)


def test_yuca_excluye_industrial_y_suma_variantes_frescas() -> None:
    datos = pd.DataFrame(
        [
            fila('2019A', area_cosechada=10.0, produccion=30.0),
            fila(
                '2019B',
                desagregacion='YUCA CONSUMO EN FRESCO',
                area_cosechada=20.0,
                produccion=100.0,
            ),
            fila(
                '2019A',
                desagregacion='YUCA INDUSTRIAL',
                area_cosechada=100.0,
                produccion=300.0,
            ),
        ]
    )

    unidades = pm.preparar_yuca(datos)

    assert len(unidades) == 1
    assert unidades.loc[0, 'area_cosechada'] == 30.0
    assert unidades.loc[0, 'produccion'] == 130.0


def test_name_suma_todas_sus_variantes() -> None:
    datos = pd.DataFrame(
        [
            fila(
                '2019A',
                cultivo='NAME',
                desagregacion='NAME',
                area_cosechada=10.0,
                produccion=30.0,
            ),
            fila(
                '2019B',
                cultivo='NAME',
                desagregacion='NAME VARIANTE',
                area_cosechada=20.0,
                produccion=100.0,
            ),
        ]
    )

    unidades = pm.preparar_name(datos)

    assert len(unidades) == 1
    assert unidades.loc[0, 'area_cosechada'] == 30.0
    assert unidades.loc[0, 'produccion'] == 130.0
    assert unidades.loc[0, 'rendimiento_t_ha'] == pytest.approx(130.0 / 30.0)


def test_alias_de_san_andres_se_normaliza_por_codigo() -> None:
    datos = pd.DataFrame(
        [
            fila(
                '2018',
                cod_dep=88,
                cod_mun=88001,
                departamento='SAN ANDRES Y PROVIDENCIA',
            ),
            fila(
                '2019',
                cod_dep=88,
                cod_mun=88001,
                departamento='ARCHIPIELAGO DE SAN ANDRES, PROVIDENCIA Y SANTA CATALINA',
            ),
        ]
    )

    unidades = pm.preparar_yuca(datos)

    assert set(unidades['departamento']) == {
        'ARCHIPIELAGO DE SAN ANDRES, PROVIDENCIA Y SANTA CATALINA'
    }
