from pathlib import Path

import pandas as pd
import pytest


ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / 'data' / 'processed'
VALID_CYCLE_VALUES = {'PERMANENTE', 'TRANSITORIO', 'ANUAL'}


@pytest.fixture(scope='module')
def clean_df() -> pd.DataFrame:
    return pd.read_pickle(PROCESSED / 'eva_limpio.pkl')


@pytest.fixture(scope='module')
def exported_csv() -> pd.DataFrame:
    return pd.read_csv(
        PROCESSED / 'eva_2007_2024_limpio.csv',
        dtype={
            'periodo': str,
            'estado_fisico_produccion': str,
        },
    )


def test_ciclo_values_are_valid(
    clean_df: pd.DataFrame,
    exported_csv: pd.DataFrame,
) -> None:
    for dataframe in (clean_df, exported_csv):
        cycle_values = set(dataframe['ciclo'].unique())

        assert dataframe['ciclo'].notna().all()
        assert cycle_values <= VALID_CYCLE_VALUES
        assert 'PERMANENTE' in cycle_values
        assert 'TRANSITORIO' in cycle_values
        assert 'ANUAL' in cycle_values


def test_old_source_ciclo_does_not_contain_physical_states(clean_df: pd.DataFrame) -> None:
    old_source = clean_df[clean_df['fuente'] == '2007-2018']
    physical_states = set(old_source['estado_fisico_produccion'].dropna().unique())

    assert physical_states
    assert set(old_source['ciclo'].unique()).isdisjoint(physical_states)


def test_new_source_has_no_physical_state(clean_df: pd.DataFrame) -> None:
    new_source = clean_df[clean_df['fuente'] == '2019-2024']

    assert new_source['estado_fisico_produccion'].isna().all()


def test_san_andres_rows_are_in_caribe_region(exported_csv: pd.DataFrame) -> None:
    san_andres_rows = exported_csv[exported_csv['cod_dep'].eq(88)]

    assert len(san_andres_rows) == 258
    assert san_andres_rows['region_caribe'].eq(True).all()


def test_no_duplicate_natural_keys(clean_df: pd.DataFrame) -> None:
    key = ['cod_mun', 'cultivo', 'desagregacion', 'anio', 'periodo']

    assert not clean_df.duplicated(subset=key).any()
