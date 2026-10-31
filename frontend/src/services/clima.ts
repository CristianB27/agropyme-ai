import type { ClimaFinca, Finca, PronosticoDia } from '../types';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

interface OpenMeteoResponse {
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
  };
  error?: boolean;
  reason?: string;
}

interface CacheEntry {
  expiresAt: number;
  value: ClimaFinca;
}

const cache = new Map<string, CacheEntry>();

const DAY_LABELS = ['Hoy', 'Mañana', 'En 2 días', 'En 3 días', 'En 4 días'];

function cacheKey(finca: Finca): string {
  return `${finca.id}:${finca.latitud.toFixed(4)},${finca.longitud.toFixed(4)}`;
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildAlert(finca: Finca, forecast: PronosticoDia[]): string | null {
  const intenseRainDay = forecast.find((day) => day.lluvia_mm >= 40);
  if (!intenseRainDay) return null;

  return `Lluvia intensa prevista ${intenseRainDay.dia.toLowerCase()} (${intenseRainDay.lluvia_mm} mm) en ${finca.nombre}. Revisa las labores programadas para ese día. Aviso informativo basado en el pronóstico para la ubicación de la finca; no es una recomendación agronómica.`;
}

function mapResponse(finca: Finca, payload: OpenMeteoResponse): ClimaFinca {
  const times = payload.daily?.time;
  const maxima = payload.daily?.temperature_2m_max;
  const minima = payload.daily?.temperature_2m_min;
  const precipitation = payload.daily?.precipitation_sum;

  if (!times || !maxima || !minima || !precipitation || times.length === 0) {
    throw new Error('Open-Meteo devolvió un pronóstico incompleto.');
  }

  const count = Math.min(5, times.length, maxima.length, minima.length, precipitation.length);
  const pronostico: PronosticoDia[] = Array.from({ length: count }, (_, index) => ({
    dia: DAY_LABELS[index] ?? times[index],
    temp_max: Math.round(numberValue(maxima[index])),
    temp_min: Math.round(numberValue(minima[index])),
    lluvia_mm: roundOneDecimal(numberValue(precipitation[index])),
  }));

  return {
    finca_id: finca.id,
    pronostico,
    alerta: buildAlert(finca, pronostico),
    error: null,
  };
}

async function requestForecast(finca: Finca): Promise<ClimaFinca> {
  const params = new URLSearchParams({
    latitude: String(finca.latitud),
    longitude: String(finca.longitud),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    forecast_days: '5',
    timezone: 'auto',
  });

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${OPEN_METEO_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo respondió con estado ${response.status}.`);
    }

    const payload = await response.json() as OpenMeteoResponse;
    if (payload.error) {
      throw new Error(payload.reason || 'Open-Meteo no pudo procesar la ubicación.');
    }

    return mapResponse(finca, payload);
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function loadClimaForFincas(fincas: Finca[]): Promise<ClimaFinca[]> {
  return Promise.all(fincas.map(async (finca) => {
    const key = cacheKey(finca);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.value, finca_id: finca.id };
    }

    try {
      const value = await requestForecast(finca);
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
      return value;
    } catch (caughtError) {
      const message = caughtError instanceof DOMException && caughtError.name === 'AbortError'
        ? 'El proveedor de clima no respondió a tiempo.'
        : caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo consultar el pronóstico.';

      return {
        finca_id: finca.id,
        pronostico: [],
        alerta: null,
        error: message,
      };
    }
  }));
}
