# AGROPYME TEST

El repositorio contiene dos componentes relacionados:

- **AgroPyme AI web:** aplicación React/TypeScript para registrar fincas, lotes, ciclos, costos, jornales, cosechas y ventas con persistencia real en Supabase.
- **Pipeline ML:** proceso en Python para consolidar, analizar y publicar los datos EVA de MADR.

## AgroPyme AI web

### Estado actual

- Persistencia en Supabase con UUID, relaciones compuestas y RLS por `auth.uid()`.
- Conversión automática de cosechas y ventas a kg mediante el factor de la unidad.
- Indicadores financieros alineados entre Dashboard y Asistente IA, con `Q` (cosechado), `Qv` (vendido), `Qnv = Q - Qv` e ingresos realizados `Ir`: costo unitario `C/Q`, costo de lo vendido `(C/Q) × Qv`, margen realizado `Ir - costo de lo vendido`, margen sobre ventas `margen realizado/Ir` y rentabilidad sobre costos `margen realizado/costo de lo vendido`. El resultado proyectado `Ir + Qnv × precio estimado - C` se muestra separado y siempre como estimación.
- Pronóstico real de cinco días por finca con Open-Meteo, caché en el navegador y alerta de lluvia.
- AsistenteIA conectado a una Supabase Edge Function. Consulta los datos del usuario aplicando RLS, usa Anthropic cuando hay clave configurada y responde con un fallback determinístico calculado sobre los mismos datos reales cuando no la hay o Anthropic falla.
- La función `asistente` está publicada en el proyecto enlazado con `verify_jwt = true`.

### Requisitos del frontend

- Node.js 18 o posterior.
- Un proyecto Supabase enlazado y aplicado.

### Configuración local

Desde `frontend/`:

```powershell
npm install
Copy-Item .env.example .env
```

Completa en `.env` los valores públicos del proyecto:

```dotenv
VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
```

No añadas `ANTHROPIC_API_KEY` al frontend. Es una credencial server-side y únicamente debe existir como secreto de Supabase Edge Functions.

Inicia la aplicación:

```powershell
npm run dev
```

### Aplicar la base de datos

```powershell
.\frontend\node_modules\.bin\supabase.cmd db push --linked
```

Las migraciones están en `supabase/migrations/`. El esquema, RLS, catálogos y triggers se documentan en [`docs/esquema.md`](docs/esquema.md).

### Clima real

El frontend consulta Open-Meteo directamente usando las coordenadas guardadas de cada finca:

- pronóstico diario de cinco días;
- caché en memoria segmentada por UUID de finca y coordenadas;
- timeout, estado de error y botón **Reintentar pronóstico**;
- alerta informativa cuando se prevén lluvias de 40 mm o más.

Open-Meteo no requiere clave API. La carga del clima no bloquea el render principal de la aplicación.

### Asistente IA y secretos

La Edge Function está en `supabase/functions/asistente/`. Para habilit la respuesta generativa de Anthropic, configura el secreto sin escribirlo en Git ni en variables `VITE_*`:

```powershell
.\frontend\node_modules\.bin\supabase.cmd secrets set ANTHROPIC_API_KEY=CLAVE_DE_ANTHROPIC
```

Opcionalmente se puede fijar el modelo:

```powershell
.\frontend\node_modules\.bin\supabase.cmd secrets set ANTHROPIC_MODEL=claude-sonnet-5-5
```

Publica o actualiza la función sin requerir Docker:

```powershell
.\frontend\node_modules\.bin\supabase.cmd functions deploy asistente --project-ref TU_PROJECT_REF --use-api
```

Sin `ANTHROPIC_API_KEY`, o si Anthropic no responde, la misma función devuelve `source: "fallback"` con cálculos sobre los datos reales del usuario. El chat identifica esa respuesta como determinística y muestra el aviso de fallback. Nunca usa datos simulados para una sesión autenticada.

### Cálculo financiero e indicadores parciales

El costo total `C` de un ciclo es la suma de insumos, jornales y otros costos. Sobre `Q` kg cosechados y `Qv` kg vendidos, con `Qnv = Q - Qv`, el costo unitario es `C/Q`, el costo de lo vendido es `(C/Q) × Qv`, el margen realizado es `Ir - costo de lo vendido`, el margen sobre ventas es `margen realizado/Ir` y la rentabilidad sobre costos es `margen realizado/costo de lo vendido`.

Si queda cosecha sin vender (`Qnv > 0`), los indicadores realizados se rotulan **parcial**. Si no hay cosecha, ventas o ingresos, los indicadores dependientes se muestran como **no disponible** y nunca se realiza una división por cero. El cálculo rechaza cantidades, precios y área no positivos, así como ventas superiores a la cosecha. El Dashboard y el asistente usan las mismas fórmulas; la suite Deno verifica además su paridad exacta.

El resultado proyectado del ciclo se calcula como `Ir + Qnv × precio estimado - C`. El usuario edita el precio estimado y el valor se presenta separado de lo realizado, siempre rotulado **Estimación**.

### Validación

```powershell
# Frontend
cd frontend
npm run typecheck
npm run lint
npm run build
npm test

# Edge Function
cd ..
npx --yes deno fmt --check supabase/functions/asistente
npx --yes deno lint supabase/functions/asistente
npx --yes deno check supabase/functions/asistente/index.ts supabase/functions/asistente/asistente_test.ts
npx --yes deno test supabase/functions/asistente/asistente_test.ts

# SQL (todas las pruebas se revierten al terminar)
.\frontend\node_modules\.bin\supabase.cmd db query --linked --file .\supabase\tests\rls_dos_usuarios.sql
.\frontend\node_modules\.bin\supabase.cmd db query --linked --file .\supabase\tests\cantidad_kg.sql
```

### Pendientes de operación

- Configurar `ANTHROPIC_API_KEY` para activar respuestas generativas; el fallback ya está operativo.
- Publicar el frontend en Vercel, Netlify, Cloudflare Pages u otro hosting estático y configurar sus variables `VITE_*`.
- Revisar la confirmación de correo de las cuentas nuevas según la política de Supabase del proyecto.
- Realizar una prueba visual final en el hosting publicado.

## Requisitos del pipeline ML

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
python ml/src/evaluar_linea_base.py
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

## Línea base de rendimiento (Fase B)

`ml/src/evaluar_linea_base.py` evalúa una línea base sin fuga de información temporal. Las medianas se calculan **solo con el conjunto de entrenamiento (2007-2018)** y se aplican al conjunto de prueba (2019-2024):

- **Llave de historia:** maíz usa `cod_mun + sistema`; yuca y ñame usan `cod_mun`.
- **Respaldo:** si una fila de prueba no tiene mediana de entrenamiento para su llave, se usa la mediana de entrenamiento de su departamento (`cod_dep`). El script falla si ese respaldo tampoco existe.
- **Métricas:** MAE y RMSE en t/ha, y MAPE porcentual calculado como `mean(abs(real - prediccion) / real * 100)`.
- **Cortes:** total, cada año de prueba, Bolívar (`cod_dep=13`) y Caribe (`cod_dep` en `{8, 13, 20, 23, 44, 47, 70, 88}`). Cuando un subgrupo por origen de predicción está vacío, conserva `NaN` en las métricas y se reporta con cero filas.
- **Escenario de yuca:** además de `TODOS`, se evalúa `SIN_MEDIO_SEMESTRE`, excluyendo `n_semestres=1` tanto del entrenamiento como de la prueba.
- **Origen de la predicción:** cada archivo de salida distingue `HISTORIA` de `RESPALDO_DEPARTAMENTO`, lo que permite cuantificar el error de cada grupo por separado.

La ejecución escribe en `ml/reports/`:

- `predicciones_linea_base.csv`: predicciones de prueba, origen, error absoluto y error porcentual por fila.
- `metricas_linea_base_cortes.csv`: MAE, RMSE y MAPE por total, año, Bolívar y Caribe.
- `metricas_linea_base_origen.csv`: las mismas métricas separadas por historia/respaldo y por corte.
- `resumen_respaldo_linea_base.csv`: filas de prueba, filas con historia, filas con respaldo departamental y porcentaje de uso del respaldo.
- `resumen_linea_base.md`: resumen corto de los indicadores principales.

Resultados del último corte reproducible:

| Cultivo | Escenario | Filas de prueba | MAE (t/ha) | RMSE (t/ha) | MAPE (%) | Filas con respaldo | Respaldo (%) |
|---|---|---:|---:|---:|---:|---:|---:|
| Maíz | TODOS | 11,154 | 0.887 | 1.544 | 38.85 | 179 | 1.60 |
| Yuca | TODOS | 4,125 | 3.564 | 5.235 | 39.60 | 48 | 1.16 |
| Yuca | SIN_MEDIO_SEMESTRE | 2,117 | 3.514 | 5.181 | 36.93 | 14 | 0.66 |
| Ñame | TODOS | 641 | 3.853 | 5.225 | 51.51 | 38 | 5.93 |

El corte temporal coincide con el cambio entre las bases EVA 2007-2018 y 2019-2024. Por ello, estas métricas miden el desempeño de la línea base sobre esa partición y no aíslan por sí solas el efecto de un posible cambio metodológico entre bases. Para comparar futuras fases, debe conservarse exactamente la misma definición de llaves, respaldo, conjuntos y cortes.

## Modelos de MAÍZ (Fase C, alcance reducido)

`ml/src/evaluar_modelos_maiz.py` compara la línea base con Ridge, Random Forest e HistGradientBoosting. El alcance de esta ejecución es deliberadamente reducido y reproducible:

- **Features:** departamento, municipio, sistema, año, semestre, rezago de rendimiento del año anterior y las dos variables climáticas ERA5-Land. La imputación de faltantes se ajusta **dentro de cada fold**.
- **Selección:** tres configuraciones por modelo. Los hiperparámetros se eligen con cinco folds expansivos: entrenamiento `<= t-1` y validación en `t`, para `t=2014, 2015, 2016, 2017, 2018`. El criterio es MAE medio; los empates se resuelven por RMSE medio, MAPE medio y desviación de MAE.
- **Prueba final:** después de cerrar la selección, cada modelo se entrena con 2007-2018 y la prueba 2019-2024 se evalúa una sola vez. Línea base y modelos usan exactamente las mismas 11,154 filas.
- **Clima incompleto:** se aceptan 5 celdas ERA5-Land sin semestres completos. Afectan 5 municipios y 112 filas de MAÍZ (79 de entrenamiento y 33 de prueba). Hay además 4 filas de 2 códigos sin geografía MGN 2023; en total, 116 filas quedan con clima faltante y se imputan dentro de cada fold. No se hizo refetch de esas celdas.

### Resultado de la prueba final 2019-2024

| Modelo | Filas | MAE (t/ha) | RMSE (t/ha) | MAPE (%) |
|---|---:|---:|---:|---:|
| Línea base | 11,154 | 0.887 | 1.544 | 38.85 |
| HistGradientBoosting | 11,154 | 0.856 | 1.505 | 38.65 |
| Random Forest | 11,154 | 0.877 | 1.533 | 39.09 |
| Ridge | 11,154 | 0.945 | 1.550 | 46.77 |

HistGradientBoosting mejora la línea base de forma leve: **-0.030 t/ha de MAE (-3.43%)**, **-0.040 t/ha de RMSE (-2.58%)** y **-0.20 puntos de MAPE**. Random Forest mejora MAE y RMSE, pero empeora el MAPE; Ridge no mejora la línea base.

La ejecución escribe en `ml/reports/`:

- `metricas_modelos_maiz.csv`: tabla total de la prueba final.
- `resumen_modelos_maiz.md`: tabla legible.
- `seleccion_hiperparametros_maiz.csv`: desempeño medio y configuración elegida por modelo.
- `validacion_folds_modelos_maiz.csv`: las 45 métricas de los folds de selección.
- `predicciones_modelos_maiz.csv`: predicciones por fila para los cuatro métodos.
- `metadatos_modelos_maiz.json`: protocolo, configuraciones, conteos y marca de imputación in-fold.

El diagnóstico por fuente, la importancia de variables y la orquestación end-to-end quedan fuera de esta ejecución y se harán solo si se solicitan.

## Inferencia de MAÍZ (Fase D)

`ml/src/inferencia_maiz.py` selecciona el modelo final exclusivamente con los cinco folds expansivos 2014-2018 y prepara una tabla de rendimiento esperado para el frontend. La prueba 2019-2024, ya evaluada en Fase C, **no se recalcula ni se usa para rankear modelos**; solo se consulta para el veto global acordado: si ningún modelo supera el MAE de la línea base en prueba, la línea base queda para inferencia.

La comparación de candidatos en folds es:

| Modelo | MAE medio (t/ha) | RMSE medio (t/ha) | MAPE medio (%) |
|---|---:|---:|---:|
| Línea base | 0.475 | 0.756 | 26.82 |
| Random Forest | **0.395** | 0.647 | **23.38** |
| HistGradientBoosting | 0.401 | **0.625** | 24.47 |
| Ridge | 0.440 | 0.652 | 27.06 |

Por el criterio congelado (MAE medio primero), **Random Forest queda como modelo de inferencia**, aunque HGB obtuvo el menor MAE en la prueba. No se cambia el modelo por una métrica de prueba. En la prueba, RF mejoró MAE y RMSE de la línea base, pero empeoró MAPE; HGB mejoró las tres métricas. Estos hechos se reportan sin maquillar el resultado.

La tabla `ml/reports/rendimiento_esperado_maiz.csv` contiene 2,831 combinaciones reales municipio-sistema-semestre para 1,065 municipios, con:

- `rendimiento_esperado_t_ha`: predicción del modelo final sobre el perfil mediano histórico del grupo;
- `rango_inferior_t_ha` y `rango_superior_t_ha`: banda empírica central objetivo del 80 %, obtenida con residuales q10/q90 out-of-fold del modelo final;
- `cod_dep`, `cod_mun` y `departamento`: claves para evitar ambigüedad de nombres homónimos.

La función pública recibe `(municipio, semestre, sistema)` y devuelve esperado, rango y modelo:

```python
import sys
sys.path.insert(0, 'ml/src')
from inferencia_maiz import predecir_rendimiento_maiz

resultado = predecir_rendimiento_maiz(
    'CARTAGENA DE INDIAS',
    'A',
    'TRADICIONAL',
)
```

Para municipios homónimos se debe agregar `cod_mun=...`. Si la combinación no tiene historia de entrenamiento, la función falla de forma explícita en vez de inventar un valor. La inferencia congela el perfil histórico mediano del grupo porque la entrada acordada no incluye año, rezago ni clima actual.

Artefactos adicionales de Fase D:

- `ml/reports/seleccion_modelo_final_maiz.csv`: comparación de folds y modelo de inferencia.
- `ml/reports/validacion_folds_candidatos_finales_maiz.csv`: 20 métricas out-of-fold (cuatro métodos × cinco folds).
- `ml/reports/metadatos_inferencia_maiz.json`: protocolo, configuración, rango y conteos.
- `ml/reports/resumen_fase_c.md`: resumen corto de Fases C y D, clima faltante, decisión y limitaciones.

## Diagnóstico post hoc de MAÍZ

`ml/src/diagnostico_inferencia_maiz.py` diagnostica el Random Forest congelado sin cambiarlo, recalibrar el rango ni usar la prueba para ajustar el modelo. Calcula cobertura del rango q10-q90 total y anual, MAE/RMSE anual de RF y línea base en Bolívar, importancia de variables por permutación y un bootstrap clusterizado por municipios de la diferencia de MAE.

```powershell
python ml/src/diagnostico_inferencia_maiz.py
```

Resultados en `ml/reports/`:

- `cobertura_rango_prueba_maiz.csv`: cobertura total y por año del rango congelado; `cobertura_rango_prueba_detalle_maiz.csv` conserva el resultado por fila.
- `metricas_bolivar_anual_maiz.csv`: MAE y RMSE por año para Bolívar.
- `importancia_permutacion_maiz.csv`: importancia media y desviación por variable; incluye el detalle de repeticiones en `importancia_permutacion_detalle_maiz.csv`.
- `bootstrap_resumen_mae_maiz.csv`: diferencia de MAE e IC 95 %; las 5.000 réplicas quedan en `bootstrap_diferencia_mae_maiz.csv`.
- `diagnostico_inferencia_maiz.json`: protocolo, semillas, resultados y marcas de que no hubo ajuste.
- `resumen_diagnostico_inferencia_maiz.md`: resumen corto de los cuatro diagnósticos.

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
