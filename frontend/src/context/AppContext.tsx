import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AppData, Finca, Lote, CicloProductivo, Insumo, ManoDeObra, Actividad } from '../types';
import { mockData } from '../mockData';

interface AppContextValue {
  data: AppData;
  addFinca: (finca: Omit<Finca, 'id' | 'usuario_id'>) => void;
  addLote: (lote: Omit<Lote, 'id'>) => void;
  addCiclo: (ciclo: Omit<CicloProductivo, 'id' | 'fecha_fin' | 'estado'>) => void;
  addInsumo: (insumo: Omit<Insumo, 'id'>) => void;
  addManoDeObra: (jornal: Omit<ManoDeObra, 'id'>) => void;
  addActividad: (actividad: Omit<Actividad, 'id'>) => void;
  selectedLoteForCost: number | null;
  selectedCicloForCost: number | null;
  setSelectedLoteForCost: (loteId: number | null) => void;
  setSelectedCicloForCost: (cicloId: number | null) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(mockData);
  const [selectedLoteForCost, setSelectedLoteForCost] = useState<number | null>(null);
  const [selectedCicloForCost, setSelectedCicloForCost] = useState<number | null>(null);

  const nextId = (arr: { id: number }[]) => (arr.length > 0 ? Math.max(...arr.map((a) => a.id)) + 1 : 1);

  const addFinca = (finca: Omit<Finca, 'id' | 'usuario_id'>) => {
    setData((prev) => ({
      ...prev,
      fincas: [...prev.fincas, { ...finca, id: nextId(prev.fincas), usuario_id: 1 }],
    }));
  };

  const addLote = (lote: Omit<Lote, 'id'>) => {
    setData((prev) => ({
      ...prev,
      lotes: [...prev.lotes, { ...lote, id: nextId(prev.lotes) }],
    }));
  };

  const addCiclo = (ciclo: Omit<CicloProductivo, 'id' | 'fecha_fin' | 'estado'>) => {
    setData((prev) => ({
      ...prev,
      ciclos_productivos: [
        ...prev.ciclos_productivos,
        { ...ciclo, id: nextId(prev.ciclos_productivos), fecha_fin: null, estado: 'Activo' },
      ],
    }));
  };

  const addInsumo = (insumo: Omit<Insumo, 'id'>) => {
    setData((prev) => ({
      ...prev,
      insumos: [...prev.insumos, { ...insumo, id: nextId(prev.insumos) }],
    }));
  };

  const addManoDeObra = (jornal: Omit<ManoDeObra, 'id'>) => {
    setData((prev) => ({
      ...prev,
      mano_de_obra: [...prev.mano_de_obra, { ...jornal, id: nextId(prev.mano_de_obra) }],
    }));
  };

  const addActividad = (actividad: Omit<Actividad, 'id'>) => {
    setData((prev) => ({
      ...prev,
      actividades: [...prev.actividades, { ...actividad, id: nextId(prev.actividades) }],
    }));
  };

  return (
    <AppContext.Provider
      value={{
        data,
        addFinca,
        addLote,
        addCiclo,
        addInsumo,
        addManoDeObra,
        addActividad,
        selectedLoteForCost,
        selectedCicloForCost,
        setSelectedLoteForCost,
        setSelectedCicloForCost,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
