import type {
  ClimateSnapshot,
  CycleSummary,
  DataSummary,
  UserData,
} from "./types.ts";

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

function assertValorValido(valor: number, nombre: string): void {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error(`${nombre} debe ser mayor que cero.`);
  }
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

  const Q = entradas.cosechas.reduce(
    (sum, cosecha) => sum + cosecha.cantidadKg,
    0,
  );
  const Qv = entradas.ventas.reduce(
    (sum, venta) => sum + venta.cantidadKg,
    0,
  );
  if (Qv > Q) {
    throw new Error("Las ventas no pueden superar la cosecha del ciclo.");
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
