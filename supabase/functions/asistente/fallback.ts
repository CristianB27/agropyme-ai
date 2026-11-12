import {
  type CanonicalIntent,
  isUnsafeAgroAdvice,
  predictModel,
  resolveAssistantIntent,
} from "./model.ts";
import type { CycleSummary, DataSummary } from "./types.ts";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatPercent(value: number | null): string {
  return value === null
    ? "no disponible"
    : `${percentFormatter.format(value * 100)} %`;
}

function formatCurrency(value: number | null): string {
  return value === null ? "no disponible" : currencyFormatter.format(value);
}

function cycleMatchesQuestion(
  cycle: CycleSummary,
  normalizedQuestion: string,
): number {
  return [cycle.cultivo, cycle.lote, cycle.finca].reduce((score, candidate) => {
    const normalizedCandidate = normalize(candidate);
    return score +
      (normalizedCandidate && normalizedQuestion.includes(normalizedCandidate)
        ? normalizedCandidate.length
        : 0);
  }, 0);
}

function selectCycle(
  summary: DataSummary,
  question: string,
): CycleSummary | undefined {
  const normalizedQuestion = normalize(question);
  const matches = summary.ciclos
    .map((cycle) => ({
      cycle,
      score: cycleMatchesQuestion(cycle, normalizedQuestion),
    }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score);

  if (matches[0]) return matches[0].cycle;
  return [...summary.ciclos].sort((left, right) =>
    right.fechaInicio.localeCompare(left.fechaInicio)
  )[0];
}

function findFarm(summary: DataSummary, question: string) {
  const normalizedQuestion = normalize(question);
  return summary.fincas.find((farm) => {
    const normalizedName = normalize(farm.nombre);
    return normalizedName && normalizedQuestion.includes(normalizedName);
  }) ?? summary.fincas[0];
}

function answerCost(cycle: CycleSummary | undefined): string {
  if (!cycle) {
    return "No tienes ciclos productivos registrados, así que todavía no puedo calcular costos de producción.";
  }
  const perKg = cycle.costoUnitario === null
    ? ""
    : ` El costo unitario de producción es ${
      decimalFormatter.format(cycle.costoUnitario)
    } COP por kg.`;
  const partial = cycle.Qnv > 0
    ? cycle.Qv > 0
      ? " La cosecha está parcialmente vendida, por lo que los indicadores realizados son parciales."
      : " La cosecha aún no tiene ventas registradas, por lo que los indicadores realizados son parciales."
    : "";
  return `El ciclo de ${cycle.cultivo} en ${cycle.lote} (${cycle.finca}) tiene un costo total de ${
    currencyFormatter.format(cycle.costoTotal)
  }: insumos ${currencyFormatter.format(cycle.costoInsumos)}, jornales ${
    currencyFormatter.format(cycle.costoJornales)
  } y otros costos ${
    currencyFormatter.format(cycle.costoOtros)
  }. El costo por hectárea es ${
    currencyFormatter.format(cycle.costoPorHectarea)
  }.${perKg}${partial}`;
}

function answerProfitability(summary: DataSummary, question: string): string {
  const cyclesWithSales = summary.ciclos.filter((cycle) =>
    cycle.ingresosRealizados > 0
  );
  if (cyclesWithSales.length === 0) {
    return "Todavía no hay ventas registradas en tus ciclos, por lo que el margen realizado, el margen sobre ventas y la rentabilidad sobre costos no están disponibles.";
  }

  const mentioned = [...cyclesWithSales]
    .map((cycle) => ({
      cycle,
      score: cycleMatchesQuestion(cycle, normalize(question)),
    }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.cycle;
  const best = mentioned ??
    [...cyclesWithSales].sort((left, right) =>
      (right.rentabilidadSobreCostos ?? Number.NEGATIVE_INFINITY) -
      (left.rentabilidadSobreCostos ?? Number.NEGATIVE_INFINITY)
    )[0];
  const partial = best.esParcial
    ? ` Quedan ${
      decimalFormatter.format(best.Qnv)
    } kg sin vender, así que el margen realizado, el margen sobre ventas y la rentabilidad sobre costos son parciales.`
    : "";
  const cycleDescription = mentioned
    ? `El ciclo de ${best.cultivo} en ${best.lote} (${best.finca})`
    : `El ciclo con mayor rentabilidad sobre costos es ${best.cultivo} en ${best.lote} (${best.finca})`;
  return `${cycleDescription}: ingresos realizados ${
    currencyFormatter.format(best.ingresosRealizados)
  }, costo total ${
    currencyFormatter.format(best.costoTotal)
  }, costo de lo vendido ${
    formatCurrency(best.costoDeLoVendido)
  } y margen realizado ${
    formatCurrency(best.margenRealizado)
  }. La rentabilidad sobre costos es ${
    formatPercent(best.rentabilidadSobreCostos)
  } y el margen sobre ventas es ${
    formatPercent(best.margenSobreVentas)
  }.${partial}`;
}

function answerLabor(cycle: CycleSummary | undefined): string {
  if (!cycle) {
    return "No tienes ciclos productivos registrados, así que todavía no hay jornales para consultar.";
  }
  const detail = cycle.manoDeObra.length > 0
    ? ` Distribución: ${
      cycle.manoDeObra.map((item) =>
        `${item.tipo} (${decimalFormatter.format(item.jornales)} jornales, ${
          currencyFormatter.format(item.costo)
        })`
      ).join("; ")
    }.`
    : "";
  return `En el ciclo de ${cycle.cultivo} en ${cycle.lote} registraste ${
    decimalFormatter.format(cycle.jornales)
  } jornales por un total de ${
    currencyFormatter.format(cycle.costoJornales)
  }.${detail}`;
}

function answerInputs(cycle: CycleSummary | undefined): string {
  if (!cycle) {
    return "No tienes ciclos productivos registrados, así que todavía no hay insumos para consultar.";
  }
  if (cycle.insumos.length === 0) {
    return `El ciclo de ${cycle.cultivo} en ${cycle.lote} no tiene insumos registrados.`;
  }
  const detail = cycle.insumos.map((item) =>
    `${item.nombre} (${decimalFormatter.format(item.cantidad)}, ${
      currencyFormatter.format(item.costo)
    })`
  ).join("; ");
  return `En el ciclo de ${cycle.cultivo} en ${cycle.lote} el gasto en insumos es ${
    currencyFormatter.format(cycle.costoInsumos)
  }. Detalle: ${detail}.`;
}

function answerCostPerHectarea(cycle: CycleSummary | undefined): string {
  if (!cycle) {
    return "No tienes ciclos productivos registrados, así que todavía no puedo calcular el costo por hectárea.";
  }
  return `El costo por hectárea del ciclo de ${cycle.cultivo} en ${cycle.lote} (${cycle.finca}) es ${
    currencyFormatter.format(cycle.costoPorHectarea)
  } por ${decimalFormatter.format(cycle.areaHa)} ha.`;
}

function answerUnitCost(cycle: CycleSummary | undefined): string {
  if (!cycle) {
    return "No tienes ciclos productivos registrados, así que todavía no puedo calcular el costo unitario.";
  }
  if (cycle.costoUnitario === null) {
    return `El ciclo de ${cycle.cultivo} en ${cycle.lote} no tiene producción cosechada para calcular el costo por kg.`;
  }
  return `El costo unitario del ciclo de ${cycle.cultivo} en ${cycle.lote} (${cycle.finca}) es ${
    decimalFormatter.format(cycle.costoUnitario)
  } COP por kg.`;
}

/** Describe lo que salió sin venderse: autoconsumo, semilla, donación y pérdidas. */
function describeNonSales(cycle: CycleSummary): string {
  const parts: string[] = [];
  if (cycle.QusoPropio > 0) {
    parts.push(`${decimalFormatter.format(cycle.QusoPropio)} kg para uso propio (hogar, animales, semilla o regalo)`);
  }
  if (cycle.Qperdida > 0) {
    parts.push(`${decimalFormatter.format(cycle.Qperdida)} kg perdidos`);
  }
  return parts.length > 0 ? ` Además salieron sin venderse ${parts.join(" y ")}.` : "";
}

function answerSales(cycle: CycleSummary | undefined): string {
  if (!cycle) {
    return "No tienes ciclos productivos registrados, así que todavía no puedo consultar las ventas.";
  }
  const partial = cycle.esParcial
    ? ` Quedan ${decimalFormatter.format(cycle.Qnv)} kg sin vender.`
    : "";
  const average = cycle.precioPromedioVenta !== null
    ? ` El precio promedio fue ${currencyFormatter.format(cycle.precioPromedioVenta)} por kg.`
    : "";
  const pending = cycle.ingresosPorCobrar > 0
    ? ` De ese valor, ${currencyFormatter.format(cycle.ingresosPorCobrar)} están por cobrar.`
    : "";
  return `En el ciclo de ${cycle.cultivo} en ${cycle.lote} (${cycle.finca}) los ingresos realizados por ventas son ${
    currencyFormatter.format(cycle.ingresosRealizados)
  } y se vendieron ${decimalFormatter.format(cycle.Qv)} kg.${average}${pending}${partial}`;
}

function answerProduction(cycle: CycleSummary | undefined): string {
  if (!cycle) {
    return "No tienes ciclos productivos registrados, así que todavía no puedo consultar la producción.";
  }
  const partial = cycle.esParcial
    ? "Los indicadores realizados son parciales porque todavía queda cosecha sin vender."
    : cycle.QusoPropio > 0 || cycle.Qperdida > 0
    ? "No queda producción en bodega: todo se vendió o tuvo otro destino."
    : "La cosecha está totalmente vendida.";
  return `En el ciclo de ${cycle.cultivo} en ${cycle.lote} (${cycle.finca}) se cosecharon ${
    decimalFormatter.format(cycle.Q)
  } kg, se vendieron ${decimalFormatter.format(cycle.Qv)} kg y quedan ${
    decimalFormatter.format(cycle.Qnv)
  } kg sin vender.${describeNonSales(cycle)} ${partial}`;
}

function answerComparison(summary: DataSummary, question: string): string {
  const normalized = normalize(question);
  const mentioned = summary.ciclos.filter((cycle) =>
    cycleMatchesQuestion(cycle, normalized) > 0
  );
  const selected = mentioned.length >= 2 ? mentioned : [...summary.ciclos]
    .sort((left, right) => left.fechaInicio.localeCompare(right.fechaInicio))
    .slice(-2);
  if (selected.length === 0) {
    return "No tienes ciclos productivos registrados para comparar.";
  }
  const details = selected.map((cycle) =>
    `${cycle.cultivo} en ${cycle.lote} (${cycle.finca}): costo total ${
      currencyFormatter.format(cycle.costoTotal)
    }, producción ${decimalFormatter.format(cycle.Q)} kg, vendido ${
      decimalFormatter.format(cycle.Qv)
    } kg y margen realizado ${formatCurrency(cycle.margenRealizado)}`
  ).join("; ");
  return `Comparación de ciclos: ${details}.`;
}

function answerIndicatorExplanation(): string {
  return "Q es el total cosechado, Qv el total vendido y Qnv = Q - Qv - salidas la producción que queda en bodega; las salidas son lo que se consumió, se dio a los animales, se guardó como semilla, se regaló o se perdió. El costo unitario es costo total dividido entre los kg aprovechables (Q menos pérdidas); el costo de lo vendido es costo unitario por Qv; el margen realizado es ingresos realizados menos costo de lo vendido; el margen sobre ventas divide el margen entre los ingresos, y la rentabilidad sobre costos divide el margen entre el costo de lo vendido.";
}

function answerHelp(): string {
  return "Hola. Puedo consultar costos, insumos, jornales, ventas, rentabilidad, producción, comparación de ciclos y clima de tus lotes. También puedo explicarte los indicadores del proyecto.";
}

function answerOutsideScope(): string {
  return "Esa consulta está fuera del alcance del asistente agrícola. Puedo ayudarte con costos, insumos, jornales, ventas, rentabilidad, producción, comparación de ciclos y clima de tus lotes.";
}

function answerClimate(summary: DataSummary, question: string): string {
  const farm = findFarm(summary, question);
  if (!farm) {
    return "No tienes fincas registradas, así que todavía no puedo consultar el clima.";
  }
  if (!farm.clima) return `No hay un pronóstico cargado para ${farm.nombre}.`;
  if (farm.clima.error) {
    return `No se pudo consultar el pronóstico de ${farm.nombre}: ${farm.clima.error}.`;
  }
  if (farm.clima.pronostico.length === 0) {
    return `No hay datos de pronóstico disponibles para ${farm.nombre}.`;
  }

  const rainiest =
    [...farm.clima.pronostico].sort((left, right) =>
      right.lluvia_mm - left.lluvia_mm
    )[0];
  const temperatureMax = Math.max(
    ...farm.clima.pronostico.map((day) => day.temp_max),
  );
  const temperatureMin = Math.min(
    ...farm.clima.pronostico.map((day) => day.temp_min),
  );
  const alert = farm.clima.alerta ? ` ${farm.clima.alerta}` : "";
  return `Para ${farm.nombre}, el pronóstico de 5 días indica temperaturas entre ${temperatureMin} °C y ${temperatureMax} °C. El día con mayor lluvia registrada es ${rainiest.dia}, con ${
    decimalFormatter.format(rainiest.lluvia_mm)
  } mm.${alert}`;
}

export function deterministicAnswer(
  question: string,
  summary: DataSummary,
  detectedIntent?: CanonicalIntent,
): string {
  const cycle = selectCycle(summary, question);
  const intent = detectedIntent ??
    resolveAssistantIntent(question, predictModel(question).intent);

  if (isUnsafeAgroAdvice(question)) return answerOutsideScope();

  switch (intent) {
    case "costo_total":
      return answerCost(cycle);
    case "costo_por_hectarea":
      return answerCostPerHectarea(cycle);
    case "costo_unitario":
      return answerUnitCost(cycle);
    case "jornales":
      return answerLabor(cycle);
    case "insumos":
      return answerInputs(cycle);
    case "ingresos_ventas":
      return answerSales(cycle);
    case "rentabilidad":
      return answerProfitability(summary, question);
    case "produccion_y_sin_vender":
      return answerProduction(cycle);
    case "comparar_ciclos":
      return answerComparison(summary, question);
    case "clima":
      return answerClimate(summary, question);
    case "explicar_indicador":
      return answerIndicatorExplanation();
    case "saludo_ayuda":
      return answerHelp();
    case "fuera_de_alcance":
      return answerOutsideScope();
  }
}
