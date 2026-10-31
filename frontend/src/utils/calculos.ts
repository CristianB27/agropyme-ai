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
  Cosecha,
  Venta,
} from '../types.ts';

export interface CicloCalculo {
  costoInsumos: number;
  costoJornales: number;
  costoOtros: number;
  costoTotal: number;
  areaHa: number;
  costoPorHectarea: number;
  Q: number;
  Qv: number;
  Qnv: number;
  costoUnitario: number | null;
  costoDeLoVendido: number | null;
  rendimiento: number | null;
  ingresosRealizados: number;
  margenRealizado: number | null;
  rentabilidadSobreCostos: number | null;
  margenSobreVentas: number | null;
  unidad: string;
  esParcial: boolean;
}

export function getLote(data: AppData, loteId: string): Lote | undefined {
  return data.lotes.find((l) => l.id === loteId);
}

export function getFinca(data: AppData, fincaId: string): Finca | undefined {
  return data.fincas.find((f) => f.id === fincaId);
}

export function getCultivo(data: AppData, cultivoId: string): Cultivo | undefined {
  return data.cultivos.find((c) => c.id === cultivoId);
}

export function getProveedor(data: AppData, proveedorId: string): Proveedor | undefined {
  return data.proveedores.find((p) => p.id === proveedorId);
}

export function getActividadesByCiclo(data: AppData, cicloId: string): Actividad[] {
  return data.actividades.filter((a) => a.ciclo_id === cicloId);
}

export function getInsumosByCiclo(data: AppData, cicloId: string): Insumo[] {
  return data.insumos.filter((i) => i.ciclo_id === cicloId);
}

export function getManoDeObraByCiclo(data: AppData, cicloId: string): ManoDeObra[] {
  return data.mano_de_obra.filter((m) => m.ciclo_id === cicloId);
}

export function getCosechasByCiclo(data: AppData, cicloId: string): Cosecha[] {
  return data.cosechas.filter((c) => c.ciclo_id === cicloId);
}

export function getVentasByCiclo(data: AppData, cicloId: string): Venta[] {
  return data.ventas.filter((v) => v.ciclo_id === cicloId);
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

  const cosechas = getCosechasByCiclo(data, ciclo.id);
  const Q = cosechas.reduce((sum, c) => sum + c.cantidad_kg, 0);
  const unidad = cosechas[0]?.unidad ?? 'kg';

  const ventas = getVentasByCiclo(data, ciclo.id);
  const Qv = ventas.reduce((sum, v) => sum + v.cantidad_kg, 0);
  const Qnv = Q - Qv;

  const costoUnitario = Q > 0 ? costoTotal / Q : null;
  const costoDeLoVendido = costoUnitario !== null ? costoUnitario * Qv : null;
  const rendimiento = Q > 0 && areaHa > 0 ? Q / areaHa : null;

  const ingresosRealizados = ventas.reduce((sum, v) => sum + v.cantidad_kg * v.precio_unitario, 0);
  const margenRealizado = costoDeLoVendido !== null
    ? ingresosRealizados - costoDeLoVendido
    : null;
  const rentabilidadSobreCostos = costoDeLoVendido !== null && costoDeLoVendido > 0
    ? margenRealizado !== null ? margenRealizado / costoDeLoVendido : null
    : null;
  const margenSobreVentas = ingresosRealizados > 0 && margenRealizado !== null
    ? margenRealizado / ingresosRealizados
    : null;

  return {
    costoInsumos,
    costoJornales,
    costoOtros,
    costoTotal,
    areaHa,
    costoPorHectarea,
    Q,
    Qv,
    Qnv,
    costoUnitario,
    costoDeLoVendido,
    rendimiento,
    ingresosRealizados,
    margenRealizado,
    rentabilidadSobreCostos,
    margenSobreVentas,
    unidad,
    esParcial: Qnv > 0,
  };
}

export function calcularResultadoProyectado(
  calculo: Pick<CicloCalculo, 'ingresosRealizados' | 'Qnv' | 'costoTotal'>,
  precioUnitarioEstimado: number,
): number {
  return calculo.ingresosRealizados +
    calculo.Qnv * precioUnitarioEstimado - calculo.costoTotal;
}

export function cicloLabel(data: AppData, ciclo: CicloProductivo): string {
  const cultivo = getCultivo(data, ciclo.cultivo_id);
  const lote = getLote(data, ciclo.lote_id);
  return `${cultivo?.nombre ?? '?'} · ${lote?.nombre ?? '?'} (${ciclo.estado})`;
}
