import type { AppData } from '../types';
import { calcularCiclo } from './calculos';

/** Toques necesarios sobre el logo para abrir la sorpresa. */
export const TOQUES_EASTER_EGG = 5;
/** Tiempo máximo (ms) entre el primer y el último toque. */
export const VENTANA_EASTER_EGG_MS = 2500;

/**
 * Registra un toque sobre el logo. Devuelve los toques que siguen dentro de la
 * ventana de tiempo y si con este toque se completó la secuencia.
 */
export function registrarToque(
  toques: number[],
  ahora: number,
  necesarios = TOQUES_EASTER_EGG,
  ventanaMs = VENTANA_EASTER_EGG_MS,
): { toques: number[]; activar: boolean } {
  const recientes = [...toques, ahora].filter((t) => ahora - t <= ventanaMs);
  if (recientes.length >= necesarios) return { toques: [], activar: true };
  return { toques: recientes, activar: false };
}

/**
 * Resume todos los ciclos del productor para el easter egg: kilos cosechados
 * y margen realizado acumulado. Un ciclo con datos inválidos se omite.
 */
export function resumirCosechas(data: AppData): { kgCosechados: number; margen: number; enGanancias: boolean } {
  let kgCosechados = 0;
  let margen = 0;
  for (const ciclo of data.ciclos_productivos) {
    try {
      const calc = calcularCiclo(data, ciclo);
      kgCosechados += calc.Q;
      margen += calc.margenRealizado ?? 0;
    } catch {
      // Ciclo incompleto: no suma.
    }
  }
  return { kgCosechados, margen, enGanancias: margen > 0 };
}
