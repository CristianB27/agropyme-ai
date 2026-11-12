import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Flag,
  Layers,
  LocateFixed,
  MapPin,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Ruler,
  Sprout,
  Trash2,
  Wheat,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import MunicipioDaneSelect from '../components/MunicipioDaneSelect';
import LoteModal from '../components/LoteModal';
import EliminarLoteModal from '../components/EliminarLoteModal';
import { calcularCiclo, getCultivo, getFinca, type CicloCalculo } from '../utils/calculos';
import { formatCantidad, formatCOP, formatDate, formatNumber } from '../utils/format';
import type { ScreenId } from '../components/Layout';
import type { AppData, CicloProductivo, Finca } from '../types';

function calcularSeguro(data: AppData, ciclo: CicloProductivo): CicloCalculo | null {
  try {
    return calcularCiclo(data, ciclo);
  } catch {
    return null;
  }
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

interface MisLotesProps {
  onNavigate: (id: ScreenId) => void;
}

export default function MisLotes({ onNavigate }: MisLotesProps) {
  const {
    data,
    loading,
    error,
    refresh,
    addFinca,
    updateFinca,
    deleteFinca,
    addLote,
    updateLote,
    deleteLote,
    addCiclo,
    updateCicloEstado,
    deleteCiclo,
    setSelectedLoteForCost,
    setSelectedCicloForCost,
  } = useApp();
  const [detailLoteId, setDetailLoteId] = useState<string | null>(null);
  const [modal, setModal] = useState<'finca' | 'editar-finca' | 'lote' | 'editar-lote' | 'eliminar-lote' | 'ciclo' | null>(null);
  const [loteSeleccionadoId, setLoteSeleccionadoId] = useState<string | null>(null);
  const [fincaEditadaId, setFincaEditadaId] = useState<string | null>(null);
  const [cicloACerrar, setCicloACerrar] = useState<CicloProductivo | null>(null);
  const [toast, setToast] = useState<{ mensaje: string; error: boolean } | null>(null);

  const showToast = (mensaje: string, error = false) => {
    setToast({ mensaje, error });
    setTimeout(() => setToast(null), 3500);
  };

  const handleEliminarFinca = async (finca: Finca) => {
    const lotes = data.lotes.filter((lote) => lote.finca_id === finca.id);
    const mensaje = lotes.length > 0
      ? `¿Eliminar la finca "${finca.nombre}"? También se eliminarán sus ${lotes.length} lote(s) con todos sus ciclos, costos, cosechas y ventas. Esta acción no se puede deshacer.`
      : `¿Eliminar la finca "${finca.nombre}"? Esta acción no se puede deshacer.`;
    if (!window.confirm(mensaje)) return;
    try {
      await deleteFinca(finca.id);
      showToast('Finca eliminada correctamente');
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'No se pudo eliminar la finca', true);
    }
  };

  const handleReabrirCiclo = async (ciclo: CicloProductivo) => {
    try {
      await updateCicloEstado(ciclo.id, { estado: 'Activo', fecha_fin: null });
      showToast('Ciclo reabierto');
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'No se pudo reabrir el ciclo', true);
    }
  };

  const handleEliminarCiclo = async (ciclo: CicloProductivo) => {
    const cultivo = getCultivo(data, ciclo.cultivo_id);
    if (!window.confirm(
      `¿Eliminar el ciclo de ${cultivo?.nombre ?? 'cultivo'} iniciado el ${formatDate(ciclo.fecha_inicio)}? Se eliminarán sus actividades, costos, cosechas, ventas y salidas. Esta acción no se puede deshacer.`,
    )) return;
    try {
      await deleteCiclo(ciclo.id);
      showToast('Ciclo eliminado correctamente');
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'No se pudo eliminar el ciclo', true);
    }
  };

  const irAProduccion = (loteId: string, cicloId: string) => {
    setSelectedLoteForCost(loteId);
    setSelectedCicloForCost(cicloId);
    onNavigate('produccion');
  };

  // Farm cards
  const farmCards = data.fincas.map((finca) => {
    const lotes = data.lotes.filter((l) => l.finca_id === finca.id);
    const areaTotal = lotes.reduce((sum, l) => sum + l.area_ha, 0);
    return { finca, lotesCount: lotes.length, areaTotal };
  });

  // Lotes table
  const lotesRows = data.lotes.map((lote) => {
    const finca = getFinca(data, lote.finca_id);
    const ciclosLote = data.ciclos_productivos.filter((c) => c.lote_id === lote.id);
    const cicloReciente = ciclosLote[ciclosLote.length - 1];
    const cultivo = cicloReciente ? getCultivo(data, cicloReciente.cultivo_id) : undefined;
    const calc = cicloReciente ? calcularSeguro(data, cicloReciente) : null;
    return { lote, finca, cicloReciente, cultivo, calc };
  });

  const handleRegistrarCosto = (loteId: string, cicloId: string) => {
    setSelectedLoteForCost(loteId);
    setSelectedCicloForCost(cicloId);
    onNavigate('costos');
  };

  const abrirEdicionLote = (loteId: string) => {
    setLoteSeleccionadoId(loteId);
    setModal('editar-lote');
  };

  const abrirEliminacionLote = (loteId: string) => {
    setLoteSeleccionadoId(loteId);
    setModal('eliminar-lote');
  };

  const cerrarModal = () => {
    setModal(null);
    setLoteSeleccionadoId(null);
  };

  if (loading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Cargando tus lotes…</div>;
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">Mis Lotes</h2>
          <p className="text-sm text-gray-500 mt-1">Fincas, lotes y ciclos productivos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setModal('finca')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nueva finca
          </button>
          <button
            onClick={() => setModal('lote')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuevo lote
          </button>
          <button
            onClick={() => setModal('ciclo')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2E7D32] text-white text-sm font-medium hover:bg-[#256628] transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuevo ciclo
          </button>
        </div>
      </div>

      {/* Farm cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {farmCards.map(({ finca, lotesCount, areaTotal }) => (
          <div key={finca.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#2E7D32]/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-[#2E7D32]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{finca.nombre}</h3>
                <p className="text-xs text-gray-500">{finca.municipio}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-600">{lotesCount} {lotesCount === 1 ? 'lote' : 'lotes'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Ruler className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-600 tnum">{formatNumber(areaTotal, 1)} ha</span>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setFincaEditadaId(finca.id);
                    setModal('editar-finca');
                  }}
                  aria-label={`Editar ${finca.nombre}`}
                  className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-[#2E7D32] hover:bg-[#2E7D32]/10 focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                >
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => void handleEliminarFinca(finca)}
                  aria-label={`Eliminar ${finca.nombre}`}
                  className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </button>
              </div>
            </div>
            {!finca.cod_mun && (
              <p className="mt-2 text-[11px] text-gray-500">
                Sin municipio DANE: edita la finca para activar la referencia histórica de rendimiento.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Lotes table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Lote</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Finca</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Área (ha)</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Cultivo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Estado</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Costo acumulado</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lotesRows.map(({ lote, finca, cicloReciente, cultivo, calc }) => (
                <tr key={lote.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{lote.nombre}</span>
                    <span className="block text-xs text-gray-500 mt-0.5">{lote.municipio}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{finca?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-600 tnum">{formatNumber(lote.area_ha, 1)}</td>
                  <td className="px-4 py-3 text-gray-600">{cultivo?.nombre ?? '—'}</td>
                  <td className="px-4 py-3">
                    {cicloReciente ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        cicloReciente.estado === 'Activo'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {cicloReciente.estado}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 tnum">
                    {calc ? formatCOP(calc.costoTotal) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailLoteId(lote.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[#2E7D32] hover:bg-[#2E7D32]/10 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Ver detalle
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirEdicionLote(lote.id)}
                        aria-label={`Editar ${lote.nombre}`}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </button>
                      {cicloReciente && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRegistrarCosto(lote.id, cicloReciente.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap"
                          >
                            <Receipt className="w-3.5 h-3.5" /> Costos
                          </button>
                          <button
                            type="button"
                            onClick={() => irAProduccion(lote.id, cicloReciente.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap"
                          >
                            <Wheat className="w-3.5 h-3.5" /> Cosechas y ventas
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => abrirEliminacionLote(lote.id)}
                        aria-label={`Eliminar ${lote.nombre}`}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {detailLoteId !== null && (
        <DetailPanel
          loteId={detailLoteId}
          onClose={() => setDetailLoteId(null)}
        />
      )}

      {/* Modals */}
      {modal === 'finca' && (
        <FincaModal
          onClose={() => setModal(null)}
          onSave={async (f) => {
            try {
              await addFinca(f);
              setModal(null);
              showToast('Finca creada correctamente');
            } catch (caughtError) {
              showToast(caughtError instanceof Error ? caughtError.message : 'No se pudo crear la finca', true);
            }
          }}
        />
      )}
      {modal === 'editar-finca' && fincaEditadaId && (
        <FincaModal
          key={`editar-finca-${fincaEditadaId}`}
          finca={data.fincas.find((finca) => finca.id === fincaEditadaId)}
          onClose={() => {
            setModal(null);
            setFincaEditadaId(null);
          }}
          onSave={async (f) => {
            try {
              await updateFinca(fincaEditadaId, f);
              setModal(null);
              setFincaEditadaId(null);
              showToast('Finca actualizada correctamente');
            } catch (caughtError) {
              showToast(caughtError instanceof Error ? caughtError.message : 'No se pudo actualizar la finca', true);
            }
          }}
        />
      )}
      {cicloACerrar && (
        <CerrarCicloModal
          ciclo={cicloACerrar}
          calculo={calcularSeguro(data, cicloACerrar)}
          onClose={() => setCicloACerrar(null)}
          onRegistrarSalida={() => {
            const ciclo = cicloACerrar;
            setCicloACerrar(null);
            irAProduccion(ciclo.lote_id, ciclo.id);
          }}
          onConfirm={async (fechaFin) => {
            try {
              await updateCicloEstado(cicloACerrar.id, { estado: 'Finalizado', fecha_fin: fechaFin });
              setCicloACerrar(null);
              showToast('Ciclo finalizado');
            } catch (caughtError) {
              showToast(caughtError instanceof Error ? caughtError.message : 'No se pudo finalizar el ciclo', true);
            }
          }}
        />
      )}
      {modal === 'lote' && (
        <LoteModal
          key="nuevo-lote"
          onClose={cerrarModal}
          onSave={async (l) => {
            await addLote(l);
            showToast('Lote creado correctamente');
          }}
        />
      )}
      {modal === 'editar-lote' && loteSeleccionadoId && (
        <LoteModal
          key={`editar-lote-${loteSeleccionadoId}`}
          lote={data.lotes.find((lote) => lote.id === loteSeleccionadoId)}
          onClose={cerrarModal}
          onSave={async (l) => {
            await updateLote(loteSeleccionadoId, l);
            showToast('Lote actualizado correctamente');
          }}
        />
      )}
      {modal === 'eliminar-lote' && loteSeleccionadoId && (
        <EliminarLoteModal
          key={`eliminar-lote-${loteSeleccionadoId}`}
          lote={data.lotes.find((lote) => lote.id === loteSeleccionadoId)}
          onClose={cerrarModal}
          onConfirm={async () => {
            await deleteLote(loteSeleccionadoId);
            showToast('Lote eliminado correctamente');
          }}
        />
      )}
      {modal === 'ciclo' && (
        <CicloModal
          onClose={() => setModal(null)}
          onSave={async (c) => {
            try {
              await addCiclo(c);
              setModal(null);
              showToast('Ciclo creado correctamente');
            } catch (caughtError) {
              showToast(caughtError instanceof Error ? caughtError.message : 'No se pudo crear el ciclo', true);
            }
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw]">
          <div className={`flex items-center gap-2 text-white px-4 py-3 rounded-lg shadow-lg ${toast.error ? 'bg-red-700' : 'bg-gray-900'}`}>
            {toast.error
              ? <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-100" />
              : <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-green-400" />}
            <span className="text-sm font-medium">{toast.mensaje}</span>
          </div>
        </div>
      )}
    </div>
  );

  function DetailPanel({ loteId, onClose }: { loteId: string; onClose: () => void }) {
    const lote = data.lotes.find((l) => l.id === loteId);
    const finca = lote ? getFinca(data, lote.finca_id) : undefined;
    const ciclos = data.ciclos_productivos.filter((c) => c.lote_id === loteId);
    const cicloReciente = ciclos[ciclos.length - 1];
    const calc = cicloReciente ? calcularSeguro(data, cicloReciente) : null;
    const cultivo = cicloReciente ? getCultivo(data, cicloReciente.cultivo_id) : undefined;

    const insumos = useMemo(
      () => cicloReciente ? data.insumos.filter((i) => i.ciclo_id === cicloReciente.id) : [],
      [cicloReciente, data.insumos]
    );
    const jornales = useMemo(
      () => cicloReciente ? data.mano_de_obra.filter((m) => m.ciclo_id === cicloReciente.id) : [],
      [cicloReciente, data.mano_de_obra]
    );
    const actividades = useMemo(
      () => cicloReciente ? data.actividades.filter((a) => a.ciclo_id === cicloReciente.id) : [],
      [cicloReciente, data.actividades]
    );

    if (!lote) return null;

    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-xl">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between z-10">
            <h3 className="text-base font-semibold text-gray-900">Detalle del lote</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="p-5 space-y-5">
            <div>
              <h4 className="text-lg font-bold text-gray-900">{lote.nombre}</h4>
              <p className="text-sm text-gray-500">{finca?.nombre} · {lote.municipio}</p>
              <p className="text-sm text-gray-500 tnum mt-1">Área: {formatNumber(lote.area_ha, 1)} ha</p>
            </div>

            {cicloReciente && cultivo && calc && (
              <>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sprout className="w-4 h-4 text-[#2E7D32]" />
                    <span className="text-sm font-semibold text-gray-900">Ciclo actual: {cultivo.nombre}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cicloReciente.estado === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                      {cicloReciente.estado}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Inicio: {formatDate(cicloReciente.fecha_inicio)}{cicloReciente.fecha_fin ? ` · Fin: ${formatDate(cicloReciente.fecha_fin)}` : ''}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-[11px] text-gray-500">Cosechado</p>
                    <p className="text-sm font-semibold text-gray-900 tnum">{calc.Q > 0 ? `${formatCantidad(calc.Q)} kg` : '—'}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-[11px] text-gray-500">Ingresos por ventas</p>
                    <p className="text-sm font-semibold text-gray-900 tnum">{calc.Qv > 0 ? formatCOP(calc.ingresosRealizados) : '—'}</p>
                  </div>
                </div>

                <div className="bg-[#2E7D32]/5 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Costo total del ciclo</p>
                  <p className="text-2xl font-bold text-[#2E7D32] tnum">{formatCOP(calc.costoTotal)}</p>
                </div>

                <div className="space-y-3">
                  <div className="border-l-4 border-[#2E7D32] pl-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Insumos</span>
                      <span className="text-sm font-semibold text-gray-900 tnum">{formatCOP(calc.costoInsumos)}</span>
                    </div>
                    {insumos.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {insumos.map((i) => (
                          <li key={i.id} className="text-xs text-gray-500 flex justify-between">
                            <span>{i.nombre}</span>
                            <span className="tnum">{formatCOP(i.cantidad * i.costo_unitario)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="border-l-4 border-[#66BB6A] pl-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Jornales</span>
                      <span className="text-sm font-semibold text-gray-900 tnum">{formatCOP(calc.costoJornales)}</span>
                    </div>
                    {jornales.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {jornales.map((j) => {
                          return (
                            <li key={j.id} className="text-xs text-gray-500 flex justify-between">
                              <span>{j.nombre} ({j.num_jornales} jornales)</span>
                              <span className="tnum">{formatCOP(j.num_jornales * j.valor_jornal)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <div className="border-l-4 border-[#A5D6A7] pl-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Otros costos</span>
                      <span className="text-sm font-semibold text-gray-900 tnum">{formatCOP(calc.costoOtros)}</span>
                    </div>
                    {actividades.filter((a) => a.otros_costos > 0).length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {actividades.filter((a) => a.otros_costos > 0).map((a) => (
                          <li key={a.id} className="text-xs text-gray-500 flex justify-between">
                            <span>{a.nombre}</span>
                            <span className="tnum">{formatCOP(a.otros_costos)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Todos los ciclos del lote */}
            <div>
              <h5 className="text-sm font-semibold text-gray-900 mb-2">Ciclos de este lote</h5>
              {ciclos.length === 0 ? (
                <p className="text-sm text-gray-500">Este lote aún no tiene ciclos. Crea uno con “Nuevo ciclo”.</p>
              ) : (
                <ul className="space-y-2">
                  {[...ciclos].reverse().map((c) => {
                    const cc = calcularSeguro(data, c);
                    const cl = getCultivo(data, c.cultivo_id);
                    return (
                      <li key={c.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-gray-900">{cl?.nombre ?? 'Cultivo'}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${c.estado === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                            {c.estado}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {formatDate(c.fecha_inicio)}{c.fecha_fin ? ` → ${formatDate(c.fecha_fin)}` : ' → en curso'}
                          {cc ? ` · Costo ${formatCOP(cc.costoTotal)}` : ''}
                          {cc && cc.margenRealizado !== null ? ` · Margen ${formatCOP(cc.margenRealizado)}` : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => irAProduccion(c.lote_id, c.id)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                          >
                            <Wheat className="w-3.5 h-3.5" /> Cosechas y ventas
                          </button>
                          {c.estado === 'Activo' ? (
                            <button
                              type="button"
                              onClick={() => setCicloACerrar(c)}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#2E7D32] hover:bg-[#2E7D32]/10"
                            >
                              <Flag className="w-3.5 h-3.5" /> Finalizar ciclo
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleReabrirCiclo(c)}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Reabrir
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleEliminarCiclo(c)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between rounded-t-xl z-10">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function FieldError({ show, message = 'Este campo es obligatorio' }: { show: boolean; message?: string }) {
  if (!show) return null;
  return <p className="text-xs text-red-500 mt-1">{message}</p>;
}

interface DatosFinca {
  nombre: string;
  municipio: string;
  cod_mun: string | null;
  latitud: number;
  longitud: number;
}

function FincaModal({ finca, onClose, onSave }: { finca?: Finca; onClose: () => void; onSave: (f: DatosFinca) => void }) {
  const [nombre, setNombre] = useState(finca?.nombre ?? '');
  const [municipio, setMunicipio] = useState(finca?.municipio ?? '');
  const [codMun, setCodMun] = useState<string | null>(finca?.cod_mun ?? null);
  const [latitud, setLatitud] = useState(finca ? String(finca.latitud) : '');
  const [longitud, setLongitud] = useState(finca ? String(finca.longitud) : '');
  const [errors, setErrors] = useState({ nombre: false, municipio: false, latitud: false, longitud: false });
  const [ubicando, setUbicando] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);

  const usarUbicacionActual = () => {
    if (!('geolocation' in navigator)) {
      setErrorUbicacion('Este dispositivo no permite obtener la ubicación.');
      return;
    }
    setUbicando(true);
    setErrorUbicacion(null);
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setLatitud(posicion.coords.latitude.toFixed(5));
        setLongitud(posicion.coords.longitude.toFixed(5));
        setUbicando(false);
      },
      () => {
        setErrorUbicacion('No se pudo obtener la ubicación. Revisa el permiso de ubicación o escríbela a mano.');
        setUbicando(false);
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const handleSave = () => {
    const lat = Number(latitud);
    const lon = Number(longitud);
    const e = {
      nombre: !nombre.trim(),
      municipio: !municipio.trim(),
      latitud: latitud.trim() === '' || !Number.isFinite(lat) || lat < -90 || lat > 90,
      longitud: longitud.trim() === '' || !Number.isFinite(lon) || lon < -180 || lon > 180,
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    onSave({ nombre: nombre.trim(), municipio: municipio.trim(), cod_mun: codMun, latitud: lat, longitud: lon });
  };

  return (
    <ModalShell title={finca ? 'Editar finca' : 'Nueva finca'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" placeholder="Ej. Finca La Montaña" />
          <FieldError show={errors.nombre} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Municipio (DANE)</label>
          <MunicipioDaneSelect
            value={codMun}
            onChange={(codigo, municipioDane) => {
              setCodMun(codigo);
              if (municipioDane) setMunicipio(municipioDane);
            }}
          />
          <p className="text-xs text-gray-400 mt-1">Recomendado. Permite comparar el ciclo con la referencia histórica del municipio.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Municipio o vereda</label>
          <input value={municipio} onChange={(e) => setMunicipio(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" placeholder="Ej. San Juan Nepomuceno" />
          <FieldError show={errors.municipio} />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700">Ubicación (para el pronóstico del clima)</span>
          </div>
          <button
            type="button"
            onClick={usarUbicacionActual}
            disabled={ubicando}
            className="mb-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#2E7D32] px-3 py-2 text-sm font-semibold text-[#2E7D32] hover:bg-[#2E7D32]/5 disabled:opacity-60"
          >
            <LocateFixed className="w-4 h-4" /> {ubicando ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual'}
          </button>
          {errorUbicacion && <p className="mb-2 text-xs text-red-600">{errorUbicacion}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Latitud</label>
              <input value={latitud} onChange={(e) => setLatitud(e.target.value)} inputMode="decimal" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] tnum" placeholder="Ej. 10.25" />
              <FieldError show={errors.latitud} message="Latitud entre -90 y 90" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Longitud</label>
              <input value={longitud} onChange={(e) => setLongitud(e.target.value)} inputMode="decimal" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] tnum" placeholder="Ej. -75.35" />
              <FieldError show={errors.longitud} message="Longitud entre -180 y 180" />
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-400">Si estás en la finca, usa el botón. Si no, cópiala de Google Maps (clic derecho sobre el punto).</p>
        </div>
        <button onClick={handleSave} className="w-full py-2.5 rounded-lg bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#256628] transition-colors">
          {finca ? 'Guardar cambios' : 'Guardar'}
        </button>
      </div>
    </ModalShell>
  );
}

function CerrarCicloModal({
  ciclo,
  calculo,
  onClose,
  onConfirm,
  onRegistrarSalida,
}: {
  ciclo: CicloProductivo;
  calculo: CicloCalculo | null;
  onClose: () => void;
  onConfirm: (fechaFin: string) => void;
  onRegistrarSalida: () => void;
}) {
  const [fechaFin, setFechaFin] = useState(() => (hoy() < ciclo.fecha_inicio ? ciclo.fecha_inicio : hoy()));
  const fechaInvalida = !fechaFin || fechaFin < ciclo.fecha_inicio;
  const enBodega = calculo?.Qnv ?? 0;
  const sinCosecha = (calculo?.Q ?? 0) === 0;

  return (
    <ModalShell title="Finalizar ciclo" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Finalizar el ciclo indica que la siembra terminó. Podrás seguir corrigiendo sus registros y reabrirlo si te equivocas.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="fecha-fin-ciclo">Fecha de cierre</label>
          <input
            id="fecha-fin-ciclo"
            type="date"
            min={ciclo.fecha_inicio}
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
          />
          <FieldError show={fechaInvalida} message={`Debe ser igual o posterior al inicio (${formatDate(ciclo.fecha_inicio)})`} />
        </div>
        {sinCosecha && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>Este ciclo no tiene cosechas registradas. Si se perdió la siembra, puedes cerrarlo igual: el costo quedará como pérdida.</p>
          </div>
        )}
        {enBodega > 0 && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p>
                Quedan <strong>{formatCantidad(enBodega)} kg</strong> sin vender ni registrar como salida. Si se consumieron,
                se guardaron como semilla o se perdieron, regístralos para que el resultado del ciclo sea real.
              </p>
              <button type="button" onClick={onRegistrarSalida} className="mt-1 font-semibold underline">
                Registrar salida
              </button>
            </div>
          </div>
        )}
        <button
          type="button"
          disabled={fechaInvalida}
          onClick={() => onConfirm(fechaFin)}
          className="w-full py-2.5 rounded-lg bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#256628] transition-colors disabled:opacity-50"
        >
          Finalizar ciclo
        </button>
      </div>
    </ModalShell>
  );
}

function CicloModal({ onClose, onSave }: { onClose: () => void; onSave: (c: { lote_id: string; cultivo_id: string; fecha_inicio: string }) => void }) {
  const { data } = useApp();
  const [loteId, setLoteId] = useState('');
  const [cultivoId, setCultivoId] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [errors, setErrors] = useState({ lote_id: false, cultivo_id: false, fecha_inicio: false });

  const handleSave = () => {
    const e = {
      lote_id: !loteId,
      cultivo_id: !cultivoId,
      fecha_inicio: !fechaInicio,
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    onSave({ lote_id: loteId, cultivo_id: cultivoId, fecha_inicio: fechaInicio });
  };

  return (
    <ModalShell title="Nuevo ciclo" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lote</label>
          <select value={loteId} onChange={(e) => setLoteId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]">
            <option value="">Selecciona un lote</option>
            {data.lotes.map((l) => {
              const finca = getFinca(data, l.finca_id);
              return <option key={l.id} value={l.id}>{l.nombre} ({finca?.nombre})</option>;
            })}
          </select>
          <FieldError show={errors.lote_id} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cultivo</label>
          <select value={cultivoId} onChange={(e) => setCultivoId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]">
            <option value="">Selecciona un cultivo</option>
            {data.cultivos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <FieldError show={errors.cultivo_id} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de inicio</label>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" />
          <FieldError show={errors.fecha_inicio} />
          <p className="text-xs text-gray-400 mt-1">El estado inicial del ciclo será "Activo"</p>
        </div>
        <button onClick={handleSave} className="w-full py-2.5 rounded-lg bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#256628] transition-colors">
          Guardar
        </button>
      </div>
    </ModalShell>
  );
}
