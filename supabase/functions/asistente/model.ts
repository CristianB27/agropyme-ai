import { MODEL_DATA } from "./model_data.ts";

export type CanonicalIntent =
  | "costo_total"
  | "costo_por_hectarea"
  | "costo_unitario"
  | "jornales"
  | "insumos"
  | "ingresos_ventas"
  | "rentabilidad"
  | "produccion_y_sin_vender"
  | "comparar_ciclos"
  | "clima"
  | "explicar_indicador"
  | "saludo_ayuda"
  | "fuera_de_alcance";

export interface ModelPrediction {
  intent: CanonicalIntent;
  confidence: number;
  probabilities: Record<CanonicalIntent, number>;
}

/**
 * Clasificador de intenciones entrenado con scripts/asistente/entrenar.py:
 * TF-IDF de palabras (1-2) y de caracteres (3-5), cada bloque normalizado
 * por separado, y regresión logística multinomial. Replica la inferencia de
 * scikit-learn; testdata/model_parity.json comprueba que coincida.
 */
interface ModelData {
  version: number;
  trainingRows: number;
  classes: CanonicalIntent[];
  wordVocabulary: string[];
  wordIdf: string;
  charVocabulary: string[];
  charIdf: string;
  coefficients: string;
  intercepts: string;
}

const data = MODEL_DATA as unknown as ModelData;
const classes = data.classes;
const wordVocabulary = new Map(
  data.wordVocabulary.map((term, index) => [term, index]),
);
const charVocabulary = new Map(
  data.charVocabulary.map((term, index) => [term, index]),
);

function decodeFloat64(encoded: string, length: number): Float64Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const view = new DataView(bytes.buffer);
  const values = new Float64Array(length);
  for (let index = 0; index < length; index += 1) {
    values[index] = view.getFloat64(index * 8, true);
  }
  return values;
}

const featureCount = wordVocabulary.size + charVocabulary.size;
const wordIdf = decodeFloat64(data.wordIdf, wordVocabulary.size);
const charIdf = decodeFloat64(data.charIdf, charVocabulary.size);
const coefficients = decodeFloat64(
  data.coefficients,
  classes.length * featureCount,
);
const intercepts = decodeFloat64(data.intercepts, classes.length);

export function normalizeModelText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function wordTokens(normalized: string): string[] {
  const matches = normalized.match(/[\p{L}\p{N}_]+/gu) ?? [];
  return matches.filter((token) => [...token].length >= 2);
}

function wordNgrams(tokens: string[]): string[] {
  const result = [...tokens];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    result.push(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return result;
}

function charWbNgrams(normalized: string): string[] {
  const result: string[] = [];
  for (const word of normalized.split(/\s+/u)) {
    if (!word) continue;
    const characters = [...` ${word} `];
    for (let size = 3; size <= 5; size += 1) {
      let offset = 0;
      result.push(characters.slice(0, size).join(""));
      while (offset + size < characters.length) {
        offset += 1;
        result.push(characters.slice(offset, offset + size).join(""));
      }
      if (offset === 0) break;
    }
  }
  return result;
}

function weightedTfidf(
  terms: string[],
  vocabulary: Map<string, number>,
  idf: Float64Array,
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const term of terms) {
    const index = vocabulary.get(term);
    if (index !== undefined) counts.set(index, (counts.get(index) ?? 0) + 1);
  }
  const weighted = new Map<number, number>();
  let squaredNorm = 0;
  for (const [index, count] of counts) {
    const value = (1 + Math.log(count)) * idf[index];
    weighted.set(index, value);
    squaredNorm += value * value;
  }
  const norm = Math.sqrt(squaredNorm);
  if (norm > 0) {
    for (const [index, value] of weighted) weighted.set(index, value / norm);
  }
  return weighted;
}

export function predictModel(question: string): ModelPrediction {
  const normalized = normalizeModelText(question);
  const features = weightedTfidf(
    wordNgrams(wordTokens(normalized)),
    wordVocabulary,
    wordIdf,
  );
  const charFeatures = weightedTfidf(
    charWbNgrams(normalized),
    charVocabulary,
    charIdf,
  );
  for (const [index, value] of charFeatures) {
    features.set(wordVocabulary.size + index, value);
  }

  const scores = classes.map((_, classIndex) => {
    let score = intercepts[classIndex];
    const offset = classIndex * featureCount;
    for (const [index, value] of features) {
      score += coefficients[offset + index] * value;
    }
    return score;
  });
  const maximum = Math.max(...scores);
  const exponentials = scores.map((score) => Math.exp(score - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);

  const probabilities = {} as Record<CanonicalIntent, number>;
  let intent = classes[0];
  let confidence = -1;
  classes.forEach((candidate, classIndex) => {
    const probability = exponentials[classIndex] / total;
    probabilities[candidate] = probability;
    if (probability > confidence) {
      intent = candidate;
      confidence = probability;
    }
  });
  return { intent, confidence, probabilities };
}

const LEADING_COURTESY =
  /^(?:(?:hola|holi|ola|buenas|buenos dias|buenas tardes|buenas noches|buen dia|saludos|hey|ey|oye|oiga|porfa|por favor|disculpa|disculpe|amigo|parce|una pregunta|pregunta)\b[\s,.:;!¡]*)+/u;

/**
 * Quita el saludo o la cortesía del inicio ("hola, ...", "porfa ...") cuando
 * después viene una pregunta; así un saludo no arrastra la intención.
 */
export function stripLeadingCourtesy(question: string): string {
  const normalized = normalizeModelText(question).replace(/^[¿¡\s]+/u, "");
  const rest = normalized.replace(LEADING_COURTESY, "").trim();
  return /[\p{L}\p{N}]{2,}/u.test(rest) ? rest : normalized;
}

/** Intención final: veto de agroquímicos, clasificador y reglas de corrección. */
export function classifyQuestion(question: string): CanonicalIntent {
  if (isUnsafeAgroAdvice(question)) return "fuera_de_alcance";
  const text = stripLeadingCourtesy(question);
  return resolveAssistantIntent(text, predictModel(text).intent);
}

export function resolveAssistantIntent(
  question: string,
  predictedIntent: CanonicalIntent = predictModel(question).intent,
): CanonicalIntent {
  const normalized = normalizeModelText(question);

  if (
    predictedIntent === "comparar_ciclos" &&
    /\b(?:que|cual) ciclo (?:ha sido|fue|es|resulto) mas rentable\b/u.test(
      normalized,
    )
  ) {
    return "rentabilidad";
  }

  if (predictedIntent !== "fuera_de_alcance") return predictedIntent;

  if (/\b(por hectarea|costo.*hectarea|hectareas?)\b/u.test(normalized)) {
    return "costo_por_hectarea";
  }
  if (/\b(costo unitario|por kg|por kilo|por kilogramo)\b/u.test(normalized)) {
    return "costo_unitario";
  }
  if (
    /\b(costo total|coste total|gasto total|inversion total|cuanto (?:me )?(?:costo|gaste|gasto)|cuanto salio (?:el|total)|cuanto llevo (?:en|entre))\b/u
      .test(normalized)
  ) {
    return "costo_total";
  }
  if (
    /\b(cuanto vendi|cuanto vendiste|ingresos por ventas|ventas realizadas|recaudo)\b/u
      .test(normalized)
  ) {
    return "ingresos_ventas";
  }
  if (/\b(jornales|mano de obra|payroll|salarios)\b/u.test(normalized)) {
    return "jornales";
  }
  if (
    /\b(insumos|insumo|semilla|fertilizante|abono|urea)\b/u.test(normalized)
  ) {
    return "insumos";
  }
  if (
    /\b(rentable|rentabilidad|margen|utilidad|ganancia|roi)\b/u.test(normalized)
  ) {
    return "rentabilidad";
  }
  if (
    /\b(produccion|cosechado|cosecha|sin vender|pendiente)\b/u.test(normalized)
  ) {
    return "produccion_y_sin_vender";
  }
  if (/\b(compara|comparacion|diferencia entre ciclos)\b/u.test(normalized)) {
    return "comparar_ciclos";
  }
  if (/\b(clima|pronostico|lluvia|temperatura)\b/u.test(normalized)) {
    return "clima";
  }
  if (
    /\b(que significa|explicame|definicion|formula|diferencia entre q)\b/u.test(
      normalized,
    )
  ) {
    return "explicar_indicador";
  }
  if (/\b(hola|buenos dias|que puedes hacer|ayuda)\b/u.test(normalized)) {
    return "saludo_ayuda";
  }
  return predictedIntent;
}

const AGROCHEMICAL = [
  "herbicida",
  "insecticida",
  "fungicida",
  "pesticida",
  "plaguicida",
  "agroquimico",
  "urea",
  "fertilizante",
  "abono",
  "cal",
  "semilla",
  "principio activo",
];
const AGROCHEMICAL_ACTION = [
  "recomiend",
  "debo aplicar",
  "debo usar",
  "debo sembrar",
  "debo poner",
  "debo cambiar",
  "aplicar",
  "aplico",
  "aplique",
  "aplicaria",
  "usar",
  "poner",
  "controlar",
  "combatar",
  "matar",
  "prevenir",
  "que dosis",
  "cual dosis",
  "dosis",
  "cuanta",
  "cuanto necesita",
  "necesita",
  "principio activo",
  "manejo agronomico",
  "producto para",
  "que producto",
  "que marca",
  "cual marca",
  "que insecticida",
  "que herbicida",
  "que fungicida",
  "que plaguicida",
  "que agroquimico",
  "sirve para",
  "para controlar",
  "aplica",
  "conviene",
  "convendria",
  "utilizar",
  "utilizo",
  "sirve",
];
const HISTORICAL_COST = [
  "cuanto gaste",
  "cuanto costo",
  "cuanto me costo",
  "cuanto pago",
  "cuanto pagamos",
  "cuanto se pago",
  "cuanto se compro",
  "cuanto compramos",
  "gasto en",
  "costo historico",
  "gasto historico",
  "valor historico",
  "precio del",
  "precio de la",
  "lo que costo",
  "cuanto llevo en",
  "costo de aplicar",
  "gasto de aplicar",
  "cuanto costo aplicar",
  "precio de aplicar",
  "cuanto se gasto aplicando",
  "cuanto costo usar",
];

export function isUnsafeAgroAdvice(question: string): boolean {
  const normalized = normalizeModelText(question);
  const agrochemical = AGROCHEMICAL.some((term) => normalized.includes(term));
  const action = AGROCHEMICAL_ACTION.some((term) => normalized.includes(term));
  const historical = HISTORICAL_COST.some((term) => normalized.includes(term));
  return agrochemical && action && !historical;
}
