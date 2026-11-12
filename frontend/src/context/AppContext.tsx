import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  Actividad,
  AppData,
  CicloProductivo,
  Cosecha,
  Finca,
  Insumo,
  Lote,
  ManoDeObra,
  Proveedor,
  SalidaProduccion,
  Venta,
} from '../types';
import {
  createActividad,
  createCiclo,
  createCosecha,
  createFinca,
  createInsumo,
  createLote,
  createManoDeObra,
  createProveedor,
  createSalida,
  createVenta,
  deleteActividad as deleteActividadRecord,
  deleteCiclo as deleteCicloRecord,
  deleteCosecha as deleteCosechaRecord,
  deleteFinca as deleteFincaRecord,
  deleteInsumo as deleteInsumoRecord,
  deleteLote as deleteLoteRecord,
  deleteManoDeObra as deleteManoDeObraRecord,
  deleteSalida as deleteSalidaRecord,
  deleteVenta as deleteVentaRecord,
  loadAppData,
  updateActividad as updateActividadRecord,
  updateCicloEstado as updateCicloEstadoRecord,
  updateCosecha as updateCosechaRecord,
  updateFinca as updateFincaRecord,
  updateFincaCodMun,
  updateInsumo as updateInsumoRecord,
  updateLote as updateLoteRecord,
  updateManoDeObra as updateManoDeObraRecord,
  updateSalida as updateSalidaRecord,
  updateVenta as updateVentaRecord,
  type CambioEstadoCiclo,
  type NuevaActividad,
  type NuevaCosecha,
  type NuevoCiclo,
  type NuevaFinca,
  type NuevoInsumo,
  type NuevoLote,
  type NuevaManoDeObra,
  type NuevoProveedor,
  type NuevaSalida,
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
  salidas_produccion: [],
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
  updateFinca: (id: string, finca: NuevaFinca) => Promise<Finca>;
  deleteFinca: (id: string) => Promise<void>;
  updateFincaCodMun: (fincaId: string, codMun: string | null) => Promise<Finca>;
  addLote: (lote: NuevoLote) => Promise<Lote>;
  updateLote: (id: string, lote: NuevoLote) => Promise<Lote>;
  deleteLote: (id: string) => Promise<void>;
  addCiclo: (ciclo: NuevoCiclo) => Promise<CicloProductivo>;
  updateCicloEstado: (id: string, cambio: CambioEstadoCiclo) => Promise<CicloProductivo>;
  deleteCiclo: (id: string) => Promise<void>;
  addProveedor: (proveedor: NuevoProveedor) => Promise<Proveedor>;
  addInsumo: (insumo: NuevoInsumo) => Promise<Insumo>;
  addManoDeObra: (jornal: NuevaManoDeObra) => Promise<ManoDeObra>;
  addActividad: (actividad: NuevaActividad) => Promise<Actividad>;
  addCosecha: (cosecha: NuevaCosecha) => Promise<Cosecha>;
  updateCosecha: (id: string, cosecha: NuevaCosecha) => Promise<Cosecha>;
  deleteCosecha: (id: string) => Promise<void>;
  addVenta: (venta: NuevaVenta) => Promise<Venta>;
  updateVenta: (id: string, venta: NuevaVenta) => Promise<Venta>;
  deleteVenta: (id: string) => Promise<void>;
  addSalida: (salida: NuevaSalida) => Promise<SalidaProduccion>;
  updateSalida: (id: string, salida: NuevaSalida) => Promise<SalidaProduccion>;
  deleteSalida: (id: string) => Promise<void>;
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

type ColeccionConId = 'cosechas' | 'ventas' | 'salidas_produccion';

/** Quita de los datos todo lo que cuelga de los ciclos indicados. */
function sinCiclos(previous: AppData, cicloIds: Set<string>): AppData {
  return {
    ...previous,
    ciclos_productivos: previous.ciclos_productivos.filter((ciclo) => !cicloIds.has(ciclo.id)),
    actividades: previous.actividades.filter((item) => !cicloIds.has(item.ciclo_id)),
    insumos: previous.insumos.filter((item) => !cicloIds.has(item.ciclo_id)),
    mano_de_obra: previous.mano_de_obra.filter((item) => !cicloIds.has(item.ciclo_id)),
    cosechas: previous.cosechas.filter((item) => !cicloIds.has(item.ciclo_id)),
    ventas: previous.ventas.filter((item) => !cicloIds.has(item.ciclo_id)),
    salidas_produccion: previous.salidas_produccion.filter((item) => !cicloIds.has(item.ciclo_id)),
  };
}

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

  // -- Fincas ---------------------------------------------------------------

  const cargarClimaDeFinca = useCallback((finca: Finca) => {
    void loadClimaForFincas([finca]).then((clima) => {
      setData((previous) => ({
        ...previous,
        clima: [
          ...previous.clima.filter((item) => item.finca_id !== finca.id),
          ...clima,
        ],
      }));
    });
  }, []);

  const addFinca = useCallback(async (finca: NuevaFinca) => {
    const created = await createFinca(finca);
    setData((previous) => ({ ...previous, fincas: [...previous.fincas, created] }));
    cargarClimaDeFinca(created);
    return created;
  }, [cargarClimaDeFinca]);

  const updateFinca = useCallback(async (id: string, finca: NuevaFinca) => {
    const anterior = data.fincas.find((item) => item.id === id);
    const updated = await updateFincaRecord(id, finca);
    setData((previous) => ({
      ...previous,
      fincas: previous.fincas.map((item) => item.id === id ? updated : item),
    }));
    if (!anterior || anterior.latitud !== updated.latitud || anterior.longitud !== updated.longitud) {
      cargarClimaDeFinca(updated);
    }
    return updated;
  }, [data.fincas, cargarClimaDeFinca]);

  const deleteFinca = useCallback(async (id: string) => {
    const loteIds = new Set(data.lotes.filter((lote) => lote.finca_id === id).map((lote) => lote.id));
    const cicloIds = new Set(
      data.ciclos_productivos.filter((ciclo) => loteIds.has(ciclo.lote_id)).map((ciclo) => ciclo.id),
    );
    await deleteFincaRecord(id);
    setData((previous) => ({
      ...sinCiclos(previous, cicloIds),
      fincas: previous.fincas.filter((finca) => finca.id !== id),
      lotes: previous.lotes.filter((lote) => !loteIds.has(lote.id)),
      clima: previous.clima.filter((item) => item.finca_id !== id),
    }));
    setSelectedLoteForCost((current) => current && loteIds.has(current) ? null : current);
    setSelectedCicloForCost((current) => current && cicloIds.has(current) ? null : current);
  }, [data.lotes, data.ciclos_productivos]);

  const updateFincaCodMunCallback = useCallback(async (fincaId: string, codMun: string | null) => {
    const updated = await updateFincaCodMun(fincaId, codMun);
    setData((previous) => ({
      ...previous,
      fincas: previous.fincas.map((finca) => finca.id === updated.id ? updated : finca),
    }));
    return updated;
  }, []);

  // -- Lotes ----------------------------------------------------------------

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
      ...sinCiclos(previous, cicloIds),
      lotes: previous.lotes.filter((lote) => lote.id !== id),
    }));
    setSelectedLoteForCost((current) => current === id ? null : current);
    setSelectedCicloForCost((current) => current && cicloIds.has(current) ? null : current);
  }, [data.ciclos_productivos]);

  // -- Ciclos ---------------------------------------------------------------

  const addCiclo = useCallback(async (ciclo: NuevoCiclo) => {
    const created = await createCiclo(ciclo);
    setData((previous) => ({
      ...previous,
      ciclos_productivos: [...previous.ciclos_productivos, created]
        .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio)),
    }));
    return created;
  }, []);

  const updateCicloEstado = useCallback(async (id: string, cambio: CambioEstadoCiclo) => {
    const updated = await updateCicloEstadoRecord(id, cambio);
    setData((previous) => ({
      ...previous,
      ciclos_productivos: previous.ciclos_productivos.map((item) => item.id === id ? updated : item),
    }));
    return updated;
  }, []);

  const deleteCiclo = useCallback(async (id: string) => {
    await deleteCicloRecord(id);
    setData((previous) => sinCiclos(previous, new Set([id])));
    setSelectedCicloForCost((current) => current === id ? null : current);
  }, []);

  // -- Costos ---------------------------------------------------------------

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

  // -- Producción -----------------------------------------------------------

  const agregarEn = useCallback(<T extends { id: string }>(coleccion: ColeccionConId, registro: T) => {
    setData((previous) => ({
      ...previous,
      [coleccion]: [...(previous[coleccion] as unknown as T[]), registro],
    }));
  }, []);

  const reemplazarEn = useCallback(<T extends { id: string }>(coleccion: ColeccionConId, registro: T) => {
    setData((previous) => ({
      ...previous,
      [coleccion]: (previous[coleccion] as unknown as T[]).map((item) => item.id === registro.id ? registro : item),
    }));
  }, []);

  const quitarDe = useCallback((coleccion: ColeccionConId, id: string) => {
    setData((previous) => ({
      ...previous,
      [coleccion]: (previous[coleccion] as Array<{ id: string }>).filter((item) => item.id !== id),
    }));
  }, []);

  const addCosecha = useCallback(async (cosecha: NuevaCosecha) => {
    const created = await createCosecha(cosecha);
    agregarEn('cosechas', created);
    return created;
  }, [agregarEn]);

  const updateCosecha = useCallback(async (id: string, cosecha: NuevaCosecha) => {
    const updated = await updateCosechaRecord(id, cosecha);
    reemplazarEn('cosechas', updated);
    return updated;
  }, [reemplazarEn]);

  const deleteCosecha = useCallback(async (id: string) => {
    await deleteCosechaRecord(id);
    quitarDe('cosechas', id);
  }, [quitarDe]);

  const addVenta = useCallback(async (venta: NuevaVenta) => {
    const created = await createVenta(venta);
    agregarEn('ventas', created);
    return created;
  }, [agregarEn]);

  const updateVenta = useCallback(async (id: string, venta: NuevaVenta) => {
    const updated = await updateVentaRecord(id, venta);
    reemplazarEn('ventas', updated);
    return updated;
  }, [reemplazarEn]);

  const deleteVenta = useCallback(async (id: string) => {
    await deleteVentaRecord(id);
    quitarDe('ventas', id);
  }, [quitarDe]);

  const addSalida = useCallback(async (salida: NuevaSalida) => {
    const created = await createSalida(salida);
    agregarEn('salidas_produccion', created);
    return created;
  }, [agregarEn]);

  const updateSalida = useCallback(async (id: string, salida: NuevaSalida) => {
    const updated = await updateSalidaRecord(id, salida);
    reemplazarEn('salidas_produccion', updated);
    return updated;
  }, [reemplazarEn]);

  const deleteSalida = useCallback(async (id: string) => {
    await deleteSalidaRecord(id);
    quitarDe('salidas_produccion', id);
  }, [quitarDe]);

  const value = useMemo<AppContextValue>(() => ({
    data, loading, climaLoading, error, refresh, refreshClima: refreshClimaForAll,
    addFinca, updateFinca, deleteFinca, updateFincaCodMun: updateFincaCodMunCallback,
    addLote, updateLote, deleteLote,
    addCiclo, updateCicloEstado, deleteCiclo,
    addProveedor, addInsumo, addManoDeObra, addActividad,
    addCosecha, updateCosecha, deleteCosecha,
    addVenta, updateVenta, deleteVenta,
    addSalida, updateSalida, deleteSalida,
    updateInsumo, deleteInsumo, updateManoDeObra, deleteManoDeObra,
    updateActividad, deleteActividad,
    selectedLoteForCost, selectedCicloForCost,
    setSelectedLoteForCost, setSelectedCicloForCost,
  }), [
    data, loading, climaLoading, error, refresh, refreshClimaForAll,
    addFinca, updateFinca, deleteFinca, updateFincaCodMunCallback,
    addLote, updateLote, deleteLote,
    addCiclo, updateCicloEstado, deleteCiclo,
    addProveedor, addInsumo, addManoDeObra, addActividad,
    addCosecha, updateCosecha, deleteCosecha,
    addVenta, updateVenta, deleteVenta,
    addSalida, updateSalida, deleteSalida,
    updateInsumo, deleteInsumo, updateManoDeObra, deleteManoDeObra,
    updateActividad, deleteActividad,
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
