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
  SalidaProduccion,
  CalidadProducto,
  TipoSalida,
} from '../types.ts';

/** Tolerancia en kg para comparar sumas de valores decimales. */
const TOLERANCIA_KG = 1e-6;

function redondearKg(valor: number): number {
  return Math.round(valor * 10_000) / 10_000;
}

export interface EntradasCalculoCiclo {
  areaHa: number;
  costoInsumos: number;
  costoJornales: number;
  costoOtros: number;
  cosechas: Array<{ cantidadKg: number }>;
  ventas: Array<{
    cantidadKg: number;
    precioUnitario: number;
    porCobrar?: boolean;
  }>;
  /**
   * Producción que sale del ciclo sin venderse. `esPerdida` distingue las
   * pérdidas (producto que se dañó) del uso propio (autoconsumo, alimento
   * animal, semilla o donación).
   */
  salidas?: Array<{ cantidadKg: number; esPerdida: boolean }>;
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
  Qperdida: number;
  QusoPropio: number;
  costoUsoPropio: number | null;
  ingresosPorCobrar: number;
  precioPromedioVenta: number | null;
}

function assertValorValido(valor: number, nombre: string): void {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error(`${nombre} debe ser mayor que cero.`);
  }
}

function sumarKg(registros: Array<{ cantidadKg: number }>): number {
  return registros.reduce((sum, registro) => sum + registro.cantidadKg, 0);
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
  (entradas.salidas ?? []).forEach((salida) =>
    assertValorValido(salida.cantidadKg, 'La cantidad de la salida')
  );

  const Q = sumarKg(entradas.cosechas);
  const Qv = sumarKg(entradas.ventas);
  const Qs = sumarKg(entradas.salidas ?? []);
  if (Qv > Q + TOLERANCIA_KG) {
    throw new Error('Las ventas no pueden superar la cosecha del ciclo.');
  }
  if (Qv + Qs > Q + TOLERANCIA_KG) {
    throw new Error(
      'Las ventas y salidas sin venta no pueden superar la cosecha del ciclo.',
    );
  }
}

/**
 * Indicadores del ciclo. Todas las cantidades están en kg.
 *
 * - Q: cosechado. Qv: vendido. Qperdida: perdido. QusoPropio: autoconsumo,
 *   alimento animal, semilla o donación.
 * - Qnv = Q - Qv - Qperdida - QusoPropio: producción en bodega, pendiente de
 *   venta.
 * - Costo unitario = C / (Q - Qperdida): las pérdidas no se reparten como
 *   producto, encarecen cada kg aprovechable.
 * - Costo de lo vendido = costo unitario × Qv; costo del uso propio = costo
 *   unitario × QusoPropio.
 */
export function calcularIndicadoresCiclo(
  entradas: EntradasCalculoCiclo,
): IndicadoresCiclo {
  validarDatosCiclo(entradas);

  const salidas = entradas.salidas ?? [];
  const costoTotal = entradas.costoInsumos +
    entradas.costoJornales + entradas.costoOtros;
  const Q = sumarKg(entradas.cosechas);
  const Qv = sumarKg(entradas.ventas);
  const Qperdida = sumarKg(salidas.filter((salida) => salida.esPerdida));
  const QusoPropio = sumarKg(salidas.filter((salida) => !salida.esPerdida));
  const Qnv = Math.max(0, redondearKg(Q - Qv - Qperdida - QusoPropio));
  const Qaprovechable = Q - Qperdida;
  const ingresosRealizados = entradas.ventas.reduce(
    (sum, venta) => sum + venta.cantidadKg * venta.precioUnitario,
    0,
  );
  const ingresosPorCobrar = entradas.ventas
    .filter((venta) => venta.porCobrar === true)
    .reduce((sum, venta) => sum + venta.cantidadKg * venta.precioUnitario, 0);

  const costoUnitario = Qaprovechable > TOLERANCIA_KG
    ? costoTotal / Qaprovechable
    : null;
  const costoDeLoVendido = Qv > 0 && costoUnitario !== null
    ? costoUnitario * Qv
    : null;
  const costoUsoPropio = QusoPropio > 0 && costoUnitario !== null
    ? costoUnitario * QusoPropio
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
    Qperdida,
    QusoPropio,
    costoUsoPropio,
    ingresosPorCobrar,
    precioPromedioVenta: Qv > 0 ? ingresosRealizados / Qv : null,
  };
}

export interface CicloCalculo extends IndicadoresCiclo {
  costoInsumos: number;
  costoJornales: number;
  costoOtros: number;
  areaHa: number;
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

export function getSalidasByCiclo(data: AppData, cicloId: string): SalidaProduccion[] {
  return data.salidas_produccion.filter((s) => s.ciclo_id === cicloId);
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
  const salidas = getSalidasByCiclo(data, ciclo.id);
  const indicadores = calcularIndicadoresCiclo({
    areaHa,
    costoInsumos,
    costoJornales,
    costoOtros,
    cosechas: cosechas.map((cosecha) => ({ cantidadKg: cosecha.cantidad_kg })),
    ventas: ventas.map((venta) => ({
      cantidadKg: venta.cantidad_kg,
      precioUnitario: venta.precio_unitario,
      porCobrar: venta.estado_pago === 'por_cobrar',
    })),
    salidas: salidas.map((salida) => ({
      cantidadKg: salida.cantidad_kg,
      esPerdida: salida.tipo === 'perdida',
    })),
  });

  return {
    ...indicadores,
    costoInsumos,
    costoJornales,
    costoOtros,
    areaHa,
  };
}

export interface ResumenCalidad {
  calidad: CalidadProducto;
  cosechadoKg: number;
  vendidoKg: number;
  ingresos: number;
  precioPromedio: number | null;
}

/** Cosechado y vendido por calidad, con el precio promedio obtenido por kg. */
export function resumirPorCalidad(data: AppData, cicloId: string): ResumenCalidad[] {
  const porCalidad = new Map<CalidadProducto, ResumenCalidad>();
  const obtener = (calidad: CalidadProducto) => {
    const actual = porCalidad.get(calidad) ?? {
      calidad, cosechadoKg: 0, vendidoKg: 0, ingresos: 0, precioPromedio: null,
    };
    porCalidad.set(calidad, actual);
    return actual;
  };
  getCosechasByCiclo(data, cicloId).forEach((c) => { obtener(c.calidad).cosechadoKg += c.cantidad_kg; });
  getVentasByCiclo(data, cicloId).forEach((v) => {
    const fila = obtener(v.calidad);
    fila.vendidoKg += v.cantidad_kg;
    fila.ingresos += v.cantidad_kg * v.precio_unitario;
  });
  const orden: CalidadProducto[] = ['primera', 'segunda', 'tercera', 'sin_clasificar'];
  return orden
    .filter((calidad) => porCalidad.has(calidad))
    .map((calidad) => {
      const fila = porCalidad.get(calidad)!;
      return { ...fila, precioPromedio: fila.vendidoKg > 0 ? fila.ingresos / fila.vendidoKg : null };
    });
}

/** Kilos de salidas sin venta agrupados por tipo. */
export function resumirSalidasPorTipo(data: AppData, cicloId: string): Array<{ tipo: TipoSalida; kg: number }> {
  const porTipo = new Map<TipoSalida, number>();
  getSalidasByCiclo(data, cicloId).forEach((s) => {
    porTipo.set(s.tipo, (porTipo.get(s.tipo) ?? 0) + s.cantidad_kg);
  });
  return Array.from(porTipo, ([tipo, kg]) => ({ tipo, kg }));
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
  return `${cultivo?.nombre ?? '?'} · ${lote?.nombre ?? '?'} · ${ciclo.fecha_inicio} (${ciclo.estado})`;
}
