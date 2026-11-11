import { describe, expect, it } from 'vitest';
import {
  convertirCantidadAKg,
  convertirPrecioACopPorKg,
  mensajeErrorCosechaVenta,
  validarVentaContraPendiente,
} from '../src/utils/cosechasVentas.ts';

describe('conversiones de cosechas y ventas', () => {
  it('convierte la cantidad de la unidad elegida a kg', () => {
    expect(convertirCantidadAKg(2, 50)).toBe(100);
    expect(convertirCantidadAKg(1.5, 1000)).toBe(1500);
    expect(convertirCantidadAKg(11250, 1)).toBe(11250);
  });

  it('convierte el precio de la unidad elegida a COP por kg', () => {
    const cantidadKg = convertirCantidadAKg(2, 50);
    const precioPorKg = convertirPrecioACopPorKg(55_000, 50);

    expect(cantidadKg).toBe(100);
    expect(precioPorKg).toBe(1100);
  });
});

describe('validación y mensajes de cosechas y ventas', () => {
  it('rechaza una venta que supera lo pendiente de venta', () => {
    expect(validarVentaContraPendiente(751, 750)).toBe(
      'La venta supera lo pendiente de venta (750 kg).',
    );
    expect(validarVentaContraPendiente(750, 750)).toBeNull();
  });

  it('muestra un mensaje comprensible cuando PostgreSQL devuelve 23514', () => {
    const error = Object.assign(new Error('regla violated'), { code: '23514' });

    expect(mensajeErrorCosechaVenta(error, 'Mensaje genérico')).toBe(
      'No se pudo guardar o eliminar el registro: las ventas del ciclo superarían la cosecha disponible.',
    );
  });
});
