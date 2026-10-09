export interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  rol: string;
}

export interface Proveedor {
  id: number;
  usuario_id: number;
  nombre: string;
  contacto: string;
}

export interface Finca {
  id: number;
  usuario_id: number;
  nombre: string;
  municipio: string;
  latitud: number;
  longitud: number;
}

export interface Lote {
  id: number;
  finca_id: number;
  nombre: string;
  area_ha: number;
}

export interface Cultivo {
  id: number;
  nombre: string;
}

export interface CicloProductivo {
  id: number;
  lote_id: number;
  cultivo_id: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: 'Activo' | 'Finalizado';
}

export interface Actividad {
  id: number;
  ciclo_id: number;
  tipo: string;
  fecha: string;
  descripcion: string;
  otros_costos: number;
}

export interface Insumo {
  id: number;
  ciclo_id: number;
  actividad_id: number;
  proveedor_id: number;
  fecha: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  costo_unitario: number;
}

export interface ManoDeObra {
  id: number;
  ciclo_id: number;
  actividad_id: number;
  fecha: string;
  num_jornales: number;
  valor_jornal: number;
}

export interface ProduccionVenta {
  id: number;
  ciclo_id: number;
  fecha: string;
  cantidad_producida: number;
  cantidad_vendida: number;
  unidad: string;
  precio_unitario: number;
}

export interface PronosticoDia {
  dia: string;
  temp_max: number;
  temp_min: number;
  lluvia_mm: number;
}

export interface ClimaFinca {
  finca_id: number;
  pronostico: PronosticoDia[];
  alerta: string | null;
}

export type AppData = {
  usuarios: Usuario[];
  proveedores: Proveedor[];
  fincas: Finca[];
  lotes: Lote[];
  cultivos: Cultivo[];
  ciclos_productivos: CicloProductivo[];
  actividades: Actividad[];
  insumos: Insumo[];
  mano_de_obra: ManoDeObra[];
  produccion_ventas: ProduccionVenta[];
  clima: ClimaFinca[];
};
