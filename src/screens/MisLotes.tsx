import { useState, useMemo } from 'react';
import { MapPin, Plus, Eye, Receipt, X, CheckCircle2, Sprout, Layers, Ruler } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calcularCiclo, getCultivo, getFinca } from '../utils/calculos';
import { formatCOP, formatNumber } from '../utils/format';
import type { ScreenId } from '../components/Layout';

interface MisLotesProps {
  onNavigate: (id: ScreenId) => void;
}

export default function MisLotes({ onNavigate }: MisLotesProps) {
  const { data, addFinca, addLote, addCiclo, setSelectedLoteForCost, setSelectedCicloForCost } = useApp();
  const [detailLoteId, setDetailLoteId] = useState<number | null>(null);
  const [modal, setModal] = useState<'finca' | 'lote' | 'ciclo' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
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
    const calc = cicloReciente ? calcularCiclo(data, cicloReciente) : null;
    return { lote, finca, cicloReciente, cultivo, calc };
  });

  const handleRegistrarCosto = (loteId: number, cicloId: number) => {
    setSelectedLoteForCost(loteId);
    setSelectedCicloForCost(cicloId);
    onNavigate('costos');
  };

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
            <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-600">{lotesCount} {lotesCount === 1 ? 'lote' : 'lotes'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Ruler className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-600 tnum">{formatNumber(areaTotal, 1)} ha</span>
              </div>
            </div>
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
                  <td className="px-4 py-3 font-medium text-gray-900">{lote.nombre}</td>
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
                        onClick={() => setDetailLoteId(lote.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[#2E7D32] hover:bg-[#2E7D32]/10 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Ver detalle
                      </button>
                      {cicloReciente && (
                        <button
                          onClick={() => handleRegistrarCosto(lote.id, cicloReciente.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <Receipt className="w-3.5 h-3.5" /> Registrar costo
                        </button>
                      )}
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
          onSave={(f) => {
            addFinca(f);
            setModal(null);
            showToast('Finca creada correctamente');
          }}
        />
      )}
      {modal === 'lote' && (
        <LoteModal
          onClose={() => setModal(null)}
          onSave={(l) => {
            addLote(l);
            setModal(null);
            showToast('Lote creado correctamente');
          }}
        />
      )}
      {modal === 'ciclo' && (
        <CicloModal
          onClose={() => setModal(null)}
          onSave={(c) => {
            addCiclo(c);
            setModal(null);
            showToast('Ciclo creado correctamente');
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-sm font-medium">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );

  function DetailPanel({ loteId, onClose }: { loteId: number; onClose: () => void }) {
    const lote = data.lotes.find((l) => l.id === loteId);
    const finca = lote ? getFinca(data, lote.finca_id) : undefined;
    const ciclos = data.ciclos_productivos.filter((c) => c.lote_id === loteId);
    const cicloReciente = ciclos[ciclos.length - 1];
    const calc = cicloReciente ? calcularCiclo(data, cicloReciente) : null;
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
              <p className="text-sm text-gray-500">{finca?.nombre} · {finca?.municipio}</p>
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
                  <p className="text-xs text-gray-500">Inicio: {cicloReciente.fecha_inicio}{cicloReciente.fecha_fin ? ` · Fin: ${cicloReciente.fecha_fin}` : ''}</p>
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
                          const act = actividades.find((a) => a.id === j.actividad_id);
                          return (
                            <li key={j.id} className="text-xs text-gray-500 flex justify-between">
                              <span>{act?.tipo ?? '—'} ({j.num_jornales} jornales)</span>
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
                            <span>{a.tipo}</span>
                            <span className="tnum">{formatCOP(a.otros_costos)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
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

function FieldError({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="text-xs text-red-500 mt-1">Este campo es obligatorio</p>;
}

function FincaModal({ onClose, onSave }: { onClose: () => void; onSave: (f: { nombre: string; municipio: string; latitud: number; longitud: number }) => void }) {
  const [nombre, setNombre] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');
  const [errors, setErrors] = useState({ nombre: false, municipio: false, latitud: false, longitud: false });

  const handleSave = () => {
    const e = {
      nombre: !nombre.trim(),
      municipio: !municipio.trim(),
      latitud: latitud === '' || isNaN(Number(latitud)),
      longitud: longitud === '' || isNaN(Number(longitud)),
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    onSave({ nombre: nombre.trim(), municipio: municipio.trim(), latitud: Number(latitud), longitud: Number(longitud) });
  };

  return (
    <ModalShell title="Nueva finca" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" placeholder="Ej. Finca La Montana" />
          <FieldError show={errors.nombre} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Municipio</label>
          <input value={municipio} onChange={(e) => setMunicipio(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" placeholder="Ej. San Juan" />
          <FieldError show={errors.municipio} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Latitud</label>
            <input value={latitud} onChange={(e) => setLatitud(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] tnum" placeholder="Ej. 10.25" />
            <FieldError show={errors.latitud} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Longitud</label>
            <input value={longitud} onChange={(e) => setLongitud(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] tnum" placeholder="Ej. -75.35" />
            <FieldError show={errors.longitud} />
          </div>
        </div>
        <button onClick={handleSave} className="w-full py-2.5 rounded-lg bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#256628] transition-colors">
          Guardar
        </button>
      </div>
    </ModalShell>
  );
}

function LoteModal({ onClose, onSave }: { onClose: () => void; onSave: (l: { finca_id: number; nombre: string; area_ha: number }) => void }) {
  const { data } = useApp();
  const [fincaId, setFincaId] = useState(data.fincas[0]?.id?.toString() ?? '');
  const [nombre, setNombre] = useState('');
  const [areaHa, setAreaHa] = useState('');
  const [errors, setErrors] = useState({ finca_id: false, nombre: false, area_ha: false });

  const handleSave = () => {
    const e = {
      finca_id: !fincaId,
      nombre: !nombre.trim(),
      area_ha: areaHa === '' || isNaN(Number(areaHa)) || Number(areaHa) <= 0,
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    onSave({ finca_id: Number(fincaId), nombre: nombre.trim(), area_ha: Number(areaHa) });
  };

  return (
    <ModalShell title="Nuevo lote" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Finca</label>
          <select value={fincaId} onChange={(e) => setFincaId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]">
            <option value="">Selecciona una finca</option>
            {data.fincas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </select>
          <FieldError show={errors.finca_id} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" placeholder="Ej. Lote Sur" />
          <FieldError show={errors.nombre} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Área (ha)</label>
          <input value={areaHa} onChange={(e) => setAreaHa(e.target.value)} type="number" step="0.1" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] tnum" placeholder="Ej. 2.5" />
          <FieldError show={errors.area_ha} />
        </div>
        <button onClick={handleSave} className="w-full py-2.5 rounded-lg bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#256628] transition-colors">
          Guardar
        </button>
      </div>
    </ModalShell>
  );
}

function CicloModal({ onClose, onSave }: { onClose: () => void; onSave: (c: { lote_id: number; cultivo_id: number; fecha_inicio: string }) => void }) {
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
    onSave({ lote_id: Number(loteId), cultivo_id: Number(cultivoId), fecha_inicio: fechaInicio });
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
