export const TIPOS_ACTIVIDAD = [
  'Preparación de suelo', 'Siembra', 'Riego', 'Fertilización',
  'Deshierba', 'Control de plagas', 'Cosecha', 'Otra',
] as const;

export const TIPO_ACTIVIDAD_OTRA = 'Otra';

export function normalizarTipoPersonalizado(
  tipo: string,
  tipoPersonalizado: string,
): string | null {
  if (tipo !== TIPO_ACTIVIDAD_OTRA) return null;

  const valor = tipoPersonalizado.trim();
  return valor.length > 0 ? valor : null;
}
