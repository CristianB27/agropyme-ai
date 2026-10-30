"""Prepara unidades de análisis para los modelos de rendimiento de AgroPyme AI."""

from pathlib import Path

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / 'data' / 'processed'
ENTRENAMIENTO_HASTA = 2018
COD_DEP_BOLIVAR = 13

# El segundo reporte usa el nombre oficial del departamento. Normalizarlo aquí
# evita que una misma categoría departamental se divida entre train y test.
DEPARTAMENTOS_CANONICOS = {
    88: 'ARCHIPIELAGO DE SAN ANDRES, PROVIDENCIA Y SANTA CATALINA',
}

# El color del maíz se descarta porque solo está disponible desde 2019.
SISTEMA_MAIZ = {
    'MAIZ TECNIFICADO': 'TECNIFICADO',
    'MAIZ AMARILLO TECNIFICADO': 'TECNIFICADO',
    'MAIZ BLANCO TECNIFICADO': 'TECNIFICADO',
    'MAIZ TRADICIONAL': 'TRADICIONAL',
    'MAIZ AMARILLO TRADICIONAL': 'TRADICIONAL',
    'MAIZ BLANCO TRADICIONAL': 'TRADICIONAL',
}
YUCA_FRESCA = {'YUCA', 'YUCA CONSUMO EN FRESCO'}
YUCA_EXCLUIDA = {'YUCA INDUSTRIAL'}

# Solo estas variables pueden entrar al modelo. Los rezagos y el clima se
# añadirán en una fase posterior, sin cambiar la regla de variables prohibidas.
FEATURES_PERMITIDAS = [
    'departamento',
    'municipio',
    'sistema',
    'anio',
    'semestre',
]
FEATURES_POR_CULTIVO = {
    'MAIZ': FEATURES_PERMITIDAS,
    'YUCA': [feature for feature in FEATURES_PERMITIDAS if feature != 'sistema'],
    'NAME': [feature for feature in FEATURES_PERMITIDAS if feature != 'sistema'],
}
VARIABLES_PROHIBIDAS = [
    'produccion',
    'area_cosechada',
    'rendimiento',
    'rendimiento_t_ha',
    'area_sembrada',
]


def validar_features_permitidas(features: dict[str, list[str]]) -> None:
    """Detiene la preparación si una feature contiene una variable prohibida."""
    grupos = {'GLOBAL': FEATURES_PERMITIDAS, **features}
    for cultivo, variables in grupos.items():
        prohibidas = set(variables) & set(VARIABLES_PROHIBIDAS)
        if prohibidas:
            raise ValueError(
                f'Variables prohibidas en FEATURES_PERMITIDAS[{cultivo!r}]: '
                f'{sorted(prohibidas)}'
            )


def normalizar_departamentos(dataframe: pd.DataFrame) -> pd.DataFrame:
    """Unifica aliases departamentales usando el código como identificador estable."""
    resultado = dataframe.copy()
    codigo_departamento = pd.to_numeric(resultado['cod_dep'], errors='coerce')
    for codigo, nombre in DEPARTAMENTOS_CANONICOS.items():
        resultado.loc[codigo_departamento.eq(codigo), 'departamento'] = nombre
    return resultado


def validar_llaves_unicas(
    dataframe: pd.DataFrame,
    llaves: list[str],
    contexto: str,
) -> None:
    """Detiene la preparación si una llave de unidad está duplicada."""
    duplicadas = dataframe.duplicated(subset=llaves, keep=False)
    if duplicadas.any():
        ejemplos = (
            dataframe.loc[duplicadas, llaves]
            .drop_duplicates()
            .head(5)
            .to_dict(orient='records')
        )
        raise ValueError(
            f'{contexto}: se encontraron llaves duplicadas {llaves}. '
            f'Ejemplos: {ejemplos}'
        )


def validar_rendimientos_positivos(dataframe: pd.DataFrame, contexto: str) -> None:
    """Detiene la preparación si un rendimiento agregado no es positivo y finito."""
    rendimiento = dataframe['rendimiento_t_ha']
    invalidos = (
        rendimiento.isna()
        | ~np.isfinite(rendimiento)
        | (rendimiento <= 0)
    )
    if invalidos.any():
        ejemplos = dataframe.loc[invalidos, ['rendimiento_t_ha']].head(5).to_dict('records')
        raise ValueError(
            f'{contexto}: se encontraron rendimientos no positivos o no finitos. '
            f'Ejemplos: {ejemplos}'
        )


def separar_anio_semestre(dataframe: pd.DataFrame) -> pd.DataFrame:
    """Separa año y semestre, y valida que el año coincida con `periodo`."""
    resultado = dataframe.copy()
    periodo = resultado['periodo'].astype('string').str.strip().str.upper()
    periodo = periodo.str.replace(r'^(\d+)\.0$', r'\1', regex=True)

    formato_valido = periodo.str.fullmatch(r'\d{4}(?:[AB])?').fillna(False)
    if not formato_valido.all():
        ejemplos = periodo[~formato_valido].drop_duplicates().head(10).tolist()
        raise ValueError(
            'Hay valores de periodo con formato no esperado; se esperan '
            f'AAAA, AAAA-A o AAAA-B. Ejemplos: {ejemplos}'
        )

    anio_periodo = pd.to_numeric(
        periodo.str.extract(r'^(\d{4})', expand=False),
        errors='coerce',
    )
    anio = pd.to_numeric(resultado['anio'], errors='coerce')
    anio_invalido = anio.isna() | anio_periodo.isna() | (anio != anio_periodo)
    if anio_invalido.any():
        raise ValueError(
            'La columna anio no coincide con el año incluido en periodo. '
            f'Se encontraron {int(anio_invalido.sum())} filas incompatibles.'
        )

    resultado['anio'] = anio.astype(int)
    resultado['semestre'] = periodo.str.extract(r'([AB])$', expand=False).fillna('ANUAL')
    return resultado


def _validar_columnas(dataframe: pd.DataFrame) -> None:
    requeridas = {
        'cod_dep',
        'departamento',
        'cod_mun',
        'municipio',
        'cultivo',
        'desagregacion',
        'anio',
        'periodo',
        'area_cosechada',
        'produccion',
        'fuente',
    }
    faltantes = requeridas - set(dataframe.columns)
    if faltantes:
        raise ValueError(f'Faltan columnas requeridas en el dataset limpio: {sorted(faltantes)}')


def _validar_desagregaciones_maiz(dataframe: pd.DataFrame) -> None:
    valores = dataframe['desagregacion'].dropna().unique()
    desconocidos = sorted(set(valores) - set(SISTEMA_MAIZ))
    if dataframe['desagregacion'].isna().any() or desconocidos:
        vacios = int(dataframe['desagregacion'].isna().sum())
        raise ValueError(
            'MAIZ: hay valores de desagregacion no reconocidos. '
            f'Vacios: {vacios}; valores: {desconocidos}. '
            'Revisa el mapeo de sistema antes de continuar.'
        )


def _detectar_mezcla_anual_semestral(
    dataframe: pd.DataFrame,
    cultivo: str,
    llaves: list[str],
) -> None:
    periodos = dataframe.groupby(llaves)['semestre'].agg(lambda valores: set(valores))
    mezclados = periodos[
        periodos.map(lambda valores: 'ANUAL' in valores and bool({'A', 'B'} & valores))
    ]
    if not mezclados.empty:
        ejemplos = mezclados.head(5).to_dict()
        raise ValueError(
            f'{cultivo}: un municipio-año mezcla periodos ANUAL y A/B en la misma '
            f'unidad. Se requiere una decisión antes de sumar. Ejemplos: {ejemplos}'
        )


def _unidades_anuales(
    dataframe: pd.DataFrame,
    cultivo: str,
) -> pd.DataFrame:
    llaves = ['cod_dep', 'cod_mun', 'anio']

    periodos_por_unidad = (
        dataframe.groupby(llaves)['semestre']
        .agg(
            lambda valores: (
                2
                if 'ANUAL' in set(valores)
                else int(valores.nunique())
            )
        )
        .rename('n_semestres')
        .reset_index()
    )

    unidades = (
        dataframe.groupby(llaves, as_index=False)
        .agg(
            departamento=('departamento', 'first'),
            municipio=('municipio', 'first'),
            fuente=('fuente', 'first'),
            area_cosechada=('area_cosechada', 'sum'),
            produccion=('produccion', 'sum'),
        )
        .merge(periodos_por_unidad, on=llaves, how='left', validate='one_to_one')
    )

    # La unidad de análisis de yuca y ñame es municipio-año. `semestre=ANUAL`
    # describe la frecuencia de publicación; `n_semestres` conserva la cobertura real.
    unidades['semestre'] = 'ANUAL'
    unidades['rendimiento_t_ha'] = unidades['produccion'] / unidades['area_cosechada']
    unidades['conjunto'] = np.where(
        unidades['anio'] <= ENTRENAMIENTO_HASTA,
        'ENTRENAMIENTO',
        'PRUEBA',
    )

    validar_llaves_unicas(unidades, llaves, f'{cultivo} unidades anuales')
    validar_rendimientos_positivos(unidades, f'{cultivo} unidades anuales')
    return unidades.sort_values(llaves).reset_index(drop=True)


def preparar_maiz(dataframe: pd.DataFrame) -> pd.DataFrame:
    """Prepara maíz por municipio-año-semestre-sistema."""
    _validar_columnas(dataframe)
    datos = normalizar_departamentos(separar_anio_semestre(dataframe))
    datos = datos[datos['cultivo'].eq('MAIZ')].copy()
    _validar_desagregaciones_maiz(datos)
    datos['sistema'] = datos['desagregacion'].map(SISTEMA_MAIZ)

    llaves = ['cod_dep', 'cod_mun', 'anio', 'semestre', 'sistema']
    unidades = (
        datos.groupby(llaves, as_index=False)
        .agg(
            departamento=('departamento', 'first'),
            municipio=('municipio', 'first'),
            fuente=('fuente', 'first'),
            area_cosechada=('area_cosechada', 'sum'),
            produccion=('produccion', 'sum'),
        )
    )
    unidades['rendimiento_t_ha'] = unidades['produccion'] / unidades['area_cosechada']
    unidades['conjunto'] = np.where(
        unidades['anio'] <= ENTRENAMIENTO_HASTA,
        'ENTRENAMIENTO',
        'PRUEBA',
    )

    validar_llaves_unicas(unidades, llaves, 'MAIZ unidades')
    validar_rendimientos_positivos(unidades, 'MAIZ unidades')
    return unidades.sort_values(llaves).reset_index(drop=True)


def preparar_yuca(dataframe: pd.DataFrame) -> pd.DataFrame:
    """Prepara yuca fresca por municipio-año y excluye yuca industrial."""
    _validar_columnas(dataframe)
    datos = normalizar_departamentos(separar_anio_semestre(dataframe))
    datos = datos[datos['cultivo'].eq('YUCA')].copy()

    permitidas = YUCA_FRESCA | YUCA_EXCLUIDA
    desconocidas = sorted(set(datos['desagregacion'].dropna().unique()) - permitidas)
    if datos['desagregacion'].isna().any() or desconocidas:
        raise ValueError(
            'YUCA: hay valores de desagregacion no reconocidos. '
            f'Vacios: {int(datos["desagregacion"].isna().sum())}; '
            f'valores: {desconocidas}. Revisa el mapeo antes de continuar.'
        )

    datos = datos[datos['desagregacion'].isin(YUCA_FRESCA)].copy()
    llaves = ['cod_dep', 'cod_mun', 'anio']
    _detectar_mezcla_anual_semestral(datos, 'YUCA', llaves)
    return _unidades_anuales(datos, 'YUCA')


def preparar_name(dataframe: pd.DataFrame) -> pd.DataFrame:
    """Prepara ñame por municipio-año, sumando todas sus variantes."""
    _validar_columnas(dataframe)
    datos = normalizar_departamentos(separar_anio_semestre(dataframe))
    datos = datos[datos['cultivo'].eq('NAME')].copy()
    llaves = ['cod_dep', 'cod_mun', 'anio']
    _detectar_mezcla_anual_semestral(datos, 'NAME', llaves)
    return _unidades_anuales(datos, 'NAME')


def construir_resumen_preparacion(
    datasets: dict[str, pd.DataFrame],
) -> pd.DataFrame:
    """Resume tamaños de los conjuntos y municipios sin historia previa.

    La métrica de municipios sin historia se calcula por cultivo, contando
    municipios distintos (identificados por ``(cod_dep, cod_mun)``), no unidades:

    - Numerador: municipios presentes en PRUEBA que no aparecen en ninguna
      unidad de ENTRENAMIENTO del mismo cultivo.
    - Denominador: todos los municipios distintos presentes en PRUEBA.
    - Porcentaje: ``100 * numerador / denominador``.

    En maíz la historia se evalúa únicamente por municipio: no se exige que el
    municipio tenga el mismo sistema (TECNIFICADO o TRADICIONAL) en prueba y
    entrenamiento. Si aparece con cualquiera de los dos sistemas en
    entrenamiento, cuenta como municipio con historia.
    """
    filas = []
    for cultivo, dataframe in datasets.items():
        entrenamiento = dataframe[dataframe['conjunto'].eq('ENTRENAMIENTO')]
        prueba = dataframe[dataframe['conjunto'].eq('PRUEBA')]

        # Numerador y denominador usan municipios distintos, no unidades.
        # En maíz no se compara sistema: cualquier sistema en entrenamiento
        # implica que el municipio tiene historia.
        municipios_entrenamiento = set(
            zip(entrenamiento['cod_dep'], entrenamiento['cod_mun'])
        )
        municipios_prueba = set(zip(prueba['cod_dep'], prueba['cod_mun']))
        municipios_sin_historia = municipios_prueba - municipios_entrenamiento
        porcentaje_sin_historia = (
            100 * len(municipios_sin_historia) / len(municipios_prueba)
            if municipios_prueba
            else 0.0
        )

        filas.append(
            {
                'cultivo': cultivo,
                'unidades_totales': len(dataframe),
                'unidades_entrenamiento': len(entrenamiento),
                'unidades_prueba': len(prueba),
                'unidades_prueba_bolivar': int(prueba['cod_dep'].eq(COD_DEP_BOLIVAR).sum()),
                'porcentaje_municipios_prueba_sin_historia_entrenamiento': round(
                    porcentaje_sin_historia,
                    2,
                ),
            }
        )

    return pd.DataFrame(filas)


def construir_log_preparacion(
    datos_limpios: pd.DataFrame,
    datasets: dict[str, pd.DataFrame],
) -> pd.DataFrame:
    """Registra las filas de entrada, exclusiones y unidades resultantes."""
    filas = []

    maiz_entrada = datos_limpios[datos_limpios['cultivo'].eq('MAIZ')]
    filas.extend(
        [
            {
                'cultivo': 'MAIZ',
                'paso': 'Filas de entrada',
                'filas_iniciales': len(maiz_entrada),
                'filas_resultantes': len(maiz_entrada),
            },
            {
                'cultivo': 'MAIZ',
                'paso': 'Unidades municipio-año-semestre-sistema',
                'filas_iniciales': len(maiz_entrada),
                'filas_resultantes': len(datasets['MAIZ']),
            },
        ]
    )

    yuca_entrada = datos_limpios[datos_limpios['cultivo'].eq('YUCA')]
    yuca_fresca = yuca_entrada[yuca_entrada['desagregacion'].isin(YUCA_FRESCA)]
    filas.extend(
        [
            {
                'cultivo': 'YUCA',
                'paso': 'Filas de entrada',
                'filas_iniciales': len(yuca_entrada),
                'filas_resultantes': len(yuca_entrada),
            },
            {
                'cultivo': 'YUCA',
                'paso': 'Exclusión de YUCA INDUSTRIAL',
                'filas_iniciales': len(yuca_entrada),
                'filas_resultantes': len(yuca_fresca),
            },
            {
                'cultivo': 'YUCA',
                'paso': 'Unidades municipio-año',
                'filas_iniciales': len(yuca_fresca),
                'filas_resultantes': len(datasets['YUCA']),
            },
        ]
    )

    name_entrada = datos_limpios[datos_limpios['cultivo'].eq('NAME')]
    filas.extend(
        [
            {
                'cultivo': 'NAME',
                'paso': 'Filas de entrada',
                'filas_iniciales': len(name_entrada),
                'filas_resultantes': len(name_entrada),
            },
            {
                'cultivo': 'NAME',
                'paso': 'Unidades municipio-año',
                'filas_iniciales': len(name_entrada),
                'filas_resultantes': len(datasets['NAME']),
            },
        ]
    )

    return pd.DataFrame(filas)


def main() -> None:
    """Ejecuta la preparación completa y guarda los artefactos reproducibles."""
    validar_features_permitidas(FEATURES_POR_CULTIVO)

    ruta_limpio = PROCESSED / 'eva_limpio.pkl'
    if not ruta_limpio.exists():
        raise FileNotFoundError(
            f'No existe {ruta_limpio}. Ejecuta antes unir_eva.py y limpiar_contar.py.'
        )

    datos_limpios = pd.read_pickle(ruta_limpio)
    datasets = {
        'MAIZ': preparar_maiz(datos_limpios),
        'YUCA': preparar_yuca(datos_limpios),
        'NAME': preparar_name(datos_limpios),
    }

    for cultivo, dataframe in datasets.items():
        dataframe.to_pickle(PROCESSED / f'modelo_{cultivo.lower()}.pkl')
        dataframe.to_csv(
            PROCESSED / f'modelo_{cultivo.lower()}.csv',
            index=False,
            encoding='utf-8-sig',
        )

    resumen = construir_resumen_preparacion(datasets)
    log = construir_log_preparacion(datos_limpios, datasets)
    resumen.to_csv(PROCESSED / 'resumen_preparacion.csv', index=False, encoding='utf-8-sig')
    log.to_csv(PROCESSED / 'log_preparacion.csv', index=False, encoding='utf-8-sig')

    print('Resumen de preparación:')
    print(resumen.to_string(index=False))
    print('\nLog de preparación:')
    print(log.to_string(index=False))


if __name__ == '__main__':
    main()
