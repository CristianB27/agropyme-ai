import type { CanonicalIntent } from "./model.ts";
import type { AssistantRequest, DataSummary } from "./types.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5-5";
const REQUEST_TIMEOUT_MS = 30_000;

const INTENT_GUIDANCE: Record<CanonicalIntent, string> = {
  costo_total: "enfócate en el costo total y su composición",
  costo_por_hectarea: "enfócate en el costo por hectárea",
  costo_unitario: "enfócate en el costo unitario por kilogramo",
  jornales: "enfócate en jornales y mano de obra",
  insumos: "enfócate en insumos y su costo",
  ingresos_ventas: "enfócate en ventas realizadas e ingresos",
  rentabilidad: "enfócate en margen y rentabilidad sobre costos",
  produccion_y_sin_vender: "enfócate en producción, ventas y cosecha pendiente",
  comparar_ciclos: "compara explícitamente los ciclos solicitados",
  clima: "enfócate en el pronóstico de la finca solicitada",
  explicar_indicador: "explica las definiciones y fórmulas de los indicadores",
  saludo_ayuda: "presenta brevemente las consultas disponibles",
  fuera_de_alcance: "indica que la consulta está fuera del alcance",
};

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
}

function buildMessages(
  request: AssistantRequest,
): Array<{ role: "user" | "assistant"; content: string }> {
  const history = (request.history ?? [])
    .filter((message) =>
      message.role === "user" || message.role === "assistant"
    )
    .filter((message) => message.content.trim().length > 0)
    .slice(-10);

  const firstUserIndex = history.findIndex((message) =>
    message.role === "user"
  );
  const relevantHistory = firstUserIndex >= 0
    ? history.slice(firstUserIndex)
    : [];

  return [
    ...relevantHistory,
    { role: "user" as const, content: request.question },
  ];
}

export async function askAnthropic(
  request: AssistantRequest,
  summary: DataSummary,
  intent: CanonicalIntent,
): Promise<string | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")?.trim();
  if (!apiKey) return null;

  const model = Deno.env.get("ANTHROPIC_MODEL")?.trim() || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const system = [
    "Eres el asistente agrícola de AgroPyme AI.",
    "Responde siempre en español, con tono claro y profesional.",
    "Usa exclusivamente los datos reales del usuario incluidos en CONTEXT_DATOS.",
    "No inventes fincas, lotes, ciclos, cifras ni datos climáticos.",
    "Si el contexto no contiene la información solicitada, dilo claramente.",
    "Distingue entre costos, ingresos realizados y estimaciones.",
    "Usa exactamente las definiciones del contexto: Q es el total cosechado; Qv es el total vendido; Qnv = Q - Qv; costoUnitario = costoTotal / Q; costoDeLoVendido = costoUnitario * Qv; margenRealizado = ingresosRealizados - costoDeLoVendido; margenSobreVentas = margenRealizado / ingresosRealizados; rentabilidadSobreCostos = margenRealizado / costoDeLoVendido.",
    "No calcules el margen realizado como ingresosRealizados - costoTotal, porque ese costo incluye producción todavía no vendida.",
    "Si Q, Qv o ingresosRealizados son cero, presenta como no disponible cada indicador que dependa de esa base y nunca dividas por cero.",
    "Si esParcial es true, indica explícitamente que el margen realizado, el margen sobre ventas y la rentabilidad sobre costos son parciales porque todavía queda cosecha sin vender.",
    "Si presentas un resultado proyectado, usa resultadoProyectado = ingresosRealizados + Qnv * precioUnitarioEstimado - costoTotal y rotúlalo siempre como estimación, nunca como resultado realizado.",
    "Los números de pesos se presentan en COP y los pesos en kg.",
    "No presentes una recomendación agronómica como una decisión definitiva.",
    "Responde de forma concisa, normalmente en un máximo de cinco frases.",
    `La intención canónica clasificada de la consulta es "${intent}"; ${
      INTENT_GUIDANCE[intent]
    }.`,
  ].join(" ");

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        system: `${system}\n\nCONTEXT_DATOS:\n${JSON.stringify(summary)}`,
        messages: buildMessages(request),
      }),
    });

    if (!response.ok) {
      console.error(`Anthropic API respondió con estado ${response.status}.`);
      return null;
    }

    const payload = await response.json() as AnthropicResponse;
    const answer = (payload.content ?? [])
      .filter((block) =>
        block.type === "text" && typeof block.text === "string"
      )
      .map((block) => block.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n");

    return answer || null;
  } catch (caughtError) {
    console.error("No se pudo completar la consulta a Anthropic.", caughtError);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
