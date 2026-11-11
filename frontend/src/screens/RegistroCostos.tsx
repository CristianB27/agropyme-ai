import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Package, User, Wrench, Save, Eye, Plus, ShoppingCart, Trash2, Wheat } from 'lucide-react';
import { DetalleRegistroModal } from '../components/RegistroCostosModal';
import type { RegistroSeleccionado } from '../components/RegistroCostosModal';
import { NuevoProveedorModal } from '../components/NuevoProveedorModal';
import { useApp } from '../context/AppContext';
import { calcularCiclo, cicloLabel, getActividadesByCiclo } from '../utils/calculos';
import {
  convertirCantidadAKg,
  convertirPrecioACopPorKg,
  esUnidadMasa,
  mensajeErrorCosechaVenta,
  validarVentaContraPendiente,
} from '../utils/cosechasVentas';
import {
  normalizarTipoPersonalizado,
  TIPO_ACTIVIDAD_OTRA,
  TIPOS_ACTIVIDAD,
} from '../utils/actividades';
import { formatCOP, formatDate, formatNumber } from '../utils/format';

type Tab = 'insumo' | 'jornal' | 'actividad' | 'cosecha' | 'venta';

const UNIDADES = ['kg', 'L', 'bulto', 'unidad'];

type CategoriaRegistro = 'Insumo' | 'Jornal' | 'Actividad' | 'Cosecha' | 'Venta';

interface RegistroReciente {
  id: string;
  registroId: string;
  fecha: string;
  categoria: CategoriaRegistro;
  nombre: string;
  valor: number;
  cantidad?: number;
  unidad?: string;
  cantidadKg?: number;
  precioUnitario?: number;
  seleccion?: RegistroSeleccionado;
}

export default function RegistroCostos() {
  const { data, loading, error, refresh, selectedLoteForCost, selectedCicloForCost, setSelectedLoteForCost, setSelectedCicloForCost, addInsumo, addManoDeObra, addActividad, addCosecha, addVenta, deleteInsumo, deleteManoDeObra, deleteActividad, deleteCosecha, deleteVenta } = useApp();
  const [tab, setTab] = useState<Tab>('insumo');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [toast, setToast] = useState<{ mensaje: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [registroSeleccionado, setRegistroSeleccionado] = useState<RegistroSeleccionado | null>(null);
  const [proveedorModalAbierto, setProveedorModalAbierto] = useState(false);

  const [loteId, setLoteId] = useState<string | null>(selectedLoteForCost);
  const ciclosDelLote = useMemo(
    () => loteId ? data.ciclos_productivos.filter((c) => c.lote_id === loteId) : [],
    [loteId, data.ciclos_productivos]
  );
  const [cicloId, setCicloId] = useState<string | null>(selectedCicloForCost);

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

  useEffect(() => {
    if (!loteId && data.lotes[0]) {
      setLoteId(data.lotes[0].id);
    }
  }, [data.lotes, loteId]);

  useEffect(() => {
    if (!cicloId && ciclosDelLote.length > 0) {
      setCicloId(ciclosDelLote[ciclosDelLote.length - 1].id);
    }
  }, [ciclosDelLote, cicloId]);

  const handleLoteChange = (id: string) => {
    setLoteId(id);
    const ciclos = data.ciclos_productivos.filter((c) => c.lote_id === id);
    setCicloId(ciclos[ciclos.length - 1]?.id ?? null);
    setSelectedLoteForCost(id);
    setSelectedCicloForCost(ciclos[ciclos.length - 1]?.id ?? null);
  };

  const handleCicloChange = (id: string) => {
    setCicloId(id);
    setSelectedCicloForCost(id);
  };

  // Insumo form state
  const [insNombre, setInsNombre] = useState('');
  const [insDescripcion, setInsDescripcion] = useState('');
  const [insCantidad, setInsCantidad] = useState('');
  const [insUnidad, setInsUnidad] = useState('kg');
  const [insCostoUnit, setInsCostoUnit] = useState('');
  const [insProveedor, setInsProveedor] = useState('');
  const [insActividad, setInsActividad] = useState('');
  const [insErrors, setInsErrors] = useState<Record<string, boolean>>({});
  const proveedorSeleccionadoRef = useRef(false);

  useEffect(() => {
    if (
      !proveedorSeleccionadoRef.current &&
      data.proveedores.length > 0
    ) {
      setInsProveedor(data.proveedores[0].id);
      proveedorSeleccionadoRef.current = true;
    }
  }, [data.proveedores]);

  const insTotal = (Number(insCantidad) || 0) * (Number(insCostoUnit) || 0);

  // Jornal form state
  const [jornNombre, setJornNombre] = useState('');
  const [jornDescripcion, setJornDescripcion] = useState('');
  const [jornNum, setJornNum] = useState('');
  const [jornValor, setJornValor] = useState('');
  const [jornActividad, setJornActividad] = useState('');
  const [jornErrors, setJornErrors] = useState<Record<string, boolean>>({});

  const jornTotal = (Number(jornNum) || 0) * (Number(jornValor) || 0);

  // Actividad form state
  const [actNombre, setActNombre] = useState('');
  const [actTipo, setActTipo] = useState<string>(TIPOS_ACTIVIDAD[0]);
  const [actTipoPersonalizado, setActTipoPersonalizado] = useState('');
  const [actDesc, setActDesc] = useState('');
  const [actOtros, setActOtros] = useState('');
  const [actErrors, setActErrors] = useState<Record<string, boolean>>({});

  // Cosecha y venta form state
  const [cosechaCantidad, setCosechaCantidad] = useState('');
  const [cosechaUnidadId, setCosechaUnidadId] = useState('');
  const [ventaCantidad, setVentaCantidad] = useState('');
  const [ventaUnidadId, setVentaUnidadId] = useState('');
  const [ventaPrecio, setVentaPrecio] = useState('');
  const [ventaComprador, setVentaComprador] = useState('');
  const [cosechaVentaErrors, setCosechaVentaErrors] = useState<Record<string, boolean>>({});

  const unidadesMasa = useMemo(
    () => data.unidades.filter((unidad) => esUnidadMasa(unidad.nombre)),
    [data.unidades],
  );

  useEffect(() => {
    if (!cosechaUnidadId && unidadesMasa.length > 0) setCosechaUnidadId(unidadesMasa[0].id);
  }, [cosechaUnidadId, unidadesMasa]);

  useEffect(() => {
    if (!ventaUnidadId && unidadesMasa.length > 0) setVentaUnidadId(unidadesMasa[0].id);
  }, [ventaUnidadId, unidadesMasa]);

  const actividadesCiclo = cicloId ? getActividadesByCiclo(data, cicloId) : [];

  const cicloActual = cicloId ? data.ciclos_productivos.find((c) => c.id === cicloId) ?? null : null;
  const calculoCiclo = useMemo(() => {
    if (!cicloActual) return null;
    try {
      return calcularCiclo(data, cicloActual);
    } catch {
      return null;
    }
  }, [data, cicloActual]);

  // Recent records
  const registrosRecientes = useMemo<RegistroReciente[]>(() => {
    if (!cicloId) return [];
    const records: RegistroReciente[] = [];

    data.insumos.filter((i) => i.ciclo_id === cicloId).forEach((i) => {
      records.push({
        id: `insumo-${i.id}`,
        registroId: i.id,
        fecha: i.fecha,
        categoria: 'Insumo',
        nombre: i.nombre,
        valor: i.cantidad * i.costo_unitario,
        seleccion: { categoria: 'Insumo', registro: i },
      });
    });

    data.mano_de_obra.filter((m) => m.ciclo_id === cicloId).forEach((m) => {
      records.push({
        id: `jornal-${m.id}`,
        registroId: m.id,
        fecha: m.fecha,
        categoria: 'Jornal',
        nombre: m.nombre,
        valor: m.num_jornales * m.valor_jornal,
        seleccion: { categoria: 'Jornal', registro: m },
      });
    });

    data.actividades.filter((a) => a.ciclo_id === cicloId).forEach((a) => {
      records.push({
        id: `actividad-${a.id}`,
        registroId: a.id,
        fecha: a.fecha,
        categoria: 'Actividad',
        nombre: a.nombre,
        valor: a.otros_costos,
        seleccion: { categoria: 'Actividad', registro: a },
      });
    });

    data.cosechas.filter((c) => c.ciclo_id === cicloId).forEach((c) => {
      records.push({
        id: `cosecha-${c.id}`,
        registroId: c.id,
        fecha: c.fecha,
        categoria: 'Cosecha',
        nombre: 'Cosecha',
        valor: 0,
        cantidad: c.cantidad,
        unidad: c.unidad,
        cantidadKg: c.cantidad_kg,
      });
    });

    data.ventas.filter((v) => v.ciclo_id === cicloId).forEach((v) => {
      records.push({
        id: `venta-${v.id}`,
        registroId: v.id,
        fecha: v.fecha,
        categoria: 'Venta',
        nombre: v.comprador?.trim() || 'Venta',
        valor: v.cantidad_kg * v.precio_unitario,
        cantidad: v.cantidad,
        unidad: v.unidad,
        cantidadKg: v.cantidad_kg,
        precioUnitario: v.precio_unitario,
      });
    });

    return records.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [data, cicloId]);

  const showToast = (message: string, error = false) => {
    setToast({ mensaje: message, error });
    setTimeout(() => setToast(null), 3000);
  };

  const resetInsumo = () => {
    setInsNombre(''); setInsDescripcion(''); setInsCantidad(''); setInsUnidad('kg'); setInsCostoUnit(''); setInsActividad('');
  };
  const resetJornal = () => {
    setJornNombre(''); setJornDescripcion(''); setJornNum(''); setJornValor(''); setJornActividad('');
  };
  const resetActividad = () => {
    setActNombre(''); setActTipo(TIPOS_ACTIVIDAD[0]); setActTipoPersonalizado(''); setActDesc(''); setActOtros('');
  };

  const resetCosecha = () => {
    setCosechaCantidad('');
    setCosechaVentaErrors({});
  };

  const resetVenta = () => {
    setVentaCantidad('');
    setVentaPrecio('');
    setVentaComprador('');
    setCosechaVentaErrors({});
  };

  const handleEliminar = async (registro: RegistroReciente) => {
    const confirmacion = window.confirm(
      `¿Eliminar ${registro.categoria.toLowerCase()} del ${formatDate(registro.fecha)}? Esta acción no se puede deshacer.`,
    );
    if (!confirmacion) return;

    try {
      if (registro.categoria === 'Cosecha') {
        await deleteCosecha(registro.registroId);
      } else if (registro.categoria === 'Venta') {
        await deleteVenta(registro.registroId);
      } else if (registro.categoria === 'Insumo') {
        await deleteInsumo(registro.registroId);
      } else if (registro.categoria === 'Jornal') {
        await deleteManoDeObra(registro.registroId);
      } else {
        await deleteActividad(registro.registroId);
      }
      showToast(`${registro.categoria} eliminada correctamente`);
    } catch (caughtError) {
      showToast(mensajeErrorCosechaVenta(caughtError, 'No se pudo eliminar el registro'), true);
    }
  };

  const handleGuardar = async () => {
    if (!cicloId || saving) return;

    try {
      setSaving(true);
      if (!fecha) {
        showToast('La fecha es obligatoria', true);
        return;
      }
      if (tab === 'insumo') {
      const e = {
        nombre: !insNombre.trim(),
        cantidad: insCantidad === '' || Number(insCantidad) <= 0,
        costoUnit: insCostoUnit === '' || Number(insCostoUnit) <= 0,
      };
      setInsErrors(e);
      if (Object.values(e).some(Boolean)) return;
      const actId = insActividad || null;
      await addInsumo({
        ciclo_id: cicloId,
        actividad_id: actId,
        proveedor_id: insProveedor || null,
        fecha,
        nombre: insNombre.trim(),
        descripcion: insDescripcion.trim() || null,
        cantidad: Number(insCantidad),
        unidad: insUnidad,
        costo_unitario: Number(insCostoUnit),
      });
      resetInsumo();
    } else if (tab === 'jornal') {
      const e = {
        nombre: !jornNombre.trim(),
        num: jornNum === '' || Number(jornNum) <= 0,
        valor: jornValor === '' || Number(jornValor) <= 0,
      };
      setJornErrors(e);
      if (Object.values(e).some(Boolean)) return;
      const actId = jornActividad || null;
      await addManoDeObra({
        ciclo_id: cicloId,
        actividad_id: actId,
        fecha,
        nombre: jornNombre.trim(),
        descripcion: jornDescripcion.trim() || null,
        num_jornales: Number(jornNum),
        valor_jornal: Number(jornValor),
      });
      resetJornal();
    } else if (tab === 'actividad') {
      const e = {
        nombre: !actNombre.trim(),
        tipo: !actTipo,
      };
      setActErrors(e);
      if (Object.values(e).some(Boolean)) return;
      await addActividad({
        ciclo_id: cicloId,
        nombre: actNombre.trim(),
        tipo: actTipo,
        tipo_personalizado: normalizarTipoPersonalizado(actTipo, actTipoPersonalizado),
        fecha,
        descripcion: actDesc.trim() || null,
        otros_costos: actOtros ? Number(actOtros) : 0,
      });
      resetActividad();
    } else if (tab === 'cosecha') {
      const cantidad = Number(cosechaCantidad);
      const e = {
        cantidad: cosechaCantidad === '' || !Number.isFinite(cantidad) || cantidad <= 0,
        unidad: !cosechaUnidadId,
      };
      setCosechaVentaErrors(e);
      if (Object.values(e).some(Boolean)) return;
      await addCosecha({
        ciclo_id: cicloId,
        fecha,
        cantidad,
        unidad_id: cosechaUnidadId,
      });
      resetCosecha();
    } else if (tab === 'venta') {
      const cantidad = Number(ventaCantidad);
      const precioPorUnidad = Number(ventaPrecio);
      const unidad = unidadesMasa.find((item) => item.id === ventaUnidadId);
      const e = {
        cantidad: ventaCantidad === '' || !Number.isFinite(cantidad) || cantidad <= 0,
        unidad: !unidad,
        precio: ventaPrecio === '' || !Number.isFinite(precioPorUnidad) || precioPorUnidad <= 0,
      };
      setCosechaVentaErrors(e);
      if (Object.values(e).some(Boolean)) return;
      if (!unidad) return;

      const cantidadKg = convertirCantidadAKg(cantidad, unidad.factor_a_kg);
      const pendienteKg = calculoCiclo?.Qnv ?? 0;
      const errorValidacion = validarVentaContraPendiente(cantidadKg, pendienteKg);
      if (errorValidacion) {
        showToast(errorValidacion, true);
        return;
      }

      await addVenta({
        ciclo_id: cicloId,
        fecha,
        cantidad,
        unidad_id: unidad.id,
        precio_unitario: convertirPrecioACopPorKg(precioPorUnidad, unidad.factor_a_kg),
        comprador: ventaComprador.trim() || null,
      });
      resetVenta();
    }
      showToast('Registro guardado correctamente');
    } catch (caughtError) {
      showToast(
        mensajeErrorCosechaVenta(caughtError, caughtError instanceof Error ? caughtError.message : 'No se pudo guardar el registro'),
        true,
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Cargando los registros…</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <button onClick={() => void refresh()} className="mt-3 rounded-lg bg-[#2E7D32] px-4 py-2 text-sm font-semibold text-white">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">Registro de Costos</h2>
        <p className="text-sm text-gray-500 mt-1">Registra insumos, jornales, actividades, cosechas y ventas</p>
      </div>

      {/* Common fields */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lote</label>
            <select
              value={loteId ?? ''}
              onChange={(e) => handleLoteChange(e.target.value)}
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
              onChange={(e) => handleCicloChange(e.target.value)}
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
            { id: 'cosecha', label: 'Cosecha', icon: Wheat },
            { id: 'venta', label: 'Venta', icon: ShoppingCart },
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
          {/* Cosecha tab */}
          {tab === 'cosecha' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cosecha-cantidad" className="block text-sm font-medium text-gray-700 mb-1">Cantidad cosechada</label>
                  <input
                    id="cosecha-cantidad"
                    value={cosechaCantidad}
                    onChange={(event) => setCosechaCantidad(event.target.value)}
                    type="number"
                    min="0"
                    step="any"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] tnum"
                    placeholder="Ej. 11250"
                  />
                  {cosechaVentaErrors.cantidad && <p className="mt-1 text-xs text-red-500">La cantidad debe ser mayor que cero</p>}
                </div>
                <div>
                  <label htmlFor="cosecha-unidad" className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                  <select
                    id="cosecha-unidad"
                    value={cosechaUnidadId}
                    onChange={(event) => setCosechaUnidadId(event.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                  >
                    {unidadesMasa.map((unidad) => <option key={unidad.id} value={unidad.id}>{unidad.nombre}</option>)}
                  </select>
                  {cosechaVentaErrors.unidad && <p className="mt-1 text-xs text-red-500">Selecciona una unidad de masa</p>}
                </div>
              </div>
              <p className="text-xs text-gray-500">Loskilogramos se calculan automáticamente con el factor de la unidad.</p>
            </>
          )}

          {/* Venta tab */}
          {tab === 'venta' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="venta-cantidad" className="block text-sm font-medium text-gray-700 mb-1">Cantidad vendida</label>
                  <input
                    id="venta-cantidad"
                    value={ventaCantidad}
                    onChange={(event) => setVentaCantidad(event.target.value)}
                    type="number"
                    min="0"
                    step="any"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] tnum"
                    placeholder="Ej. 1000"
                  />
                  {cosechaVentaErrors.cantidad && <p className="mt-1 text-xs text-red-500">La cantidad debe ser mayor que cero</p>}
                </div>
                <div>
                  <label htmlFor="venta-unidad" className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                  <select
                    id="venta-unidad"
                    value={ventaUnidadId}
                    onChange={(event) => setVentaUnidadId(event.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                  >
                    {unidadesMasa.map((unidad) => <option key={unidad.id} value={unidad.id}>{unidad.nombre}</option>)}
                  </select>
                  {cosechaVentaErrors.unidad && <p className="mt-1 text-xs text-red-500">Selecciona una unidad de masa</p>}
                </div>
                <div>
                  <label htmlFor="venta-precio" className="block text-sm font-medium text-gray-700 mb-1">Precio por unidad (COP)</label>
                  <input
                    id="venta-precio"
                    value={ventaPrecio}
                    onChange={(event) => setVentaPrecio(event.target.value)}
                    type="number"
                    min="0"
                    step="any"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] tnum"
                    placeholder="Ej. 55000"
                  />
                  {cosechaVentaErrors.precio && <p className="mt-1 text-xs text-red-500">El precio debe ser mayor que cero</p>}
                  {(() => {
                    const unidad = unidadesMasa.find((item) => item.id === ventaUnidadId);
                    const precio = Number(ventaPrecio);
                    if (!unidad || !Number.isFinite(precio) || precio <= 0) return null;
                    return (
                      <p className="mt-1 text-xs text-gray-500">
                        Se guardará como {formatCOP(convertirPrecioACopPorKg(precio, unidad.factor_a_kg))} por kg.
                      </p>
                    );
                  })()}
                </div>
                <div>
                  <label htmlFor="venta-comprador" className="block text-sm font-medium text-gray-700 mb-1">Comprador (opcional)</label>
                  <input
                    id="venta-comprador"
                    value={ventaComprador}
                    onChange={(event) => setVentaComprador(event.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                    placeholder="Ej. Mercado local"
                  />
                </div>
              </div>
            </>
          )}

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
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label htmlFor="insumo-proveedor" className="text-sm font-medium text-gray-700">Proveedor</label>
                    <button
                      type="button"
                      onClick={() => setProveedorModalAbierto(true)}
                      className="inline-flex items-center gap-1 rounded-md text-xs font-semibold text-[#2E7D32] hover:bg-[#2E7D32]/10 focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nuevo proveedor
                    </button>
                  </div>
                  <select
                    id="insumo-proveedor"
                    value={insProveedor}
                    onChange={(e) => {
                      proveedorSeleccionadoRef.current = true;
                      setInsProveedor(e.target.value);
                    }}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                  >
                    <option value="">Sin proveedor</option>
                    {data.proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  {data.proveedores.length === 0 && (
                    <p className="mt-1 text-xs text-gray-500">Aún no hay proveedores. Crea el primero para seleccionarlo aquí.</p>
                  )}
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
                    {actividadesCiclo.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                  <textarea value={insDescripcion} onChange={(e) => setInsDescripcion(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" placeholder="Añade información adicional sobre el insumo..." />
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
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del jornal</label>
                  <input value={jornNombre} onChange={(e) => setJornNombre(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" placeholder="Ej. Siembra de maíz" />
                  {jornErrors.nombre && <p className="text-xs text-red-500 mt-1">Este campo es obligatorio</p>}
                </div>
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
                    {actividadesCiclo.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                  <textarea value={jornDescripcion} onChange={(e) => setJornDescripcion(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" placeholder="Añade información adicional sobre el jornal..." />
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
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la actividad</label>
                  <input value={actNombre} onChange={(e) => setActNombre(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" placeholder="Ej. Preparación del suelo" />
                  {actErrors.nombre && <p className="text-xs text-red-500 mt-1">Este campo es obligatorio</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={actTipo}
                    onChange={(e) => {
                      const tipo = e.target.value;
                      setActTipo(tipo);
                      if (tipo !== TIPO_ACTIVIDAD_OTRA) setActTipoPersonalizado('');
                    }}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                  >
                    {TIPOS_ACTIVIDAD.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {actErrors.tipo && <p className="text-xs text-red-500 mt-1">Este campo es obligatorio</p>}
                </div>
                {actTipo === TIPO_ACTIVIDAD_OTRA && (
                  <div className="sm:col-span-2">
                    <label htmlFor="actividad-tipo-personalizado" className="block text-sm font-medium text-gray-700 mb-1">Nombre específico del tipo (opcional)</label>
                    <input
                      id="actividad-tipo-personalizado"
                      value={actTipoPersonalizado}
                      onChange={(e) => setActTipoPersonalizado(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                      placeholder="Ej. Aplicación foliar"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Otros costos (COP, opcional)</label>
                  <input value={actOtros} onChange={(e) => setActOtros(e.target.value)} type="number" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] tnum" placeholder="Ej. 2000000" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                  <textarea value={actDesc} onChange={(e) => setActDesc(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" placeholder="Describe la actividad realizada..." />
                </div>
              </div>
            </>
          )}

          {calculoCiclo && (
            <div className="rounded-lg bg-[#2E7D32]/5 px-4 py-3 text-sm text-gray-700">
              Cosechado <strong>{formatNumber(calculoCiclo.Q)} kg</strong> · Vendido <strong>{formatNumber(calculoCiclo.Qv)} kg</strong> · Sin vender <strong>{formatNumber(calculoCiclo.Qnv)} kg</strong>
            </div>
          )}

          <button
            onClick={handleGuardar}
            disabled={!cicloId || saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#256628] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar registro'}
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
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Fecha</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Cantidad</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Kg</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Precio por kg</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Ingreso</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {registrosRecientes.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.categoria === 'Insumo' ? 'bg-blue-100 text-blue-800' :
                        r.categoria === 'Jornal' ? 'bg-amber-100 text-amber-800' :
                        r.categoria === 'Actividad' ? 'bg-purple-100 text-purple-800' :
                        r.categoria === 'Cosecha' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-cyan-100 text-cyan-800'
                      }`}>
                        {r.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 tnum">{formatDate(r.fecha)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {r.cantidad !== undefined && r.unidad ? `${formatNumber(r.cantidad)} ${r.unidad}` : r.nombre}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tnum">
                      {r.cantidadKg !== undefined ? formatNumber(r.cantidadKg) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tnum">
                      {r.precioUnitario !== undefined ? formatCOP(r.precioUnitario) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 tnum">
                      {r.categoria === 'Venta' ? formatCOP(r.valor) : r.categoria === 'Cosecha' ? '—' : formatCOP(r.valor)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {r.seleccion && (
                          <button
                            type="button"
                            onClick={() => {
                              if (r.seleccion) setRegistroSeleccionado(r.seleccion);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#2E7D32] hover:bg-[#2E7D32]/10 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:ring-offset-1"
                          >
                            <Eye className="h-4 w-4" />
                            Ver más
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleEliminar(r)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-1"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {registroSeleccionado && (
        <DetalleRegistroModal
          seleccion={registroSeleccionado}
          onClose={() => setRegistroSeleccionado(null)}
          onMensaje={showToast}
        />
      )}

      {proveedorModalAbierto && (
        <NuevoProveedorModal
          onClose={() => setProveedorModalAbierto(false)}
          onSaved={(proveedor) => {
            setInsProveedor(proveedor.id);
            proveedorSeleccionadoRef.current = true;
            setProveedorModalAbierto(false);
            showToast('Proveedor guardado correctamente');
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50">
          <div className={`flex items-center gap-2 text-white px-4 py-3 rounded-lg shadow-lg ${toast.error ? 'bg-red-700' : 'bg-gray-900'}`}>
            {toast.error ? <AlertTriangle className="w-5 h-5 text-red-100" /> : <CheckCircle2 className="w-5 h-5 text-green-400" />}
            <span className="text-sm font-medium">{toast.mensaje}</span>
          </div>
        </div>
      )}
    </div>
  );
}
