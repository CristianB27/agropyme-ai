import { askAnthropic } from "./anthropic.ts";
import { AuthenticationError, loadUserData } from "./data.ts";
import { deterministicAnswer } from "./fallback.ts";
import { buildDataSummary } from "./summary.ts";
import type {
  AssistantRequest,
  AssistantResponse,
  ClimateSnapshot,
} from "./types.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function isForecastDay(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const day = value as {
    dia?: unknown;
    temp_max?: unknown;
    temp_min?: unknown;
    lluvia_mm?: unknown;
  };

  return typeof day.dia === "string" && day.dia.trim().length > 0 &&
    day.dia.length <= 100 && typeof day.temp_max === "number" &&
    Number.isFinite(day.temp_max) && typeof day.temp_min === "number" &&
    Number.isFinite(day.temp_min) && typeof day.lluvia_mm === "number" &&
    Number.isFinite(day.lluvia_mm);
}

function isClimateSnapshot(value: unknown): value is ClimateSnapshot {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ClimateSnapshot>;
  return typeof item.finca_id === "string" && item.finca_id.length > 0 &&
    item.finca_id.length <= 100 && Array.isArray(item.pronostico) &&
    item.pronostico.length <= 5 && item.pronostico.every(isForecastDay) &&
    (item.alerta === null ||
      (typeof item.alerta === "string" && item.alerta.length <= 1_000)) &&
    (item.error === null || item.error === undefined ||
      (typeof item.error === "string" && item.error.length <= 1_000));
}

function parseRequest(body: unknown): AssistantRequest | null {
  if (!body || typeof body !== "object") return null;
  const candidate = body as Partial<AssistantRequest>;
  const question = typeof candidate.question === "string"
    ? candidate.question.trim()
    : "";
  if (!question || question.length > 2_000) return null;

  const history = Array.isArray(candidate.history)
    ? candidate.history
      .filter((message) =>
        message && (message.role === "user" || message.role === "assistant")
      )
      .filter((message) =>
        typeof message.content === "string" && message.content.length <= 4_000
      )
      .slice(-12)
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }))
    : [];

  const clima = Array.isArray(candidate.clima)
    ? candidate.clima.filter(isClimateSnapshot).slice(0, 100)
    : [];

  return { question, history, clima };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Método no permitido." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({
      error: "Debes iniciar sesión para usar el asistente.",
    }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({
      error: "El cuerpo de la solicitud no es JSON válido.",
    }, 400);
  }

  const parsed = parseRequest(body);
  if (!parsed) {
    return jsonResponse({
      error: "Escribe una pregunta válida de hasta 2.000 caracteres.",
    }, 400);
  }

  try {
    const accessToken = authorization.slice("Bearer ".length).trim();
    const userData = await loadUserData(accessToken);
    const summary = buildDataSummary(userData, parsed.clima);
    const anthropicAnswer = await askAnthropic(parsed, summary);

    if (anthropicAnswer) {
      const response: AssistantResponse = {
        answer: anthropicAnswer,
        source: "anthropic",
      };
      return jsonResponse(response);
    }

    const response: AssistantResponse = {
      answer: deterministicAnswer(parsed.question, summary),
      source: "fallback",
      notice:
        "La IA generativa no está configurada o no está disponible; la respuesta se calculó con tus datos reales.",
    };
    return jsonResponse(response);
  } catch (caughtError) {
    if (caughtError instanceof AuthenticationError) {
      return jsonResponse({ error: caughtError.message }, 401);
    }
    console.error("Error al atender la solicitud del asistente.", caughtError);
    return jsonResponse({
      error: "No se pudieron consultar tus datos en este momento.",
    }, 503);
  }
});
