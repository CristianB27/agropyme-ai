import type {
  AppData,
  CicloProductivo,
  Lote,
  Cultivo,
  Finca,
  Proveedor,
  Actividad,
  Insumo,
  ManoDeObra,
  ProduccionVenta,
} from '../types';

export interface CicloCalculo {
  costoInsumos: number;
  costoJornales: number;
  costoOtros: number;
  costoTotal: number;
  areaHa: number;
  costoPorHectarea: number;
  produccionTotal: number;
  costoPorUnidad: number | null;
  rendimiento: number | null;
  ingresos: number;
  utilidad: number | null;
  rentabilidad: number | null;
  unidad: string;
}

export function getLote(data: AppData, loteId: number): Lote | undefined {
  return data.lotes.find((l) => l.id === loteId);
}

export function getFinca(data: AppData, fincaId: number): Finca | undefined {
  return data.fincas.find((f) => f.id === fincaId);
}

export function getCultivo(data: AppData, cultivoId: number): Cultivo | undefined {
  return data.cultivos.find((c) => c.id === cultivoId);
}

export function getProveedor(data: AppData, proveedorId: number): Proveedor | undefined {
  return data.proveedores.find((p) => p.id === proveedorId);
}

export function getActividadesByCiclo(data: AppData, cicloId: number): Actividad[] {
  return data.actividades.filter((a) => a.ciclo_id === cicloId);
}

export function getInsumosByCiclo(data: AppData, cicloId: number): Insumo[] {
  return data.insumos.filter((i) => i.ciclo_id === cicloId);
}

export function getManoDeObraByCiclo(data: AppData, cicloId: number): ManoDeObra[] {
  return data.mano_de_obra.filter((m) => m.ciclo_id === cicloId);
}

export function getProduccionByCiclo(data: AppData, cicloId: number): ProduccionVenta[] {
  return data.produccion_ventas.filter((p) => p.ciclo_id === cicloId);
}

export function calcularCiclo(data: AppData, ciclo: CicloProductivo): CicloCalculo {
  const lote = getLote(data, ciclo.lote_id);
  const areaHa = lote?.area_ha ?? 0;

  const insumos = getInsumosByCiclo(data, ciclo.id);
  const costoInsumos = insumos.reduce((sum, i) => sum + i.cantidad * i.costo_unitario, 0);

  const manoDeObra = getManoDeObraByCiclo(data, ciclo.id);
  const costoJornales = manoDeObra.reduce((sum, m) => sum + m.num_jornales * m.valor_jornal, 0);

  const actividades = getActividadesByCiclo(data, ciclo.id);
  const costoOtros = actividades.reduce((sum, a) => sum + a.otros_costos, 0);

  const costoTotal = costoInsumos + costoJornales + costoOtros;
  const costoPorHectarea = areaHa > 0 ? costoTotal / areaHa : 0;

  const produccion = getProduccionByCiclo(data, ciclo.id);
  const produccionTotal = produccion.reduce((sum, p) => sum + p.cantidad_producida, 0);
  const unidad = produccion[0]?.unidad ?? 'kg';

  const costoPorUnidad = produccionTotal > 0 ? costoTotal / produccionTotal : null;
  const rendimiento = produccionTotal > 0 && areaHa > 0 ? produccionTotal / areaHa : null;

  const ingresos = produccion.reduce((sum, p) => sum + p.cantidad_vendida * p.precio_unitario, 0);
  const utilidad = ingresos - costoTotal;
  const rentabilidad = costoTotal > 0 ? utilidad / costoTotal : null;

  return {
    costoInsumos,
    costoJornales,
    costoOtros,
    costoTotal,
    areaHa,
    costoPorHectarea,
    produccionTotal,
    costoPorUnidad,
    rendimiento,
    ingresos,
    utilidad,
    rentabilidad,
    unidad,
  };
}

export function cicloLabel(data: AppData, ciclo: CicloProductivo): string {
  const cultivo = getCultivo(data, ciclo.cultivo_id);
  const lote = getLote(data, ciclo.lote_id);
  return `${cultivo?.nombre ?? '?'} · ${lote?.nombre ?? '?'} (${ciclo.estado})`;
}
