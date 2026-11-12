import { describe, expect, it } from 'vitest';
import type { AppData } from '../src/types.ts';
import {
  calcularCiclo,
  calcularIndicadoresCiclo,
  calcularResultadoProyectado,
  resumirPorCalidad,
  resumirSalidasPorTipo,
} from '../src/utils/calculos.ts';
import {
  convertirPrecioACopPorKg,
  convertirPrecioPorKgAUnidad,
  esUnidadMasa,
  unidadesDePeso,
  validarContraDisponible,
} from '../src/utils/cosechasVentas.ts';

const base = {
  areaHa: 2,
  costoInsumos: 600_000,
  costoJornales: 300_000,
  costoOtros: 0,
};

describe('salidas de producción sin venta', () => {
  it('descuenta autoconsumo y pérdidas de lo que queda en bodega', () => {
    const calc = calcularIndicadoresCiclo({
      ...base,
      cosechas: [{ cantidadKg: 1_000 }],
      ventas: [{ cantidadKg: 600, precioUnitario: 1_500 }],
      salidas: [
        { cantidadKg: 100, esPerdida: false },
        { cantidadKg: 100, esPerdida: true },
      ],
    });

    expect(calc.Q).toBe(1_000);
    expect(calc.Qv).toBe(600);
    expect(calc.QusoPropio).toBe(100);
    expect(calc.Qperdida).toBe(100);
    expect(calc.Qnv).toBe(200);
    expect(calc.esParcial).toBe(true);
  });

  it('reparte el costo entre los kg aprovechables cuando hay pérdidas', () => {
    const calc = calcularIndicadoresCiclo({
      ...base,
      cosechas: [{ cantidadKg: 1_000 }],
      ventas: [{ cantidadKg: 600, precioUnitario: 1_500 }],
      salidas: [
        { cantidadKg: 100, esPerdida: false },
        { cantidadKg: 100, esPerdida: true },
      ],
    });

    // C = 900.000; kg aprovechables = 1.000 - 100 perdidos = 900 → 1.000 COP/kg.
    expect(calc.costoUnitario).toBe(1_000);
    expect(calc.costoDeLoVendido).toBe(600_000);
    expect(calc.costoUsoPropio).toBe(100_000);
    expect(calc.ingresosRealizados).toBe(900_000);
    expect(calc.margenRealizado).toBe(300_000);
  });

  it('deja el ciclo completo (no parcial) cuando todo se vendió o tuvo otro destino', () => {
    const calc = calcularIndicadoresCiclo({
      ...base,
      cosechas: [{ cantidadKg: 1_000 }],
      ventas: [{ cantidadKg: 800, precioUnitario: 1_500 }],
      salidas: [
        { cantidadKg: 150, esPerdida: false },
        { cantidadKg: 50, esPerdida: true },
      ],
    });

    expect(calc.Qnv).toBe(0);
    expect(calc.esParcial).toBe(false);
    // Sin producto en bodega, la proyección coincide con ingresos menos costo total.
    expect(calcularResultadoProyectado(calc, 1_500)).toBe(1_200_000 - 900_000);
  });

  it('no valora a precio de venta lo que se consumió o se perdió', () => {
    const sinSalidas = calcularIndicadoresCiclo({
      ...base,
      cosechas: [{ cantidadKg: 1_000 }],
      ventas: [{ cantidadKg: 600, precioUnitario: 1_500 }],
    });
    const conSalidas = calcularIndicadoresCiclo({
      ...base,
      cosechas: [{ cantidadKg: 1_000 }],
      ventas: [{ cantidadKg: 600, precioUnitario: 1_500 }],
      salidas: [{ cantidadKg: 400, esPerdida: false }],
    });

    expect(calcularResultadoProyectado(sinSalidas, 1_500)).toBe(600_000);
    expect(calcularResultadoProyectado(conSalidas, 1_500)).toBe(0);
  });

  it('rechaza ventas y salidas que en conjunto superan la cosecha', () => {
    expect(() =>
      calcularIndicadoresCiclo({
        ...base,
        cosechas: [{ cantidadKg: 1_000 }],
        ventas: [{ cantidadKg: 900, precioUnitario: 1_500 }],
        salidas: [{ cantidadKg: 101, esPerdida: true }],
      }),
    ).toThrow('Las ventas y salidas sin venta no pueden superar la cosecha del ciclo.');
  });

  it('deja el costo unitario no disponible si toda la cosecha se perdió', () => {
    const calc = calcularIndicadoresCiclo({
      ...base,
      cosechas: [{ cantidadKg: 500 }],
      ventas: [],
      salidas: [{ cantidadKg: 500, esPerdida: true }],
    });

    expect(calc.costoUnitario).toBeNull();
    expect(calc.Qnv).toBe(0);
    expect(calc.esParcial).toBe(false);
  });
});

describe('ventas por cobrar y precio promedio', () => {
  it('separa lo cobrado de lo fiado y calcula el precio promedio por kg', () => {
    const calc = calcularIndicadoresCiclo({
      ...base,
      cosechas: [{ cantidadKg: 1_000 }],
      ventas: [
        { cantidadKg: 500, precioUnitario: 1_600 },
        { cantidadKg: 300, precioUnitario: 1_000, porCobrar: true },
      ],
    });

    expect(calc.ingresosRealizados).toBe(1_100_000);
    expect(calc.ingresosPorCobrar).toBe(300_000);
    expect(calc.precioPromedioVenta).toBe(1_375);
  });

  it('no tiene precio promedio si no hay ventas', () => {
    const calc = calcularIndicadoresCiclo({
      ...base,
      cosechas: [{ cantidadKg: 1_000 }],
      ventas: [],
    });
    expect(calc.precioPromedioVenta).toBeNull();
    expect(calc.ingresosPorCobrar).toBe(0);
  });
});

describe('resúmenes por calidad y por tipo de salida', () => {
  const userId = 'usuario';
  const data: AppData = {
    proveedores: [],
    fincas: [{ id: 'f', user_id: userId, nombre: 'Finca', municipio: 'M', cod_mun: null, latitud: 10, longitud: -75 }],
    lotes: [{ id: 'l', user_id: userId, finca_id: 'f', nombre: 'Lote', area_ha: 1, municipio: 'M', cod_mun: null }],
    cultivos: [{ id: 'c', nombre: 'Maíz' }],
    ciclos_productivos: [{
      id: 'ciclo', user_id: userId, lote_id: 'l', cultivo_id: 'c',
      fecha_inicio: '2026-01-01', fecha_fin: null, estado: 'Activo',
    }],
    actividades: [],
    insumos: [],
    mano_de_obra: [],
    unidades: [],
    cosechas: [
      { id: 'c1', user_id: userId, ciclo_id: 'ciclo', fecha: '2026-05-01', cantidad: 800, unidad_id: 'kg', unidad: 'kg', cantidad_kg: 800, calidad: 'primera', descripcion: null },
      { id: 'c2', user_id: userId, ciclo_id: 'ciclo', fecha: '2026-05-01', cantidad: 200, unidad_id: 'kg', unidad: 'kg', cantidad_kg: 200, calidad: 'segunda', descripcion: null },
    ],
    ventas: [
      { id: 'v1', user_id: userId, ciclo_id: 'ciclo', fecha: '2026-05-02', cantidad: 700, unidad_id: 'kg', unidad: 'kg', cantidad_kg: 700, precio_unitario: 1_500, comprador: null, calidad: 'primera', tipo_comprador: 'cooperativa', estado_pago: 'pagado' },
      { id: 'v2', user_id: userId, ciclo_id: 'ciclo', fecha: '2026-05-02', cantidad: 150, unidad_id: 'kg', unidad: 'kg', cantidad_kg: 150, precio_unitario: 900, comprador: null, calidad: 'segunda', tipo_comprador: 'intermediario', estado_pago: 'por_cobrar' },
    ],
    salidas_produccion: [
      { id: 's1', user_id: userId, ciclo_id: 'ciclo', fecha: '2026-05-03', tipo: 'autoconsumo', cantidad: 50, unidad_id: 'kg', unidad: 'kg', cantidad_kg: 50, descripcion: null },
      { id: 's2', user_id: userId, ciclo_id: 'ciclo', fecha: '2026-05-04', tipo: 'perdida', cantidad: 30, unidad_id: 'kg', unidad: 'kg', cantidad_kg: 30, descripcion: null },
      { id: 's3', user_id: userId, ciclo_id: 'ciclo', fecha: '2026-05-05', tipo: 'autoconsumo', cantidad: 20, unidad_id: 'kg', unidad: 'kg', cantidad_kg: 20, descripcion: null },
    ],
    clima: [],
  };

  it('agrupa cosechado, vendido y precio promedio por calidad', () => {
    expect(resumirPorCalidad(data, 'ciclo')).toEqual([
      { calidad: 'primera', cosechadoKg: 800, vendidoKg: 700, ingresos: 1_050_000, precioPromedio: 1_500 },
      { calidad: 'segunda', cosechadoKg: 200, vendidoKg: 150, ingresos: 135_000, precioPromedio: 900 },
    ]);
  });

  it('agrupa las salidas por tipo', () => {
    expect(resumirSalidasPorTipo(data, 'ciclo')).toEqual([
      { tipo: 'autoconsumo', kg: 70 },
      { tipo: 'perdida', kg: 30 },
    ]);
  });

  it('integra salidas y ventas por cobrar en el cálculo del ciclo', () => {
    const calc = calcularCiclo(data, data.ciclos_productivos[0]);
    expect(calc.Q).toBe(1_000);
    expect(calc.Qv).toBe(850);
    expect(calc.QusoPropio).toBe(70);
    expect(calc.Qperdida).toBe(30);
    expect(calc.Qnv).toBe(50);
    expect(calc.ingresosPorCobrar).toBe(135_000);
  });
});

describe('unidades y validaciones de producción', () => {
  it('sólo acepta unidades de peso y las ordena de menor a mayor', () => {
    const unidades = [
      { id: 't', nombre: 'tonelada', factor_a_kg: 1_000, es_masa: true },
      { id: 'u', nombre: 'unidad', factor_a_kg: 1, es_masa: false },
      { id: 'b', nombre: 'bulto', factor_a_kg: 50, es_masa: true },
      { id: 'a', nombre: 'arroba', factor_a_kg: 12.5, es_masa: true },
      { id: 'k', nombre: 'kg', factor_a_kg: 1, es_masa: true },
      { id: 'l', nombre: 'litro', factor_a_kg: 1, es_masa: false },
    ];
    expect(unidadesDePeso(unidades).map((u) => u.nombre)).toEqual(['kg', 'arroba', 'bulto', 'tonelada']);
    expect(esUnidadMasa({ nombre: 'litro', es_masa: false })).toBe(false);
    // Compatibilidad con una base sin la columna es_masa.
    expect(esUnidadMasa({ nombre: 'Bulto' })).toBe(true);
  });

  it('convierte el precio por arroba a COP/kg y de vuelta', () => {
    const porKg = convertirPrecioACopPorKg(20_000, 12.5);
    expect(porKg).toBe(1_600);
    expect(convertirPrecioPorKgAUnidad(porKg, 12.5)).toBe(20_000);
  });

  it('valida ventas y salidas contra lo disponible en bodega', () => {
    expect(validarContraDisponible(100, 100, 'venta')).toBeNull();
    expect(validarContraDisponible(101, 100, 'salida')).toBe(
      'La salida supera lo disponible en bodega (100 kg).',
    );
    expect(validarContraDisponible(10, 0, 'venta')).toBe(
      'No hay producción disponible. Registra primero la cosecha antes de la venta.',
    );
    expect(validarContraDisponible(0, 100, 'venta')).toBe('La cantidad de la venta debe ser mayor que cero.');
  });
});
