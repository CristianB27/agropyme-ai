export type EntityId = string;

export interface Proveedor {
  id: EntityId;
  user_id: EntityId;
  nombre: string;
  contacto: string | null;
}

export interface Finca {
  id: EntityId;
  user_id: EntityId;
  nombre: string;
  municipio: string;
  cod_mun: string | null;
  latitud: number;
  longitud: number;
}

export interface Lote {
  id: EntityId;
  user_id: EntityId;
  finca_id: EntityId;
  nombre: string;
  area_ha: number;
  municipio: string;
  cod_mun: string | null;
}

export interface Cultivo {
  id: EntityId;
  nombre: string;
}

export interface CicloProductivo {
  id: EntityId;
  user_id: EntityId;
  lote_id: EntityId;
  cultivo_id: EntityId;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: 'Activo' | 'Finalizado';
}

export interface Actividad {
  id: EntityId;
  user_id: EntityId;
  ciclo_id: EntityId;
  nombre: string;
  tipo: string;
  tipo_personalizado: string | null;
  fecha: string;
  descripcion: string | null;
  otros_costos: number;
}

export interface Insumo {
  id: EntityId;
  user_id: EntityId;
  ciclo_id: EntityId;
  actividad_id: EntityId | null;
  proveedor_id: EntityId | null;
  fecha: string;
  nombre: string;
  descripcion: string | null;
  cantidad: number;
  unidad: string;
  costo_unitario: number;
}

export interface ManoDeObra {
  id: EntityId;
  user_id: EntityId;
  ciclo_id: EntityId;
  actividad_id: EntityId | null;
  fecha: string;
  nombre: string;
  descripcion: string | null;
  num_jornales: number;
  valor_jornal: number;
}

export interface Unidad {
  id: EntityId;
  nombre: string;
  factor_a_kg: number;
  /** Sólo las unidades de peso se aceptan en cosechas, ventas y salidas. */
  es_masa: boolean;
}

export type CalidadProducto = 'primera' | 'segunda' | 'tercera' | 'sin_clasificar';

export type TipoComprador =
  | 'intermediario'
  | 'cooperativa'
  | 'plaza_mercado'
  | 'industria'
  | 'consumidor_final'
  | 'otro';

export type EstadoPago = 'pagado' | 'por_cobrar';

export type TipoSalida = 'autoconsumo' | 'alimento_animal' | 'semilla' | 'donacion' | 'perdida';

export interface Cosecha {
  id: EntityId;
  user_id: EntityId;
  ciclo_id: EntityId;
  fecha: string;
  cantidad: number;
  unidad_id: EntityId;
  unidad: string;
  cantidad_kg: number;
  calidad: CalidadProducto;
  descripcion: string | null;
}

export interface Venta {
  id: EntityId;
  user_id: EntityId;
  ciclo_id: EntityId;
  fecha: string;
  cantidad: number;
  unidad_id: EntityId;
  unidad: string;
  cantidad_kg: number;
  /** Siempre en COP por kg. */
  precio_unitario: number;
  comprador: string | null;
  calidad: CalidadProducto;
  tipo_comprador: TipoComprador | null;
  estado_pago: EstadoPago;
}

/** Producción que sale del ciclo sin venderse (autoconsumo, semilla, pérdida…). */
export interface SalidaProduccion {
  id: EntityId;
  user_id: EntityId;
  ciclo_id: EntityId;
  fecha: string;
  tipo: TipoSalida;
  cantidad: number;
  unidad_id: EntityId;
  unidad: string;
  cantidad_kg: number;
  descripcion: string | null;
}

export interface PronosticoDia {
  dia: string;
  temp_max: number;
  temp_min: number;
  lluvia_mm: number;
}

export interface ClimaFinca {
  finca_id: EntityId;
  pronostico: PronosticoDia[];
  alerta: string | null;
  error: string | null;
}

export type AppData = {
  proveedores: Proveedor[];
  fincas: Finca[];
  lotes: Lote[];
  cultivos: Cultivo[];
  ciclos_productivos: CicloProductivo[];
  actividades: Actividad[];
  insumos: Insumo[];
  mano_de_obra: ManoDeObra[];
  unidades: Unidad[];
  cosechas: Cosecha[];
  ventas: Venta[];
  salidas_produccion: SalidaProduccion[];
  clima: ClimaFinca[];
};
