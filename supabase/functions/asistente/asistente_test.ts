import { deterministicAnswer } from "./fallback.ts";
import { buildDataSummary, calcularResultadoProyectado } from "./summary.ts";
import type { UserData } from "./types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

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

const userData: UserData = {
  fincas: [
    {
      id: "finca-1",
      nombre: "Hacienda El Roble",
      municipio: "María la Baja",
      latitud: 9.98,
      longitud: -75.3,
    },
    {
      id: "finca-2",
      nombre: "Finca La Ceiba",
      municipio: "Arjona",
      latitud: 10.25,
      longitud: -75.35,
    },
  ],
  lotes: [
    { id: "lote-1", finca_id: "finca-1", nombre: "Lote Norte", area_ha: 2 },
    { id: "lote-2", finca_id: "finca-2", nombre: "Lote Sur", area_ha: 1 },
  ],
  ciclos: [
    {
      id: "ciclo-1",
      lote_id: "lote-1",
      cultivo_id: "cultivo-1",
      fecha_inicio: "2026-01-01",
      fecha_fin: null,
      estado: "activo",
    },
    {
      id: "ciclo-2",
      lote_id: "lote-2",
      cultivo_id: "cultivo-2",
      fecha_inicio: "2026-02-01",
      fecha_fin: null,
      estado: "activo",
    },
  ],
  cultivos: [
    { id: "cultivo-1", nombre: "Maíz Crimea" },
    { id: "cultivo-2", nombre: "Yuca Real" },
  ],
  actividades: [
    {
      id: "actividad-1",
      ciclo_id: "ciclo-1",
      tipo: "Siembra",
      fecha: "2026-01-02",
      descripcion: "Siembra",
      otros_costos: 3000,
    },
    {
      id: "actividad-2",
      ciclo_id: "ciclo-2",
      tipo: "Siembra",
      fecha: "2026-02-02",
      descripcion: "Siembra",
      otros_costos: 4000,
    },
  ],
  insumos: [
    {
      id: "insumo-1",
      ciclo_id: "ciclo-1",
      actividad_id: "actividad-1",
      fecha: "2026-01-02",
      nombre: "Semilla Premium",
      cantidad: 10,
      costo_unitario: 20000,
    },
    {
      id: "insumo-2",
      ciclo_id: "ciclo-2",
      actividad_id: "actividad-2",
      fecha: "2026-02-02",
      nombre: "Fertilizante Plus",
      cantidad: 5,
      costo_unitario: 18000,
    },
  ],
  manoDeObra: [
    {
      id: "jornal-1",
      ciclo_id: "ciclo-1",
      actividad_id: "actividad-1",
      fecha: "2026-01-03",
      num_jornales: 3,
      valor_jornal: 50000,
    },
    {
      id: "jornal-2",
      ciclo_id: "ciclo-2",
      actividad_id: "actividad-2",
      fecha: "2026-02-03",
      num_jornales: 4,
      valor_jornal: 45000,
    },
  ],
  cosechas: [
    {
      id: "cosecha-1",
      ciclo_id: "ciclo-1",
      fecha: "2026-06-01",
      cantidad_kg: 500,
    },
    {
      id: "cosecha-2",
      ciclo_id: "ciclo-2",
      fecha: "2026-07-01",
      cantidad_kg: 700,
    },
  ],
  ventas: [
    {
      id: "venta-1",
      ciclo_id: "ciclo-1",
      fecha: "2026-06-02",
      cantidad_kg: 200,
      precio_unitario: 3000,
      comprador: "Mercado A",
    },
    {
      id: "venta-2",
      ciclo_id: "ciclo-2",
      fecha: "2026-07-02",
      cantidad_kg: 600,
      precio_unitario: 3500,
      comprador: "Mercado B",
    },
  ],
};

const ejemploUserData: UserData = {
  fincas: [{
    id: "finca-ejemplo",
    nombre: "Hacienda El Roble",
    municipio: "María la Baja",
    latitud: 9.98,
    longitud: -75.3,
  }],
  lotes: [{
    id: "lote-norte",
    finca_id: "finca-ejemplo",
    nombre: "Lote Norte",
    area_ha: 2,
  }],
  ciclos: [{
    id: "ciclo-maiz",
    lote_id: "lote-norte",
    cultivo_id: "cultivo-maiz",
    fecha_inicio: "2026-01-01",
    fecha_fin: null,
    estado: "activo",
  }],
  cultivos: [{ id: "cultivo-maiz", nombre: "Maíz" }],
  actividades: [{
    id: "actividad-siembra",
    ciclo_id: "ciclo-maiz",
    tipo: "Siembra",
    fecha: "2026-01-02",
    descripcion: "Siembra de maíz",
    otros_costos: 1_356_000,
  }],
  insumos: [{
    id: "insumo-ciclo",
    ciclo_id: "ciclo-maiz",
    actividad_id: "actividad-siembra",
    fecha: "2026-01-02",
    nombre: "Insumos del ciclo",
    cantidad: 1,
    costo_unitario: 6_000_000,
  }],
  manoDeObra: [{
    id: "jornal-ciclo",
    ciclo_id: "ciclo-maiz",
    actividad_id: "actividad-siembra",
    fecha: "2026-01-03",
    num_jornales: 10,
    valor_jornal: 150_000,
  }],
  cosechas: [{
    id: "cosecha-ciclo",
    ciclo_id: "ciclo-maiz",
    fecha: "2026-06-01",
    cantidad_kg: 11_250,
  }],
  ventas: [
    {
      id: "venta-ciclo-1",
      ciclo_id: "ciclo-maiz",
      fecha: "2026-06-02",
      cantidad_kg: 9_000,
      precio_unitario: 1_100,
      comprador: "Mercado A",
    },
    {
      id: "venta-ciclo-2",
      ciclo_id: "ciclo-maiz",
      fecha: "2026-06-03",
      cantidad_kg: 1_500,
      precio_unitario: 1_250,
      comprador: "Mercado B",
    },
  ],
};

Deno.test("el resumen consolida costos, producción, ingresos y margen por ciclo", () => {
  const summary = buildDataSummary(userData);
  const first = summary.ciclos.find((cycle) => cycle.id === "ciclo-1");
  const second = summary.ciclos.find((cycle) => cycle.id === "ciclo-2");

  assert(first, "Debe resumir el primer ciclo.");
  assert(second, "Debe resumir el segundo ciclo.");
  assertEquals(first.costoInsumos, 200000, "Costo de insumos del primer ciclo");
  assertEquals(
    first.costoJornales,
    150000,
    "Costo de jornales del primer ciclo",
  );
  assertEquals(first.costoOtros, 3000, "Otros costos del primer ciclo");
  assertEquals(first.costoTotal, 353000, "Costo total del primer ciclo");
  assertEquals(first.ingresosRealizados, 600000, "Ingresos del primer ciclo");
  assertEquals(first.costoUnitario, 706, "Costo unitario del primer ciclo");
  assertEquals(
    first.costoDeLoVendido,
    141200,
    "Costo de lo vendido del primer ciclo",
  );
  assertEquals(
    first.margenRealizado,
    458800,
    "Margen realizado del primer ciclo",
  );
  assertEquals(
    first.pendienteKg,
    300,
    "Kilogramos pendientes del primer ciclo",
  );
  assertEquals(summary.totales.costos, 627000, "Costo total consolidado");
  assertEquals(summary.totales.ingresos, 2700000, "Ingresos consolidados");
  assertAlmostEquals(
    summary.totales.costoDeLoVendido,
    376057.142857,
    "Costo de lo vendido consolidado",
  );
  assertAlmostEquals(
    summary.totales.margenRealizado,
    2323942.857143,
    "Margen realizado consolidado",
  );
});

Deno.test("el ciclo de ejemplo aplica el Paso 4 y proyecta el resultado estimado", () => {
  const summary = buildDataSummary(ejemploUserData);
  const cycle = summary.ciclos[0];

  assert(cycle, "Debe resumir el ciclo de maíz de Lote Norte.");
  assertEquals(cycle.costoTotal, 8_856_000, "Costo total del ciclo de ejemplo");
  assertEquals(cycle.produccionKg, 11_250, "Producción del ciclo de ejemplo");
  assertEquals(cycle.vendidoKg, 10_500, "Vendido del ciclo de ejemplo");
  assertEquals(cycle.pendienteKg, 750, "Pendiente del ciclo de ejemplo");
  assertEquals(
    cycle.ingresosRealizados,
    11_775_000,
    "Ingresos del ciclo de ejemplo",
  );
  assertAlmostEquals(
    cycle.costoUnitario!,
    787.2,
    "Costo unitario del ciclo de ejemplo",
  );
  assertAlmostEquals(
    cycle.costoDeLoVendido!,
    8_265_600,
    "Costo de lo vendido del ciclo de ejemplo",
  );
  assertAlmostEquals(
    cycle.margenRealizado!,
    3_509_400,
    "Margen realizado del ciclo de ejemplo",
  );
  assertAlmostEquals(
    cycle.margenSobreVentas!,
    0.298038216561,
    "Margen sobre ventas del ciclo de ejemplo",
  );
  assertAlmostEquals(
    cycle.rentabilidadSobreCostos!,
    0.424578977933,
    "Rentabilidad sobre costos del ciclo de ejemplo",
  );
  assertEquals(
    calcularResultadoProyectado(cycle, 1_150),
    3_781_500,
    "Resultado proyectado del ciclo de ejemplo",
  );

  const answer = deterministicAnswer(
    "¿Cuál es la rentabilidad y el margen sobre ventas del maíz de Lote Norte?",
    summary,
  );
  assert(answer.includes("Maíz"), "El fallback debe nombrar el maíz.");
  assert(answer.includes("Lote Norte"), "El fallback debe nombrar Lote Norte.");
  assert(
    answer.includes("8.265.600"),
    "El fallback debe mostrar el costo de lo vendido.",
  );
  assert(
    answer.includes("3.509.400"),
    "El fallback debe mostrar el margen realizado.",
  );
  assert(
    answer.includes("42,5 %"),
    "El fallback debe mostrar la rentabilidad del 42,5 %.",
  );
  assert(
    answer.includes("29,8 %"),
    "El fallback debe mostrar el margen sobre ventas del 29,8 %.",
  );
});

Deno.test("el fallback responde con el ciclo mencionado y sus datos consolidados", () => {
  const summary = buildDataSummary(userData);
  const answer = deterministicAnswer(
    "¿Cuánto costó producir Maíz Crimea en Lote Norte?",
    summary,
  );

  assert(answer.includes("Maíz Crimea"), "Debe nombrar el cultivo real.");
  assert(answer.includes("Lote Norte"), "Debe nombrar el lote real.");
  assert(answer.includes("Hacienda El Roble"), "Debe nombrar la finca real.");
  assert(answer.includes("353.000"), "Debe mostrar el costo total real.");
});

Deno.test("el fallback selecciona el ciclo con mayor rentabilidad sobre lo vendido", () => {
  const summary = buildDataSummary(userData);
  const answer = deterministicAnswer(
    "¿Qué ciclo ha sido más rentable y cuál es el margen sobre ventas?",
    summary,
  );

  assert(
    answer.includes("Yuca Real"),
    "Debe seleccionar el segundo ciclo por su mayor rentabilidad.",
  );
  assert(
    answer.includes("Lote Sur"),
    "Debe identificar el lote del ciclo más rentable.",
  );
  assert(
    answer.includes("Finca La Ceiba"),
    "Debe identificar la finca del ciclo más rentable.",
  );
});

Deno.test("el fallback usa el pronóstico asociado a la finca solicitada", () => {
  const summary = buildDataSummary(userData, [{
    finca_id: "finca-2",
    pronostico: [
      { dia: "Hoy", temp_max: 31, temp_min: 22, lluvia_mm: 45 },
      { dia: "Mañana", temp_max: 30, temp_min: 21, lluvia_mm: 2 },
    ],
    alerta: "Lluvia intensa prevista hoy (45 mm) en Finca La Ceiba.",
    error: null,
  }]);
  const answer = deterministicAnswer(
    "¿Cómo va el clima en Finca La Ceiba?",
    summary,
  );

  assert(
    answer.includes("Finca La Ceiba"),
    "Debe responder sobre la finca solicitada.",
  );
  assert(
    answer.includes("45 mm"),
    "Debe incluir la lluvia real del pronóstico.",
  );
});

Deno.test("el fallback distingue una cosecha sin ventas de una venta parcial", () => {
  const summary = buildDataSummary({
    ...userData,
    ventas: [],
  });
  const answer = deterministicAnswer(
    "¿Cuánto costó producir Maíz Crimea en Lote Norte?",
    summary,
  );

  assert(
    answer.includes("La cosecha aún no tiene ventas registradas"),
    "Debe informar que la cosecha todavía no tiene ventas.",
  );
  assert(
    !answer.includes("La cosecha está parcialmente vendida"),
    "No debe afirmar que existe una venta parcial cuando no hay ventas.",
  );
});

Deno.test("el fallback informa cuando el usuario todavía no tiene ciclos", () => {
  const summary = buildDataSummary({
    ...userData,
    lotes: [],
    ciclos: [],
    actividades: [],
    insumos: [],
    manoDeObra: [],
    cosechas: [],
    ventas: [],
  });
  const answer = deterministicAnswer("¿Cuánto he gastado en insumos?", summary);

  assert(
    answer.includes("No tienes ciclos productivos"),
    "Debe indicar que no hay ciclos.",
  );
});
