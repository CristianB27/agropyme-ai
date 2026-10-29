from pathlib import Path
import pandas as pd, numpy as np

# Raíz del repo: este archivo está en ml/src/, así que subimos dos niveles
ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / 'data' / 'processed'
PROCESSED.mkdir(parents=True, exist_ok=True)

df = pd.read_pickle(PROCESSED / 'eva_bruto.pkl')
df = df[df.anio>=2007].copy()
df['sem'] = df.periodo.str.extract(r'([AB])$')[0].fillna('ANUAL')
print('periodo por cultivo foco:')
foco = df[df.cultivo.isin(['MAIZ','YUCA','NAME'])]
print(pd.crosstab(foco.cultivo, foco['sem']))

# limpieza con registro
log=[]
def paso(nombre, mask):
    global df
    log.append((nombre, int((~mask).sum()))); df = df[mask]
paso('sin area cosechada (<=0 o vacia)', df.area_cosechada.fillna(0)>0)
paso('sin produccion (<=0 o vacia)', df.produccion.fillna(0)>0)
df['rend_calc'] = df.produccion/df.area_cosechada
paso('cosechada > sembrada (+10% tolerancia)', ~(df.area_cosechada > df.area_sembrada.fillna(np.inf)*1.10))
df['dif'] = (df.rend_calc/df.rendimiento - 1).abs()
print('rendimiento reportado vs produccion/area: mediana dif', df['dif'].median(), ' >5%:', (df['dif']>0.05).mean())
log_df = pd.DataFrame(log, columns=['paso','filas_eliminadas']); print(log_df)

# outliers por cultivo (IQR 3x sobre log)
def out(g):
    l = np.log(g.rend_calc); q1,q3 = l.quantile([.25,.75]); i=q3-q1
    return (l>=q1-3*i)&(l<=q3+3*i)
m = df.groupby('cultivo', group_keys=False).apply(out)
print('outliers rendimiento (3xIQR log por cultivo):', int((~m).sum()))
df = df.loc[m.reindex(df.index, fill_value=False)]
df.to_pickle(PROCESSED / 'eva_limpio.pkl')
print('filas limpias', len(df))

# conteo
g = df.groupby('cultivo').agg(filas=('rend_calc','size'), municipios=('cod_mun','nunique'),
        anios=('anio','nunique'), deptos=('departamento','nunique'))
g['filas_caribe_bolivar'] = df[df.departamento=='BOLIVAR'].groupby('cultivo').size()
g = g.fillna(0).astype({'filas_caribe_bolivar':int}).sort_values('filas',ascending=False)
print(g.head(25).to_string())
print(g.loc[[c for c in ['MAIZ','YUCA','NAME'] if c in g.index]].to_string())