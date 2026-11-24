import { describe, expect, it } from 'vitest';
import { registrarToque, TOQUES_EASTER_EGG } from '../src/utils/easterEgg';

describe('easter egg del logo', () => {
  it('se activa con cinco toques seguidos y reinicia el conteo', () => {
    let toques: number[] = [];
    let activar = false;
    for (let i = 0; i < TOQUES_EASTER_EGG; i += 1) {
      ({ toques, activar } = registrarToque(toques, 1000 + i * 200));
    }
    expect(activar).toBe(true);
    expect(toques).toEqual([]);
  });

  it('no se activa con menos toques', () => {
    let toques: number[] = [];
    let activar = false;
    for (let i = 0; i < TOQUES_EASTER_EGG - 1; i += 1) {
      ({ toques, activar } = registrarToque(toques, 1000 + i * 200));
    }
    expect(activar).toBe(false);
    expect(toques).toHaveLength(TOQUES_EASTER_EGG - 1);
  });

  it('descarta los toques demasiado separados en el tiempo', () => {
    let toques: number[] = [];
    let activar = false;
    for (let i = 0; i < TOQUES_EASTER_EGG; i += 1) {
      ({ toques, activar } = registrarToque(toques, i * 1000));
    }
    expect(activar).toBe(false);
  });
});
