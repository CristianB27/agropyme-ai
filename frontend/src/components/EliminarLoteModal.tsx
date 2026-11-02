import { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calcularImpactoEliminacionLote } from '../utils/lotes';
import type { Lote } from '../types';

interface EliminarLoteModalProps {
  lote?: Lote;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function EliminarLoteModal({ lote, onClose, onConfirm }: EliminarLoteModalProps) {
  const { data } = useApp();
  const [eliminando, setEliminando] = useState(false);
  const [errorOperacion, setErrorOperacion] = useState<string | null>(null);
  const impacto = lote ? calcularImpactoEliminacionLote(data, lote.id) : null;

  if (!lote || !impacto) return null;

  const confirmar = async () => {
    try {
      setEliminando(true);
      setErrorOperacion(null);
      await onConfirm();
      onClose();
    } catch (caughtError) {
      setErrorOperacion(caughtError instanceof Error ? caughtError.message : 'No se pudo eliminar el lote.');
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/40"
        onClick={() => !eliminando && onClose()}
        aria-label="Cerrar confirmación de eliminación"
      />
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-confirmar-lote" className="relative w-full max-w-lg bg-white rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between rounded-t-xl z-10">
          <h3 id="titulo-confirmar-lote" className="text-base font-semibold text-gray-900">Eliminar lote</h3>
          <button type="button" onClick={onClose} disabled={eliminando} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50" aria-label="Cerrar">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
              <div>
                <h4 className="text-sm font-semibold text-red-900">Confirmar eliminación</h4>
                <p className="mt-1 text-sm leading-relaxed text-red-800">
                  ¿Estás seguro de que deseas eliminar este lote? Esta acción no se puede deshacer y podría afectar a los registros asociados.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-red-800">
                  Se eliminará <strong>{lote.nombre}</strong>{impacto.totalRegistros === 0
                    ? ' y no tiene registros asociados.'
                    : impacto.totalRegistros === 1
                      ? ' y su único registro asociado.'
                      : ` y sus ${impacto.totalRegistros} registros asociados.`}
                </p>
              </div>
            </div>
          </div>

          {impacto.totalRegistros > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Registros que también se eliminarán</p>
              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-amber-800">
                <li>{impacto.ciclos} {impacto.ciclos === 1 ? 'ciclo' : 'ciclos'}</li>
                <li>{impacto.actividades} {impacto.actividades === 1 ? 'actividad' : 'actividades'}</li>
                <li>{impacto.insumos} {impacto.insumos === 1 ? 'insumo' : 'insumos'}</li>
                <li>{impacto.jornales} {impacto.jornales === 1 ? 'jornal' : 'jornales'}</li>
                <li>{impacto.cosechas} {impacto.cosechas === 1 ? 'cosecha' : 'cosechas'}</li>
                <li>{impacto.ventas} {impacto.ventas === 1 ? 'venta' : 'ventas'}</li>
              </ul>
            </div>
          )}

          {errorOperacion && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorOperacion}</p>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={eliminando}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void confirmar()}
              disabled={eliminando}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
