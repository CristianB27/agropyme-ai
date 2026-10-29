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
python ml/src/exportar_resultados.py
```

Los resultados se escriben en `data/processed/`:

- `eva_bruto.pkl`
- `eva_limpio.pkl`
- `eva_2007_2024_limpio.csv`
- `log_limpieza.csv`

El script `ml/src/exportar_resultados.py` también regenera `ml/reports/conteo_cultivos_EVA.xlsx`.

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
