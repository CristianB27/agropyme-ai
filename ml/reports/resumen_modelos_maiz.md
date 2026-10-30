# Modelos de MAÍZ (Fase C, alcance reducido)

Los hiperparámetros se seleccionaron con cinco folds expansivos 2014--2018. La prueba 2019--2024 se evaluó una sola vez.

| Modelo | Filas | MAE (t/ha) | RMSE (t/ha) | MAPE (%) |
|---|---:|---:|---:|---:|
| LineaBase | 11,154 | 0.887 | 1.544 | 38.85 |
| HistGradientBoosting | 11,154 | 0.856 | 1.505 | 38.65 |
| RandomForest | 11,154 | 0.877 | 1.533 | 39.09 |
| Ridge | 11,154 | 0.945 | 1.550 | 46.77 |
