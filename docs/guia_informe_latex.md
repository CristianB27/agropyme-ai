# Guía para revisar y editar el informe LaTeX

> Documento para quien (persona o IA) vaya a revisar o modificar [`IETR1433_Lab.tex`](../IETR1433_Lab.tex). El funcionamiento de la aplicación está en el [README](../README.md) y el esquema de datos en [`esquema.md`](esquema.md); esta guía reúne las reglas editoriales, el detalle metodológico del ML y la lista de afirmaciones del informe que ya no coinciden con el código.
>
> Estado verificado al **12 de noviembre de 2026**, después de la migración `20261112120000_clasificar_produccion_y_cierre` (cosechas, ventas, salidas sin venta y cierre de ciclos).

## Contenido

1. Misión y reglas de integridad
2. Ruta de lectura y jerarquía de fuentes
3. Identidad del proyecto y del informe
4. Afirmaciones del informe que deben corregirse
5. Evidencia actual
6. Componente de ML: referencia histórica de maíz
7. Clasificador local de intenciones
8. Mapa del documento LaTeX
9. Checklist para editar el LaTeX
10. Alcance académico original
11. Prompt de arranque para una IA externa

## 1. Misión, audiencia y alcance de la edición

### 1.1 Audiencia principal

Esta guía está escrita para quien edite `IETR1433_Lab.tex`, en particular una IA externa. La IA debe poder trabajar sin acceso a la conversación previa con el equipo, sin memoria del proyecto y sin tener que inferir qué frase del informe era una decisión metodológica.


### 1.2 Objetivo del documento LaTeX

[`IETR1433_Lab.tex`](../IETR1433_Lab.tex) es un informe académico acumulativo de los Avances 1 a 5 del proyecto de Ingeniería I. Reúne:

- planteamiento del problema, justificación, objetivos y antecedentes;
- estado del arte, requisitos, actores, historias y casos de uso;
- evolución del prototipo a una aplicación persistida;
- modelo de datos, arquitectura, decisiones técnicas e indicadores;
- componente de ML de rendimiento de maíz;
- evidencia de validación, límites y trabajo pendiente.

### 1.3 Alcance autorizado por defecto

Salvo que el usuario indique otra cosa, una IA externa debe:

- editar únicamente [`IETR1433_Lab.tex`](../IETR1433_Lab.tex);
- consultar código, migraciones, pruebas y reportes sólo para verificar afirmaciones;
- corregir afirmaciones del informe que estén desactualizadas respecto al código;
- mantener idioma español, tono académico y estructura existente;
- registrar en su respuesta qué cambió, con qué evidencia y qué validaciones ejecutó.

No debe modificar por iniciativa propia la aplicación, el esquema, el pipeline ML, los artefactos del modelo ni las migraciones. Si detecta un defecto de código o una incoherencia metodológica, debe señalarla, no resolverla silenciosamente dentro del informe.

### 1.4 Reglas no negociables de integridad

1. **No inventar datos, resultados, citas, capturas, despliegues ni validaciones.** Cada afirmación cuantitativa debe ser rastreable a código, prueba o artefacto.
2. **Distinguir siempre** entre implementado, parcialmente implementado, sólo presente en el esquema, pendiente y pendiente de evidencia manual.
3. **No describir la aplicación como versión 1.0 completa, producto comercial o sistema listo para producción.** El propio LaTeX define “Avances 1 a 5” y califica el estado actual como avance ejecutable y probado, no producto comercial.
4. **No llamar “predicción” al valor de rendimiento de maíz.** Es una referencia histórica congelada, con rango típico de error y sin mejora estadísticamente distinguible de la línea base.
5. **No presentar el resultado proyectado como utilidad realizada.** Siempre es estimación y usa un precio editable.
6. **No mezclar los dos modelos de ML.** El modelo de maíz estima referencia de rendimiento; el clasificador de intenciones selecciona cómo responder una pregunta.
7. **No revelar credenciales, tokens, claves, datos de usuarios ni variables secretas.** Los secretos se describen por nombre y ubicación, nunca por valor.
8. **No reescribir el historial metodológico para mejorar resultados.** Si una prueba falla, una cobertura es baja o un intervalo contiene cero, el texto debe conservarlo.
9. **No usar el examen final fallido del experimento de intenciones como si fuera una validación exitosa del modelo desplegado.** Ver §12.4: hay una contradicción de procedencia que debe describirse con cautela.
10. **No editar manualmente `model_data.ts`.** Es un artefacto generado.

## 2. Ruta de lectura recomendada

Antes de cambiar una línea del informe, una IA externa debería leer, en este orden:

1. El [README](../README.md) completo y esta guía.
2. [`IETR1433_Lab.tex`](../IETR1433_Lab.tex) completo.
3. [`trazabilidad_documento.md`](trazabilidad_documento.md), entendiendo que es una fotografía del 31 de octubre de 2026 y por eso contiene conteos/hashes anteriores a los commits recientes.
4. [`esquema.md`](esquema.md) para el esquema aplicado.
5. [`supabase/config.toml`](../supabase/config.toml), [`frontend/package.json`](../frontend/package.json) y las migraciones en [`supabase/migrations/`](../supabase/migrations/).
6. [`frontend/src/utils/calculos.ts`](../frontend/src/utils/calculos.ts) y [`supabase/functions/asistente/summary.ts`](../supabase/functions/asistente/summary.ts) para las fórmulas financieras.
7. [`supabase/functions/asistente/model.ts`](../supabase/functions/asistente/model.ts), [`model_data.ts`](../supabase/functions/asistente/model_data.ts) y [`scripts/export_assistant_model.py`](../scripts/export_assistant_model.py) para el clasificador de intenciones.
8. [`ml/reports/metadatos_inferencia_maiz.json`](../ml/reports/metadatos_inferencia_maiz.json), [`metadatos_modelos_maiz.json`](../ml/reports/metadatos_modelos_maiz.json) y [`diagnostico_inferencia_maiz.json`](../ml/reports/diagnostico_inferencia_maiz.json) para el ML de maíz.

### 2.1 Regla para resolver conflictos

Cuando dos fuentes discrepen, aplicar esta jerarquía:

1. **Código y migraciones actuales** para afirmar qué está implementado.
2. **Pruebas y artefactos analíticos actuales** para afirmar comportamiento o métricas verificables.
3. **Historial Git y commits** para reconstruir cambios y cronología.
4. **Documento LaTeX y trazabilidad** como narrativa/evidencia secundaria; pueden estar desactualizados.
5. **README y esta guía** como mapa de trabajo, no como evidencia primaria de una cifra.

Si una cifra del `.tex` no coincide con el artefacto canónico, no se promedia ni se estima: se corrige con el valor del artefacto o se deja explícitamente pendiente de verificación.

## 3. Identidad del proyecto y del informe

| Campo | Valor |
|---|---|
| Producto | AgroPyme AI |
| Aplicación web publicada | [https://agropyme-ai.vercel.app](https://agropyme-ai.vercel.app) |
| Institución | Universidad Tecnológica de Bolívar |
| Proyecto | Proyecto de Ingeniería I, NRC 1236 |
| Integrantes | Cristian Matteo Benitez Montes (`T00078658`) y Santiago Payares (`T00068704`) |
| Revisor indicado | Prof. Aisner Jose Marrugo Juliao |
| Archivo principal | `IETR1433_Lab.tex` |
| Portada actual | “AgroPyme AI — Avances 1 a 5: Desarrollo del producto, arquitectura y componente de ML” |
| Fecha de portada en la línea base | 2 de noviembre de 2026 |
| Repositorio declarado en el informe | `https://github.com/CristianB27/agropyme-ai` |

La portada, los autores, el NRC, el revisor y la fecha son datos editoriales controlados por el usuario. No deben cambiarse sólo porque una IA editó el texto; hay que pedir confirmación explícita.

## 4. Afirmaciones del informe que deben corregirse

El `.tex` se redactó antes de varios cambios. Una revisión debe corregir o matizar estas zonas (las líneas son aproximadas) y pedir confirmación al usuario cuando cambie una conclusión editorial.

| Zona del `.tex` | Afirmación antigua | Estado correcto |
|---|---|---|
| §“Registro de Costos” (~479–485) | No hay formularios de cosecha, venta ni cierre de ciclo | **Existen.** Pantalla “Cosechas y Ventas” con cosecha, venta y otras salidas; cierre, reapertura y eliminación de ciclos en Mis Lotes |
| Trazabilidad RF3 (~536) | RF3 parcial | RF3 **implementado**: alta, edición y eliminación de cosechas, ventas y salidas sin venta, con clasificación por calidad, tipo de comprador y estado de pago |
| Trazabilidad RF2 (~533) y decisiones D3/DN15 (~804, ~822) | Falta el alta de proveedor | Existe `NuevoProveedorModal`. Sigue sin haber edición/eliminación de proveedores |
| Trazabilidad RF4 y evidencia (~537, ~917) | 15 o 21 pruebas Vitest | **39 pruebas en 6 archivos** (`npm test`) |
| Trazabilidad RF6 y evidencia (~539, ~923) | 11 o 15 pruebas Deno | **17 pruebas**: 14 de `asistente_test.ts` + 3 de `model_test.ts` |
| Evidencia SQL | 2–5 scripts | **6 scripts** en `supabase/tests/`, todos aprobados contra el proyecto enlazado el 12/11/2026 |
| Fórmulas (§`sec:indicadores-vigentes`, ~676–690) | `Qnv = Q − Qv`; costo unitario `C/Q` | `Qnv = Q − Qv − Qperdida − QusoPropio`; costo unitario `C/(Q − Qperdida)`. Sin pérdidas ni uso propio coinciden con las anteriores, por lo que **el ejemplo canónico no cambia** |
| ERD y tabla de entidades (~555–663) | Cosechas/Ventas sin clasificación; `VentaCosecha` no implementada | Añadir `salidas_produccion`, los campos `calidad`, `tipo_comprador`, `estado_pago` y la unidad `arroba`. `VentaCosecha` sigue sin implementarse: la venta se clasifica por calidad, no se vincula a una cosecha concreta |
| §“Asistente IA” (~423, ~482–487, ~778, ~814, D4 ~895) | Ruta generativa con Anthropic como fuente vigente | Clasificador local de 13 intenciones, resolver acotado, veto server-side y respuesta determinista sobre datos reales. No presentar Claude como dependencia |
| Bibliografía (~988) | Entrada `anthropic` | Si se elimina la mención, retirar `\cite{anthropic}` y `\bibitem{anthropic}` juntos |
| Trabajo pendiente (~950, ~1048) | No existe clasificador de intenciones; faltan formularios de cosecha/venta | Ambos existen. Mantener pendientes: RF7, RNF4, reportes automáticos, histórico comparativo dedicado, modelos de yuca y ñame, edición de proveedores |
| Despliegue | Edge Function versión 6 | **Versión 7** desplegada el 12/11/2026 (`ACTIVE`, `verify_jwt = true`) |
| Aplicación publicada | — | La URL [agropyme-ai.vercel.app](https://agropyme-ai.vercel.app) sirve el frontend de la rama publicada; los cambios locales no están allí hasta que se publiquen |

### 4.1 Afirmaciones que sí deben conservarse

- El producto no es una versión 1.0 completa ni un producto comercial, y no tiene un modelo de negocio comercial definido.
- RF7, RNF4, histórico comparativo dedicado, reportes automáticos y modelos de yuca/ñame siguen pendientes.
- El ML de maíz es referencia histórica, no predicción.
- El rango q10–q90 tiene cobertura 60,5 %, no 80 %.
- La mejora de RF sobre la línea base no se distingue del azar.
- No se han hecho pruebas de usabilidad con al menos tres productores.
- Falta validación agronómica del umbral de 40 mm.
- Falta compilación TeX y revisión visual del PDF.
- Falta evidencia visual manual del aislamiento con dos cuentas (la prueba SQL sí existe y pasa).

## 5. Evidencia actual

| Comprobación | Resultado (12/11/2026) |
|---|---|
| Frontend Vitest | 6 archivos, **39/39** |
| Frontend TypeScript | `tsc --noEmit` sin errores |
| Frontend ESLint | 0 errores, 5 advertencias previas no bloqueantes |
| Frontend build | correcto (aviso de chunk > 500 kB) |
| Edge Function Deno | **17/17** con `--allow-read`, incluida la paridad frontend/Edge con salidas sin venta |
| SQL contra el proyecto enlazado | 6/6: `salidas_y_clasificacion`, `cantidad_kg`, `rls_dos_usuarios`, `editar_eliminar_registros`, `editar_eliminar_lote`, `tipo_personalizado_actividad` |
| Edge Function | versión 7, `ACTIVE`; sin sesión responde 401 |

La trazabilidad de [`trazabilidad_documento.md`](trazabilidad_documento.md) es una foto del 31/10/2026; no reutilizar sus conteos.

### 5.1 Evidencia que todavía no existe

| Actividad | Criterio de cierre |
|---|---|
| Capturas de pantalla | PNG reales aprobadas; no reutilizar imágenes ajenas |
| Prueba visual con dos cuentas | La cuenta B no ve ni modifica datos de A; evidencia fechada |
| Pruebas con productores | Al menos 3 personas, protocolo, hallazgos y fecha |
| Revisión agronómica de lluvia | Profesional valida 40 mm y su significado |
| Compilación del informe | Compilar con TeX y revisar el PDF |
| Accuracy post-integración del clasificador | Conjunto nuevo o decisión metodológica explícita |

## 6. Componente de ML: referencia histórica de rendimiento de maíz

Esta sección es independiente del clasificador de intenciones. El objetivo del modelo de maíz es producir una **referencia histórica** por grupo `municipio--sistema--semestre`; no es un motor de predicción en tiempo real.

### 6.1 Fuentes y datos

- Evaluaciones Agropecuarias Municipales (EVA) de UPRA/MADR:
  - `data/raw/Base Agrícola EVA 2007-2018_MADR.xlsx`;
  - `data/raw/Base EVA 2019-2024.xlsx`.
- Geografía municipal: Marco Geográfico de Referencia 2023 de DANE.
- Clima histórico: ERA5-Land del semestre calendario inmediatamente anterior.
- `data/` está excluido de Git; los scripts no descargan los XLSX.

Unidades de análisis:

- **Maíz:** `municipio--año--semestre--sistema`; seis desagregaciones de color se reducen a `TECNIFICADO` o `TRADICIONAL`.
- **Yuca:** `municipio--año`; se suman `YUCA` y `YUCA CONSUMO EN FRESCO`; se excluye `YUCA INDUSTRIAL`.
- **Ñame:** `municipio--año`; se suman todas sus desagregaciones.
- En cada unidad se suman `produccion` y `area_cosechada`, y se recalcula `rendimiento = produccion / area_cosechada`; nunca se promedian rendimientos publicados.

### 6.2 Predictores permitidos y prohibidos

Features finales del modelo de maíz:

1. `departamento`;
2. `municipio`;
3. `sistema`;
4. `anio`;
5. `semestre`;
6. `rendimiento_lag1_t_ha` (mismo semestre del año anterior);
7. `temperatura_2m_media_c` (semestre anterior);
8. `soil_moisture_0_to_7cm_media` (semestre anterior).

Están explícitamente prohibidos como predictores: `area_sembrada`, `produccion`, `area_cosechada` y `rendimiento` de la fila objetivo. La exclusión de área sembrada responde al contrato metodológico y de inferencia, no a una afirmación causal.

El rezago se une explícitamente por año calendario; no se desplaza una observación antigua para rellenar un año ausente. El clima usa el semestre calendario inmediatamente anterior en UTC: para destino A se toma B del año anterior; para destino B se toma A del mismo año. La geografía usa centroides MGN 2023 y celdas ERA5-Land de 0,1°. La imputación de clima se ajusta **dentro de cada fold** con mediana.

### 6.3 Línea base temporal y métricas

La línea base se calcula sin fuga temporal:

- medianas calculadas sólo con 2007--2018 y aplicadas a 2019--2024;
- llave de historia para maíz: `cod_mun + sistema`; para yuca y ñame: `cod_mun`;
- si no hay mediana histórica para la llave, se usa la mediana histórica departamental; si tampoco existe, el pipeline falla;
- MAE y RMSE en t/ha;
- MAPE: `mean(abs(real - predicho) / real * 100)`;
- cortes: total, cada año de prueba, Bolívar (`cod_dep=13`) y Caribe (`cod_dep` en `{8,13,20,23,44,47,70,88}`);
- origen: `HISTORIA` o `RESPALDO_DEPARTAMENTO`, con métricas separadas;
- yuca incluye escenario `SIN_MEDIO_SEMESTRE`, que excluye `n_semestres=1` de train y prueba.

| Cultivo / escenario | Filas | MAE (t/ha) | RMSE (t/ha) | MAPE (%) | Con respaldo departamental |
|---|---:|---:|---:|---:|---:|
| Maíz / TODOS | 11.154 | 0,887 | 1,544 | 38,85 | 179 (1,60 %) |
| Yuca / TODOS | 4.125 | 3,564 | 5,235 | 39,60 | 48 (1,16 %) |
| Yuca / SIN_MEDIO_SEMESTRE | 2.117 | 3,514 | 5,181 | 36,93 | 14 (0,66 %) |
| Ñame / TODOS | 641 | 3,853 | 5,225 | 51,51 | 38 (5,93 %) |

La partición coincide con el cambio entre las bases EVA 2007--2018 y 2019--2024; por ello no aísla por sí sola un posible efecto metodológico entre bases.

### 6.4 Partición temporal

- Entrenamiento: 2007--2018; 24.859 filas finales para maíz.
- Validación: folds expansivos 2014, 2015, 2016, 2017 y 2018; para validar `t`, el entrenamiento usa sólo años `<= t-1`.
- Prueba: 2019--2024; 11.154 filas; 1.036 municipios; 36.013 filas de features en total.
- El rezago observado se congela a información ≤2018: 2019 conserva el rezago de 2018 y 2020--2024 quedan sin rezago observado, imputándose dentro de cada fold.
- La prueba se abre una sola vez después de cerrar la selección. No participa en el ranking, no reconfigura modelos y no altera el rango.
- 116 filas tienen alguna variable climática faltante: 112 filas por celdas ERA5-Land incompletas en 5 municipios y 4 filas de 2 códigos sin geografía MGN 2023.

### 6.5 Candidatos y configuración elegida

| Familia | Candidatos | Configuración elegida por folds |
|---|---|---|
| Ridge | `alpha` 1, 10, 100 | `alpha=100` |
| Random Forest | 200 árboles; (`max_depth`, `min_samples_leaf`) = (`None`,1), (20,1), (20,5) | `n_estimators=200`, `max_depth=None`, `min_samples_leaf=1` |
| HistGradientBoosting | `learning_rate` 0,05/0,10; hojas 15/31; 250 iteraciones; `l2_regularization=1` | `learning_rate=0,05`, `max_leaf_nodes=15`, `max_iter=250`, `l2=1` |

Criterio de selección: MAE medio de folds; empates por RMSE medio, MAPE medio y desviación de MAE. Random Forest quedó como modelo publicado con MAE medio de folds 0,395316 t/ha. No se cambió por su desempeño en prueba.

### 6.6 Prueba final 2019--2024

| Modelo | MAE (t/ha) | RMSE (t/ha) | MAPE (%) |
|---|---:|---:|---:|
| Línea base (mediana municipal/sistema) | 0,8866 | 1,5444 | 38,85 |
| Random Forest (publicado) | 0,8772 | 1,5332 | 39,09 |
| HistGradientBoosting | 0,8561 | 1,5049 | 38,65 |
| Ridge | 0,9450 | 1,5500 | 46,77 |

Random Forest mejoró MAE y RMSE de la línea base, pero empeoró MAPE. HGB mejoró las tres métricas en prueba, pero no sustituye a RF porque la prueba no participó en el ranking.

Bootstrap clusterizado por municipio, 5.000 remuestreos, semilla `20261104`:

- diferencia `MAE_línea_base - MAE_RF`: 0,009342 t/ha;
- IC 95 %: [-0,010022; 0,027903] t/ha;
- la mejora de RF **no es distinguible del azar al 95 %**.

### 6.7 Rango y diagnóstico

- `q10` residual out-of-fold: -0,593090 t/ha.
- `q90` residual out-of-fold: 0,724648 t/ha.
- Cobertura observada en 2019--2024: 60,507 %, no 80 %.
- El rango es “rango típico de error”, no intervalo de confianza ni banda garantizada.
- Importancia por permutación: 30 repeticiones, semilla `20261103`; variables disponibles: 8.
- Aumento medio de MAE al permutar: sistema 0,379; departamento 0,103; rezago 0,046; municipio 0,014; temperatura 0,006; semestre 0,0005; año 0,000; humedad del suelo -0,001 t/ha.

Diagnóstico de redondeo de la fuente EVA:

| Cultivo | Fuente | Registros | Coinciden | Porcentaje |
|---|---|---:|---:|---:|
| Maíz | 2007--2018 | 24.859 | 6.091 | 24,5 % |
| Maíz | 2019--2024 | 14.521 | 4.996 | 34,4 % |
| Yuca | 2007--2018 | 9.400 | 7.283 | 77,5 % |
| Yuca | 2019--2024 | 6.471 | 5.573 | 86,1 % |
| Ñame | 2007--2018 | 1.460 | 1.046 | 71,6 % |
| Ñame | 2019--2024 | 979 | 803 | 82,0 % |
| Todos los cultivos EVA | 2007--2018 | 202.412 | 111.583 | 55,1 % |
| Todos los cultivos EVA | 2019--2024 | 126.354 | 82.347 | 65,2 % |
| Todos los cultivos EVA | Total | 328.766 | 193.930 | 59,0 % |

“Coincide” significa que el rendimiento publicado es el entero más cercano de `produccion / area_cosechada`. Es un diagnóstico de redondeo de la fuente, **no una métrica de error del modelo**.

### 6.8 Inferencia publicada

- `ml/reports/rendimiento_esperado_maiz.csv`: 2.831 combinaciones `municipio--sistema--semestre` para 1.065 municipios.
- `frontend/src/data/rendimiento_esperado_maiz.json`: mismos 2.831 registros, convertidos de t/ha a kg/ha y redondeados a entero.
- La inferencia congela el perfil histórico mediano del grupo; no recibe año, rezago ni clima actual.
- La interfaz lo presenta como **referencia histórica**, nunca como predicción de la temporada en curso.
- Para municipios homónimos se requiere `cod_mun`; una combinación sin historia falla explícitamente y no inventa un valor.
- Yuca y ñame sólo tienen línea base; no hay modelos publicados para ellos.

## 7. Clasificador local de intenciones (ML independiente)

### 7.1 Taxonomía canónica

El modelo selecciona una de estas 13 intenciones:

1. `costo_total`;
2. `costo_por_hectarea`;
3. `costo_unitario`;
4. `jornales`;
5. `insumos`;
6. `ingresos_ventas`;
7. `rentabilidad`;
8. `produccion_y_sin_vender`;
9. `comparar_ciclos`;
10. `clima`;
11. `explicar_indicador`;
12. `saludo_ayuda`;
13. `fuera_de_alcance`.

### 7.2 Modelo fuente y exportación

Artefacto fuente local: `experimentos/asistente_propio/artifacts/model.joblib`.

- SHA-256: `767bf72bd68633a7f9a49b793babb0ca9cd76a8ca07421db9086f49e7f84cc1b`.
- Familia serializada: `LogisticRegression`.
- Parámetros: `C=2.0`, `class_weight="balanced"`, `max_iter=2500`, solver `lbfgs`, `random_state=20261104`.
- Calibración: `CalibratedClassifierCV(method="sigmoid", cv=5, ensemble=False, n_jobs=1)`.
- Features: unión de TF-IDF de palabras (n-gramas de 1--2), TF-IDF de caracteres `char_wb` (n-gramas de 3--5) y características léxicas/entidades dispersas.
- Umbral guardado en el bundle y exportado: `0.05`.
- Semilla: `20261104`.
- Entorno Python del experimento: Python 3.12.10, scikit-learn 1.7.1, NumPy 2.2.6, SciPy 1.15.3 y joblib 1.4.2. **No usar el entorno del pipeline de maíz** (scikit-learn 1.9.1) para regenerar este artefacto.

[`scripts/export_assistant_model.py`](../scripts/export_assistant_model.py) no reentrena ni modifica el modelo. Verifica la familia del pipeline y exporta vocabularios, IDF, pesos, interceptos y calibradores como `Float64Array` base64 en [`model_data.ts`](../supabase/functions/asistente/model_data.ts). También genera un fixture de paridad desde `experimentos/asistente_propio/data/dev.jsonl`:

- fixture: `supabase/functions/asistente/testdata/model_parity.json`;
- SHA-256 de `dev.jsonl`: `5997f8fff87f8ebc5ccf419e898a1381a6ddf7f1d862ed48e891e66148cbe129`;
- 260 casos, 20 por cada intención;
- `model_data.ts`: 1.157.571 bytes en la línea base;
- `model_parity.json`: 153.322 bytes en la línea base.

### 7.3 Datos experimentales y evaluación histórica

El experimento local (excluido de Git) declara:

- los datos son **sintéticos**, derivados de cálculos localmente verificables; no son preguntas reales de productores;
- train: 1.040 filas, 80 por intención, 574 familias semánticas;
- dev: 260 filas, 20 por intención;
- validaciones independientes sucesivas: 130, 65 y 39;
- examen final congelado: 150 preguntas (100 parte a + 50 parte b), 40 fuera de alcance;
- CV: `StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=20261104)`;
- taxonomía de 13 etiquetas sin fusiones a priori.

El examen final reportó **FALLO de 1 de 4 criterios**:

| Métrica histórica del examen | Resultado |
|---|---:|
| Top-1 cruda | 84,00 % |
| F1 macro | 0,8282 |
| Rechazo seguro fuera de alcance | 85,00 % |
| Falso rechazo dentro de alcance | 2,73 % |
| Rechazo explícito pesticidas/dosis | 75,00 % |
| Exactitud de cultivo | 98,81 % |
| Exactitud de ciclo | 90,80 % |
| Exactitud extremo a extremo | 79,31 % |
| Latencia media / mediana / p95 | 1,9255 / 1,8269 / 2,5400 ms |

Antes del examen, la selección reproducible por CV agrupado registró para `logistic` con reglas: accuracy OOF 90,865 %, macro-F1 0,909048 y log-loss 0,365568; en dev: accuracy 97,692 %, macro-F1 0,976885, rechazo seguro 100 %, falso rechazo 0 % y rechazo de pesticidas 100 %. Estos valores son de CV/dev y no sustituyen el examen final.

Criterios preacordados: top-1 ≥ 90 %; rechazo seguro ≥ 80 % y falso rechazo ≤ 10 %; E2E ≥ 85 %; rechazo de pesticidas/dosis 100 %.

### 7.4 Advertencia crítica de procedencia

El reporte local `experimentos/asistente_propio/REPORTE_FINAL.md` dice literalmente “no se integra nada” tras el fallo del examen. Sin embargo:

- el `model.joblib` con SHA `767bf7...` es el mismo artefacto evaluado por el manifiesto final y fue exportado después a `model_data.ts`;
- el manifiesto final y `pre_final_reproducibility.json` confirman que el artefacto congelado es `logistic`; un `train_log_final.txt` antiguo que menciona `LinearSVC` no es la evidencia canónica del artefacto;
- el artefacto se integró, probó, confirmizó y desplegó en commit `afe1c87`;
- el runtime incluye además un resolver determinista y veto de agroquímicos que no son el modelo puro del examen.

Por tanto, **no se debe publicar 84 % como “accuracy del asistente desplegado”**. Lo correcto es separar:

1. **Métrica histórica del examen congelado:** 84 % top-1; el examen falló sus criterios y no debe repetirse.
2. **Comportamiento del artefacto desplegado:** paridad numérica con Python en 260 casos de dev, despacho de las 13 intenciones, resolver semántico, veto server-side, contrato HTTP y smoke tests.
3. **No existe aún una nueva evaluación accuracy/E2E sobre un conjunto intacto posterior a la integración.** Si el informe afirma una tasa de acierto actual, debe decir de qué evaluación procede.

### 7.5 Lo que el runtime hace con el umbral

`model_data.ts` conserva `threshold: 0.05`, pero `predictModel` en [`model.ts`](../supabase/functions/asistente/model.ts) **no lo usa para abandonar o cambiar la predicción**: siempre devuelve el argmax y su confianza. El umbral pertenece al protocolo experimental y a la calibración exportada; no debe describirse como mecanismo activo de abstención en producción.

### 7.6 Resolver determinista y corrección semántica

`resolveAssistantIntent` mantiene la predicción del modelo salvo dos comportamientos:

- si el modelo predice `comparar_ciclos` y la pregunta coincide con “¿qué/cual ciclo (ha sido|fue|es|resultó) más rentable?”, la intención efectiva es `rentabilidad`;
- si el modelo predice `fuera_de_alcance`, se aplican reglas léxicas acotadas para recuperar una intención dentro de alcance.

La corrección semántica es deliberadamente estrecha: “Compara la rentabilidad…” conserva `comparar_ciclos`; no se deben generalizar cambios de reglas sin evidencia.

### 7.7 Veto server-side de agroquímicos

`isUnsafeAgroAdvice` marca la pregunta como fuera de alcance si combina:

1. un término de agroquímico (por ejemplo herbicida, insecticida, fungicida, fertilizante, urea, semilla o principio activo);
2. una acción (recomendar, aplicar, usar, controlar, dosis, etc.);
3. y no es una consulta histórica de costo (“cuánto gasté”, “cuánto costó aplicar”, etc.).

El veto ocurre **antes de construir la respuesta**. Es un control server-side de alcance, no una garantía exhaustiva de seguridad agronómica; no debe llamarse “certificación” ni “aprobación de agroquímicos”.

## 8. Mapa exacto del documento LaTeX

### 8.1 Preámbulo y convenciones

- Clase: `report`, `letterpaper`, 12 pt.
- Idioma: español como principal; inglés disponible mediante `babel`.
- Secciones numeradas arábigas; subsecciones `X.Y`.
- Figuras y tablas se numeran por sección mediante `counterwithin`.
- Interlineado global 1,5; tablas y bloques suelen bajar a 1.
- Paquetes relevantes: `graphicx`, `float`, `booktabs`, `longtable`, `array`, `multicol`, `mdframed`, `tikz`, `hyperref`, `xurl`, `chngcntr`.
- Macros propios: `\hdr` (encabezado de tabla), `\ra` (columna ragged-right) y `\captura` (imagen opcional con recuadro provisional).
- Color principal: `headerblue` RGB (31,56,100); filas alternas: `rowgray` RGB (235,235,235).
- Formato numérico español: coma decimal y punto de millar; unidades con `\,` (por ejemplo `11\\,154`).
- Los porcentajes se escapan como `\\,\\%`; los guiones largos de rango son `--`; los términos técnicos se tipografían con `\texttt{}` y los underscores se escapan.

### 8.2 Estructura editorial

1. **Portada:** título, autores, NRC, repositorio, revisor y fecha.
2. **Índice:** tabla de contenido con baselinestretch 1.
3. **Capítulo 1 — Avance 1:** problema, justificación, objetivo general, 9 objetivos específicos, usuarios, alcance preliminar y antecedentes (FMIS, plataformas comerciales, IA y meteorología).
4. **Capítulo 2 — Avance 2:** estado del arte, 7 RF, 4 RNF, actores, historias de usuario y casos de uso CU-01 a CU-09.
5. **Capítulo 3 — Avances 3 a 5:** evolución del producto, pantallas, flujos, trazabilidad RF, ERD/esquema, indicadores, tecnologías/arquitectura, decisiones, ML de maíz, validación y pendientes.
6. **Referencias:** entorno `thebibliography` con 17 entradas, no BibTeX.

Objetivos específicos (OE1--OE9): gestión estructural; registro de costos y trabajo; producción/ventas; indicadores financieros; dashboard/histórico; meteorología; referencia histórica de maíz; asistente conversacional; reportes e integración final.

### 8.3 Inventario de tablas y figuras

El `.tex` de línea base contiene 13 entornos `table`, 4 `longtable`, 2 figuras TikZ directas (ERD y arquitectura) y 9 llamadas `\captura` que generan marcos provisionales si faltan imágenes. Hay 19 leyendas escritas explícitamente (17 de tablas y 2 de figuras); la macro `\captura` puede añadir otras 9 leyendas al renderizar los cuadros provisionales. La bibliografía contiene 17 entradas.

Etiquetas importantes:

| Etiqueta | Contenido |
|---|---|
| `tab:estado-arte` | Síntesis del estado del arte |
| `tab:rf` | Requisitos funcionales RF1--RF7 |
| `tab:rnf` | Requisitos no funcionales RNF1--RNF4 |
| `tab:hu` | Historias de usuario |
| `tab:cu` | Casos de uso |
| `tab:pantallas` | Pantallas y requisitos asociados |
| `sec:estado-funcional` | Trazabilidad de implementación RF |
| `tab:trazabilidad` | RF, implementación, estado y brecha |
| `sec:erd` / `fig:erd` | Modelo de datos y ERD |
| `tab:entidades` | Elementos y atributos del esquema |
| `tab:comparacion-erd` | Diseño original frente a esquema aplicado |
| `sec:indicadores-vigentes` / `tab:ejemplo` | Fórmulas y ejemplo financiero |
| `tab:tecnologias` | Tecnologías por capa |
| `sec:arquitectura` / `fig:arquitectura` | Arquitectura implementada |
| `sec:ajuste-alcance` / `tab:decisiones` | Decisiones vigentes |
| `sec:ml-aplicado` / `tab:ml-validacion` | ML de maíz y prueba final |
| `tab:redondeo-fuente` | Diagnóstico de redondeo EVA |
| `tab:evidencia-pruebas` | Evidencia de validación |

### 8.4 Capturas que el documento espera

Todas estas rutas **no existen** en la línea base; la macro muestra un recuadro “Captura pendiente” si no se añaden:

| Archivo esperado | Contenido |
|---|---|
| `logo_utb.png` | Logo de la Universidad Tecnológica de Bolívar |
| `dashboard.png` | Dashboard, indicadores, clima y referencia de maíz |
| `Lotes.png` | Gestión de fincas, lotes, ciclos y municipio DANE |
| `Registro.png` | Registro de insumos, jornales y actividades |
| `IA.png` | Chat del asistente y fuente de respuesta |
| `login.png` | Acceso/registro con Supabase Auth |
| `referencia-rendimiento-maiz.png` | Tarjeta de referencia histórica de maíz |
| `selector-municipio-dane.png` | Selector DANE y código normalizado |
| `evidencia-rls-supabase.png` | Políticas RLS en Supabase |
| `prueba-dos-cuentas.png` | Evidencia visual de aislamiento con dos cuentas |

Una IA no debe fabricar estas imágenes. Debe mantener los recuadros o marcar la evidencia como pendiente.

### 8.5 Bibliografía existente

Claves `\cite`: `fountas2015`, `lawson2011`, `vanklompenburg2020`, `traction`, `ideam`, `openmeteo`, `openmeteoterms`, `anthropic`, `pgrls`, `vercel`, `supabasepricing`, `upraeva`, `danemgn`, `era5land`, `supabaserls`, `supabaseedge`, `vercelvite`.

La línea base incluye `anthropic` porque el `.tex` aún describe la integración externa heredada. Esa entrada no respalda una función vigente. Si la corrección del asistente elimina la mención a Claude, se deben retirar juntos `\cite{anthropic}` y `\bibitem{anthropic}` si la clave deja de usarse.

No agregar una cita sin `\\bibitem`; no dejar una `\\bibitem` sin uso si se busca una bibliografía limpia. Para afirmaciones nuevas que requieran fuente externa, verificar la fuente primaria y URL, no inventar DOI/ISBN.

## 9. Checklist para editar el LaTeX

### 9.1 Antes de editar

- [ ] Leer el README, esta guía y el `.tex` completo.
- [ ] Confirmar `git status`; no sobrescribir cambios ajenos.
- [ ] Confirmar que `IETR1433_Lab.tex` y `docs/trazabilidad_documento.md` están versionados antes de compartir el repositorio.
- [ ] Identificar si la tarea es editorial, técnica o de evidencia; no hacer más de lo solicitado.
- [ ] Anotar qué cifras se verificarán y en qué artefacto.

### 9.2 Durante la edición

- [ ] Mantener idioma, tono, macros y formato numérico español.
- [ ] Escapar correctamente `%`, `&`, `_`, `#`, `$` y comandos de LaTeX.
- [ ] No introducir tablas que excedan `\textwidth`; preferir `longtable` si son largas.
- [ ] No cambiar portada/autores/fecha sin confirmación.
- [ ] No convertir una meta en requisito cumplido.
- [ ] No presentar la ruta generativa heredada como capacidad actual o como pendiente que requiera configurar una clave.
- [ ] No llamar “predicción” a la referencia histórica de maíz.
- [ ] No atribuir al modelo de maíz métricas del clasificador de intenciones ni viceversa.
- [ ] Mantener juntas las advertencias metodológicas de cobertura, bootstrap y prueba fallida.
- [ ] No agregar capturas que no existan.
- [ ] Actualizar en el mismo cambio los conteos, decisiones y pendientes afectados.

### 9.3 Validación mínima del `.tex`

En el entorno de revisión original no había `pdflatex`, `xelatex`, `lualatex`, `tectonic`, `latexmk` ni `chktex`. Por eso se hicieron controles estáticos, pero **no se generó PDF**.

Controles estáticos que deben repetirse tras editar:

```powershell
Set-Location -LiteralPath 'C:\Users\Matt\Desktop\AGROPYME TEST'
python -c "from pathlib import Path; p=Path('IETR1433_Lab.tex'); s=p.read_text(encoding='utf-8'); print('open_braces',s.count('{'),'close_braces',s.count('}'))"
```

Además, comprobar:

- [ ] llaves de entrada y salida balanceadas;
- [ ] ninguna etiqueta duplicada;
- [ ] cada `\ref`/`\eqref` tiene destino;
- [ ] cada `\cite` tiene `\bibitem` y viceversa;
- [ ] ambientes `table`, `longtable`, `figure`, `itemize`, `enumerate` balanceados;
- [ ] todas las rutas de imagen son intencionales;
- [ ] ningún `\texttt` contiene un underscore sin escapar;
- [ ] tablas largas usan `longtable` y `\endhead`/`\endfirsthead` cuando proceda.

Si hay compilador TeX disponible:

```powershell
pdflatex -interaction=nonstopmode -halt-on-error IETR1433_Lab.tex
pdflatex -interaction=nonstopmode -halt-on-error IETR1433_Lab.tex
```

Para una entrega académica, compilar dos veces, revisar warnings, overflows, paginación, índice, figuras, tablas y bibliografía en el PDF. Una revisión estática no equivale a compilación.

### 9.4 Checklist de entrega de la IA

La respuesta final debe incluir:

1. archivos modificados;
2. resumen de cambios editoriales/técnicos;
3. evidencia utilizada para cada afirmación nueva;
4. comandos de validación ejecutados y resultados;
5. elementos que siguen pendientes;
6. advertencia si no se pudo compilar el PDF;
7. confirmación de que no se alteraron datos, credenciales ni archivos fuera del alcance.

## 10. Alcance académico y catálogo funcional original

El Avance 1 formuló un alcance de dos semestres. El informe debe conservar esa formulación como **alcance preliminar** y separarla del estado real posterior.

### 10.1 Funcionalidades incluidas en la versión 1.0 prevista

- gestión de usuarios o productores;
- registro de fincas y lotes;
- gestión de cultivos y ciclos productivos;
- registro de actividades, insumos, proveedores y costos;
- registro de mano de obra y jornales;
- registro de producción y ventas por ciclo;
- costos por lote, hectárea y unidad producida;
- rendimiento, margen realizado, margen sobre ventas, rentabilidad y estimación de producción pendiente;
- dashboard productivo y económico;
- histórico y comparación entre ciclos y lotes;
- fuente meteorológica pública y alertas básicas;
- referencia histórica experimental de rendimiento de maíz;
- asistente conversacional sobre datos registrados;
- reportes automáticos del ciclo.

### 10.2 Funcionalidades explícitamente fuera del alcance

- drones;
- IoT obligatorio;
- control automático de riego;
- diagnóstico automático de enfermedades;
- comercio electrónico;
- créditos agrícolas;
- recomendaciones autónomas de pesticidas o dosificaciones químicas.

### 10.3 Requisitos funcionales, redacción original

| ID | Descripción original | OE |
|---|---|---|
| RF1 | Gestión de usuarios, fincas, lotes, cultivos y ciclos productivos | OE1 |
| RF2 | Registro de actividades, insumos, proveedores y mano de obra/jornales, con trazabilidad por lote y ciclo | OE2 |
| RF3 | Registro de producción y ventas por ciclo | OE3 |
| RF4 | Cálculo automático de costos por lote, hectárea y unidad, e indicadores de rentabilidad | OE4 |
| RF5 | API meteorológica y alertas climáticas básicas por finca | OE6 |
| RF6 | Asistente conversacional de IA para consultas en lenguaje natural | OE8 |
| RF7 | Gestión de roles y acceso compartido a fincas | OE1 |

### 10.4 Requisitos no funcionales, redacción original

| ID | Categoría | Criterio de diseño |
|---|---|---|
| RNF1 | Usabilidad | Interfaz móvil desde 360 px; gasto en máximo 5 pasos; prueba con ≥3 personas externas |
| RNF2 | Seguridad | Cada productor sólo consulta sus datos; claves externas no se exponen; prueba con dos cuentas |
| RNF3 | Desempeño | Registro/consulta ≤2 s para p95 móvil; asistente ≤10 s para consultas típicas |
| RNF4 | Operación sin conexión | PWA que inicia offline, conserva consulta local y sincroniza al volver la red |

RNF1--RNF4 son metas/criterios de verificación, no pruebas ya completadas salvo donde el informe cite evidencia concreta.

### 10.5 Actores

- productor agrícola (principal);
- encargado de finca;
- ingeniero agrónomo o asesor técnico (secundario);
- cooperativas/asociaciones (beneficiario potencial, no función implementada);
- servicios externos de meteorología.

### 10.6 Casos de uso

| ID | Caso | Actor principal | RF |
|---|---|---|---|
| CU-01 | Autenticarse y gestionar perfil | Productor/encargado/agrónomo | RF1 |
| CU-02 | Gestionar fincas y lotes | Productor | RF1 |
| CU-03 | Gestionar cultivos y ciclos | Productor | RF1 |
| CU-04 | Registrar actividades e insumos | Encargado/productor | RF2 |
| CU-05 | Registrar mano de obra/jornales | Encargado/productor | RF2 |
| CU-06 | Registrar producción y ventas | Productor | RF3 |
| CU-07 | Consultar costos y rentabilidad | Productor/agrónomo | RF4 |
| CU-08 | Consultar alertas climáticas | Productor | RF5 |
| CU-09 | Consultar al asistente de IA | Productor | RF6 |

## 11. Prompt de arranque para la IA externa

Si se va a entregar el repositorio a otra IA, el siguiente prompt puede usarse como punto de partida. Debe pegarse **después** de que la IA haya leído el README, esta guía y el `.tex`:

```text
Vas a revisar y editar el documento LaTeX IETR1433_Lab.tex del proyecto AgroPyme AI.

Antes de editar:
1. Lee README.md, docs/guia_informe_latex.md, IETR1433_Lab.tex completo,
   docs/trazabilidad_documento.md y docs/esquema.md.
2. Revisa git status y no sobrescribas cambios ajenos.
3. Usa código, migraciones, pruebas y artefactos como fuentes de verdad;
   no uses memories, inferencias o cifras inventadas.
4. Distingue implementado, parcial, pendiente y pendiente de evidencia.
5. Separa el modelo de rendimiento de maíz del clasificador de intenciones.
6. Mantén las limitaciones metodológicas, el estado real de RF/RNF y
   las discrepancias listadas en docs/guia_informe_latex.md (§4).

Al editar:
- Trabaja por defecto sólo en IETR1433_Lab.tex.
- Conserva idioma español, macros, formato numérico, referencias y estilo.
- No cambies portada, autores, NRC ni fecha sin autorización.
- No afirmes que la app es versión 1.0 completa ni que la referencia de maíz
  es una predicción. El fallback usa datos reales, no simulados.
- No presentes Claude/Anthropic ni una ruta generativa externa como capacidad
  actual; esa rama del código es heredada y no debe configurar ni documentarse.
- No atribuyas 84 % de top-1 al accuracy actual del asistente desplegado;
  ese 84 % pertenece al examen congelado que falló sus criterios.
- Actualiza tablas, texto, decisiones y pendientes de forma consistente.
- No inventes capturas, citas, pruebas ni resultados.

Antes de entregar:
- Ejecuta los controles LaTeX disponibles y, si hay TeX, compila dos veces.
- Revisa diff, enlaces, cifras, tablas, figuras y bibliografía.
- Informa archivos cambiados, evidencia usada, validaciones, pendientes y
  cualquier limitación de compilación.
```
