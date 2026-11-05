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

interface ModelData {
  version: number;
  sourceModelSha256: string;
  threshold: number;
  canonicalIntents: CanonicalIntent[];
  classes: CanonicalIntent[];
  wordVocabulary: Record<string, number>;
  wordIdf: string;
  charVocabulary: Record<string, number>;
  charIdf: string;
  ruleGroups: Record<string, readonly string[]>;
  ruleVocabulary: Record<string, number>;
  coefficients: string;
  intercepts: string;
  calibratorA: string;
  calibratorB: string;
}

const data = MODEL_DATA as unknown as ModelData;
const wordVocabulary = new Map(Object.entries(data.wordVocabulary));
const charVocabulary = new Map(Object.entries(data.charVocabulary));
const ruleVocabulary = new Map(Object.entries(data.ruleVocabulary));
const canonicalIntents = data.canonicalIntents;
const classes = data.classes;

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

const wordIdf = decodeFloat64(data.wordIdf, wordVocabulary.size);
const charIdf = decodeFloat64(data.charIdf, charVocabulary.size);
const coefficients = decodeFloat64(
  data.coefficients,
  classes.length *
    (wordVocabulary.size + charVocabulary.size + ruleVocabulary.size),
);
const intercepts = decodeFloat64(data.intercepts, classes.length);
const calibratorA = decodeFloat64(data.calibratorA, classes.length);
const calibratorB = decodeFloat64(data.calibratorB, classes.length);

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
    const padded = ` ${word} `;
    const characters = [...padded];
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

function countTerms(terms: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const term of terms) {
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return counts;
}

function weightedTfidf(
  counts: Map<string, number>,
  vocabulary: Map<string, number>,
  idf: Float64Array,
): Map<number, number> {
  const weighted = new Map<number, number>();
  for (const [term, count] of counts) {
    const index = vocabulary.get(term);
    if (index === undefined) continue;
    weighted.set(index, (1 + Math.log(count)) * idf[index]);
  }
  let squaredNorm = 0;
  for (const value of weighted.values()) squaredNorm += value * value;
  const norm = Math.sqrt(squaredNorm);
  if (norm > 0) {
    for (const [index, value] of weighted) weighted.set(index, value / norm);
  }
  return weighted;
}

function ruleFeatures(normalized: string, originalText: string): Set<string> {
  const active = new Set<string>();
  for (const [name, words] of Object.entries(data.ruleGroups)) {
    if (words.some((word) => normalized.includes(word))) active.add(name);
  }

  if (/\b20\d{2}\b/u.test(normalized)) active.add("sig_ano");
  if (
    /\d+(?:[.,]\d+)?\s*(?:kg|kilos|kilogramos|ha|hectareas|jornales|unidades|litros)\b/u
      .test(normalized)
  ) {
    active.add("sig_unidad_cantidad");
  }
  if (
    /(?<!\w)(maiz|mais|yuca|yuka|name|nane|arroz)(?!\w)/u.test(normalized)
  ) {
    active.add("sig_cultivo");
  }
  if (
    /(?<!\w)(norte|sur|rio|occidente|pradera|mirador)(?!\w)/u
      .test(normalized)
  ) {
    active.add("sig_lote_finca");
  }
  if (originalText.includes("?")) active.add("sig_pregunta");

  if (normalized.includes("arroz")) active.add("crop_arroz");
  if (normalized.includes("maiz")) active.add("crop_maiz");
  if (normalized.includes("name")) active.add("crop_name");
  if (normalized.includes("yuca")) active.add("crop_yuca");
  if (normalized.includes("norte")) active.add("lote_norte");
  if (normalized.includes("sur")) active.add("lote_sur");
  if (normalized.includes("rio")) active.add("lote_rio");
  if (normalized.includes("occidente")) active.add("lote_occidente");
  if (normalized.includes("pradera")) active.add("finca_pradera");
  if (normalized.includes("mirador")) active.add("finca_mirador");
  return active;
}

function expit(value: number): number {
  if (value >= 0) {
    return 1 / (1 + Math.exp(-value));
  }
  const exponential = Math.exp(value);
  return exponential / (1 + exponential);
}

export function predictModel(question: string): ModelPrediction {
  const normalized = normalizeModelText(question);
  const wordFeatures = weightedTfidf(
    countTerms(wordNgrams(wordTokens(normalized))),
    wordVocabulary,
    wordIdf,
  );
  const charFeatures = weightedTfidf(
    countTerms(charWbNgrams(normalized)),
    charVocabulary,
    charIdf,
  );
  const features = new Map<number, number>();
  for (const [index, value] of wordFeatures) features.set(index, value);
  const charOffset = wordVocabulary.size;
  for (const [index, value] of charFeatures) {
    features.set(charOffset + index, value);
  }
  const ruleOffset = wordVocabulary.size + charVocabulary.size;
  for (const name of ruleFeatures(normalized, question)) {
    const index = ruleVocabulary.get(name);
    if (index !== undefined) features.set(ruleOffset + index, 1);
  }

  const featureCount = wordVocabulary.size + charVocabulary.size +
    ruleVocabulary.size;
  const decision = new Float64Array(classes.length);
  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    let score = intercepts[classIndex];
    const classOffset = classIndex * featureCount;
    for (const [index, value] of features) {
      score += coefficients[classOffset + index] * value;
    }
    decision[classIndex] = score;
  }

  const classProbabilities = new Map<CanonicalIntent, number>();
  let total = 0;
  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    const probability = expit(
      -(calibratorA[classIndex] * decision[classIndex] +
        calibratorB[classIndex]),
    );
    classProbabilities.set(classes[classIndex], probability);
    total += probability;
  }

  const probabilities = {} as Record<CanonicalIntent, number>;
  for (const intent of canonicalIntents) {
    const probability = total > 0
      ? (classProbabilities.get(intent) ?? 0) / total
      : 1 / canonicalIntents.length;
    probabilities[intent] = probability;
  }
  let intent = canonicalIntents[0];
  let confidence = -1;
  for (const candidate of canonicalIntents) {
    if (probabilities[candidate] > confidence) {
      intent = candidate;
      confidence = probabilities[candidate];
    }
  }
  return { intent, confidence, probabilities };
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
