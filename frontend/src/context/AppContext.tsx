import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppData, Finca, Lote, CicloProductivo, Insumo, ManoDeObra, Actividad, Proveedor, Cosecha, Venta } from '../types';
import {
  createActividad,
  createCiclo,
  createCosecha,
  createFinca,
  createInsumo,
  createLote,
  createManoDeObra,
  createProveedor,
  createVenta,
  deleteActividad as deleteActividadRecord,
  deleteCosecha as deleteCosechaRecord,
  deleteInsumo as deleteInsumoRecord,
  deleteLote as deleteLoteRecord,
  deleteManoDeObra as deleteManoDeObraRecord,
  deleteVenta as deleteVentaRecord,
  loadAppData,
  updateActividad as updateActividadRecord,
  updateFincaCodMun,
  updateInsumo as updateInsumoRecord,
  updateLote as updateLoteRecord,
  updateManoDeObra as updateManoDeObraRecord,
  type NuevaActividad,
  type NuevaCosecha,
  type NuevoCiclo,
  type NuevaFinca,
  type NuevoInsumo,
  type NuevoLote,
  type NuevaManoDeObra,
  type NuevoProveedor,
  type NuevaVenta,
} from '../services/agropyme';
import { loadClimaForFincas } from '../services/clima';

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
  climaLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshClima: () => Promise<void>;
  addFinca: (finca: NuevaFinca) => Promise<Finca>;
  updateFincaCodMun: (fincaId: string, codMun: string | null) => Promise<Finca>;
  addLote: (lote: NuevoLote) => Promise<Lote>;
  updateLote: (id: string, lote: NuevoLote) => Promise<Lote>;
  deleteLote: (id: string) => Promise<void>;
  addCiclo: (ciclo: NuevoCiclo) => Promise<CicloProductivo>;
  addProveedor: (proveedor: NuevoProveedor) => Promise<Proveedor>;
  addInsumo: (insumo: NuevoInsumo) => Promise<Insumo>;
  addManoDeObra: (jornal: NuevaManoDeObra) => Promise<ManoDeObra>;
  addActividad: (actividad: NuevaActividad) => Promise<Actividad>;
  addCosecha: (cosecha: NuevaCosecha) => Promise<Cosecha>;
  addVenta: (venta: NuevaVenta) => Promise<Venta>;
  deleteCosecha: (id: string) => Promise<void>;
  deleteVenta: (id: string) => Promise<void>;
  updateInsumo: (id: string, insumo: NuevoInsumo) => Promise<Insumo>;
  deleteInsumo: (id: string) => Promise<void>;
  updateManoDeObra: (id: string, jornal: NuevaManoDeObra) => Promise<ManoDeObra>;
  deleteManoDeObra: (id: string) => Promise<void>;
  updateActividad: (id: string, actividad: NuevaActividad) => Promise<Actividad>;
  deleteActividad: (id: string) => Promise<void>;
  selectedLoteForCost: string | null;
  selectedCicloForCost: string | null;
  setSelectedLoteForCost: (loteId: string | null) => void;
  setSelectedCicloForCost: (cicloId: string | null) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [climaLoading, setClimaLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLoteForCost, setSelectedLoteForCost] = useState<string | null>(null);
  const [selectedCicloForCost, setSelectedCicloForCost] = useState<string | null>(null);

  const refreshClima = useCallback(async (fincas: Finca[]) => {
    if (fincas.length === 0) {
      setData((previous) => ({ ...previous, clima: [] }));
      setClimaLoading(false);
      return;
    }

    setClimaLoading(true);
    try {
      const clima = await loadClimaForFincas(fincas);
      setData((previous) => {
        const climaByFinca = new Map(previous.clima.map((item) => [item.finca_id, item]));
        for (const item of clima) climaByFinca.set(item.finca_id, item);
        return {
          ...previous,
          clima: fincas
            .map((finca) => climaByFinca.get(finca.id))
            .filter((item): item is NonNullable<typeof item> => item !== undefined),
        };
      });
    } finally {
      setClimaLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const appData = await loadAppData();
      setData(appData);
      setLoading(false);
      await refreshClima(appData.fincas);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  }, [refreshClima]);

  const refreshClimaForAll = useCallback(async () => {
    await refreshClima(data.fincas);
  }, [data.fincas, refreshClima]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addFinca = useCallback(async (finca: NuevaFinca) => {
    const created = await createFinca(finca);
    setData((previous) => ({ ...previous, fincas: [...previous.fincas, created] }));

    void loadClimaForFincas([created]).then((clima) => {
      setData((previous) => ({
        ...previous,
        clima: [
          ...previous.clima.filter((item) => item.finca_id !== created.id),
          ...clima,
        ],
      }));
    });

    return created;
  }, []);

  const updateFincaCodMunCallback = useCallback(async (fincaId: string, codMun: string | null) => {
    const updated = await updateFincaCodMun(fincaId, codMun);
    setData((previous) => ({
      ...previous,
      fincas: previous.fincas.map((finca) => finca.id === updated.id ? updated : finca),
    }));
    return updated;
  }, []);

  const addLote = useCallback(async (lote: NuevoLote) => {
    const created = await createLote(lote);
    setData((previous) => ({ ...previous, lotes: [...previous.lotes, created] }));
    return created;
  }, []);

  const updateLote = useCallback(async (id: string, lote: NuevoLote) => {
    const updated = await updateLoteRecord(id, lote);
    setData((previous) => ({
      ...previous,
      lotes: previous.lotes.map((item) => item.id === id ? updated : item),
    }));
    return updated;
  }, []);

  const deleteLote = useCallback(async (id: string) => {
    const cicloIds = new Set(
      data.ciclos_productivos
        .filter((ciclo) => ciclo.lote_id === id)
        .map((ciclo) => ciclo.id),
    );

    await deleteLoteRecord(id);
    setData((previous) => ({
      ...previous,
      lotes: previous.lotes.filter((lote) => lote.id !== id),
      ciclos_productivos: previous.ciclos_productivos.filter((ciclo) => ciclo.lote_id !== id),
      actividades: previous.actividades.filter((actividad) => !cicloIds.has(actividad.ciclo_id)),
      insumos: previous.insumos.filter((insumo) => !cicloIds.has(insumo.ciclo_id)),
      mano_de_obra: previous.mano_de_obra.filter((jornal) => !cicloIds.has(jornal.ciclo_id)),
      cosechas: previous.cosechas.filter((cosecha) => !cicloIds.has(cosecha.ciclo_id)),
      ventas: previous.ventas.filter((venta) => !cicloIds.has(venta.ciclo_id)),
    }));
    setSelectedLoteForCost((current) => current === id ? null : current);
    setSelectedCicloForCost((current) => current && cicloIds.has(current) ? null : current);
  }, [data.ciclos_productivos]);

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

  const addCosecha = useCallback(async (cosecha: NuevaCosecha) => {
    const created = await createCosecha(cosecha);
    setData((previous) => ({ ...previous, cosechas: [...previous.cosechas, created] }));
    return created;
  }, []);

  const addVenta = useCallback(async (venta: NuevaVenta) => {
    const created = await createVenta(venta);
    setData((previous) => ({ ...previous, ventas: [...previous.ventas, created] }));
    return created;
  }, []);

  const deleteCosecha = useCallback(async (id: string) => {
    await deleteCosechaRecord(id);
    setData((previous) => ({ ...previous, cosechas: previous.cosechas.filter((item) => item.id !== id) }));
  }, []);

  const deleteVenta = useCallback(async (id: string) => {
    await deleteVentaRecord(id);
    setData((previous) => ({ ...previous, ventas: previous.ventas.filter((item) => item.id !== id) }));
  }, []);

  const addProveedor = useCallback(async (proveedor: NuevoProveedor) => {
    const created = await createProveedor(proveedor);
    setData((previous) => ({ ...previous, proveedores: [...previous.proveedores, created] }));
    return created;
  }, []);

  const updateInsumo = useCallback(async (id: string, insumo: NuevoInsumo) => {
    const updated = await updateInsumoRecord(id, insumo);
    setData((previous) => ({
      ...previous,
      insumos: previous.insumos.map((item) => item.id === id ? updated : item),
    }));
    return updated;
  }, []);

  const deleteInsumo = useCallback(async (id: string) => {
    await deleteInsumoRecord(id);
    setData((previous) => ({
      ...previous,
      insumos: previous.insumos.filter((item) => item.id !== id),
    }));
  }, []);

  const updateManoDeObra = useCallback(async (id: string, jornal: NuevaManoDeObra) => {
    const updated = await updateManoDeObraRecord(id, jornal);
    setData((previous) => ({
      ...previous,
      mano_de_obra: previous.mano_de_obra.map((item) => item.id === id ? updated : item),
    }));
    return updated;
  }, []);

  const deleteManoDeObra = useCallback(async (id: string) => {
    await deleteManoDeObraRecord(id);
    setData((previous) => ({
      ...previous,
      mano_de_obra: previous.mano_de_obra.filter((item) => item.id !== id),
    }));
  }, []);

  const updateActividad = useCallback(async (id: string, actividad: NuevaActividad) => {
    const updated = await updateActividadRecord(id, actividad);
    setData((previous) => ({
      ...previous,
      actividades: previous.actividades.map((item) => item.id === id ? updated : item),
    }));
    return updated;
  }, []);

  const deleteActividad = useCallback(async (id: string) => {
    await deleteActividadRecord(id);
    setData((previous) => ({
      ...previous,
      actividades: previous.actividades.filter((item) => item.id !== id),
      insumos: previous.insumos.map((item) => item.actividad_id === id ? { ...item, actividad_id: null } : item),
      mano_de_obra: previous.mano_de_obra.map((item) => item.actividad_id === id ? { ...item, actividad_id: null } : item),
    }));
  }, []);


  const value = useMemo<AppContextValue>(() => ({
    data, loading, climaLoading, error, refresh, refreshClima: refreshClimaForAll,
    addFinca, updateFincaCodMun: updateFincaCodMunCallback, addLote, updateLote, deleteLote, addCiclo,
    addProveedor, addInsumo, addManoDeObra, addActividad,
    addCosecha, addVenta, deleteCosecha, deleteVenta,
    updateInsumo, deleteInsumo, updateManoDeObra, deleteManoDeObra,
    updateActividad, deleteActividad,
    selectedLoteForCost, selectedCicloForCost,
    setSelectedLoteForCost, setSelectedCicloForCost,
  }), [
    data, loading, climaLoading, error, refresh, refreshClimaForAll,
    addFinca, updateFincaCodMunCallback, addLote, updateLote, deleteLote, addCiclo, addProveedor,
    addInsumo, addManoDeObra, addActividad, addCosecha, addVenta,
    deleteCosecha, deleteVenta, updateInsumo, deleteInsumo,
    updateManoDeObra, deleteManoDeObra, updateActividad, deleteActividad,
    selectedLoteForCost, selectedCicloForCost,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
