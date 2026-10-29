from pathlib import Path
import pandas as pd, unicodedata, re

# Raíz del repo: este archivo está en ml/src/, así que subimos dos niveles
ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data' / 'raw'
PROCESSED = ROOT / 'data' / 'processed'
PROCESSED.mkdir(parents=True, exist_ok=True)

def norm(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii','ignore').decode().upper()
    return re.sub(r'\s+',' ', s).strip()

cols = ['cod_dep','departamento','cod_mun','municipio','grupo','subgrupo','cultivo','desagregacion',
        'anio','periodo','area_sembrada','area_cosechada','produccion','rendimiento','ciclo']

a = pd.read_excel(RAW / 'Base Agrícola EVA 2007-2018_MADR.xlsx', sheet_name='FINAL', header=None, skiprows=2)
a = a.iloc[:, :15]; a.columns = cols
a['fuente'] = '2007-2018'
b = pd.read_excel(RAW / 'Base EVA 2019-2024.xlsx', sheet_name='BASE 2019-2024')
b.columns = cols; b['fuente'] = '2019-2024'

df = pd.concat([a,b], ignore_index=True)
n0 = len(df)
for c in ['departamento','municipio','grupo','subgrupo','cultivo','desagregacion','ciclo']:
    df[c] = df[c].map(norm)
for c in ['cod_mun','anio','area_sembrada','area_cosechada','produccion','rendimiento']:
    df[c] = pd.to_numeric(df[c], errors='coerce')
df['periodo'] = df['periodo'].astype(str).str.strip().str.upper()
df['ciclo'] = df['ciclo'].replace({'TRANSITORIO':'TRANSITORIO','PERMANENTE':'PERMANENTE'})
df.to_pickle(PROCESSED / 'eva_bruto.pkl')
print('filas brutas', n0)
print(df.groupby('fuente')['anio'].agg(['min','max','count']))
print('cultivos unicos', df['cultivo'].nunique())
print(df[df.cultivo.str.contains('MAIZ|YUCA|NAME')].groupby(['cultivo','desagregacion']).size().to_string())
print(df[df.fuente=='2007-2018'].periodo.str[-1].value_counts().head())