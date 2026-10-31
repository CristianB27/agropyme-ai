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

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatPercent(value: number | null): string {
  return value === null
    ? "no calculable"
    : `${decimalFormatter.format(value * 100)} %`;
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
  const perKg = cycle.costoPorKg === null
    ? ""
    : ` El costo por kilogramo producido es ${
      decimalFormatter.format(cycle.costoPorKg)
    } COP.`;
  const partial = cycle.pendienteKg > 0
    ? cycle.vendidoKg > 0
      ? " La cosecha está parcialmente vendida, por lo que el resultado financiero aún es parcial."
      : " La cosecha aún no tiene ventas registradas, por lo que el resultado financiero aún es parcial."
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

function answerProfitability(summary: DataSummary): string {
  const cyclesWithSales = summary.ciclos.filter((cycle) =>
    cycle.ingresosRealizados > 0
  );
  if (cyclesWithSales.length === 0) {
    return "Todavía no hay ventas registradas en tus ciclos, por lo que aún no es posible calcular rentabilidad realizada.";
  }

  const best =
    [...cyclesWithSales].sort((left, right) =>
      right.utilidadRealizada - left.utilidadRealizada
    )[0];
  const partial = best.esParcial
    ? ` Quedan ${
      decimalFormatter.format(best.pendienteKg)
    } kg sin vender, así que la utilidad realizada es parcial.`
    : "";
  return `El ciclo con mayor utilidad realizada es ${best.cultivo} en ${best.lote} (${best.finca}): ingresos por ventas ${
    currencyFormatter.format(best.ingresosRealizados)
  }, costos ${currencyFormatter.format(best.costoTotal)} y utilidad ${
    currencyFormatter.format(best.utilidadRealizada)
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

function answerSummary(summary: DataSummary): string {
  if (summary.totales.ciclos === 0) {
    return `Tu cuenta todavía no tiene ciclos productivos. Tienes ${summary.totales.fincas} finca(s) y ${summary.totales.lotes} lote(s) registrados.`;
  }
  return `Tienes ${summary.totales.fincas} finca(s), ${summary.totales.lotes} lote(s) y ${summary.totales.ciclos} ciclo(s). Los costos registrados suman ${
    currencyFormatter.format(summary.totales.costos)
  }, los ingresos realizados ${
    currencyFormatter.format(summary.totales.ingresos)
  } y la utilidad realizada ${
    currencyFormatter.format(summary.totales.utilidad)
  }. Has producido ${
    decimalFormatter.format(summary.totales.produccionKg)
  } kg y vendido ${decimalFormatter.format(summary.totales.vendidoKg)} kg.`;
}

export function deterministicAnswer(
  question: string,
  summary: DataSummary,
): string {
  const normalized = normalize(question);
  const cycle = selectCycle(summary, question);

  if (
    normalized.includes("clima") || normalized.includes("lluvia") ||
    normalized.includes("pronostico") || normalized.includes("tiempo") ||
    normalized.includes("temperatura")
  ) {
    return answerClimate(summary, question);
  }
  if (
    normalized.includes("rentable") || normalized.includes("rentabilidad") ||
    normalized.includes("utilidad") || normalized.includes("ganancia") ||
    normalized.includes("margen")
  ) {
    return answerProfitability(summary);
  }
  if (
    normalized.includes("jornal") || normalized.includes("mano de obra") ||
    normalized.includes("trabajo")
  ) {
    return answerLabor(cycle);
  }
  if (
    normalized.includes("insumo") || normalized.includes("semilla") ||
    normalized.includes("fertilizante") || normalized.includes("herbicida") ||
    normalized.includes("urea")
  ) {
    return answerInputs(cycle);
  }
  if (
    normalized.includes("costo") || normalized.includes("coste") ||
    normalized.includes("cuanto") || normalized.includes("produccion")
  ) {
    return answerCost(cycle);
  }
  return answerSummary(summary);
}
