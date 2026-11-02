import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Pencil, Save, Trash2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Actividad, Insumo, ManoDeObra } from '../types';
import { formatCOP, formatDate, formatNumber } from '../utils/format';

const TIPOS_ACTIVIDAD = [
  'Preparación de suelo', 'Siembra', 'Riego', 'Fertilización',
  'Deshierba', 'Control de plagas', 'Cosecha', 'Otra',
];

const UNIDADES = ['kg', 'L', 'bulto', 'unidad'];

export type RegistroSeleccionado =
  | { categoria: 'Insumo'; registro: Insumo }
  | { categoria: 'Jornal'; registro: ManoDeObra }
  | { categoria: 'Actividad'; registro: Actividad };

interface DetalleCampo {
  etiqueta: string;
  valor: string;
}

interface FormularioEdicion {
  fecha: string;
  nombre: string;
  descripcion: string;
  cantidad: string;
  unidad: string;
  costoUnitario: string;
  proveedorId: string;
  actividadId: string;
  numJornales: string;
  valorJornal: string;
  tipo: string;
  otrosCostos: string;
}

type VistaModal = 'detalle' | 'editar' | 'confirmar';

function formularioInicial(seleccion: RegistroSeleccionado): FormularioEdicion {
  const base: FormularioEdicion = {
    fecha: '',
    nombre: '',
    descripcion: '',
    cantidad: '',
    unidad: 'kg',
    costoUnitario: '',
    proveedorId: '',
    actividadId: '',
    numJornales: '',
    valorJornal: '',
    tipo: TIPOS_ACTIVIDAD[0],
    otrosCostos: '',
  };

  if (seleccion.categoria === 'Insumo') {
    return {
      ...base,
      fecha: seleccion.registro.fecha,
      nombre: seleccion.registro.nombre,
      descripcion: seleccion.registro.descripcion ?? '',
      cantidad: String(seleccion.registro.cantidad),
      unidad: seleccion.registro.unidad,
      costoUnitario: String(seleccion.registro.costo_unitario),
      proveedorId: seleccion.registro.proveedor_id ?? '',
      actividadId: seleccion.registro.actividad_id ?? '',
    };
  }

  if (seleccion.categoria === 'Jornal') {
    return {
      ...base,
      fecha: seleccion.registro.fecha,
      nombre: seleccion.registro.nombre,
      descripcion: seleccion.registro.descripcion ?? '',
      actividadId: seleccion.registro.actividad_id ?? '',
      numJornales: String(seleccion.registro.num_jornales),
      valorJornal: String(seleccion.registro.valor_jornal),
    };
  }

  return {
    ...base,
    fecha: seleccion.registro.fecha,
    nombre: seleccion.registro.nombre,
    descripcion: seleccion.registro.descripcion ?? '',
    tipo: seleccion.registro.tipo,
    otrosCostos: String(seleccion.registro.otros_costos),
  };
}

function mensajeError(caughtError: unknown, fallback: string): string {
  return caughtError instanceof Error ? caughtError.message : fallback;
}


interface DetalleRegistroModalProps {
  seleccion: RegistroSeleccionado;
  onClose: () => void;
  onMensaje: (mensaje: string) => void;
}

export function DetalleRegistroModal({ seleccion, onClose, onMensaje }: DetalleRegistroModalProps) {
  const { data, updateInsumo, deleteInsumo, updateManoDeObra, deleteManoDeObra, updateActividad, deleteActividad } = useApp();
  const [vista, setVista] = useState<VistaModal>('detalle');
  const [formulario, setFormulario] = useState<FormularioEdicion>(() => formularioInicial(seleccion));
  const [errores, setErrores] = useState<Record<string, boolean>>({});
  const [errorOperacion, setErrorOperacion] = useState<string | null>(null);
  const [operando, setOperando] = useState(false);

  const cicloId = seleccion.registro.ciclo_id;
  const actividadesCiclo = useMemo(
    () => data.actividades.filter((actividad) => actividad.ciclo_id === cicloId),
    [data.actividades, cicloId],
  );

  const campos = useMemo<DetalleCampo[]>(() => {
    if (seleccion.categoria === 'Insumo') {
      const proveedor = data.proveedores.find((item) => item.id === seleccion.registro.proveedor_id);
      const actividad = data.actividades.find((item) => item.id === seleccion.registro.actividad_id);
      return [
        { etiqueta: 'Cantidad', valor: `${formatNumber(seleccion.registro.cantidad, 2)} ${seleccion.registro.unidad}` },
        { etiqueta: 'Costo unitario', valor: formatCOP(seleccion.registro.costo_unitario) },
        { etiqueta: 'Costo total', valor: formatCOP(seleccion.registro.cantidad * seleccion.registro.costo_unitario) },
        { etiqueta: 'Proveedor', valor: proveedor?.nombre ?? 'Sin proveedor' },
        { etiqueta: 'Actividad asociada', valor: actividad?.nombre ?? 'Sin actividad' },
      ];
    }

    if (seleccion.categoria === 'Jornal') {
      const actividad = data.actividades.find((item) => item.id === seleccion.registro.actividad_id);
      return [
        { etiqueta: 'Número de jornales', valor: formatNumber(seleccion.registro.num_jornales, 2) },
        { etiqueta: 'Valor del jornal', valor: formatCOP(seleccion.registro.valor_jornal) },
        { etiqueta: 'Costo total', valor: formatCOP(seleccion.registro.num_jornales * seleccion.registro.valor_jornal) },
        { etiqueta: 'Actividad asociada', valor: actividad?.nombre ?? 'Sin actividad' },
      ];
    }

    return [
      { etiqueta: 'Tipo', valor: seleccion.registro.tipo },
      { etiqueta: 'Otros costos', valor: formatCOP(seleccion.registro.otros_costos) },
    ];
  }, [data.actividades, data.proveedores, seleccion]);

  const valorTotal = seleccion.categoria === 'Insumo'
    ? seleccion.registro.cantidad * seleccion.registro.costo_unitario
    : seleccion.categoria === 'Jornal'
      ? seleccion.registro.num_jornales * seleccion.registro.valor_jornal
      : seleccion.registro.otros_costos;

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !operando) onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, operando]);

  const cambiarFormulario = <K extends keyof FormularioEdicion>(campo: K, valor: FormularioEdicion[K]) => {
    setFormulario((previous) => ({ ...previous, [campo]: valor }));
  };


  const guardarEdicion = async () => {
    const validacion: Record<string, boolean> = {
      nombre: !formulario.nombre.trim(),
      fecha: !formulario.fecha,
    };

    if (seleccion.categoria === 'Insumo') {
      validacion.cantidad = formulario.cantidad === '' || Number(formulario.cantidad) <= 0;
      validacion.costoUnitario = formulario.costoUnitario === '' || Number(formulario.costoUnitario) <= 0;
    } else if (seleccion.categoria === 'Jornal') {
      validacion.numJornales = formulario.numJornales === '' || Number(formulario.numJornales) <= 0;
      validacion.valorJornal = formulario.valorJornal === '' || Number(formulario.valorJornal) <= 0;
    } else {
      validacion.otrosCostos = formulario.otrosCostos !== '' && Number(formulario.otrosCostos) < 0;
    }

    setErrores(validacion);
    if (Object.values(validacion).some(Boolean)) return;

    try {
      setOperando(true);
      setErrorOperacion(null);

      if (seleccion.categoria === 'Insumo') {
        await updateInsumo(seleccion.registro.id, {
          ciclo_id: seleccion.registro.ciclo_id,
          actividad_id: formulario.actividadId || null,
          proveedor_id: formulario.proveedorId || null,
          fecha: formulario.fecha,
          nombre: formulario.nombre.trim(),
          descripcion: formulario.descripcion.trim() || null,
          cantidad: Number(formulario.cantidad),
          unidad: formulario.unidad,
          costo_unitario: Number(formulario.costoUnitario),
        });
      } else if (seleccion.categoria === 'Jornal') {
        await updateManoDeObra(seleccion.registro.id, {
          ciclo_id: seleccion.registro.ciclo_id,
          actividad_id: formulario.actividadId || null,
          fecha: formulario.fecha,
          nombre: formulario.nombre.trim(),
          descripcion: formulario.descripcion.trim() || null,
          num_jornales: Number(formulario.numJornales),
          valor_jornal: Number(formulario.valorJornal),
        });
      } else {
        await updateActividad(seleccion.registro.id, {
          ciclo_id: seleccion.registro.ciclo_id,
          nombre: formulario.nombre.trim(),
          tipo: formulario.tipo,
          fecha: formulario.fecha,
          descripcion: formulario.descripcion.trim() || null,
          otros_costos: formulario.otrosCostos === '' ? 0 : Number(formulario.otrosCostos),
        });
      }

      onMensaje('Registro actualizado correctamente');
      onClose();
    } catch (caughtError) {
      setErrorOperacion(mensajeError(caughtError, 'No se pudo actualizar el registro.'));
    } finally {
      setOperando(false);
    }
  };


  const confirmarEliminacion = async () => {
    try {
      setOperando(true);
      setErrorOperacion(null);

      if (seleccion.categoria === 'Insumo') {
        await deleteInsumo(seleccion.registro.id);
      } else if (seleccion.categoria === 'Jornal') {
        await deleteManoDeObra(seleccion.registro.id);
      } else {
        await deleteActividad(seleccion.registro.id);
      }

      onMensaje('Registro eliminado correctamente');
      onClose();
    } catch (caughtError) {
      setErrorOperacion(mensajeError(caughtError, 'No se pudo eliminar el registro.'));
    } finally {
      setOperando(false);
    }
  };

  const volverAFormulario = () => {
    setFormulario(formularioInicial(seleccion));
    setErrores({});
    setErrorOperacion(null);
    setVista('detalle');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/40"
        onClick={() => !operando && onClose()}
        aria-label="Cerrar detalles del registro"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalle-registro-title"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-xl border-b border-gray-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#2E7D32]">
              {vista === 'editar' ? `Editar ${seleccion.categoria}` : seleccion.categoria}
            </p>
            <h3 id="detalle-registro-title" className="mt-1 text-base font-semibold text-gray-900">
              {vista === 'editar' ? `Editar ${seleccion.registro.nombre}` : seleccion.registro.nombre}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={operando}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {vista === 'detalle' && (
          <div className="space-y-5 p-5">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">Fecha</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900 tnum">{formatDate(seleccion.registro.fecha)}</dd>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">Valor total</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900 tnum">{formatCOP(valorTotal)}</dd>
              </div>
              {campos.map((campo) => (
                <div key={campo.etiqueta} className="rounded-lg bg-gray-50 p-3">
                  <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">{campo.etiqueta}</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-gray-900">{campo.valor}</dd>
                </div>
              ))}
            </dl>

            <div>
              <h4 className="text-sm font-semibold text-gray-900">Descripción</h4>
              <p className="mt-2 whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-3 text-sm leading-relaxed text-gray-700">
                {seleccion.registro.descripcion ?? 'Sin descripción'}
              </p>
            </div>

            {errorOperacion && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorOperacion}</p>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setVista('confirmar')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
              <button
                type="button"
                onClick={() => setVista('editar')}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2E7D32] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#256628] focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:ring-offset-2"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
            </div>
          </div>
        )}



        {vista === 'editar' && (
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="editar-nombre" className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  id="editar-nombre"
                  value={formulario.nombre}
                  onChange={(event) => cambiarFormulario('nombre', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                />
                {errores.nombre && <p className="mt-1 text-xs text-red-500">Este campo es obligatorio</p>}
              </div>
              <div>
                <label htmlFor="editar-fecha" className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input
                  id="editar-fecha"
                  type="date"
                  value={formulario.fecha}
                  onChange={(event) => cambiarFormulario('fecha', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                />
                {errores.fecha && <p className="mt-1 text-xs text-red-500">Este campo es obligatorio</p>}
              </div>

              {seleccion.categoria === 'Insumo' && (
                <>
                  <div>
                    <label htmlFor="editar-cantidad" className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                    <input
                      id="editar-cantidad"
                      type="number"
                      min="0"
                      step="any"
                      value={formulario.cantidad}
                      onChange={(event) => cambiarFormulario('cantidad', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm tnum focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                    />
                    {errores.cantidad && <p className="mt-1 text-xs text-red-500">Debe ser mayor que cero</p>}
                  </div>
                  <div>
                    <label htmlFor="editar-unidad" className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                    <select
                      id="editar-unidad"
                      value={formulario.unidad}
                      onChange={(event) => cambiarFormulario('unidad', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                    >
                      {UNIDADES.map((unidad) => <option key={unidad} value={unidad}>{unidad}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="editar-costo-unitario" className="block text-sm font-medium text-gray-700 mb-1">Costo unitario (COP)</label>
                    <input
                      id="editar-costo-unitario"
                      type="number"
                      min="0"
                      step="any"
                      value={formulario.costoUnitario}
                      onChange={(event) => cambiarFormulario('costoUnitario', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm tnum focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                    />
                    {errores.costoUnitario && <p className="mt-1 text-xs text-red-500">Debe ser mayor que cero</p>}
                  </div>
                  <div>
                    <label htmlFor="editar-proveedor" className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                    <select
                      id="editar-proveedor"
                      value={formulario.proveedorId}
                      onChange={(event) => cambiarFormulario('proveedorId', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                    >
                      <option value="">Sin proveedor</option>
                      {data.proveedores.map((proveedor) => <option key={proveedor.id} value={proveedor.id}>{proveedor.nombre}</option>)}
                    </select>
                  </div>
                </>
              )}

              {seleccion.categoria === 'Jornal' && (
                <>
                  <div>
                    <label htmlFor="editar-num-jornales" className="block text-sm font-medium text-gray-700 mb-1">Número de jornales</label>
                    <input
                      id="editar-num-jornales"
                      type="number"
                      min="0"
                      step="any"
                      value={formulario.numJornales}
                      onChange={(event) => cambiarFormulario('numJornales', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm tnum focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                    />
                    {errores.numJornales && <p className="mt-1 text-xs text-red-500">Debe ser mayor que cero</p>}
                  </div>
                  <div>
                    <label htmlFor="editar-valor-jornal" className="block text-sm font-medium text-gray-700 mb-1">Valor del jornal (COP)</label>
                    <input
                      id="editar-valor-jornal"
                      type="number"
                      min="0"
                      step="any"
                      value={formulario.valorJornal}
                      onChange={(event) => cambiarFormulario('valorJornal', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm tnum focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                    />
                    {errores.valorJornal && <p className="mt-1 text-xs text-red-500">Debe ser mayor que cero</p>}
                  </div>
                </>
              )}

              {seleccion.categoria === 'Actividad' && (
                <>
                  <div>
                    <label htmlFor="editar-tipo-actividad" className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      id="editar-tipo-actividad"
                      value={formulario.tipo}
                      onChange={(event) => cambiarFormulario('tipo', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                    >
                      {TIPOS_ACTIVIDAD.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="editar-otros-costos" className="block text-sm font-medium text-gray-700 mb-1">Otros costos (COP)</label>
                    <input
                      id="editar-otros-costos"
                      type="number"
                      min="0"
                      step="any"
                      value={formulario.otrosCostos}
                      onChange={(event) => cambiarFormulario('otrosCostos', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm tnum focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                    />
                    {errores.otrosCostos && <p className="mt-1 text-xs text-red-500">No puede ser negativo</p>}
                  </div>
                </>
              )}

              {seleccion.categoria !== 'Actividad' && (
                <div className="sm:col-span-2">
                  <label htmlFor="editar-actividad" className="block text-sm font-medium text-gray-700 mb-1">Actividad asociada (opcional)</label>
                  <select
                    id="editar-actividad"
                    value={formulario.actividadId}
                    onChange={(event) => cambiarFormulario('actividadId', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                  >
                    <option value="">Sin actividad</option>
                    {actividadesCiclo.map((actividad) => <option key={actividad.id} value={actividad.id}>{actividad.nombre}</option>)}
                  </select>
                </div>
              )}

              <div className="sm:col-span-2">
                <label htmlFor="editar-descripcion" className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                <textarea
                  id="editar-descripcion"
                  value={formulario.descripcion}
                  onChange={(event) => cambiarFormulario('descripcion', event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                />
              </div>
            </div>

            {errorOperacion && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorOperacion}</p>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={volverAFormulario}
                disabled={operando}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void guardarEdicion()}
                disabled={operando}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2E7D32] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#256628] focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {operando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}



        {vista === 'confirmar' && (
          <div className="space-y-5 p-5">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
                <div>
                  <h4 className="text-sm font-semibold text-red-900">Confirmar eliminación</h4>
                  <p className="mt-1 text-sm leading-relaxed text-red-800">
                    ¿Seguro que deseas eliminar <strong>{seleccion.registro.nombre}</strong>? Esta acción no se puede deshacer.
                  </p>
                  {seleccion.categoria === 'Actividad' && (
                    <p className="mt-2 text-sm leading-relaxed text-red-800">
                      Los insumos y jornales asociados no se eliminarán; quedarán sin actividad asociada.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {errorOperacion && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorOperacion}</p>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setVista('detalle')}
                disabled={operando}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmarEliminacion()}
                disabled={operando}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {operando ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
