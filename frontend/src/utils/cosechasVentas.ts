import type {
  CalidadProducto,
  EstadoPago,
  TipoComprador,
  TipoSalida,
  Unidad,
} from '../types';

export interface ErrorBaseDeDatos {
  code?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Catálogos de clasificación (deben coincidir con los CHECK de PostgreSQL).
// ---------------------------------------------------------------------------

export const CALIDADES: ReadonlyArray<{ valor: CalidadProducto; etiqueta: string; ayuda: string }> = [
  { valor: 'primera', etiqueta: 'Primera', ayuda: 'Producto de mejor tamaño y estado; recibe el mejor precio.' },
  { valor: 'segunda', etiqueta: 'Segunda', ayuda: 'Producto comercial con defectos menores.' },
  { valor: 'tercera', etiqueta: 'Tercera / descarte', ayuda: 'Producto pequeño o dañado que se vende barato.' },
  { valor: 'sin_clasificar', etiqueta: 'Sin clasificar', ayuda: 'Se cosechó o vendió todo junto, sin separar calidades.' },
];

export const TIPOS_COMPRADOR: ReadonlyArray<{ valor: TipoComprador; etiqueta: string }> = [
  { valor: 'intermediario', etiqueta: 'Intermediario / acopiador' },
  { valor: 'cooperativa', etiqueta: 'Cooperativa o asociación' },
  { valor: 'plaza_mercado', etiqueta: 'Plaza de mercado' },
  { valor: 'industria', etiqueta: 'Industria / agroindustria' },
  { valor: 'consumidor_final', etiqueta: 'Consumidor final' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export const ESTADOS_PAGO: ReadonlyArray<{ valor: EstadoPago; etiqueta: string }> = [
  { valor: 'pagado', etiqueta: 'Pagado' },
  { valor: 'por_cobrar', etiqueta: 'Por cobrar (fiado)' },
];

export const TIPOS_SALIDA: ReadonlyArray<{ valor: TipoSalida; etiqueta: string; ayuda: string }> = [
  { valor: 'autoconsumo', etiqueta: 'Consumo del hogar', ayuda: 'Lo que consume la familia.' },
  { valor: 'alimento_animal', etiqueta: 'Alimento para animales', ayuda: 'Lo que se da a los animales de la finca.' },
  { valor: 'semilla', etiqueta: 'Guardado para semilla', ayuda: 'Lo que se reserva para la próxima siembra.' },
  { valor: 'donacion', etiqueta: 'Regalo o donación', ayuda: 'Lo que se regala sin cobrar.' },
  { valor: 'perdida', etiqueta: 'Pérdida o daño', ayuda: 'Producto podrido, robado, dañado por plagas o clima.' },
];

function etiquetaDe<T extends string>(catalogo: ReadonlyArray<{ valor: T; etiqueta: string }>, valor: T | null | undefined): string {
  if (!valor) return '—';
  return catalogo.find((item) => item.valor === valor)?.etiqueta ?? valor;
}

export const etiquetaCalidad = (valor: CalidadProducto | null | undefined) => etiquetaDe(CALIDADES, valor);
export const etiquetaTipoComprador = (valor: TipoComprador | null | undefined) => etiquetaDe(TIPOS_COMPRADOR, valor);
export const etiquetaEstadoPago = (valor: EstadoPago | null | undefined) => etiquetaDe(ESTADOS_PAGO, valor);
export const etiquetaTipoSalida = (valor: TipoSalida | null | undefined) => etiquetaDe(TIPOS_SALIDA, valor);

// ---------------------------------------------------------------------------
// Unidades y conversiones.
// ---------------------------------------------------------------------------

const UNIDADES_MASA = new Set(['kg', 'arroba', 'bulto', 'tonelada']);

/**
 * Indica si una unidad es de peso. Usa la marca `es_masa` del catálogo y, si
 * la base todavía no tiene esa columna, el nombre de la unidad.
 */
export function esUnidadMasa(unidad: Pick<Unidad, 'nombre'> & { es_masa?: boolean }): boolean {
  if (unidad.es_masa) return true;
  return UNIDADES_MASA.has(unidad.nombre.trim().toLowerCase());
}

/** Ordena las unidades de peso de menor a mayor factor (kg, arroba, bulto, tonelada). */
export function unidadesDePeso(unidades: Unidad[]): Unidad[] {
  return unidades
    .filter((unidad) => esUnidadMasa(unidad))
    .sort((a, b) => a.factor_a_kg - b.factor_a_kg);
}

export function convertirCantidadAKg(cantidad: number, factorAKg: number): number {
  if (!Number.isFinite(cantidad) || !Number.isFinite(factorAKg) || factorAKg <= 0) {
    throw new Error('La cantidad y el factor de conversión deben ser válidos.');
  }
  return Math.round(cantidad * factorAKg * 10_000) / 10_000;
}

export function convertirPrecioACopPorKg(precioPorUnidad: number, factorAKg: number): number {
  if (!Number.isFinite(precioPorUnidad) || !Number.isFinite(factorAKg) || factorAKg <= 0) {
    throw new Error('El precio y el factor de conversión deben ser válidos.');
  }
  return Math.round((precioPorUnidad / factorAKg) * 100) / 100;
}

/** Inverso de `convertirPrecioACopPorKg`, para mostrar el precio en la unidad de la venta. */
export function convertirPrecioPorKgAUnidad(precioPorKg: number, factorAKg: number): number {
  return Math.round(precioPorKg * factorAKg * 100) / 100;
}

// ---------------------------------------------------------------------------
// Validaciones.
// ---------------------------------------------------------------------------

/**
 * Valida que una venta o salida no supere lo que queda en bodega. Al editar un
 * registro, `disponibleKg` debe incluir los kg que ese registro ya ocupaba.
 */
export function validarContraDisponible(
  cantidadKg: number,
  disponibleKg: number,
  operacion: 'venta' | 'salida' = 'venta',
): string | null {
  const sustantivo = operacion === 'venta' ? 'venta' : 'salida';
  if (!Number.isFinite(cantidadKg) || cantidadKg <= 0) {
    return `La cantidad de la ${sustantivo} debe ser mayor que cero.`;
  }
  if (!Number.isFinite(disponibleKg) || disponibleKg < 0) {
    return 'No hay una cantidad disponible válida en este ciclo.';
  }
  if (cantidadKg > disponibleKg + 1e-6) {
    if (disponibleKg === 0) {
      return `No hay producción disponible. Registra primero la cosecha antes de la ${sustantivo}.`;
    }
    return `La ${sustantivo} supera lo disponible en bodega (${disponibleKg.toLocaleString('es-CO')} kg).`;
  }
  return null;
}

/** Compatibilidad con la versión anterior: valida una venta contra lo pendiente. */
export function validarVentaContraPendiente(cantidadVentaKg: number, pendienteKg: number): string | null {
  if (!Number.isFinite(cantidadVentaKg) || cantidadVentaKg <= 0) {
    return 'La cantidad de la venta debe ser mayor que cero.';
  }
  if (!Number.isFinite(pendienteKg) || pendienteKg < 0) {
    return 'No hay una cantidad pendiente válida en este ciclo.';
  }
  if (cantidadVentaKg > pendienteKg + 1e-6) {
    return `La venta supera lo pendiente de venta (${pendienteKg.toLocaleString('es-CO')} kg).`;
  }
  return null;
}

export function mensajeErrorCosechaVenta(error: unknown, fallback: string): string {
  const errorBase = error as ErrorBaseDeDatos | null;
  if (errorBase?.code === '23514') {
    return 'No se pudo guardar o eliminar el registro: las ventas y salidas del ciclo superarían la cosecha disponible.';
  }
  if (errorBase?.code === '22023') {
    return errorBase.message ?? 'La unidad seleccionada no es una unidad de peso.';
  }
  return error instanceof Error ? error.message : fallback;
}
