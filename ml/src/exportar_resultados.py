from pathlib import Path
import pandas as pd, numpy as np

# Raíz del repo: este archivo está en ml/src/, así que subimos dos niveles
ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / 'data' / 'processed'
REPORTS = ROOT / 'ml' / 'reports'
PROCESSED.mkdir(parents=True, exist_ok=True)
REPORTS.mkdir(parents=True, exist_ok=True)

df = pd.read_pickle(PROCESSED / 'eva_limpio.pkl')
df['semestre'] = df.periodo.str.extract(r'([AB])$')[0].fillna('ANUAL')
caribe = ['ATLANTICO','BOLIVAR','CESAR','CORDOBA','LA GUAJIRA','MAGDALENA','SUCRE','SAN ANDRES']
df['region_caribe'] = df.departamento.isin(caribe)
df['rendimiento_kg_ha'] = (df.rend_calc*1000).round(1)
out = df[['fuente','departamento','cod_mun','municipio','grupo','cultivo','desagregacion','anio','periodo','semestre','ciclo',
          'area_sembrada','area_cosechada','produccion','rend_calc','rendimiento_kg_ha','region_caribe']].rename(columns={'rend_calc':'rendimiento_t_ha'})
out.to_csv(PROCESSED / 'eva_2007_2024_limpio.csv', index=False, encoding='utf-8-sig')

g = df.groupby('cultivo').agg(filas=('anio','size'), municipios=('cod_mun','nunique'), anios=('anio','nunique'),
                              departamentos=('departamento','nunique'))
g['filas_caribe'] = df[df.region_caribe].groupby('cultivo').size()
g['filas_bolivar'] = df[df.departamento=='BOLIVAR'].groupby('cultivo').size()
g['municipios_bolivar'] = df[df.departamento=='BOLIVAR'].groupby('cultivo').cod_mun.nunique()
g = g.fillna(0).astype(int).sort_values('filas', ascending=False).reset_index()
foco = g[g.cultivo.isin(['MAIZ','YUCA','NAME'])]

# El registro de limpieza lo genera limpiar_contar.py; aquí solo se lee.
ruta_log = PROCESSED / 'log_limpieza.csv'
if not ruta_log.exists():
    raise FileNotFoundError(f'No existe {ruta_log}. Corre antes ml/src/limpiar_contar.py')
limpieza = pd.read_csv(ruta_log)

with pd.ExcelWriter(REPORTS / 'conteo_cultivos_EVA.xlsx') as w:
    foco.to_excel(w,sheet_name='Cultivos foco',index=False)
    g.to_excel(w,sheet_name='Todos los cultivos',index=False)
    limpieza.to_excel(w,sheet_name='Limpieza',index=False)
print(foco.to_string()); print(limpieza.to_string(index=False)); print(len(out))