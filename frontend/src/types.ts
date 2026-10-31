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
  tipo: string;
  fecha: string;
  descripcion: string;
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
  num_jornales: number;
  valor_jornal: number;
}

export interface Unidad {
  id: EntityId;
  nombre: string;
  factor_a_kg: number;
}

export interface Cosecha {
  id: EntityId;
  user_id: EntityId;
  ciclo_id: EntityId;
  fecha: string;
  cantidad: number;
  unidad_id: EntityId;
  unidad: string;
  cantidad_kg: number;
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
  precio_unitario: number;
  comprador: string | null;
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
  clima: ClimaFinca[];
};
