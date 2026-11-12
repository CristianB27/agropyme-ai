import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, HandCoins, Info, Package, Pencil, Save, ShoppingCart, Trash2, Wheat, X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { ScreenId } from '../components/Layout';
import type {
  CalidadProducto, Cosecha, EstadoPago, SalidaProduccion, TipoComprador, TipoSalida, Unidad, Venta,
} from '../types';
import { calcularCiclo, cicloLabel } from '../utils/calculos';
import {
  CALIDADES,
  ESTADOS_PAGO,
  TIPOS_COMPRADOR,
  TIPOS_SALIDA,
  convertirCantidadAKg,
  convertirPrecioACopPorKg,
  convertirPrecioPorKgAUnidad,
  etiquetaCalidad,
  etiquetaTipoComprador,
  etiquetaTipoSalida,
  mensajeErrorCosechaVenta,
  unidadesDePeso,
  validarContraDisponible,
} from '../utils/cosechasVentas';
import { formatCantidad, formatCOP, formatDate } from '../utils/format';

type Tab = 'cosecha' | 'venta' | 'salida';

type Edicion =
  | { categoria: 'cosecha'; registro: Cosecha }
  | { categoria: 'venta'; registro: Venta }
  | { categoria: 'salida'; registro: SalidaProduccion };

interface FilaRegistro {
  key: string;
  categoria: Tab;
  fecha: string;
  detalle: string;
  cantidad: number;
  unidad: string;
  kg: number;
  valor: number | null;
  porCobrar: boolean;
  edicion: Edicion;
}

const INPUT = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]';
const LABEL = 'block text-sm font-medium text-gray-700 mb-1';

const ETIQUETA_CATEGORIA: Record<Tab, string> = {
  cosecha: 'Cosecha',
  venta: 'Venta',
  salida: 'Salida sin venta',
};

const COLOR_CATEGORIA: Record<Tab, string> = {
  cosecha: 'bg-emerald-100 text-emerald-800',
  venta: 'bg-cyan-100 text-cyan-800',
  salida: 'bg-orange-100 text-orange-800',
};

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function numeroPositivo(valor: string): number | null {
  if (valor.trim() === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

interface RegistroProduccionProps {
  onNavigate: (id: ScreenId) => void;
}

export default function RegistroProduccion({ onNavigate }: RegistroProduccionProps) {
  const {
    data, loading, error, refresh,
    selectedLoteForCost, selectedCicloForCost, setSelectedLoteForCost, setSelectedCicloForCost,
    addCosecha, updateCosecha, deleteCosecha,
    addVenta, updateVenta, deleteVenta,
    addSalida, updateSalida, deleteSalida,
  } = useApp();

  const [tab, setTab] = useState<Tab>('cosecha');
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [fecha, setFecha] = useState(hoy);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ mensaje: string; error: boolean } | null>(null);
  const [errores, setErrores] = useState<Record<string, boolean>>({});

  // Formulario común
  const [cantidad, setCantidad] = useState('');
  const [unidadId, setUnidadId] = useState('');
  const [calidad, setCalidad] = useState<CalidadProducto>('sin_clasificar');
  const [nota, setNota] = useState('');
  // Venta
  const [precio, setPrecio] = useState('');
  const [tipoComprador, setTipoComprador] = useState<TipoComprador | ''>('');
  const [comprador, setComprador] = useState('');
  const [estadoPago, setEstadoPago] = useState<EstadoPago>('pagado');
  // Salida
  const [tipoSalida, setTipoSalida] = useState<TipoSalida>('autoconsumo');

  // -- Lote y ciclo (compartidos con Registro de Costos) --------------------
  const [loteId, setLoteId] = useState<string | null>(selectedLoteForCost);
  const [cicloId, setCicloId] = useState<string | null>(selectedCicloForCost);
  const ciclosDelLote = useMemo(
    () => loteId ? data.ciclos_productivos.filter((c) => c.lote_id === loteId) : [],
    [loteId, data.ciclos_productivos],
  );

  useEffect(() => {
    if (selectedLoteForCost !== null) setLoteId(selectedLoteForCost);
  }, [selectedLoteForCost]);
  useEffect(() => {
    if (selectedCicloForCost !== null) setCicloId(selectedCicloForCost);
  }, [selectedCicloForCost]);
  useEffect(() => {
    if (!loteId && data.lotes[0]) setLoteId(data.lotes[0].id);
  }, [data.lotes, loteId]);
  useEffect(() => {
    const cicloValido = cicloId && ciclosDelLote.some((c) => c.id === cicloId);
    if (!cicloValido && ciclosDelLote.length > 0) setCicloId(ciclosDelLote[ciclosDelLote.length - 1].id);
  }, [ciclosDelLote, cicloId]);

  const unidades = useMemo(() => unidadesDePeso(data.unidades), [data.unidades]);
  useEffect(() => {
    if (!unidadId && unidades.length > 0) setUnidadId(unidades[0].id);
  }, [unidadId, unidades]);
  const unidad: Unidad | undefined = unidades.find((u) => u.id === unidadId);

  const ciclo = cicloId ? data.ciclos_productivos.find((c) => c.id === cicloId) ?? null : null;
  const calculo = useMemo(() => {
    if (!ciclo) return null;
    try {
      return calcularCiclo(data, ciclo);
    } catch {
      return null;
    }
  }, [data, ciclo]);

  const showToast = (mensaje: string, esError = false) => {
    setToast({ mensaje, error: esError });
    setTimeout(() => setToast(null), 3500);
  };

  const limpiarFormulario = () => {
    setCantidad('');
    setPrecio('');
    setNota('');
    setComprador('');
    setErrores({});
    setEdicion(null);
  };

  const cambiarTab = (nuevo: Tab) => {
    if (edicion) limpiarFormulario();
    setTab(nuevo);
    setErrores({});
  };

  const cambiarLote = (id: string) => {
    const ciclos = data.ciclos_productivos.filter((c) => c.lote_id === id);
    const ultimo = ciclos[ciclos.length - 1]?.id ?? null;
    setLoteId(id);
    setCicloId(ultimo);
    setSelectedLoteForCost(id);
    setSelectedCicloForCost(ultimo);
    limpiarFormulario();
  };

  const cambiarCiclo = (id: string) => {
    setCicloId(id);
    setSelectedCicloForCost(id);
    limpiarFormulario();
  };

  // -- Vista previa del registro en kg y COP --------------------------------
  const cantidadNum = numeroPositivo(cantidad);
  const precioNum = numeroPositivo(precio);
  const cantidadKg = cantidadNum !== null && unidad ? convertirCantidadAKg(cantidadNum, unidad.factor_a_kg) : null;
  const precioKg = precioNum !== null && unidad ? convertirPrecioACopPorKg(precioNum, unidad.factor_a_kg) : null;
  const totalVenta = cantidadNum !== null && precioNum !== null ? cantidadNum * precioNum : null;

  /** Kilos en bodega que puede usar el registro actual (incluye lo que ya ocupaba si se edita). */
  const disponibleKg = (calculo?.Qnv ?? 0) +
    (edicion && edicion.categoria !== 'cosecha' && edicion.categoria === tab ? edicion.registro.cantidad_kg : 0);

  // -- Registros del ciclo --------------------------------------------------
  const filas = useMemo<FilaRegistro[]>(() => {
    if (!cicloId) return [];
    const resultado: FilaRegistro[] = [];
    data.cosechas.filter((c) => c.ciclo_id === cicloId).forEach((c) => resultado.push({
      key: `cosecha-${c.id}`,
      categoria: 'cosecha',
      fecha: c.fecha,
      detalle: `Calidad: ${etiquetaCalidad(c.calidad)}${c.descripcion ? ` · ${c.descripcion}` : ''}`,
      cantidad: c.cantidad,
      unidad: c.unidad,
      kg: c.cantidad_kg,
      valor: null,
      porCobrar: false,
      edicion: { categoria: 'cosecha', registro: c },
    }));
    data.ventas.filter((v) => v.ciclo_id === cicloId).forEach((v) => {
      const partes = [`Calidad: ${etiquetaCalidad(v.calidad)}`];
      if (v.tipo_comprador) partes.push(etiquetaTipoComprador(v.tipo_comprador));
      if (v.comprador) partes.push(v.comprador);
      partes.push(`${formatCOP(v.precio_unitario)}/kg`);
      resultado.push({
        key: `venta-${v.id}`,
        categoria: 'venta',
        fecha: v.fecha,
        detalle: partes.join(' · '),
        cantidad: v.cantidad,
        unidad: v.unidad,
        kg: v.cantidad_kg,
        valor: v.cantidad_kg * v.precio_unitario,
        porCobrar: v.estado_pago === 'por_cobrar',
        edicion: { categoria: 'venta', registro: v },
      });
    });
    data.salidas_produccion.filter((s) => s.ciclo_id === cicloId).forEach((s) => resultado.push({
      key: `salida-${s.id}`,
      categoria: 'salida',
      fecha: s.fecha,
      detalle: `${etiquetaTipoSalida(s.tipo)}${s.descripcion ? ` · ${s.descripcion}` : ''}`,
      cantidad: s.cantidad,
      unidad: s.unidad,
      kg: s.cantidad_kg,
      valor: null,
      porCobrar: false,
      edicion: { categoria: 'salida', registro: s },
    }));
    return resultado.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [data.cosechas, data.ventas, data.salidas_produccion, cicloId]);

  // -- Acciones -------------------------------------------------------------
  const empezarEdicion = (registro: Edicion) => {
    setErrores({});
    setEdicion(registro);
    setTab(registro.categoria);
    setFecha(registro.registro.fecha);
    setUnidadId(registro.registro.unidad_id);
    setCantidad(String(registro.registro.cantidad));
    if (registro.categoria === 'cosecha') {
      setCalidad(registro.registro.calidad);
      setNota(registro.registro.descripcion ?? '');
    } else if (registro.categoria === 'venta') {
      const u = data.unidades.find((item) => item.id === registro.registro.unidad_id);
      setCalidad(registro.registro.calidad);
      setPrecio(String(convertirPrecioPorKgAUnidad(registro.registro.precio_unitario, u?.factor_a_kg ?? 1)));
      setTipoComprador(registro.registro.tipo_comprador ?? '');
      setComprador(registro.registro.comprador ?? '');
      setEstadoPago(registro.registro.estado_pago);
    } else {
      setTipoSalida(registro.registro.tipo);
      setNota(registro.registro.descripcion ?? '');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eliminar = async (fila: FilaRegistro) => {
    if (fila.categoria === 'cosecha' && calculo && fila.kg > calculo.Qnv + 1e-6) {
      showToast(
        `No se puede eliminar: ya se vendieron o usaron ${formatCantidad(fila.kg - calculo.Qnv)} kg de esta cosecha. Elimina o corrige primero esas ventas o salidas.`,
        true,
      );
      return;
    }
    if (!window.confirm(`¿Eliminar ${ETIQUETA_CATEGORIA[fila.categoria].toLowerCase()} del ${formatDate(fila.fecha)}? Esta acción no se puede deshacer.`)) return;
    try {
      if (fila.categoria === 'cosecha') await deleteCosecha(fila.edicion.registro.id);
      else if (fila.categoria === 'venta') await deleteVenta(fila.edicion.registro.id);
      else await deleteSalida(fila.edicion.registro.id);
      if (edicion?.registro.id === fila.edicion.registro.id) limpiarFormulario();
      showToast('Registro eliminado correctamente');
    } catch (caughtError) {
      showToast(mensajeErrorCosechaVenta(caughtError, 'No se pudo eliminar el registro'), true);
    }
  };

  const marcarPagada = async (venta: Venta) => {
    try {
      await updateVenta(venta.id, {
        ciclo_id: venta.ciclo_id,
        fecha: venta.fecha,
        cantidad: venta.cantidad,
        unidad_id: venta.unidad_id,
        precio_unitario: venta.precio_unitario,
        comprador: venta.comprador,
        calidad: venta.calidad,
        tipo_comprador: venta.tipo_comprador,
        estado_pago: 'pagado',
      });
      showToast('Venta marcada como pagada');
    } catch (caughtError) {
      showToast(mensajeErrorCosechaVenta(caughtError, 'No se pudo actualizar la venta'), true);
    }
  };

  const guardar = async () => {
    if (!cicloId || saving) return;
    const e: Record<string, boolean> = {
      fecha: !fecha,
      cantidad: cantidadNum === null,
      unidad: !unidad,
    };
    if (tab === 'venta') e.precio = precioNum === null;
    setErrores(e);
    if (Object.values(e).some(Boolean) || !unidad || cantidadNum === null || cantidadKg === null) return;

    if (ciclo && fecha < ciclo.fecha_inicio) {
      showToast(`La fecha no puede ser anterior al inicio del ciclo (${formatDate(ciclo.fecha_inicio)}).`, true);
      return;
    }

    if (tab === 'venta' || tab === 'salida') {
      const mensaje = validarContraDisponible(cantidadKg, disponibleKg, tab);
      if (mensaje) {
        showToast(mensaje, true);
        return;
      }
    }
    if (tab === 'cosecha' && edicion?.categoria === 'cosecha' && calculo) {
      const minimoKg = edicion.registro.cantidad_kg - calculo.Qnv;
      if (cantidadKg < minimoKg - 1e-6) {
        showToast(`La cosecha no puede quedar por debajo de ${formatCantidad(minimoKg)} kg porque ya se vendió o usó esa cantidad.`, true);
        return;
      }
    }

    try {
      setSaving(true);
      if (tab === 'cosecha') {
        const payload = {
          ciclo_id: cicloId, fecha, cantidad: cantidadNum, unidad_id: unidad.id,
          calidad, descripcion: nota.trim() || null,
        };
        if (edicion?.categoria === 'cosecha') await updateCosecha(edicion.registro.id, payload);
        else await addCosecha(payload);
      } else if (tab === 'venta') {
        if (precioNum === null) return;
        const payload = {
          ciclo_id: cicloId, fecha, cantidad: cantidadNum, unidad_id: unidad.id,
          precio_unitario: convertirPrecioACopPorKg(precioNum, unidad.factor_a_kg),
          comprador: comprador.trim() || null,
          calidad,
          tipo_comprador: tipoComprador || null,
          estado_pago: estadoPago,
        };
        if (edicion?.categoria === 'venta') await updateVenta(edicion.registro.id, payload);
        else await addVenta(payload);
      } else {
        const payload = {
          ciclo_id: cicloId, fecha, tipo: tipoSalida, cantidad: cantidadNum, unidad_id: unidad.id,
          descripcion: nota.trim() || null,
        };
        if (edicion?.categoria === 'salida') await updateSalida(edicion.registro.id, payload);
        else await addSalida(payload);
      }
      showToast(edicion ? 'Cambios guardados correctamente' : 'Registro guardado correctamente');
      limpiarFormulario();
    } catch (caughtError) {
      showToast(mensajeErrorCosechaVenta(caughtError, 'No se pudo guardar el registro'), true);
    } finally {
      setSaving(false);
    }
  };

  // -- Render ---------------------------------------------------------------
  if (loading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Cargando la producción…</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <button onClick={() => void refresh()} className="mt-3 rounded-lg bg-[#2E7D32] px-4 py-2 text-sm font-semibold text-white">Reintentar</button>
      </div>
    );
  }

  if (data.ciclos_productivos.length === 0) {
    return (
      <div className="space-y-6">
        <Encabezado />
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <h3 className="text-lg font-bold text-gray-900">Primero crea un ciclo productivo</h3>
          <p className="mt-2 text-sm text-gray-500">Las cosechas y ventas se registran dentro de un ciclo (una siembra de un cultivo en un lote).</p>
          <button
            type="button"
            onClick={() => onNavigate('lotes')}
            className="mt-4 rounded-lg bg-[#2E7D32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#256628]"
          >
            Ir a Mis Lotes
          </button>
        </div>
      </div>
    );
  }

  const ayudaCalidad = CALIDADES.find((c) => c.valor === calidad)?.ayuda;
  const ayudaSalida = TIPOS_SALIDA.find((t) => t.valor === tipoSalida)?.ayuda;
  const nombreUnidad = unidad?.nombre ?? 'unidad';

  return (
    <div className="space-y-6">
      <Encabezado />

      {/* Lote, ciclo y fecha */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={LABEL} htmlFor="prod-lote">Lote</label>
            <select id="prod-lote" value={loteId ?? ''} onChange={(e) => cambiarLote(e.target.value)} className={INPUT}>
              {data.lotes.map((l) => {
                const finca = data.fincas.find((f) => f.id === l.finca_id);
                return <option key={l.id} value={l.id}>{l.nombre} ({finca?.nombre})</option>;
              })}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="prod-ciclo">Ciclo productivo</label>
            <select id="prod-ciclo" value={cicloId ?? ''} onChange={(e) => cambiarCiclo(e.target.value)} className={INPUT}>
              {ciclosDelLote.length === 0 && <option value="">Sin ciclos</option>}
              {ciclosDelLote.map((c) => <option key={c.id} value={c.id}>{cicloLabel(data, c)}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="prod-fecha">Fecha</label>
            <input id="prod-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={INPUT} />
            {errores.fecha && <p className="mt-1 text-xs text-red-500">La fecha es obligatoria</p>}
          </div>
        </div>
      </div>

      {/* Balance de producción */}
      {calculo && <BalanceProduccion calculo={calculo} cicloFinalizado={ciclo?.estado === 'Finalizado'} />}

      {/* Formulario */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {([
            { id: 'cosecha', label: 'Cosecha', icon: Wheat },
            { id: 'venta', label: 'Venta', icon: ShoppingCart },
            { id: 'salida', label: 'Otra salida', icon: Package },
          ] as { id: Tab; label: string; icon: typeof Wheat }[]).map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => cambiarTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-2 sm:px-4 py-3 text-sm font-medium transition-colors ${
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
          {edicion && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-sm text-amber-900">
                Editando {ETIQUETA_CATEGORIA[edicion.categoria].toLowerCase()} del {formatDate(edicion.registro.fecha)}
              </p>
              <button type="button" onClick={limpiarFormulario} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:underline">
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
            </div>
          )}

          {tab === 'cosecha' && (
            <p className="text-xs text-gray-500">
              Registra cada recolección por separado. Si separas el producto por calidad, registra una cosecha por cada calidad.
            </p>
          )}
          {tab === 'venta' && (
            <p className="text-xs text-gray-500">
              Escribe el precio tal como lo negociaste (por kg, arroba, bulto o tonelada); la aplicación lo convierte a precio por kg.
            </p>
          )}
          {tab === 'salida' && (
            <p className="text-xs text-gray-500">
              Producción que no se vendió: lo que consumió la familia, se dio a los animales, se guardó como semilla, se regaló o se perdió.
              Así el ciclo puede cerrarse y la proyección no cuenta como venta lo que ya no existe.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tab === 'salida' && (
              <div className="sm:col-span-2">
                <label className={LABEL} htmlFor="salida-tipo">Tipo de salida</label>
                <select id="salida-tipo" value={tipoSalida} onChange={(e) => setTipoSalida(e.target.value as TipoSalida)} className={INPUT}>
                  {TIPOS_SALIDA.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                </select>
                {ayudaSalida && <p className="mt-1 text-xs text-gray-500">{ayudaSalida}</p>}
              </div>
            )}

            <div>
              <label className={LABEL} htmlFor="prod-cantidad">
                {tab === 'cosecha' ? 'Cantidad cosechada' : tab === 'venta' ? 'Cantidad vendida' : 'Cantidad'}
              </label>
              <input
                id="prod-cantidad"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                className={`${INPUT} tnum`}
                placeholder="Ej. 40"
              />
              {errores.cantidad && <p className="mt-1 text-xs text-red-500">La cantidad debe ser mayor que cero</p>}
            </div>
            <div>
              <label className={LABEL} htmlFor="prod-unidad">Unidad</label>
              <select id="prod-unidad" value={unidadId} onChange={(e) => setUnidadId(e.target.value)} className={INPUT}>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}{u.factor_a_kg !== 1 ? ` (${formatCantidad(u.factor_a_kg)} kg)` : ''}
                  </option>
                ))}
              </select>
              {errores.unidad && <p className="mt-1 text-xs text-red-500">Selecciona una unidad de peso</p>}
            </div>

            {(tab === 'cosecha' || tab === 'venta') && (
              <div className={tab === 'cosecha' ? 'sm:col-span-2' : ''}>
                <label className={LABEL} htmlFor="prod-calidad">Calidad</label>
                <select id="prod-calidad" value={calidad} onChange={(e) => setCalidad(e.target.value as CalidadProducto)} className={INPUT}>
                  {CALIDADES.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
                </select>
                {ayudaCalidad && <p className="mt-1 text-xs text-gray-500">{ayudaCalidad}</p>}
              </div>
            )}

            {tab === 'venta' && (
              <>
                <div>
                  <label className={LABEL} htmlFor="venta-precio">Precio por {nombreUnidad} (COP)</label>
                  <input
                    id="venta-precio"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    className={`${INPUT} tnum`}
                    placeholder={nombreUnidad === 'bulto' ? 'Ej. 55000' : 'Ej. 1100'}
                  />
                  {errores.precio && <p className="mt-1 text-xs text-red-500">El precio debe ser mayor que cero</p>}
                </div>
                <div>
                  <label className={LABEL} htmlFor="venta-tipo-comprador">Tipo de comprador</label>
                  <select
                    id="venta-tipo-comprador"
                    value={tipoComprador}
                    onChange={(e) => setTipoComprador(e.target.value as TipoComprador | '')}
                    className={INPUT}
                  >
                    <option value="">Sin especificar</option>
                    {TIPOS_COMPRADOR.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL} htmlFor="venta-comprador">Nombre del comprador (opcional)</label>
                  <input id="venta-comprador" value={comprador} onChange={(e) => setComprador(e.target.value)} className={INPUT} placeholder="Ej. Don José, Coomaíz" />
                </div>
                <div className="sm:col-span-2">
                  <span className={LABEL}>¿Ya te pagaron?</span>
                  <div className="grid grid-cols-2 gap-2">
                    {ESTADOS_PAGO.map((estado) => (
                      <button
                        key={estado.valor}
                        type="button"
                        onClick={() => setEstadoPago(estado.valor)}
                        aria-pressed={estadoPago === estado.valor}
                        className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                          estadoPago === estado.valor
                            ? 'border-[#2E7D32] bg-[#2E7D32]/10 text-[#2E7D32]'
                            : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {estado.etiqueta}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {(tab === 'cosecha' || tab === 'salida') && (
              <div className="sm:col-span-2">
                <label className={LABEL} htmlFor="prod-nota">Nota (opcional)</label>
                <input
                  id="prod-nota"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  className={INPUT}
                  placeholder={tab === 'cosecha' ? 'Ej. Primera recolección, lado norte' : 'Ej. Gorgojo en bodega'}
                />
              </div>
            )}
          </div>

          {/* Resumen del registro */}
          {cantidadKg !== null && (
            <div className="rounded-lg bg-[#2E7D32]/5 px-4 py-3 text-sm text-gray-700 space-y-0.5">
              <p>Equivale a <strong className="tnum">{formatCantidad(cantidadKg)} kg</strong>.</p>
              {tab === 'venta' && precioKg !== null && totalVenta !== null && (
                <p>
                  Precio por kg: <strong className="tnum">{formatCOP(precioKg)}</strong> · Total de la venta: <strong className="tnum">{formatCOP(totalVenta)}</strong>
                </p>
              )}
              {(tab === 'venta' || tab === 'salida') && (
                <p className={cantidadKg > disponibleKg + 1e-6 ? 'text-red-700 font-medium' : 'text-gray-500'}>
                  Disponible en bodega: {formatCantidad(disponibleKg)} kg
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => void guardar()}
            disabled={!cicloId || saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#256628] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" /> {saving ? 'Guardando…' : edicion ? 'Guardar cambios' : 'Guardar registro'}
          </button>
        </div>
      </div>

      {/* Registros */}
      {ciclo && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Registros de producción — {cicloLabel(data, ciclo)}</h3>
          </div>
          {filas.length === 0 ? (
            <p className="px-4 md:px-6 py-8 text-center text-sm text-gray-500">Aún no hay cosechas, ventas ni salidas en este ciclo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Tipo</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Fecha</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Detalle</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Cantidad</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Kg</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Valor</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila) => (
                    <tr key={fila.key} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${COLOR_CATEGORIA[fila.categoria]}`}>
                          {ETIQUETA_CATEGORIA[fila.categoria]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 tnum whitespace-nowrap">{formatDate(fila.fecha)}</td>
                      <td className="px-4 py-3 text-gray-700 min-w-[12rem]">{fila.detalle}</td>
                      <td className="px-4 py-3 text-right text-gray-700 tnum whitespace-nowrap">{formatCantidad(fila.cantidad)} {fila.unidad}</td>
                      <td className="px-4 py-3 text-right text-gray-700 tnum">{formatCantidad(fila.kg)}</td>
                      <td className="px-4 py-3 text-right tnum whitespace-nowrap">
                        {fila.valor !== null ? (
                          <>
                            <span className="font-medium text-gray-900">{formatCOP(fila.valor)}</span>
                            {fila.porCobrar && (
                              <span className="ml-1.5 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">por cobrar</span>
                            )}
                          </>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {fila.porCobrar && fila.edicion.categoria === 'venta' && (
                            <button
                              type="button"
                              onClick={() => { if (fila.edicion.categoria === 'venta') void marcarPagada(fila.edicion.registro); }}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#2E7D32] hover:bg-[#2E7D32]/10 whitespace-nowrap"
                            >
                              <HandCoins className="h-4 w-4" /> Pagada
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => empezarEdicion(fila.edicion)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                          >
                            <Pencil className="h-4 w-4" /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void eliminar(fila)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" /> Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 max-w-[90vw]">
          <div className={`flex items-center gap-2 text-white px-4 py-3 rounded-lg shadow-lg ${toast.error ? 'bg-red-700' : 'bg-gray-900'}`}>
            {toast.error ? <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-100" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-green-400" />}
            <span className="text-sm font-medium">{toast.mensaje}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Encabezado() {
  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-gray-900">Cosechas y Ventas</h2>
      <p className="text-sm text-gray-500 mt-1">Registra lo que cosechas, lo que vendes y lo que sale sin venderse</p>
    </div>
  );
}

interface BalanceProps {
  calculo: ReturnType<typeof calcularCiclo>;
  cicloFinalizado: boolean;
}

function BalanceProduccion({ calculo, cicloFinalizado }: BalanceProps) {
  const { Q, Qv, QusoPropio, Qperdida, Qnv } = calculo;
  const segmentos = [
    { etiqueta: 'Vendido', kg: Qv, color: 'bg-cyan-600' },
    { etiqueta: 'Uso propio', kg: QusoPropio, color: 'bg-amber-500' },
    { etiqueta: 'Pérdidas', kg: Qperdida, color: 'bg-red-500' },
    { etiqueta: 'En bodega', kg: Qnv, color: 'bg-gray-300' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Balance de la producción</h3>
        <span className="text-sm text-gray-600 tnum">Cosechado: <strong className="text-gray-900">{formatCantidad(Q)} kg</strong></span>
      </div>
      {Q > 0 ? (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100" role="img" aria-label="Distribución de lo cosechado">
            {segmentos.filter((s) => s.kg > 0).map((s) => (
              <div key={s.etiqueta} className={s.color} style={{ width: `${(s.kg / Q) * 100}%` }} title={`${s.etiqueta}: ${formatCantidad(s.kg)} kg`} />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {segmentos.map((s) => (
              <div key={s.etiqueta} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                <span className="text-xs text-gray-600">{s.etiqueta}: <strong className="text-gray-900 tnum">{formatCantidad(s.kg)} kg</strong></span>
              </div>
            ))}
          </div>
          {calculo.ingresosPorCobrar > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-amber-800">
              <HandCoins className="w-4 h-4" /> Te deben {formatCOP(calculo.ingresosPorCobrar)} de ventas por cobrar.
            </p>
          )}
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Info className="w-4 h-4" /> Registra la primera cosecha para poder registrar ventas y salidas.
        </p>
      )}
      {cicloFinalizado && (
        <p className="text-xs text-gray-500">Este ciclo está finalizado. Puedes seguir corrigiendo sus registros.</p>
      )}
    </div>
  );
}
