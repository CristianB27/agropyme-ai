from pathlib import Path
import pandas as pd, numpy as np

# Raíz del repo: este archivo está en ml/src/, así que subimos dos niveles
ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / 'data' / 'processed'
PROCESSED.mkdir(parents=True, exist_ok=True)

# Los límites de atípicos se calculan solo con estos años (entrenamiento),
# para que los años de prueba no influyan en la limpieza.
ENTRENAMIENTO_HASTA = 2018

df = pd.read_pickle(PROCESSED / 'eva_bruto.pkl')

# --- Registro de limpieza: cada paso guarda cuántas filas quitó y cuántas quedan ---
log = [('Filas brutas (2006-2024, unidas)', 0, len(df))]

def paso(nombre, mask):
    """Conserva solo las filas donde mask es True y deja constancia en el registro."""
    global df
    quitadas = int((~mask).sum())
    df = df[mask]
    log.append((nombre, quitadas, len(df)))

paso('Se descarta 2006 (fuera del rango 2007-2024)', df.anio >= 2007)
df = df.copy()

df['sem'] = df.periodo.str.extract(r'([AB])$')[0].fillna('ANUAL')
print('periodo por cultivo foco:')
foco = df[df.cultivo.isin(['MAIZ', 'YUCA', 'NAME'])]
print(pd.crosstab(foco.cultivo, foco['sem']))

paso('Sin area cosechada (<=0 o vacia)', df.area_cosechada.fillna(0) > 0)
paso('Sin produccion (<=0 o vacia)', df.produccion.fillna(0) > 0)
df['rend_calc'] = df.produccion / df.area_cosechada
paso('Cosechada > sembrada (+10% tolerancia)',
     ~(df.area_cosechada > df.area_sembrada.fillna(np.inf) * 1.10))

df['dif'] = (df.rend_calc / df.rendimiento - 1).abs()
print('rendimiento reportado vs produccion/area: mediana dif', df['dif'].median(),
      ' >5%:', (df['dif'] > 0.05).mean())

# --- Atípicos: 3 x IQR sobre el log del rendimiento, por cultivo ---
# Los cuartiles salen SOLO de los años de entrenamiento y luego se aplican a todos los años.
tr = df[df.anio <= ENTRENAMIENTO_HASTA].assign(l=lambda d: np.log(d.rend_calc))
q = tr.groupby('cultivo')['l'].quantile([.25, .75]).unstack()
q['iqr'] = q[0.75] - q[0.25]
q['lo'] = q[0.25] - 3 * q['iqr']
q['hi'] = q[0.75] + 3 * q['iqr']

lim = df[['cultivo']].join(q[['lo', 'hi']], on='cultivo')
l = np.log(df.rend_calc)
# Cultivos sin datos de entrenamiento no tienen límites: no se filtran.
dentro = ((l >= lim.lo) & (l <= lim.hi)) | lim.lo.isna()
paso(f'Rendimientos atipicos (3 x IQR en log; limites con 2007-{ENTRENAMIENTO_HASTA})', dentro)

log_df = pd.DataFrame(log, columns=['paso', 'filas_eliminadas', 'filas_restantes'])
print(log_df.to_string(index=False))
log_df.to_csv(PROCESSED / 'log_limpieza.csv', index=False, encoding='utf-8-sig')

df.to_pickle(PROCESSED / 'eva_limpio.pkl')
print('filas limpias', len(df))

# --- Conteo ---
g = df.groupby('cultivo').agg(filas=('rend_calc', 'size'), municipios=('cod_mun', 'nunique'),
                              anios=('anio', 'nunique'), deptos=('departamento', 'nunique'))
g['filas_bolivar'] = df[df.departamento == 'BOLIVAR'].groupby('cultivo').size()
g = g.fillna(0).astype({'filas_bolivar': int}).sort_values('filas', ascending=False)
print(g.head(25).to_string())
print(g.loc[[c for c in ['MAIZ', 'YUCA', 'NAME'] if c in g.index]].to_string())