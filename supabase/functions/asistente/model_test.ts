import {
  type CanonicalIntent,
  isUnsafeAgroAdvice,
  predictModel,
  resolveAssistantIntent,
} from "./model.ts";

interface ParityCase {
  id: string;
  text: string;
  expectedIntent: CanonicalIntent;
  expectedProbabilities: number[];
}

interface ParityFixture {
  source: string;
  sourceSha256: string;
  cases: ParityCase[];
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

Deno.test("el modelo TypeScript conserva la paridad numérica de Python en dev", async () => {
  const fixtureUrl = new URL("./testdata/model_parity.json", import.meta.url);
  const fixture = JSON.parse(
    await Deno.readTextFile(fixtureUrl),
  ) as ParityFixture;
  let maximumDifference = 0;
  let intentMismatches = 0;

  for (const testCase of fixture.cases) {
    const prediction = predictModel(testCase.text);
    if (prediction.intent !== testCase.expectedIntent) intentMismatches += 1;
    for (
      let index = 0;
      index < testCase.expectedProbabilities.length;
      index += 1
    ) {
      const intent = Object.keys(
        prediction.probabilities,
      )[index] as CanonicalIntent;
      maximumDifference = Math.max(
        maximumDifference,
        Math.abs(
          prediction.probabilities[intent] -
            testCase.expectedProbabilities[index],
        ),
      );
    }
  }

  assert(
    intentMismatches === 6,
    `La accuracy top-1 cambió: hay ${intentMismatches} intenciones distintas`,
  );
  assert(
    fixture.cases.length - intentMismatches === 254,
    "La accuracy top-1 debe permanecer en 254/260 casos correctos",
  );
  assert(
    maximumDifference < 1e-12,
    `La diferencia máxima de probabilidad es ${maximumDifference}`,
  );
});

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
