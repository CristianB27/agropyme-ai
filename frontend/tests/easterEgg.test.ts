import { describe, expect, it } from 'vitest';
import type { AppData } from '../src/types';
import { registrarToque, resumirCosechas, TOQUES_EASTER_EGG } from '../src/utils/easterEgg';

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

describe('resumen de cosechas del easter egg', () => {
  const u = 'u';
  const datos = (precio: number, jornal: number): AppData => ({
    proveedores: [],
    fincas: [{ id: 'f', user_id: u, nombre: 'Finca', municipio: 'M', cod_mun: null, latitud: 10, longitud: -75 }],
    lotes: [{ id: 'l', user_id: u, finca_id: 'f', nombre: 'Lote', area_ha: 1, municipio: 'M', cod_mun: null }],
    cultivos: [{ id: 'c', nombre: 'Maíz' }],
    ciclos_productivos: [{ id: 'ciclo', user_id: u, lote_id: 'l', cultivo_id: 'c', fecha_inicio: '2026-01-01', fecha_fin: null, estado: 'Activo' }],
    actividades: [],
    insumos: [],
    mano_de_obra: [{ id: 'm', user_id: u, ciclo_id: 'ciclo', actividad_id: null, fecha: '2026-02-01', nombre: 'Jornal', num_jornales: 10, valor_jornal: jornal, descripcion: null }],
    unidades: [],
    cosechas: [{ id: 'c1', user_id: u, ciclo_id: 'ciclo', fecha: '2026-05-01', cantidad: 1_000, unidad_id: 'kg', unidad: 'kg', cantidad_kg: 1_000, calidad: 'primera', descripcion: null }],
    ventas: [{ id: 'v1', user_id: u, ciclo_id: 'ciclo', fecha: '2026-05-02', cantidad: 1_000, unidad_id: 'kg', unidad: 'kg', cantidad_kg: 1_000, precio_unitario: precio, comprador: null, calidad: 'primera', tipo_comprador: 'cooperativa', estado_pago: 'pagado' }],
    salidas_produccion: [],
    clima: [],
  });

  it('reconoce cuando el productor va en ganancias', () => {
    const r = resumirCosechas(datos(1_500, 50_000));
    expect(r.kgCosechados).toBe(1_000);
    expect(r.margen).toBe(1_000_000);
    expect(r.enGanancias).toBe(true);
  });

  it('no marca ganancias cuando está en números rojos', () => {
    const r = resumirCosechas(datos(300, 50_000));
    expect(r.margen).toBe(-200_000);
    expect(r.enGanancias).toBe(false);
  });

  it('sin ciclos no hay ganancias', () => {
    const r = resumirCosechas({ ...datos(1, 1), ciclos_productivos: [] });
    expect(r).toEqual({ kgCosechados: 0, margen: 0, enGanancias: false });
  });
});
