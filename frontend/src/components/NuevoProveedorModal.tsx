import { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Proveedor } from '../types';

interface NuevoProveedorModalProps {
  onClose: () => void;
  onSaved: (proveedor: Proveedor) => void;
}

export function NuevoProveedorModal({ onClose, onSaved }: NuevoProveedorModalProps) {
  const { addProveedor } = useApp();
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, saving]);

  const guardar = async () => {
    if (!nombre.trim()) {
      setError('El nombre del proveedor es obligatorio.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const proveedor = await addProveedor({
        nombre: nombre.trim(),
        contacto: contacto.trim() || null,
      });
      onSaved(proveedor);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo guardar el proveedor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/40"
        onClick={() => !saving && onClose()}
        aria-label="Cerrar formulario de proveedor"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nuevo-proveedor-title"
        className="relative w-full max-w-md rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#2E7D32]">Proveedores</p>
            <h3 id="nuevo-proveedor-title" className="mt-1 text-base font-semibold text-gray-900">Nuevo proveedor</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void guardar();
          }}
          className="space-y-4 p-5"
        >
          <div>
            <label htmlFor="proveedor-nombre" className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              id="proveedor-nombre"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              autoFocus
              maxLength={120}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
              placeholder="Ej. Agroinsumos del Valle"
            />
          </div>
          <div>
            <label htmlFor="proveedor-contacto" className="block text-sm font-medium text-gray-700 mb-1">Contacto (opcional)</label>
            <input
              id="proveedor-contacto"
              value={contacto}
              onChange={(event) => setContacto(event.target.value)}
              maxLength={200}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
              placeholder="Teléfono, correo o persona de contacto"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2E7D32] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#256628] focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Guardando…' : 'Guardar proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
