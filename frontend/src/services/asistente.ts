import { supabase } from '../lib/supabase';
import type { ClimaFinca } from '../types';

export interface AsistenteHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AsistenteResult {
  answer: string;
  source: 'anthropic' | 'fallback';
  notice?: string;
}

async function functionErrorMessage(error: unknown): Promise<string> {
  const candidate = error as { message?: string; context?: unknown };
  if (candidate.context instanceof Response) {
    try {
      const payload = await candidate.context.clone().json() as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
    } catch {
      // Se usa el mensaje genérico si la respuesta no contiene JSON.
    }
  }
  return candidate.message?.trim() || 'No se pudo contactar al asistente.';
}

export async function invokeAsistente(
  question: string,
  history: AsistenteHistoryMessage[],
  clima: ClimaFinca[],
): Promise<AsistenteResult> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');
  }

  const { data, error } = await supabase.functions.invoke<AsistenteResult>('asistente', {
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body: {
      question,
      history,
      clima,
    },
  });

  if (error) throw new Error(await functionErrorMessage(error));
  if (!data?.answer?.trim()) throw new Error('El asistente no devolvió una respuesta válida.');
  return data;
}
