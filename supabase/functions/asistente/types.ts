export interface AssistantRequest {
  question: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  clima?: ClimateSnapshot[];
}

export interface AssistantResponse {
  answer: string;
  source: "anthropic" | "fallback";
  notice?: string;
}

export interface ClimateSnapshot {
  finca_id: string;
  pronostico: Array<{
    dia: string;
    temp_max: number;
    temp_min: number;
    lluvia_mm: number;
  }>;
  alerta: string | null;
  error?: string | null;
}

export interface FincaRow {
  id: string;
  nombre: string;
  municipio: string;
  latitud: number;
  longitud: number;
}

export interface LoteRow {
  id: string;
  finca_id: string;
  nombre: string;
  area_ha: number;
}

export interface CicloRow {
  id: string;
  lote_id: string;
  cultivo_id: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: "activo" | "finalizado";
}

export interface CultivoRow {
  id: string;
  nombre: string;
}

export interface ActividadRow {
  id: string;
  ciclo_id: string;
  tipo: string;
  fecha: string;
  descripcion: string;
  otros_costos: number;
}

export interface InsumoRow {
  id: string;
  ciclo_id: string;
  actividad_id: string | null;
  fecha: string;
  nombre: string;
  cantidad: number;
  costo_unitario: number;
}

export interface ManoDeObraRow {
  id: string;
  ciclo_id: string;
  actividad_id: string | null;
  fecha: string;
  num_jornales: number;
  valor_jornal: number;
}

export interface CosechaRow {
  id: string;
  ciclo_id: string;
  fecha: string;
  cantidad_kg: number;
}

export interface VentaRow {
  id: string;
  ciclo_id: string;
  fecha: string;
  cantidad_kg: number;
  precio_unitario: number;
  comprador: string | null;
}

export interface UserData {
  fincas: FincaRow[];
  lotes: LoteRow[];
  ciclos: CicloRow[];
  cultivos: CultivoRow[];
  actividades: ActividadRow[];
  insumos: InsumoRow[];
  manoDeObra: ManoDeObraRow[];
  cosechas: CosechaRow[];
  ventas: VentaRow[];
}

export interface CycleSummary {
  id: string;
  cultivo: string;
  lote: string;
  finca: string;
  municipio: string;
  areaHa: number;
  estado: "activo" | "finalizado";
  fechaInicio: string;
  costoInsumos: number;
  costoJornales: number;
  costoOtros: number;
  costoTotal: number;
  costoPorHectarea: number;
  costoUnitario: number | null;
  Q: number;
  Qv: number;
  Qnv: number;
  produccionKg: number;
  vendidoKg: number;
  pendienteKg: number;
  ingresosRealizados: number;
  costoDeLoVendido: number | null;
  margenRealizado: number | null;
  rentabilidadSobreCostos: number | null;
  margenSobreVentas: number | null;
  rendimiento: number | null;
  jornales: number;
  esParcial: boolean;
  insumos: Array<{ nombre: string; cantidad: number; costo: number }>;
  manoDeObra: Array<{ tipo: string; jornales: number; costo: number }>;
  actividades: Array<{ tipo: string; fecha: string; otrosCostos: number }>;
}

export interface FarmSummary {
  id: string;
  nombre: string;
  municipio: string;
  clima?: ClimateSnapshot;
}

export interface DataSummary {
  fincas: FarmSummary[];
  ciclos: CycleSummary[];
  totales: {
    fincas: number;
    lotes: number;
    ciclos: number;
    costos: number;
    ingresos: number;
    costoDeLoVendido: number;
    margenRealizado: number;
    produccionKg: number;
    vendidoKg: number;
  };
}
