import { describe, expect, it } from 'vitest';
import {
  normalizarTipoPersonalizado,
  TIPO_ACTIVIDAD_OTRA,
  TIPOS_ACTIVIDAD,
} from '../src/utils/actividades.ts';

describe('tipos de actividad', () => {
  it('incluye la categoría Otra', () => {
    expect(TIPOS_ACTIVIDAD).toContain(TIPO_ACTIVIDAD_OTRA);
  });

  it('guarda el tipo personalizado sin espacios sobrantes', () => {
    expect(normalizarTipoPersonalizado('Otra', '  Aplicación foliar  ')).toBe(
      'Aplicación foliar',
    );
  });

  it('convierte en null un tipo personalizado vacío', () => {
    expect(normalizarTipoPersonalizado('Otra', '   ')).toBeNull();
  });

  it('descarta el tipo personalizado cuando no aplica la categoría Otra', () => {
    expect(normalizarTipoPersonalizado('Riego', 'Aplicación foliar')).toBeNull();
  });
});
