export interface ErrorBaseDeDatos {
  code?: string;
  message?: string;
}

const UNIDADES_MASA = new Set(['kg', 'bulto', 'tonelada']);

export function esUnidadMasa(nombre: string): boolean {
  return UNIDADES_MASA.has(nombre.trim().toLowerCase());
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

export function validarVentaContraPendiente(cantidadVentaKg: number, pendienteKg: number): string | null {
  if (!Number.isFinite(cantidadVentaKg) || cantidadVentaKg <= 0) {
    return 'La cantidad de la venta debe ser mayor que cero.';
  }
  if (!Number.isFinite(pendienteKg) || pendienteKg < 0) {
    return 'No hay una cantidad pendiente válida en este ciclo.';
  }
  if (cantidadVentaKg > pendienteKg) {
    return `La venta supera lo pendiente de venta (${pendienteKg.toLocaleString('es-CO')} kg).`;
  }
  return null;
}

export function mensajeErrorCosechaVenta(error: unknown, fallback: string): string {
  const errorBase = error as ErrorBaseDeDatos | null;
  if (errorBase?.code === '23514') {
    return 'No se pudo guardar o eliminar el registro: las ventas del ciclo superarían la cosecha disponible.';
  }
  return error instanceof Error ? error.message : fallback;
}
