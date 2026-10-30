# Diagnóstico post hoc de inferencia de MAÍZ

Diagnóstico del Random Forest congelado en la prueba 2019-2024. No se cambió el modelo, no se ajustó el rango y no se usaron la prueba para seleccionar ni recalibrar nada.

## 1. Cobertura real del rango q10-q90

Los residuales congelados son q10=-0.593 y q90=0.725 t/ha; se aplicaron a las predicciones RF de prueba con el mismo recorte en cero de la tabla de inferencia.

| Corte | Año | Filas | Dentro | Cobertura (%) |
|---|---:|---:|---:|---:|
| Total | — | 11,154 | 6,749 | 60.51 |
| Año | 2019 | 2,102 | 1,340 | 63.75 |
| Año | 2020 | 2,174 | 1,255 | 57.73 |
| Año | 2021 | 2,175 | 1,308 | 60.14 |
| Año | 2022 | 1,610 | 984 | 61.12 |
| Año | 2023 | 1,553 | 936 | 60.27 |
| Año | 2024 | 1,540 | 926 | 60.13 |

La cobertura observada quedó 19.49 puntos porcentuales por debajo del objetivo nominal de 80 %. No se recalibró el rango.

## 2. MAE y RMSE por año en Bolívar

| Año | Modelo | Filas | MAE (t/ha) | RMSE (t/ha) |
|---:|---|---:|---:|---:|
| 2019 | LineaBase | 96 | 0.554 | 0.806 |
| 2019 | RandomForest | 96 | 0.527 | 0.803 |
| 2020 | LineaBase | 96 | 0.720 | 1.051 |
| 2020 | RandomForest | 96 | 0.725 | 1.037 |
| 2021 | LineaBase | 96 | 0.674 | 0.897 |
| 2021 | RandomForest | 96 | 0.690 | 0.922 |
| 2022 | LineaBase | 72 | 0.683 | 0.897 |
| 2022 | RandomForest | 72 | 0.660 | 0.906 |
| 2023 | LineaBase | 69 | 0.696 | 0.940 |
| 2023 | RandomForest | 69 | 0.681 | 0.931 |
| 2024 | LineaBase | 78 | 0.773 | 1.053 |
| 2024 | RandomForest | 78 | 0.751 | 1.016 |

## 3. Importancia por permutación

La importancia es el aumento medio del MAE al permutar cada variable en la prueba. Solo hay 8 predictores permitidos, así que el top 10 contiene las 8 variables disponibles.

| Posición | Variable | Aumento MAE (t/ha) | Desv. (t/ha) |
|---:|---|---:|---:|
| 1 | sistema | 0.3788 | 0.0058 |
| 2 | departamento | 0.1029 | 0.0036 |
| 3 | rendimiento_lag1_t_ha | 0.0458 | 0.0018 |
| 4 | municipio | 0.0135 | 0.0006 |
| 5 | temperatura_2m_media_c | 0.0064 | 0.0010 |
| 6 | semestre | 0.0005 | 0.0003 |
| 7 | anio | 0.0000 | 0.0000 |
| 8 | soil_moisture_0_to_7cm_media | -0.0014 | 0.0011 |

Un valor positivo indica que permutar la variable degradó el MAE; uno negativo indica que la permutación no lo degradó en esta prueba.

## 4. Bootstrap clusterizado por municipios

- MAE línea base: 0.8866 t/ha.
- MAE Random Forest: 0.8772 t/ha.
- Diferencia (línea base − RF): 0.0093 t/ha.
- IC 95 % percentil: [-0.0100, 0.0279] t/ha.
- 5,000 remuestreos de los 1,036 municipios de prueba.

El intervalo 95 % contiene cero: con este bootstrap no se puede distinguir la mejora observada del azar.

## Limitaciones

- La cobertura mide el esquema empírico q10-q90 sobre esta prueba; no garantiza cobertura por municipio, año o futuro.
- La importancia por permutación es asociativa, no causal; las variables categóricas de alta cardinalidad pueden ser difíciles de interpretar.
- El bootstrap representa incertidumbre por municipio en la prueba, no toda la incertidumbre de un despliegue futuro.
