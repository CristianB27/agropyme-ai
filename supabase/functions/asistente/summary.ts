import type {
  ClimateSnapshot,
  CycleSummary,
  DataSummary,
  UserData,
} from "./types.ts";

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
    const costoTotal = costoInsumos + costoJornales + costoOtros;
    const produccionKg = cosechas.reduce(
      (total, cosecha) => total + cosecha.cantidad_kg,
      0,
    );
    const vendidoKg = ventas.reduce(
      (total, venta) => total + venta.cantidad_kg,
      0,
    );
    const pendienteKg = produccionKg - vendidoKg;
    const ingresosRealizados = ventas.reduce(
      (total, venta) => total + venta.cantidad_kg * venta.precio_unitario,
      0,
    );
    const utilidadRealizada = ingresosRealizados - costoTotal;
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
      costoTotal,
      costoPorHectarea: areaHa > 0 ? costoTotal / areaHa : 0,
      costoPorKg: produccionKg > 0 ? costoTotal / produccionKg : null,
      produccionKg,
      vendidoKg,
      pendienteKg,
      ingresosRealizados,
      utilidadRealizada,
      rentabilidadSobreCostos: costoTotal > 0
        ? utilidadRealizada / costoTotal
        : null,
      margenSobreVentas: ingresosRealizados > 0
        ? utilidadRealizada / ingresosRealizados
        : null,
      jornales,
      esParcial: pendienteKg > 0,
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
      utilidad: total.utilidad + ciclo.utilidadRealizada,
      produccionKg: total.produccionKg + ciclo.produccionKg,
      vendidoKg: total.vendidoKg + ciclo.vendidoKg,
    }),
    { costos: 0, ingresos: 0, utilidad: 0, produccionKg: 0, vendidoKg: 0 },
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
