# AGROPYME TEST

Proyecto con una aplicación frontend y un pipeline ETL en Python para consolidar y publicar los datos EVA de MADR.

## Requisitos

- Python 3.12 (probado con Python 3.12.10 en Windows).
- Los dos archivos fuente de MADR (EVA) descritos a continuación.

## Instalación

Desde la raíz del repositorio:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r ml/requirements.txt
```

`ml/requirements.txt` está codificado en UTF-8 y contiene las versiones exactas utilizadas para validar el pipeline.

## Datos fuente requeridos

El directorio `data/` está excluido de Git, por lo que un clon nuevo no incluye ni las fuentes ni los artefactos generados. Antes de ejecutar el pipeline, coloca estos archivos en las rutas indicadas:

```text
data/raw/Base Agrícola EVA 2007-2018_MADR.xlsx
data/raw/Base EVA 2019-2024.xlsx
```

Los nombres y las rutas son case-sensitive en Linux y CI. Los scripts no descargan los datos automáticamente.

## Ejecución del pipeline

El pipeline debe ejecutarse en este orden:

```powershell
python ml/src/unir_eva.py
python ml/src/limpiar_contar.py
python ml/src/preparar_modelo.py
python ml/src/exportar_resultados.py
```

Los resultados se escriben en `data/processed/`:

- `eva_bruto.pkl`
- `eva_limpio.pkl`
- `modelo_maiz.pkl` y `modelo_maiz.csv`
- `modelo_yuca.pkl` y `modelo_yuca.csv`
- `modelo_name.pkl` y `modelo_name.csv`
- `resumen_preparacion.csv`
- `log_preparacion.csv`
- `eva_2007_2024_limpio.csv`
- `log_limpieza.csv`

El script `ml/src/exportar_resultados.py` también regenera `ml/reports/conteo_cultivos_EVA.xlsx`.

## Preparación de datos para modelado (Fase A)

`ml/src/preparar_modelo.py` parte de `eva_limpio.pkl` y crea unidades analysis-ready para maíz, yuca y ñame:

- **Maíz:** unidad `municipio-año-semestre-sistema`. Las seis desagregaciones de color se reducen a `TECNIFICADO` o `TRADICIONAL`.
- **Yuca:** unidad `municipio-año`; se suman `YUCA` y `YUCA CONSUMO EN FRESCO`, y se excluye `YUCA INDUSTRIAL`.
- **Ñame:** unidad `municipio-año`; se suman todas sus desagregaciones.
- **Rendimiento:** en cada unidad se suman `area_cosechada` y `produccion`, y se recalcula como `produccion / area_cosechada`; nunca se promedian rendimientos.
- **Cobertura semestral:** en yuca y ñame, `n_semestres=2` para un reporte anual, `1` si solo se reportó A o B y `2` si se reportaron ambos. `semestre=ANUAL` identifica la frecuencia de la unidad municipio-año y `n_semestres` conserva la cobertura real.
- **Conjuntos:** `ENTRENAMIENTO` para años hasta 2018 y `PRUEBA` desde 2019.
- **Municipios de prueba sin historia:** en `resumen_preparacion.csv`, esta métrica se calcula por cultivo sobre **municipios distintos**, identificados por `(cod_dep, cod_mun)`, y no sobre unidades. El **numerador** es el número de municipios que aparecen en alguna unidad de prueba pero en ninguna unidad de entrenamiento del mismo cultivo; el **denominador** es el total de municipios distintos que aparecen en prueba. El porcentaje es `100 * numerador / denominador`. En maíz se evalúa **solo por municipio**, sin comparar `sistema`: un municipio que tiene historial con cualquiera de los dos sistemas cuenta como municipio con historia.
- **Features:** se permiten `departamento`, `municipio`, `sistema` (solo en maíz), `anio` y `semestre`. Producción, área cosechada, rendimiento y área sembrada están prohibidas como features.
- **San Andrés:** `cod_dep=88` usa siempre el nombre oficial `ARCHIPIELAGO DE SAN ANDRES, PROVIDENCIA Y SANTA CATALINA` para no separar artificialmente train y test.

El script se detiene con un error claro si aparece una desagregación inesperada, se mezclan periodos anuales y semestrales en una misma unidad, quedan llaves duplicadas, aparecen rendimientos no positivos o se intenta usar una variable prohibida como feature.

## Pruebas

Las pruebas son de regresión sobre los artefactos de `data/processed/`. En un clon nuevo primero hay que ejecutar el pipeline completo y después las pruebas:

```powershell
python -m pytest ml/tests
```

Si `data/processed/` no existe o está incompleta, las pruebas fallarán al leer `eva_limpio.pkl` o `eva_2007_2024_limpio.csv`.

## Lectura del CSV exportado

Lee `data/processed/eva_2007_2024_limpio.csv` conservando `periodo` como texto para evitar el `DtypeWarning` y no alterar identificadores o etiquetas de periodo. El aviso de lectura es usar `dtype={'periodo': str}`. En pandas 3.1, especifica también `estado_fisico_produccion` como texto para evitar el aviso de tipos mixtos de esa columna:

```python
import pandas as pd

df = pd.read_csv(
    "data/processed/eva_2007_2024_limpio.csv",
    dtype={
        "periodo": str,
        "estado_fisico_produccion": str,
    },
)
```

Para análisis temporales usa las columnas `anio` y `semestre`.
