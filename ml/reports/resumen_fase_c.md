# Resumen de MAÍZ: Fases C y D

## Resultado de la prueba 2019-2024 (Fase C)

| Modelo | Filas | MAE (t/ha) | RMSE (t/ha) | MAPE (%) |
|---|---:|---:|---:|---:|
| LineaBase | 11,154 | 0.887 | 1.544 | 38.85 |
| HistGradientBoosting | 11,154 | 0.856 | 1.505 | 38.65 |
| RandomForest | 11,154 | 0.877 | 1.533 | 39.09 |
| Ridge | 11,154 | 0.945 | 1.550 | 46.77 |

La prueba se evaluó una sola vez con 11,154 filas idénticas para la línea base y los tres modelos.

## Selección y modelo de inferencia (Fase D)

El modelo elegido exclusivamente por MAE medio en folds fue **RandomForest**. El modelo que queda para inferencia es **RandomForest**.

El candidato se mantiene por ser el mejor en MAE medio de folds; la prueba solo confirma que al menos un modelo supera el MAE de la línea base y no participa del ranking.

La prueba no se usó para reconfigurar ni para rankear modelos; el CSV de prueba solo se consultó para aplicar el veto global acordado. Por eso, una métrica superior en prueba de otro modelo no reemplaza al ganador de folds.

En la prueba, RandomForest obtuvo MAE 0.877, RMSE 1.533 y MAPE 39.09; la línea base obtuvo 0.887, 1.544 y 38.85, respectivamente.
El menor MAE de prueba fue 0.856 de HistGradientBoosting; no se adoptó porque la prueba no participa en el ranking del modelo final.

### Validación out-of-fold de los candidatos

| Modelo | MAE medio (t/ha) | RMSE medio (t/ha) | MAPE medio (%) |
|---|---:|---:|---:|
| HistGradientBoosting | 0.401 | 0.625 | 24.47 |
| LineaBase | 0.475 | 0.756 | 26.82 |
| RandomForest | 0.395 | 0.647 | 23.38 |
| Ridge | 0.440 | 0.652 | 27.06 |

## Cobertura y clima faltante

- Filas totales con al menos una variable climática faltante: **116**: 112 filas en 5 municipios con celdas incompletas, más 4 filas de 2 códigos sin MGN 2023.
- Las medianas de la línea base se calculan dentro de cada fold; la imputación climática de los modelos también se ajusta dentro de cada fold.
- Filas de la tabla de inferencia: **2831**, una por combinación real municipio-sistema-semestre con historia.

## Rango típico de error

El rango típico de error (percentiles 10 y 90 de los residuales out-of-fold 2014-2018) usa q10=-0.593 y q90=0.725 t/ha. Su cobertura real en la prueba 2019-2024 fue **60,5 %**, por lo que no es un intervalo central del 80 % ni una banda con garantía de cobertura.

## Interpretación del valor

La mejora del modelo sobre la línea base no se distingue del azar en la prueba: el IC 95 % de la diferencia de MAE fue **-0,010 a 0,028 t/ha**. Por esta razón, el valor se presenta como referencia histórica y no como predicción.

## Limitaciones

- La entrada de inferencia no incluye año ni clima actual: el perfil mediano histórico del grupo se congela para el esperado.
- Solo se incluyen combinaciones con historia de entrenamiento; no se inventan combinaciones ni municipios sin historial.
- Los nombres homónimos requieren `cod_mun` como desambiguador.
- El cambio de base EVA 2007-2018 a 2019-2024 puede afectar el desempeño; la prueba no aísla ese efecto.
- El rango es una guía empírica de error y no una garantía para cada municipio, sistema o semestre.
