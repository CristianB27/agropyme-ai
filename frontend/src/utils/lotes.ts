import type { AppData } from '../types';

export interface DatosLoteFormulario {
  nombre: string;
  areaHa: string;
  municipio: string;
}

export interface ErroresLote {
  nombre: boolean;
  area_ha: boolean;
  municipio: boolean;
}

export interface ImpactoEliminacionLote {
  ciclos: number;
  actividades: number;
  insumos: number;
  jornales: number;
  cosechas: number;
  ventas: number;
  totalRegistros: number;
}

export function validarCamposLote(datos: DatosLoteFormulario): ErroresLote {
  const area = Number(datos.areaHa);

  return {
    nombre: datos.nombre.trim().length === 0,
    area_ha: datos.areaHa.trim().length === 0 || !Number.isFinite(area) || area <= 0,
    municipio: datos.municipio.trim().length === 0,
  };
}

export function calcularImpactoEliminacionLote(
  data: AppData,
  loteId: string,
): ImpactoEliminacionLote {
  const ciclos = data.ciclos_productivos.filter((ciclo) => ciclo.lote_id === loteId);
  const cicloIds = new Set(ciclos.map((ciclo) => ciclo.id));
  const actividades = data.actividades.filter((actividad) => cicloIds.has(actividad.ciclo_id)).length;
  const insumos = data.insumos.filter((insumo) => cicloIds.has(insumo.ciclo_id)).length;
  const jornales = data.mano_de_obra.filter((jornal) => cicloIds.has(jornal.ciclo_id)).length;
  const cosechas = data.cosechas.filter((cosecha) => cicloIds.has(cosecha.ciclo_id)).length;
  const ventas = data.ventas.filter((venta) => cicloIds.has(venta.ciclo_id)).length;

  return {
    ciclos: ciclos.length,
    actividades,
    insumos,
    jornales,
    cosechas,
    ventas,
    totalRegistros: ciclos.length + actividades + insumos + jornales + cosechas + ventas,
  };
}
