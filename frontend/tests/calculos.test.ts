import { describe, expect, it } from 'vitest';
import {
  calcularCiclo,
  calcularIndicadoresCiclo,
  calcularResultadoProyectado,
  validarDatosCiclo,
} from '../src/utils/calculos.ts';
import type { AppData } from '../src/types.ts';

const userId = 'user-1';
const data: AppData = {
  proveedores: [],
  fincas: [{
    id: 'finca-1',
    user_id: userId,
    nombre: 'Hacienda El Roble',
    municipio: 'María la Baja',
    cod_mun: null,
    latitud: 9.98,
    longitud: -75.3,
  }],
  lotes: [{
    id: 'lote-1',
    user_id: userId,
    finca_id: 'finca-1',
    nombre: 'Lote Norte',
    area_ha: 2.5,
  }],
  cultivos: [{ id: 'cultivo-1', nombre: 'Maíz' }],
  ciclos_productivos: [{
    id: 'ciclo-1',
    user_id: userId,
    lote_id: 'lote-1',
    cultivo_id: 'cultivo-1',
    fecha_inicio: '2026-01-01',
    fecha_fin: null,
    estado: 'Activo',
  }],
  actividades: [{
    id: 'actividad-1',
    user_id: userId,
    ciclo_id: 'ciclo-1',
    tipo: 'Siembra',
    fecha: '2026-01-02',
    descripcion: 'Siembra de maíz',
    otros_costos: 2_000_000,
  }],
  insumos: [{
    id: 'insumo-1',
    user_id: userId,
    ciclo_id: 'ciclo-1',
    actividad_id: 'actividad-1',
    proveedor_id: null,
    fecha: '2026-01-02',
    nombre: 'Insumos del ciclo',
    cantidad: 1,
    unidad: 'bulto',
    costo_unitario: 3_466_000,
  }],
  mano_de_obra: [{
    id: 'jornal-1',
    user_id: userId,
    ciclo_id: 'ciclo-1',
    actividad_id: 'actividad-1',
    fecha: '2026-01-03',
    num_jornales: 22.6,
    valor_jornal: 150_000,
  }],
  unidades: [],
  cosechas: [{
    id: 'cosecha-1',
    user_id: userId,
    ciclo_id: 'ciclo-1',
    fecha: '2026-06-01',
    cantidad: 11_250,
    unidad_id: 'unidad-kg',
    unidad: 'kg',
    cantidad_kg: 11_250,
  }],
  ventas: [
    {
      id: 'venta-1',
      user_id: userId,
      ciclo_id: 'ciclo-1',
      fecha: '2026-06-02',
      cantidad: 4_000,
      unidad_id: 'unidad-kg',
      unidad: 'kg',
      cantidad_kg: 4_000,
      precio_unitario: 1_100,
      comprador: 'Mercado A',
    },
    {
      id: 'venta-2',
      user_id: userId,
      ciclo_id: 'ciclo-1',
      fecha: '2026-06-03',
      cantidad: 2_000,
      unidad_id: 'unidad-kg',
      unidad: 'kg',
      cantidad_kg: 2_000,
      precio_unitario: 1_100,
      comprador: 'Mercado B',
    },
    {
      id: 'venta-3',
      user_id: userId,
      ciclo_id: 'ciclo-1',
      fecha: '2026-06-04',
      cantidad: 4_500,
      unidad_id: 'unidad-kg',
      unidad: 'kg',
      cantidad_kg: 4_500,
      precio_unitario: 1_150,
      comprador: 'Mercado C',
    },
  ],
  clima: [],
};

describe('cálculo financiero de un ciclo', () => {
  it('usa el costo de lo vendido para el margen realizado del ejemplo', () => {
    const cycle = data.ciclos_productivos[0];
    const calc = calcularCiclo(data, cycle);

    expect(calc.costoInsumos).toBe(3_466_000);
    expect(calc.costoJornales).toBe(3_390_000);
    expect(calc.costoOtros).toBe(2_000_000);
    expect(calc.costoTotal).toBe(8_856_000);
    expect(calc.costoPorHectarea).toBe(3_542_400);
    expect(calc.Q).toBe(11_250);
    expect(calc.Qv).toBe(10_500);
    expect(calc.Qnv).toBe(750);
    expect(calc.ingresosRealizados).toBe(11_775_000);
    expect(calc.costoUnitario).toBeCloseTo(787.2, 10);
    expect(calc.costoDeLoVendido).toBeCloseTo(8_265_600, 6);
    expect(calc.margenRealizado).toBeCloseTo(3_509_400, 6);
    expect(calc.margenSobreVentas).toBeCloseTo(0.298038216561, 10);
    expect(calc.rentabilidadSobreCostos).toBeCloseTo(0.424578977933, 10);
    expect(calc.rendimiento).toBe(4_500);
    expect(calc.esParcial).toBe(true);
  });

  it('presenta el resultado proyectado como estimación', () => {
    const cycle = data.ciclos_productivos[0];
    const calc = calcularCiclo(data, cycle);

    expect(calcularResultadoProyectado(calc, 1_150)).toBe(3_781_500);
    expect(calcularResultadoProyectado(calc, 0)).toBeNull();
    expect(calcularResultadoProyectado(calc, -100)).toBeNull();
  });
});


describe('casos límite del cálculo financiero', () => {
  it('deja no disponible los indicadores dependientes cuando no hay cosecha', () => {
    const calc = calcularIndicadoresCiclo({
      areaHa: 2.5,
      costoInsumos: 1_000_000,
      costoJornales: 500_000,
      costoOtros: 0,
      cosechas: [],
      ventas: [],
    });

    expect(calc.Q).toBe(0);
    expect(calc.Qv).toBe(0);
    expect(calc.Qnv).toBe(0);
    expect(calc.costoUnitario).toBeNull();
    expect(calc.costoDeLoVendido).toBeNull();
    expect(calc.ingresosRealizados).toBe(0);
    expect(calc.margenRealizado).toBeNull();
    expect(calc.margenSobreVentas).toBeNull();
    expect(calc.rentabilidadSobreCostos).toBeNull();
    expect(calc.rendimiento).toBeNull();
    expect(calc.esParcial).toBe(false);
  });

  it('deja no disponible los indicadores de venta cuando no hay ventas', () => {
    const calc = calcularIndicadoresCiclo({
      areaHa: 2.5,
      costoInsumos: 1_000_000,
      costoJornales: 500_000,
      costoOtros: 0,
      cosechas: [{ cantidadKg: 11_250 }],
      ventas: [],
    });

    expect(calc.Q).toBe(11_250);
    expect(calc.Qv).toBe(0);
    expect(calc.Qnv).toBe(11_250);
    expect(calc.costoUnitario).toBeCloseTo(133.333333333, 8);
    expect(calc.costoDeLoVendido).toBeNull();
    expect(calc.margenRealizado).toBeNull();
    expect(calc.margenSobreVentas).toBeNull();
    expect(calc.rentabilidadSobreCostos).toBeNull();
    expect(calc.esParcial).toBe(true);
  });

  it('rechaza una venta que supera la cosecha', () => {
    expect(() => validarDatosCiclo({
      areaHa: 2.5,
      costoInsumos: 1_000_000,
      costoJornales: 500_000,
      costoOtros: 0,
      cosechas: [{ cantidadKg: 1_000 }],
      ventas: [{ cantidadKg: 1_001, precioUnitario: 1_100 }],
    })).toThrow('Las ventas no pueden superar la cosecha del ciclo.');
  });

  it('rechaza cantidades, precios y área no positivos', () => {
    const base = {
      areaHa: 2.5,
      costoInsumos: 1_000_000,
      costoJornales: 500_000,
      costoOtros: 0,
      cosechas: [{ cantidadKg: 1_000 }],
      ventas: [{ cantidadKg: 500, precioUnitario: 1_100 }],
    };

    expect(() => validarDatosCiclo({ ...base, areaHa: 0 })).toThrow(
      'El área del lote debe ser mayor que cero.',
    );
    expect(() => validarDatosCiclo({
      ...base,
      cosechas: [{ cantidadKg: 0 }],
    })).toThrow('La cantidad cosechada debe ser mayor que cero.');
    expect(() => validarDatosCiclo({
      ...base,
      ventas: [{ cantidadKg: 0, precioUnitario: 1_100 }],
    })).toThrow('La cantidad vendida debe ser mayor que cero.');
    expect(() => validarDatosCiclo({
      ...base,
      ventas: [{ cantidadKg: 500, precioUnitario: 0 }],
    })).toThrow('El precio de venta debe ser mayor que cero.');
  });

  it('no rotula como parcial un ciclo totalmente vendido', () => {
    const calc = calcularIndicadoresCiclo({
      areaHa: 2.5,
      costoInsumos: 1_000_000,
      costoJornales: 500_000,
      costoOtros: 0,
      cosechas: [{ cantidadKg: 11_250 }],
      ventas: [{ cantidadKg: 11_250, precioUnitario: 1_100 }],
    });

    expect(calc.Q).toBe(11_250);
    expect(calc.Qv).toBe(11_250);
    expect(calc.Qnv).toBe(0);
    expect(calc.esParcial).toBe(false);
    expect(calc.margenRealizado).not.toBeNull();
    expect(calc.margenSobreVentas).not.toBeNull();
    expect(calc.rentabilidadSobreCostos).not.toBeNull();
  });
});
