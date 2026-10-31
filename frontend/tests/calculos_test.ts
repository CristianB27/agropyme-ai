/* global Deno */
import {
  calcularCiclo,
  calcularResultadoProyectado,
} from '../src/utils/calculos.ts';
import type { AppData } from '../src/types.ts';

function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: esperado ${String(expected)}, obtenido ${String(actual)}`,
    );
  }
}

function assertAlmostEquals(
  actual: number,
  expected: number,
  message: string,
): void {
  if (Math.abs(actual - expected) > 0.000001) {
    throw new Error(
      `${message}: esperado ${String(expected)}, obtenido ${String(actual)}`,
    );
  }
}

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
    area_ha: 2,
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
    otros_costos: 1_356_000,
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
    costo_unitario: 6_000_000,
  }],
  mano_de_obra: [{
    id: 'jornal-1',
    user_id: userId,
    ciclo_id: 'ciclo-1',
    actividad_id: 'actividad-1',
    fecha: '2026-01-03',
    num_jornales: 10,
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
      cantidad: 9_000,
      unidad_id: 'unidad-kg',
      unidad: 'kg',
      cantidad_kg: 9_000,
      precio_unitario: 1_100,
      comprador: 'Mercado A',
    },
    {
      id: 'venta-2',
      user_id: userId,
      ciclo_id: 'ciclo-1',
      fecha: '2026-06-03',
      cantidad: 1_500,
      unidad_id: 'unidad-kg',
      unidad: 'kg',
      cantidad_kg: 1_500,
      precio_unitario: 1_250,
      comprador: 'Mercado B',
    },
  ],
  clima: [],
};

Deno.test('el cálculo del ciclo usa el costo de lo vendido para el margen realizado', () => {
  const cycle = data.ciclos_productivos[0];
  const calc = calcularCiclo(data, cycle);

  assertEquals(calc.costoTotal, 8_856_000, 'Costo total');
  assertEquals(calc.Q, 11_250, 'Producción Q');
  assertEquals(calc.Qv, 10_500, 'Vendido Qv');
  assertEquals(calc.Qnv, 750, 'Pendiente Qnv');
  assertEquals(calc.ingresosRealizados, 11_775_000, 'Ingresos realizados');
  assertAlmostEquals(calc.costoUnitario!, 787.2, 'Costo unitario C/Q');
  assertAlmostEquals(
    calc.costoDeLoVendido!,
    8_265_600,
    'Costo de lo vendido',
  );
  assertAlmostEquals(
    calc.margenRealizado!,
    3_509_400,
    'Margen realizado',
  );
  assertAlmostEquals(
    calc.margenSobreVentas!,
    0.298038216561,
    'Margen sobre ventas',
  );
  assertAlmostEquals(
    calc.rentabilidadSobreCostos!,
    0.424578977933,
    'Rentabilidad sobre costos',
  );
});

Deno.test('el resultado proyectado se calcula con el costo total y se estima aparte', () => {
  const cycle = data.ciclos_productivos[0];
  const calc = calcularCiclo(data, cycle);
  const projected = calcularResultadoProyectado(calc, 1_150);

  assertEquals(projected, 3_781_500, 'Resultado proyectado');
});
