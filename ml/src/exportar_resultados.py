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

bruto = pd.read_pickle(PROCESSED / 'eva_bruto.pkl')
limpieza = pd.DataFrame({'paso':['Filas brutas (2006-2024, unidas)','Se descarta 2006 (no pertenece al rango)','Sin área cosechada (<=0 o vacía)',
  'Área cosechada > sembrada + 10%','Rendimientos atípicos (3 x IQR en log, por cultivo)','Filas limpias finales'],
  'filas':[len(bruto), int((bruto.anio<2007).sum()), 9020, 8683, 1130, len(df)]})

with pd.ExcelWriter(REPORTS / 'conteo_cultivos_EVA.xlsx') as w:
    foco.to_excel(w,sheet_name='Cultivos foco',index=False)
    g.to_excel(w,sheet_name='Todos los cultivos',index=False)
    limpieza.to_excel(w,sheet_name='Limpieza',index=False)
print(foco.to_string()); print(limpieza.to_string()); print(len(out))