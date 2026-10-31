import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppData, Finca, Lote, CicloProductivo, Insumo, ManoDeObra, Actividad } from '../types';
import {
  createActividad,
  createCiclo,
  createFinca,
  createInsumo,
  createLote,
  createManoDeObra,
  loadAppData,
  type NuevaActividad,
  type NuevoCiclo,
  type NuevaFinca,
  type NuevoInsumo,
  type NuevoLote,
  type NuevaManoDeObra,
} from '../services/agropyme';

const EMPTY_DATA: AppData = {
  proveedores: [],
  fincas: [],
  lotes: [],
  cultivos: [],
  ciclos_productivos: [],
  actividades: [],
  insumos: [],
  mano_de_obra: [],
  unidades: [],
  cosechas: [],
  ventas: [],
  clima: [],
};

interface AppContextValue {
  data: AppData;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addFinca: (finca: NuevaFinca) => Promise<Finca>;
  addLote: (lote: NuevoLote) => Promise<Lote>;
  addCiclo: (ciclo: NuevoCiclo) => Promise<CicloProductivo>;
  addInsumo: (insumo: NuevoInsumo) => Promise<Insumo>;
  addManoDeObra: (jornal: NuevaManoDeObra) => Promise<ManoDeObra>;
  addActividad: (actividad: NuevaActividad) => Promise<Actividad>;
  selectedLoteForCost: string | null;
  selectedCicloForCost: string | null;
  setSelectedLoteForCost: (loteId: string | null) => void;
  setSelectedCicloForCost: (cicloId: string | null) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLoteForCost, setSelectedLoteForCost] = useState<string | null>(null);
  const [selectedCicloForCost, setSelectedCicloForCost] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setData(await loadAppData());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addFinca = useCallback(async (finca: NuevaFinca) => {
    const created = await createFinca(finca);
    setData((previous) => ({ ...previous, fincas: [...previous.fincas, created] }));
    return created;
  }, []);

  const addLote = useCallback(async (lote: NuevoLote) => {
    const created = await createLote(lote);
    setData((previous) => ({ ...previous, lotes: [...previous.lotes, created] }));
    return created;
  }, []);

  const addCiclo = useCallback(async (ciclo: NuevoCiclo) => {
    const created = await createCiclo(ciclo);
    setData((previous) => ({ ...previous, ciclos_productivos: [...previous.ciclos_productivos, created] }));
    return created;
  }, []);

  const addInsumo = useCallback(async (insumo: NuevoInsumo) => {
    const created = await createInsumo(insumo);
    setData((previous) => ({ ...previous, insumos: [...previous.insumos, created] }));
    return created;
  }, []);

  const addManoDeObra = useCallback(async (jornal: NuevaManoDeObra) => {
    const created = await createManoDeObra(jornal);
    setData((previous) => ({ ...previous, mano_de_obra: [...previous.mano_de_obra, created] }));
    return created;
  }, []);

  const addActividad = useCallback(async (actividad: NuevaActividad) => {
    const created = await createActividad(actividad);
    setData((previous) => ({ ...previous, actividades: [...previous.actividades, created] }));
    return created;
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    data, loading, error, refresh, addFinca, addLote, addCiclo, addInsumo,
    addManoDeObra, addActividad, selectedLoteForCost, selectedCicloForCost,
    setSelectedLoteForCost, setSelectedCicloForCost,
  }), [data, loading, error, refresh, addFinca, addLote, addCiclo, addInsumo, addManoDeObra, addActividad, selectedLoteForCost, selectedCicloForCost]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
