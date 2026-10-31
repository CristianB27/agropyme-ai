# Pipeline ML de maíz

Este directorio conserva el pipeline reproducible de la referencia histórica de rendimiento para maíz. El modelo publicado es **Random Forest**, entrenado con EVA UPRA/MADR de 2007-2018.

## Referencia de rendimiento

`ml/reports/rendimiento_esperado_maiz.csv` contiene 2,831 combinaciones reales de municipio, sistema y semestre para 1,065 municipios. El `rango_inferior_t_ha` y `rango_superior_t_ha` forman el **rango típico de error**: percentiles 10 y 90 de los residuales out-of-fold 2014-2018.

Este rango no es un intervalo central del 80 %. Su cobertura real en la prueba 2019-2024 fue **60,5 %**. Además, la mejora del modelo sobre la línea base no se distingue del azar en la prueba (IC 95 % de la diferencia de MAE: **-0,010 a 0,028 t/ha**). Por ello, el valor se presenta como referencia histórica y no como predicción.

## Exportación para frontend

El JSON del frontend se genera sin volver a entrenar el modelo:

```powershell
python ml/src/exportar_json_frontend.py
```

El exportador valida el CSV, conserva `cod_mun` como texto de cinco dígitos, convierte t/ha a kg/ha redondeada al entero y escribe `frontend/src/data/rendimiento_esperado_maiz.json` de forma determinista.

El pipeline completo y sus preprocesamiento permanecen en `ml/src/`; los datos locales y los modelos serializados no se versionan.
