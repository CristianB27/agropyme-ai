# Línea base de rendimiento (Fase B)

Las medianas se calculan únicamente con entrenamiento (2007-2018) y se evalúan en prueba (2019-2024).

## Métricas totales

| Cultivo | Escenario | Filas | MAE (t/ha) | RMSE (t/ha) | MAPE (%) |
|---|---|---:|---:|---:|---:|
| MAIZ | TODOS | 11154 | 0.887 | 1.544 | 38.85 |
| YUCA | TODOS | 4125 | 3.564 | 5.235 | 39.60 |
| YUCA | SIN_MEDIO_SEMESTRE | 2117 | 3.514 | 5.181 | 36.93 |
| NAME | TODOS | 641 | 3.853 | 5.225 | 51.51 |

## Uso del respaldo y error por origen

| Cultivo | Escenario | Con historia | Con respaldo | Respaldo (%) | MAE hist. | RMSE hist. | MAPE hist. (%) | MAE resp. | RMSE resp. | MAPE resp. (%) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| MAIZ | TODOS | 10975 | 179 | 1.60 | 0.881 | 1.538 | 38.71 | 1.244 | 1.879 | 47.82 |
| YUCA | TODOS | 4077 | 48 | 1.16 | 3.548 | 5.228 | 38.95 | 4.894 | 5.809 | 94.29 |
| YUCA | SIN_MEDIO_SEMESTRE | 2103 | 14 | 0.66 | 3.506 | 5.178 | 36.39 | 4.809 | 5.535 | 117.39 |
| NAME | TODOS | 603 | 38 | 5.93 | 3.768 | 5.164 | 49.37 | 5.186 | 6.108 | 85.56 |

El detalle por año de prueba, Bolívar y Caribe está en `metricas_linea_base_cortes.csv`. El error por origen incluye MAE, RMSE y MAPE en `metricas_linea_base_origen.csv`.
