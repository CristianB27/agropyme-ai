import {
  type CanonicalIntent,
  classifyQuestion,
  isUnsafeAgroAdvice,
  predictModel,
  resolveAssistantIntent,
} from "./model.ts";

interface ParityCase {
  text: string;
  probabilities: Record<CanonicalIntent, number>;
}

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

async function readBenchmark(
  name: string,
): Promise<[CanonicalIntent, string][]> {
  const text = await Deno.readTextFile(
    new URL(`./testdata/${name}`, import.meta.url),
  );
  return text.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    const [intent, question] = line.split("\t");
    return [intent as CanonicalIntent, question];
  });
}

function finalIntent(question: string): CanonicalIntent {
  return classifyQuestion(question);
}

Deno.test("el modelo TypeScript calcula las mismas probabilidades que Python", async () => {
  const fixture = JSON.parse(
    await Deno.readTextFile(
      new URL("./testdata/model_parity.json", import.meta.url),
    ),
  ) as { cases: ParityCase[] };
  assert(fixture.cases.length > 0, "El archivo de paridad está vacío");
  let maximumDifference = 0;
  for (const testCase of fixture.cases) {
    const prediction = predictModel(testCase.text);
    for (const [intent, expected] of Object.entries(testCase.probabilities)) {
      maximumDifference = Math.max(
        maximumDifference,
        Math.abs(
          prediction.probabilities[intent as CanonicalIntent] - expected,
        ),
      );
    }
  }
  assert(
    maximumDifference < 1e-9,
    `La diferencia máxima de probabilidad es ${maximumDifference}`,
  );
});

for (
  const [name, minimum] of [["benchmark_dev.tsv", 0.95], [
    "benchmark_final.tsv",
    0.9,
  ]] as const
) {
  Deno.test(`el asistente entiende preguntas redactadas libremente (${name})`, async () => {
    const rows = await readBenchmark(name);
    const failures = rows.filter(([intent, question]) =>
      finalIntent(question) !== intent
    );
    const accuracy = (rows.length - failures.length) / rows.length;
    assert(
      accuracy >= minimum,
      `Aciertos ${(accuracy * 100).toFixed(1)} % (< ${
        minimum * 100
      } %). Fallos:\n` +
        failures.map(([intent, question]) => `  ${intent}: ${question}`).join(
          "\n",
        ),
    );
  });
}

Deno.test("el resolver recupera intención para consultas naturales del frontend", () => {
  assertEquals(
    resolveAssistantIntent("¿Cuánto vendí?", "fuera_de_alcance"),
    "ingresos_ventas",
    "La consulta de ventas debe resolverse como ingresos por ventas.",
  );
  assertEquals(
    resolveAssistantIntent("¿Cuánto costaron los insumos?", "fuera_de_alcance"),
    "insumos",
    "La consulta de insumos debe resolverse como insumos.",
  );
  assertEquals(
    resolveAssistantIntent("¿Cuánto es por hectárea?", "fuera_de_alcance"),
    "costo_por_hectarea",
    "La consulta por superficie debe resolverse como costo por hectárea.",
  );
  assertEquals(
    resolveAssistantIntent(
      "¿Qué ciclo ha sido más rentable y cuál es el margen sobre ventas?",
      "comparar_ciclos",
    ),
    "rentabilidad",
    "La pregunta sobre el ciclo más rentable debe resolverse como rentabilidad.",
  );
  assertEquals(
    resolveAssistantIntent(
      "Compara la rentabilidad de mis dos ciclos",
      "comparar_ciclos",
    ),
    "comparar_ciclos",
    "Una comparación explícita debe conservarse como comparación de ciclos.",
  );
});

Deno.test("el veto server-side bloquea dosis y conserva consultas históricas", () => {
  assert(
    isUnsafeAgroAdvice("¿Qué dosis de urea debo aplicar al maíz?"),
    "Debe bloquear una consulta de dosis.",
  );
  assert(
    isUnsafeAgroAdvice("Recomiéndame un herbicida para la maleza."),
    "Debe bloquear una recomendación de herbicida.",
  );
  assert(
    !isUnsafeAgroAdvice("¿Cuánto gasté en urea durante el ciclo?"),
    "No debe bloquear una consulta histórica de gasto.",
  );
});
