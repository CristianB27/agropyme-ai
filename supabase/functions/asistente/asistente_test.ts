import { deterministicAnswer } from "./fallback.ts";
import { buildDataSummary } from "./summary.ts";
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

Deno.test("el resumen consolida costos, producción, ingresos y utilidad por ciclo", () => {
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
  assertEquals(first.utilidadRealizada, 247000, "Utilidad del primer ciclo");
  assertEquals(
    first.pendienteKg,
    300,
    "Kilogramos pendientes del primer ciclo",
  );
  assertEquals(summary.totales.costos, 627000, "Costo total consolidado");
  assertEquals(summary.totales.ingresos, 2700000, "Ingresos consolidados");
  assertEquals(summary.totales.utilidad, 2073000, "Utilidad consolidada");
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

Deno.test("el fallback selecciona el ciclo con mayor utilidad realizada", () => {
  const summary = buildDataSummary(userData);
  const answer = deterministicAnswer(
    "¿Qué ciclo ha sido más rentable y cuál es el margen sobre ventas?",
    summary,
  );

  assert(
    answer.includes("Yuca Real"),
    "Debe seleccionar el segundo ciclo por su mayor utilidad.",
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
