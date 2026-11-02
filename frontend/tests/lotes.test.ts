import { describe, expect, it } from 'vitest';
import {
  calcularImpactoEliminacionLote,
  validarCamposLote,
} from '../src/utils/lotes.ts';
import type { AppData } from '../src/types.ts';

const usuario = 'user-1';

const data: AppData = {
  proveedores: [],
  fincas: [{
    id: 'finca-1',
    user_id: usuario,
    nombre: 'Finca principal',
    municipio: 'María la Baja',
    cod_mun: '50424',
    latitud: 9.98,
    longitud: -75.3,
  }],
  lotes: [{
    id: 'lote-1',
    user_id: usuario,
    finca_id: 'finca-1',
    nombre: 'Lote Norte',
    area_ha: 2.5,
    municipio: 'María la Baja',
    cod_mun: '50424',
  }],
  cultivos: [],
  ciclos_productivos: [
    {
      id: 'ciclo-1',
      user_id: usuario,
      lote_id: 'lote-1',
      cultivo_id: 'cultivo-1',
      fecha_inicio: '2026-01-01',
      fecha_fin: null,
      estado: 'Activo',
    },
    {
      id: 'ciclo-2',
      user_id: usuario,
      lote_id: 'lote-2',
      cultivo_id: 'cultivo-1',
      fecha_inicio: '2026-02-01',
      fecha_fin: null,
      estado: 'Activo',
    },
  ],
  actividades: [{
    id: 'actividad-1',
    user_id: usuario,
    ciclo_id: 'ciclo-1',
    nombre: 'Siembra',
    tipo: 'Siembra',
    tipo_personalizado: null,
    fecha: '2026-01-02',
    descripcion: null,
    otros_costos: 0,
  }],
  insumos: [{
    id: 'insumo-1',
    user_id: usuario,
    ciclo_id: 'ciclo-1',
    actividad_id: 'actividad-1',
    proveedor_id: null,
    fecha: '2026-01-02',
    nombre: 'Semilla',
    descripcion: null,
    cantidad: 1,
    unidad: 'kg',
    costo_unitario: 10_000,
  }],
  mano_de_obra: [{
    id: 'jornal-1',
    user_id: usuario,
    ciclo_id: 'ciclo-1',
    actividad_id: 'actividad-1',
    fecha: '2026-01-03',
    nombre: 'Siembra',
    descripcion: null,
    num_jornales: 1,
    valor_jornal: 50_000,
  }],
  unidades: [],
  cosechas: [{
    id: 'cosecha-1',
    user_id: usuario,
    ciclo_id: 'ciclo-1',
    fecha: '2026-06-01',
    cantidad: 1,
    unidad_id: 'unidad-1',
    unidad: 'kg',
    cantidad_kg: 1,
  }],
  ventas: [{
    id: 'venta-1',
    user_id: usuario,
    ciclo_id: 'ciclo-1',
    fecha: '2026-06-02',
    cantidad: 1,
    unidad_id: 'unidad-1',
    unidad: 'kg',
    cantidad_kg: 1,
    precio_unitario: 1000,
    comprador: null,
  }],
  clima: [],
};

describe('gestión de lotes', () => {
  it('exige nombre, área positiva y municipio', () => {
    expect(validarCamposLote({ nombre: ' ', areaHa: '0', municipio: '' })).toEqual({
      nombre: true,
      area_ha: true,
      municipio: true,
    });

    expect(validarCamposLote({ nombre: 'Lote Norte', areaHa: '2.5', municipio: 'María la Baja' })).toEqual({
      nombre: false,
      area_ha: false,
      municipio: false,
    });
  });

  it('cuenta únicamente los registros asociados al lote eliminado', () => {
    expect(calcularImpactoEliminacionLote(data, 'lote-1')).toEqual({
      ciclos: 1,
      actividades: 1,
      insumos: 1,
      jornales: 1,
      cosechas: 1,
      ventas: 1,
      totalRegistros: 6,
    });
  });
});
