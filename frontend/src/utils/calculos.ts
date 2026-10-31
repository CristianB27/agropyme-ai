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

export interface EntradasCalculoCiclo {
  areaHa: number;
  costoInsumos: number;
  costoJornales: number;
  costoOtros: number;
  cosechas: Array<{ cantidadKg: number }>;
  ventas: Array<{ cantidadKg: number; precioUnitario: number }>;
}

export interface IndicadoresCiclo {
  costoTotal: number;
  costoPorHectarea: number;
  Q: number;
  Qv: number;
  Qnv: number;
  costoUnitario: number | null;
  costoDeLoVendido: number | null;
  ingresosRealizados: number;
  margenRealizado: number | null;
  rentabilidadSobreCostos: number | null;
  margenSobreVentas: number | null;
  rendimiento: number | null;
  esParcial: boolean;
}

export interface CicloCalculo extends IndicadoresCiclo {
  costoInsumos: number;
  costoJornales: number;
  costoOtros: number;
  areaHa: number;
  unidad: string;
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

function assertValorValido(valor: number, nombre: string): void {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error(`${nombre} debe ser mayor que cero.`);
  }
}

export function validarDatosCiclo(entradas: EntradasCalculoCiclo): void {
  assertValorValido(entradas.areaHa, 'El área del lote');
  entradas.cosechas.forEach((cosecha) =>
    assertValorValido(cosecha.cantidadKg, 'La cantidad cosechada')
  );
  entradas.ventas.forEach((venta) => {
    assertValorValido(venta.cantidadKg, 'La cantidad vendida');
    assertValorValido(venta.precioUnitario, 'El precio de venta');
  });

  const Q = entradas.cosechas.reduce(
    (sum, cosecha) => sum + cosecha.cantidadKg,
    0,
  );
  const Qv = entradas.ventas.reduce(
    (sum, venta) => sum + venta.cantidadKg,
    0,
  );
  if (Qv > Q) {
    throw new Error('Las ventas no pueden superar la cosecha del ciclo.');
  }
}

export function calcularIndicadoresCiclo(
  entradas: EntradasCalculoCiclo,
): IndicadoresCiclo {
  validarDatosCiclo(entradas);

  const costoTotal = entradas.costoInsumos +
    entradas.costoJornales + entradas.costoOtros;
  const Q = entradas.cosechas.reduce(
    (sum, cosecha) => sum + cosecha.cantidadKg,
    0,
  );
  const Qv = entradas.ventas.reduce(
    (sum, venta) => sum + venta.cantidadKg,
    0,
  );
  const Qnv = Q - Qv;
  const ingresosRealizados = entradas.ventas.reduce(
    (sum, venta) => sum + venta.cantidadKg * venta.precioUnitario,
    0,
  );

  const costoUnitario = Q > 0 ? costoTotal / Q : null;
  const costoDeLoVendido = Qv > 0 && costoUnitario !== null
    ? costoUnitario * Qv
    : null;
  const margenRealizado = Qv > 0 && ingresosRealizados > 0 &&
      costoDeLoVendido !== null
    ? ingresosRealizados - costoDeLoVendido
    : null;
  const rentabilidadSobreCostos = margenRealizado !== null &&
      costoDeLoVendido !== null && costoDeLoVendido > 0
    ? margenRealizado / costoDeLoVendido
    : null;
  const margenSobreVentas = ingresosRealizados > 0 && margenRealizado !== null
    ? margenRealizado / ingresosRealizados
    : null;

  return {
    costoTotal,
    costoPorHectarea: entradas.areaHa > 0 ? costoTotal / entradas.areaHa : 0,
    Q,
    Qv,
    Qnv,
    costoUnitario,
    costoDeLoVendido,
    ingresosRealizados,
    margenRealizado,
    rentabilidadSobreCostos,
    margenSobreVentas,
    rendimiento: Q > 0 ? Q / entradas.areaHa : null,
    esParcial: Qnv > 0,
  };
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

  const cosechas = getCosechasByCiclo(data, ciclo.id);
  const ventas = getVentasByCiclo(data, ciclo.id);
  const indicadores = calcularIndicadoresCiclo({
    areaHa,
    costoInsumos,
    costoJornales,
    costoOtros,
    cosechas: cosechas.map((cosecha) => ({ cantidadKg: cosecha.cantidad_kg })),
    ventas: ventas.map((venta) => ({
      cantidadKg: venta.cantidad_kg,
      precioUnitario: venta.precio_unitario,
    })),
  });

  return {
    ...indicadores,
    costoInsumos,
    costoJornales,
    costoOtros,
    areaHa,
    unidad: cosechas[0]?.unidad ?? 'kg',
  };
}

export function calcularResultadoProyectado(
  calculo: Pick<CicloCalculo, 'ingresosRealizados' | 'Qnv' | 'costoTotal'>,
  precioUnitarioEstimado: number,
): number | null {
  if (!Number.isFinite(precioUnitarioEstimado) || precioUnitarioEstimado <= 0) {
    return null;
  }
  return calculo.ingresosRealizados +
    calculo.Qnv * precioUnitarioEstimado - calculo.costoTotal;
}

export function cicloLabel(data: AppData, ciclo: CicloProductivo): string {
  const cultivo = getCultivo(data, ciclo.cultivo_id);
  const lote = getLote(data, ciclo.lote_id);
  return `${cultivo?.nombre ?? '?'} · ${lote?.nombre ?? '?'} (${ciclo.estado})`;
}
