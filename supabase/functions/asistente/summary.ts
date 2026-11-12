import type {
  ClimateSnapshot,
  CycleSummary,
  DataSummary,
  UserData,
} from "./types.ts";

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
  assertValorValido(entradas.areaHa, "El área del lote");
  entradas.cosechas.forEach((cosecha) =>
    assertValorValido(cosecha.cantidadKg, "La cantidad cosechada")
  );
  entradas.ventas.forEach((venta) => {
    assertValorValido(venta.cantidadKg, "La cantidad vendida");
    assertValorValido(venta.precioUnitario, "El precio de venta");
  });
  (entradas.salidas ?? []).forEach((salida) =>
    assertValorValido(salida.cantidadKg, "La cantidad de la salida")
  );

  const Q = sumarKg(entradas.cosechas);
  const Qv = sumarKg(entradas.ventas);
  const Qs = sumarKg(entradas.salidas ?? []);
  if (Qv > Q + TOLERANCIA_KG) {
    throw new Error("Las ventas no pueden superar la cosecha del ciclo.");
  }
  if (Qv + Qs > Q + TOLERANCIA_KG) {
    throw new Error(
      "Las ventas y salidas sin venta no pueden superar la cosecha del ciclo.",
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

export function calcularResultadoProyectado(
  ciclo: Pick<
    IndicadoresCiclo,
    "ingresosRealizados" | "Qnv" | "costoTotal"
  >,
  precioUnitarioEstimado: number,
): number | null {
  if (!Number.isFinite(precioUnitarioEstimado) || precioUnitarioEstimado <= 0) {
    return null;
  }
  return ciclo.ingresosRealizados +
    ciclo.Qnv * precioUnitarioEstimado - ciclo.costoTotal;
}

export function buildDataSummary(
  data: UserData,
  clima: ClimateSnapshot[] = [],
): DataSummary {
  const fincaById = new Map(data.fincas.map((finca) => [finca.id, finca]));
  const loteById = new Map(data.lotes.map((lote) => [lote.id, lote]));
  const cultivoById = new Map(
    data.cultivos.map((cultivo) => [cultivo.id, cultivo]),
  );
  const actividadById = new Map(
    data.actividades.map((actividad) => [actividad.id, actividad]),
  );
  const climaByFinca = new Map(clima.map((item) => [item.finca_id, item]));

  const ciclos: CycleSummary[] = data.ciclos.map((ciclo) => {
    const lote = loteById.get(ciclo.lote_id);
    const finca = lote ? fincaById.get(lote.finca_id) : undefined;
    const areaHa = lote?.area_ha ?? 0;

    const insumos = data.insumos.filter((insumo) =>
      insumo.ciclo_id === ciclo.id
    );
    const manoDeObra = data.manoDeObra.filter((registro) =>
      registro.ciclo_id === ciclo.id
    );
    const actividades = data.actividades.filter((actividad) =>
      actividad.ciclo_id === ciclo.id
    );
    const cosechas = data.cosechas.filter((cosecha) =>
      cosecha.ciclo_id === ciclo.id
    );
    const ventas = data.ventas.filter((venta) => venta.ciclo_id === ciclo.id);
    const salidas = (data.salidas ?? []).filter((salida) =>
      salida.ciclo_id === ciclo.id
    );

    const costoInsumos = insumos.reduce(
      (total, insumo) => total + insumo.cantidad * insumo.costo_unitario,
      0,
    );
    const costoJornales = manoDeObra.reduce(
      (total, registro) =>
        total + registro.num_jornales * registro.valor_jornal,
      0,
    );
    const costoOtros = actividades.reduce(
      (total, actividad) => total + actividad.otros_costos,
      0,
    );
    const indicadores = calcularIndicadoresCiclo({
      areaHa,
      costoInsumos,
      costoJornales,
      costoOtros,
      cosechas: cosechas.map((cosecha) => ({
        cantidadKg: cosecha.cantidad_kg,
      })),
      ventas: ventas.map((venta) => ({
        cantidadKg: venta.cantidad_kg,
        precioUnitario: venta.precio_unitario,
        porCobrar: venta.estado_pago === "por_cobrar",
      })),
      salidas: salidas.map((salida) => ({
        cantidadKg: salida.cantidad_kg,
        esPerdida: salida.tipo === "perdida",
      })),
    });
    const jornales = manoDeObra.reduce(
      (total, registro) => total + registro.num_jornales,
      0,
    );

    const laborPorTipo = new Map<string, { jornales: number; costo: number }>();
    for (const registro of manoDeObra) {
      const tipo = registro.actividad_id
        ? actividadById.get(registro.actividad_id)?.tipo || "Otra actividad"
        : "Sin actividad asignada";
      const actual = laborPorTipo.get(tipo) ?? { jornales: 0, costo: 0 };
      laborPorTipo.set(tipo, {
        jornales: actual.jornales + registro.num_jornales,
        costo: actual.costo + registro.num_jornales * registro.valor_jornal,
      });
    }

    return {
      id: ciclo.id,
      cultivo: cultivoById.get(ciclo.cultivo_id)?.nombre ||
        "Cultivo no identificado",
      lote: lote?.nombre || "Lote no identificado",
      finca: finca?.nombre || "Finca no identificada",
      municipio: finca?.municipio || "Municipio no identificado",
      areaHa,
      estado: ciclo.estado,
      fechaInicio: ciclo.fecha_inicio,
      costoInsumos,
      costoJornales,
      costoOtros,
      costoTotal: indicadores.costoTotal,
      costoPorHectarea: indicadores.costoPorHectarea,
      costoUnitario: indicadores.costoUnitario,
      Q: indicadores.Q,
      Qv: indicadores.Qv,
      Qnv: indicadores.Qnv,
      produccionKg: indicadores.Q,
      vendidoKg: indicadores.Qv,
      pendienteKg: indicadores.Qnv,
      ingresosRealizados: indicadores.ingresosRealizados,
      costoDeLoVendido: indicadores.costoDeLoVendido,
      margenRealizado: indicadores.margenRealizado,
      rentabilidadSobreCostos: indicadores.rentabilidadSobreCostos,
      margenSobreVentas: indicadores.margenSobreVentas,
      rendimiento: indicadores.rendimiento,
      jornales,
      esParcial: indicadores.esParcial,
      Qperdida: indicadores.Qperdida,
      QusoPropio: indicadores.QusoPropio,
      costoUsoPropio: indicadores.costoUsoPropio,
      ingresosPorCobrar: indicadores.ingresosPorCobrar,
      precioPromedioVenta: indicadores.precioPromedioVenta,
      insumos: insumos.map((insumo) => ({
        nombre: insumo.nombre,
        cantidad: insumo.cantidad,
        costo: insumo.cantidad * insumo.costo_unitario,
      })),
      manoDeObra: Array.from(
        laborPorTipo,
        ([tipo, values]) => ({ tipo, ...values }),
      ),
      actividades: actividades.map((actividad) => ({
        tipo: actividad.tipo,
        fecha: actividad.fecha,
        otrosCostos: actividad.otros_costos,
      })),
    };
  });

  const totales = ciclos.reduce(
    (total, ciclo) => ({
      costos: total.costos + ciclo.costoTotal,
      ingresos: total.ingresos + ciclo.ingresosRealizados,
      costoDeLoVendido: total.costoDeLoVendido +
        (ciclo.costoDeLoVendido ?? 0),
      margenRealizado: total.margenRealizado +
        (ciclo.margenRealizado ?? 0),
      produccionKg: total.produccionKg + ciclo.produccionKg,
      vendidoKg: total.vendidoKg + ciclo.vendidoKg,
    }),
    {
      costos: 0,
      ingresos: 0,
      costoDeLoVendido: 0,
      margenRealizado: 0,
      produccionKg: 0,
      vendidoKg: 0,
    },
  );

  return {
    fincas: data.fincas.map((finca) => ({
      id: finca.id,
      nombre: finca.nombre,
      municipio: finca.municipio,
      clima: climaByFinca.get(finca.id),
    })),
    ciclos,
    totales: {
      fincas: data.fincas.length,
      lotes: data.lotes.length,
      ciclos: data.ciclos.length,
      ...totales,
    },
  };
}
