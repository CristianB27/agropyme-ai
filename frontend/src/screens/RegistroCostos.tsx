import { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, Package, User, Wrench, Save } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { cicloLabel, getActividadesByCiclo, getCultivo, getLote } from '../utils/calculos';
import { formatCOP, formatDate } from '../utils/format';

type Tab = 'insumo' | 'jornal' | 'actividad';

const TIPOS_ACTIVIDAD = [
  'Preparación de suelo', 'Siembra', 'Riego', 'Fertilización',
  'Deshierba', 'Control de plagas', 'Cosecha', 'Otra',
];

const UNIDADES = ['kg', 'L', 'bulto', 'unidad'];

interface RegistroReciente {
  fecha: string;
  categoria: string;
  descripcion: string;
  valor: number;
}

export default function RegistroCostos() {
  const { data, selectedLoteForCost, selectedCicloForCost, setSelectedLoteForCost, setSelectedCicloForCost, addInsumo, addManoDeObra, addActividad } = useApp();
  const [tab, setTab] = useState<Tab>('insumo');
  const [fecha, setFecha] = useState('2026-10-08');
  const [toast, setToast] = useState(false);

  const [loteId, setLoteId] = useState<number | null>(
    selectedLoteForCost ?? data.lotes[0]?.id ?? null
  );
  const ciclosDelLote = useMemo(
    () => loteId ? data.ciclos_productivos.filter((c) => c.lote_id === loteId) : [],
    [loteId, data.ciclos_productivos]
  );
  const [cicloId, setCicloId] = useState<number | null>(
    selectedCicloForCost ?? ciclosDelLote[ciclosDelLote.length - 1]?.id ?? null
  );

  useEffect(() => {
    if (selectedCicloForCost !== null) {
      setCicloId(selectedCicloForCost);
    }
  }, [selectedCicloForCost]);

  useEffect(() => {
    if (selectedLoteForCost !== null) {
      setLoteId(selectedLoteForCost);
    }
  }, [selectedLoteForCost]);

  const handleLoteChange = (id: number) => {
    setLoteId(id);
    const ciclos = data.ciclos_productivos.filter((c) => c.lote_id === id);
    setCicloId(ciclos[ciclos.length - 1]?.id ?? null);
    setSelectedLoteForCost(id);
    setSelectedCicloForCost(ciclos[ciclos.length - 1]?.id ?? null);
  };

  const handleCicloChange = (id: number) => {
    setCicloId(id);
    setSelectedCicloForCost(id);
  };

  // Insumo form state
  const [insNombre, setInsNombre] = useState('');
  const [insCantidad, setInsCantidad] = useState('');
  const [insUnidad, setInsUnidad] = useState('kg');
  const [insCostoUnit, setInsCostoUnit] = useState('');
  const [insProveedor, setInsProveedor] = useState(data.proveedores[0]?.id?.toString() ?? '');
  const [insActividad, setInsActividad] = useState('');
  const [insErrors, setInsErrors] = useState<Record<string, boolean>>({});

  const insTotal = (Number(insCantidad) || 0) * (Number(insCostoUnit) || 0);

  // Jornal form state
  const [jornNum, setJornNum] = useState('');
  const [jornValor, setJornValor] = useState('');
  const [jornActividad, setJornActividad] = useState('');
  const [jornErrors, setJornErrors] = useState<Record<string, boolean>>({});

  const jornTotal = (Number(jornNum) || 0) * (Number(jornValor) || 0);

  // Actividad form state
  const [actTipo, setActTipo] = useState(TIPOS_ACTIVIDAD[0]);
  const [actDesc, setActDesc] = useState('');
  const [actOtros, setActOtros] = useState('');
  const [actErrors, setActErrors] = useState<Record<string, boolean>>({});

  const actividadesCiclo = cicloId ? getActividadesByCiclo(data, cicloId) : [];

  // Recent records
  const registrosRecientes = useMemo<RegistroReciente[]>(() => {
    if (!cicloId) return [];
    const records: RegistroReciente[] = [];

    data.insumos.filter((i) => i.ciclo_id === cicloId).forEach((i) => {
      records.push({ fecha: i.fecha, categoria: 'Insumo', descripcion: i.nombre, valor: i.cantidad * i.costo_unitario });
    });
    data.mano_de_obra.filter((m) => m.ciclo_id === cicloId).forEach((m) => {
      const act = data.actividades.find((a) => a.id === m.actividad_id);
      records.push({ fecha: m.fecha, categoria: 'Jornal', descripcion: `${act?.tipo ?? '—'} (${m.num_jornales} jornales)`, valor: m.num_jornales * m.valor_jornal });
    });
    data.actividades.filter((a) => a.ciclo_id === cicloId).forEach((a) => {
      records.push({ fecha: a.fecha, categoria: 'Actividad', descripcion: `${a.tipo}: ${a.descripcion}`, valor: a.otros_costos });
    });

    return records.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [data, cicloId]);

  const showToast = () => {
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  };

  const resetInsumo = () => {
    setInsNombre(''); setInsCantidad(''); setInsUnidad('kg'); setInsCostoUnit(''); setInsActividad('');
  };
  const resetJornal = () => {
    setJornNum(''); setJornValor(''); setJornActividad('');
  };
  const resetActividad = () => {
    setActTipo(TIPOS_ACTIVIDAD[0]); setActDesc(''); setActOtros('');
  };

  const handleGuardar = () => {
    if (!cicloId) return;

    if (tab === 'insumo') {
      const e = {
        nombre: !insNombre.trim(),
        cantidad: insCantidad === '' || Number(insCantidad) <= 0,
        costoUnit: insCostoUnit === '' || Number(insCostoUnit) <= 0,
      };
      setInsErrors(e);
      if (Object.values(e).some(Boolean)) return;
      const actId = insActividad ? Number(insActividad) : 0;
      addInsumo({
        ciclo_id: cicloId,
        actividad_id: actId,
        proveedor_id: Number(insProveedor) || data.proveedores[0]?.id || 0,
        fecha,
        nombre: insNombre.trim(),
        cantidad: Number(insCantidad),
        unidad: insUnidad,
        costo_unitario: Number(insCostoUnit),
      });
      resetInsumo();
    } else if (tab === 'jornal') {
      const e = {
        num: jornNum === '' || Number(jornNum) <= 0,
        valor: jornValor === '' || Number(jornValor) <= 0,
      };
      setJornErrors(e);
      if (Object.values(e).some(Boolean)) return;
      const actId = jornActividad ? Number(jornActividad) : 0;
      addManoDeObra({
        ciclo_id: cicloId,
        actividad_id: actId,
        fecha,
        num_jornales: Number(jornNum),
        valor_jornal: Number(jornValor),
      });
      resetJornal();
    } else if (tab === 'actividad') {
      const e = {
        tipo: !actTipo,
        desc: !actDesc.trim(),
      };
      setActErrors(e);
      if (Object.values(e).some(Boolean)) return;
      addActividad({
        ciclo_id: cicloId,
        tipo: actTipo,
        fecha,
        descripcion: actDesc.trim(),
        otros_costos: actOtros ? Number(actOtros) : 0,
      });
      resetActividad();
    }
    showToast();
  };

  const cicloActual = cicloId ? data.ciclos_productivos.find((c) => c.id === cicloId) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">Registro de Costos</h2>
        <p className="text-sm text-gray-500 mt-1">Registra insumos, jornales y actividades</p>
      </div>

      {/* Common fields */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lote</label>
            <select
              value={loteId ?? ''}
              onChange={(e) => handleLoteChange(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
            >
              {data.lotes.map((l) => {
                const finca = data.fincas.find((f) => f.id === l.finca_id);
                return <option key={l.id} value={l.id}>{l.nombre} ({finca?.nombre})</option>;
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ciclo productivo</label>
            <select
              value={cicloId ?? ''}
              onChange={(e) => handleCicloChange(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
            >
              {ciclosDelLote.length === 0 && <option value="">Sin ciclos</option>}
              {ciclosDelLote.map((c) => (
                <option key={c.id} value={c.id}>{cicloLabel(data, c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {([
            { id: 'insumo', label: 'Insumo', icon: Package },
            { id: 'jornal', label: 'Jornal', icon: User },
            { id: 'actividad', label: 'Actividad', icon: Wrench },
          ] as { id: Tab; label: string; icon: typeof Package }[]).map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  active ? 'text-[#2E7D32] border-b-2 border-[#2E7D32] bg-[#2E7D32]/5' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="p-4 md:p-6 space-y-4">
          {/* Insumo tab */}
          {tab === 'insumo' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del insumo</label>
                  <input value={insNombre} onChange={(e) => setInsNombre(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" placeholder="Ej. Fertilizante NPK" />
                  {insErrors.nombre && <p className="text-xs text-red-500 mt-1">Este campo es obligatorio</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                  <select value={insProveedor} onChange={(e) => setInsProveedor(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]">
                    {data.proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                  <input value={insCantidad} onChange={(e) => setInsCantidad(e.target.value)} type="number" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] tnum" placeholder="Ej. 10" />
                  {insErrors.cantidad && <p className="text-xs text-red-500 mt-1">Este campo es obligatorio</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                  <select value={insUnidad} onChange={(e) => setInsUnidad(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]">
                    {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Costo unitario (COP)</label>
                  <input value={insCostoUnit} onChange={(e) => setInsCostoUnit(e.target.value)} type="number" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] tnum" placeholder="Ej. 135000" />
                  {insErrors.costoUnit && <p className="text-xs text-red-500 mt-1">Este campo es obligatorio</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Actividad asociada (opcional)</label>
                  <select value={insActividad} onChange={(e) => setInsActividad(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]">
                    <option value="">Sin actividad</option>
                    {actividadesCiclo.map((a) => <option key={a.id} value={a.id}>{a.tipo}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between bg-[#2E7D32]/5 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-gray-700">Total calculado</span>
                <span className="text-lg font-bold text-[#2E7D32] tnum">{formatCOP(insTotal)}</span>
              </div>
            </>
          )}

          {/* Jornal tab */}
          {tab === 'jornal' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de jornales</label>
                  <input value={jornNum} onChange={(e) => setJornNum(e.target.value)} type="number" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] tnum" placeholder="Ej. 10" />
                  {jornErrors.num && <p className="text-xs text-red-500 mt-1">Este campo es obligatorio</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor del jornal (COP)</label>
                  <input value={jornValor} onChange={(e) => setJornValor(e.target.value)} type="number" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] tnum" placeholder="Ej. 45000" />
                  {jornErrors.valor && <p className="text-xs text-red-500 mt-1">Este campo es obligatorio</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Actividad asociada (opcional)</label>
                  <select value={jornActividad} onChange={(e) => setJornActividad(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]">
                    <option value="">Sin actividad</option>
                    {actividadesCiclo.map((a) => <option key={a.id} value={a.id}>{a.tipo}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between bg-[#2E7D32]/5 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-gray-700">Total calculado</span>
                <span className="text-lg font-bold text-[#2E7D32] tnum">{formatCOP(jornTotal)}</span>
              </div>
            </>
          )}

          {/* Actividad tab */}
          {tab === 'actividad' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={actTipo} onChange={(e) => setActTipo(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]">
                    {TIPOS_ACTIVIDAD.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {actErrors.tipo && <p className="text-xs text-red-500 mt-1">Este campo es obligatorio</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Otros costos (COP, opcional)</label>
                  <input value={actOtros} onChange={(e) => setActOtros(e.target.value)} type="number" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] tnum" placeholder="Ej. 2000000" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea value={actDesc} onChange={(e) => setActDesc(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" placeholder="Describe la actividad realizada..." />
                  {actErrors.desc && <p className="text-xs text-red-500 mt-1">Este campo es obligatorio</p>}
                </div>
              </div>
            </>
          )}

          <button
            onClick={handleGuardar}
            disabled={!cicloId}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#256628] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" /> Guardar registro
          </button>
        </div>
      </div>

      {/* Recent records */}
      {cicloActual && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Últimos registros — {cicloLabel(data, cicloActual)}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Fecha</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Categoría</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Descripción</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Valor</th>
                </tr>
              </thead>
              <tbody>
                {registrosRecientes.map((r, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 tnum">{formatDate(r.fecha)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.categoria === 'Insumo' ? 'bg-blue-100 text-blue-800' :
                        r.categoria === 'Jornal' ? 'bg-amber-100 text-amber-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {r.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.descripcion}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 tnum">{formatCOP(r.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-sm font-medium">Registro guardado correctamente</span>
          </div>
        </div>
      )}
    </div>
  );
}
