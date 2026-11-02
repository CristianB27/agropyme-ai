import { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import MunicipioDaneSelect from './MunicipioDaneSelect';
import { validarCamposLote } from '../utils/lotes';
import type { Lote } from '../types';

export interface DatosLoteModal {
  finca_id: string;
  nombre: string;
  area_ha: number;
  municipio: string;
  cod_mun: string | null;
}

interface LoteModalProps {
  lote?: Lote;
  onClose: () => void;
  onSave: (lote: DatosLoteModal) => Promise<void>;
}

function FieldError({ show, message }: { show: boolean; message: string }) {
  if (!show) return null;
  return <p className="text-xs text-red-500 mt-1">{message}</p>;
}

export default function LoteModal({ lote, onClose, onSave }: LoteModalProps) {
  const { data } = useApp();
  const fincaInicial = lote
    ? data.fincas.find((finca) => finca.id === lote.finca_id)
    : data.fincas[0];
  const [fincaId, setFincaId] = useState(lote?.finca_id ?? fincaInicial?.id ?? '');
  const [nombre, setNombre] = useState(lote?.nombre ?? '');
  const [areaHa, setAreaHa] = useState(lote ? String(lote.area_ha) : '');
  const [municipio, setMunicipio] = useState(lote?.municipio ?? fincaInicial?.municipio ?? '');
  const [codMun, setCodMun] = useState<string | null>(lote?.cod_mun ?? fincaInicial?.cod_mun ?? null);
  const [errors, setErrors] = useState({ finca_id: false, nombre: false, area_ha: false, municipio: false });
  const [guardando, setGuardando] = useState(false);
  const [errorOperacion, setErrorOperacion] = useState<string | null>(null);
  const esEdicion = lote !== undefined;

  const cambiarFinca = (id: string) => {
    setFincaId(id);
    const fincaSeleccionada = data.fincas.find((finca) => finca.id === id);
    if (!fincaSeleccionada) return;
    setMunicipio(fincaSeleccionada.municipio);
    setCodMun(fincaSeleccionada.cod_mun);
  };

  const handleSave = async () => {
    const e = {
      finca_id: !fincaId,
      ...validarCamposLote({ nombre, areaHa, municipio }),
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;

    try {
      setGuardando(true);
      setErrorOperacion(null);
      await onSave({
        finca_id: fincaId,
        nombre: nombre.trim(),
        area_ha: Number(areaHa),
        municipio: municipio.trim(),
        cod_mun: codMun,
      });
      onClose();
    } catch (caughtError) {
      setErrorOperacion(caughtError instanceof Error ? caughtError.message : 'No se pudo guardar el lote.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/30"
        onClick={() => !guardando && onClose()}
        aria-label="Cerrar formulario de lote"
      />
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-modal-lote" className="relative w-full max-w-md bg-white rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between rounded-t-xl z-10">
          <h3 id="titulo-modal-lote" className="text-base font-semibold text-gray-900">
            {esEdicion ? 'Editar lote' : 'Nuevo lote'}
          </h3>
          <button type="button" onClick={onClose} disabled={guardando} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50" aria-label="Cerrar">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="lote-finca" className="block text-sm font-medium text-gray-700 mb-1">Finca</label>
            <select
              id="lote-finca"
              value={fincaId}
              onChange={(e) => cambiarFinca(e.target.value)}
              disabled={esEdicion}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">Selecciona una finca</option>
              {data.fincas.map((finca) => <option key={finca.id} value={finca.id}>{finca.nombre}</option>)}
            </select>
            <FieldError show={errors.finca_id} message="Selecciona una finca." />
          </div>

          <div>
            <label htmlFor="lote-nombre" className="block text-sm font-medium text-gray-700 mb-1">Nombre del lote o sub-lote</label>
            <input id="lote-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" placeholder="Ej. Lote Sur" />
            <FieldError show={errors.nombre} message="Ingresa el nombre del lote." />
          </div>

          <div>
            <label htmlFor="lote-area" className="block text-sm font-medium text-gray-700 mb-1">Área (ha)</label>
            <input id="lote-area" value={areaHa} onChange={(e) => setAreaHa(e.target.value)} type="number" min="0" step="0.1" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] tnum" placeholder="Ej. 2.5" />
            <FieldError show={errors.area_ha} message="Ingresa un área mayor que cero." />
          </div>

          <div>
            <label htmlFor="lote-municipio" className="block text-sm font-medium text-gray-700 mb-1">Municipio</label>
            <input
              id="lote-municipio"
              value={municipio}
              onChange={(e) => {
                setMunicipio(e.target.value);
                setCodMun(null);
              }}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
              placeholder="Ej. María la Baja"
            />
            <FieldError show={errors.municipio} message="Ingresa el municipio del lote." />
            <p className="text-xs text-gray-400 mt-1">El municipio pertenece a este lote y no modifica los lotes de la misma finca.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Municipio (DANE)</label>
            <MunicipioDaneSelect
              key={codMun ?? 'sin-codigo-dane'}
              value={codMun}
              onChange={(codigo, municipioDane) => {
                setCodMun(codigo);
                if (municipioDane) setMunicipio(municipioDane);
              }}
            />
            <p className="text-xs text-gray-400 mt-1">Opcional. Permite comparar el ciclo con referencias históricas del municipio.</p>
          </div>

          {errorOperacion && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorOperacion}</p>
          )}

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={guardando}
            className="w-full py-2.5 rounded-lg bg-[#2E7D32] text-white text-sm font-semibold hover:bg-[#256628] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
