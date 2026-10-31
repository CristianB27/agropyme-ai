import { describe, expect, it } from 'vitest';
import {
  buscarRegistroRendimientoMaiz,
  calcularDiferenciaPorcentual,
  derivarSemestre,
} from '../src/utils/rendimientoMaiz.ts';

describe('semestre del ciclo de maíz', () => {
  it('deriva A para enero a junio y B para julio a diciembre', () => {
    expect(derivarSemestre('2026-01-15')).toBe('A');
    expect(derivarSemestre('2026-06-30')).toBe('A');
    expect(derivarSemestre('2026-07-01')).toBe('B');
    expect(derivarSemestre('2026-12-31')).toBe('B');
  });

  it('no deriva un semestre desde una fecha inválida', () => {
    expect(derivarSemestre('2026-13-01')).toBeNull();
    expect(derivarSemestre('2026-02-31')).toBeNull();
    expect(derivarSemestre('sin-fecha')).toBeNull();
  });
});

describe('búsqueda de referencia de rendimiento de maíz', () => {
  it('encuentra la combinación de municipio, sistema y semestre', () => {
    const registro = buscarRegistroRendimientoMaiz(
      '05002',
      'TRADICIONAL',
      'A',
    );

    expect(registro).toBeDefined();
    expect(registro?.municipio).toBe('ABEJORRAL');
    expect(registro?.departamento).toBe('ANTIOQUIA');
    expect(registro?.esperado_kg_ha).toBe(1453);
  });

  it('normaliza un cod_mun legacy de cuatro dígitos', () => {
    const registro = buscarRegistroRendimientoMaiz(
      '5002',
      'TRADICIONAL',
      'A',
    );

    expect(registro?.cod_mun).toBe('05002');
  });

  it('no encuentra una combinación que no existe', () => {
    expect(buscarRegistroRendimientoMaiz(
      '99999',
      'TECNIFICADO',
      'B',
    )).toBeUndefined();
  });

  it('no busca referencia cuando la finca no tiene cod_mun', () => {
    expect(buscarRegistroRendimientoMaiz(
      null,
      'TRADICIONAL',
      'A',
    )).toBeUndefined();
  });
});

describe('diferencia porcentual contra el rendimiento esperado', () => {
  it('calcula el porcentaje con signo respecto al esperado', () => {
    expect(calcularDiferenciaPorcentual(1200, 1000)).toBe(20);
    expect(calcularDiferenciaPorcentual(750, 1000)).toBe(-25);
  });

  it('no calcula diferencia sin un valor válido', () => {
    expect(calcularDiferenciaPorcentual(null, 1000)).toBeNull();
    expect(calcularDiferenciaPorcentual(1000, 0)).toBeNull();
    expect(calcularDiferenciaPorcentual(1000, null)).toBeNull();
  });
});
