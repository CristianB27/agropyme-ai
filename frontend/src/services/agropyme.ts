import { supabase } from '../lib/supabase';
import type {
  Actividad,
  AppData,
  CicloProductivo,
  Cosecha,
  Cultivo,
  Finca,
  Insumo,
  Lote,
  ManoDeObra,
  Proveedor,
  Unidad,
  Venta,
} from '../types';

type RawRow = Record<string, unknown>;

function assertData<T>(data: T | null, context: string): T {
  if (data === null) throw new Error(`No se pudieron cargar ${context}.`);
  return data;
}

function assertError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function mapFinca(row: RawRow): Finca {
  return {
    id: stringValue(row.id),
    user_id: stringValue(row.user_id),
    nombre: stringValue(row.nombre),
    municipio: stringValue(row.municipio),
    cod_mun: typeof row.cod_mun === 'string' ? row.cod_mun : null,
    latitud: numberValue(row.latitud),
    longitud: numberValue(row.longitud),
  };
}

function mapLote(row: RawRow): Lote {
  return {
    id: stringValue(row.id),
    user_id: stringValue(row.user_id),
    finca_id: stringValue(row.finca_id),
    nombre: stringValue(row.nombre),
    area_ha: numberValue(row.area_ha),
  };
}

function mapProveedor(row: RawRow): Proveedor {
  return {
    id: stringValue(row.id),
    user_id: stringValue(row.user_id),
    nombre: stringValue(row.nombre),
    contacto: typeof row.contacto === 'string' ? row.contacto : null,
  };
}

function mapCiclo(row: RawRow): CicloProductivo {
  return {
    id: stringValue(row.id),
    user_id: stringValue(row.user_id),
    lote_id: stringValue(row.lote_id),
    cultivo_id: stringValue(row.cultivo_id),
    fecha_inicio: stringValue(row.fecha_inicio),
    fecha_fin: typeof row.fecha_fin === 'string' ? row.fecha_fin : null,
    estado: row.estado === 'finalizado' ? 'Finalizado' : 'Activo',
  };
}

function mapActividad(row: RawRow): Actividad {
  return {
    id: stringValue(row.id),
    user_id: stringValue(row.user_id),
    ciclo_id: stringValue(row.ciclo_id),
    tipo: stringValue(row.tipo),
    fecha: stringValue(row.fecha),
    descripcion: stringValue(row.descripcion),
    otros_costos: numberValue(row.otros_costos),
  };
}

function mapInsumo(row: RawRow): Insumo {
  return {
    id: stringValue(row.id),
    user_id: stringValue(row.user_id),
    ciclo_id: stringValue(row.ciclo_id),
    actividad_id: typeof row.actividad_id === 'string' ? row.actividad_id : null,
    proveedor_id: typeof row.proveedor_id === 'string' ? row.proveedor_id : null,
    fecha: stringValue(row.fecha),
    nombre: stringValue(row.nombre),
    cantidad: numberValue(row.cantidad),
    unidad: stringValue(row.unidad),
    costo_unitario: numberValue(row.costo_unitario),
  };
}

function mapManoDeObra(row: RawRow): ManoDeObra {
  return {
    id: stringValue(row.id),
    user_id: stringValue(row.user_id),
    ciclo_id: stringValue(row.ciclo_id),
    actividad_id: typeof row.actividad_id === 'string' ? row.actividad_id : null,
    fecha: stringValue(row.fecha),
    num_jornales: numberValue(row.num_jornales),
    valor_jornal: numberValue(row.valor_jornal),
  };
}

function mapCosecha(row: RawRow, unidades: Map<string, Unidad>): Cosecha {
  const unidadId = stringValue(row.unidad_id);
  return {
    id: stringValue(row.id),
    user_id: stringValue(row.user_id),
    ciclo_id: stringValue(row.ciclo_id),
    fecha: stringValue(row.fecha),
    cantidad: numberValue(row.cantidad),
    unidad_id: unidadId,
    unidad: unidades.get(unidadId)?.nombre ?? 'kg',
    cantidad_kg: numberValue(row.cantidad_kg),
  };
}

function mapVenta(row: RawRow, unidades: Map<string, Unidad>): Venta {
  const unidadId = stringValue(row.unidad_id);
  return {
    id: stringValue(row.id),
    user_id: stringValue(row.user_id),
    ciclo_id: stringValue(row.ciclo_id),
    fecha: stringValue(row.fecha),
    cantidad: numberValue(row.cantidad),
    unidad_id: unidadId,
    unidad: unidades.get(unidadId)?.nombre ?? 'kg',
    cantidad_kg: numberValue(row.cantidad_kg),
    precio_unitario: numberValue(row.precio_unitario),
    comprador: typeof row.comprador === 'string' ? row.comprador : null,
  };
}

export type NuevaFinca = Omit<Finca, 'id' | 'user_id' | 'cod_mun'> & { cod_mun?: string | null };
export type NuevoLote = Omit<Lote, 'id' | 'user_id'>;
export type NuevoCiclo = Omit<CicloProductivo, 'id' | 'user_id' | 'fecha_fin' | 'estado'>;
export type NuevaActividad = Omit<Actividad, 'id' | 'user_id'>;
export type NuevoInsumo = Omit<Insumo, 'id' | 'user_id'>;
export type NuevaManoDeObra = Omit<ManoDeObra, 'id' | 'user_id'>;

async function insertAndMap<TPayload extends Record<string, unknown>, TResult>(
  table: string,
  payload: TPayload,
  mapper: (row: RawRow) => TResult,
): Promise<TResult> {
  const { data, error } = await supabase.from(table).insert(payload).select('*').single();
  assertError(error);
  return mapper(data as RawRow);
}

export async function createFinca(finca: NuevaFinca): Promise<Finca> {
  return insertAndMap('fincas', { ...finca, cod_mun: finca.cod_mun ?? null }, mapFinca);
}

export async function createLote(lote: NuevoLote): Promise<Lote> {
  return insertAndMap('lotes', lote, mapLote);
}

export async function createCiclo(ciclo: NuevoCiclo): Promise<CicloProductivo> {
  return insertAndMap('ciclos', { ...ciclo, estado: 'activo' }, mapCiclo);
}

export async function createActividad(actividad: NuevaActividad): Promise<Actividad> {
  return insertAndMap('actividades', actividad, mapActividad);
}

export async function createInsumo(insumo: NuevoInsumo): Promise<Insumo> {
  return insertAndMap('insumos', insumo, mapInsumo);
}

export async function createManoDeObra(jornal: NuevaManoDeObra): Promise<ManoDeObra> {
  return insertAndMap('mano_de_obra', jornal, mapManoDeObra);
}

export async function loadAppData(): Promise<AppData> {
  const [fincas, lotes, proveedores, ciclos, actividades, insumos, manoDeObra, cultivos, unidades, cosechas, ventas] = await Promise.all([
    supabase.from('fincas').select('*'),
    supabase.from('lotes').select('*'),
    supabase.from('proveedores').select('*'),
    supabase.from('ciclos').select('*'),
    supabase.from('actividades').select('*'),
    supabase.from('insumos').select('*'),
    supabase.from('mano_de_obra').select('*'),
    supabase.from('cultivos').select('*'),
    supabase.from('unidades').select('*'),
    supabase.from('cosechas').select('*'),
    supabase.from('ventas').select('*'),
  ]);

  for (const result of [fincas, lotes, proveedores, ciclos, actividades, insumos, manoDeObra, cultivos, unidades, cosechas, ventas]) {
    assertError(result.error);
  }

  const mappedCultivos: Cultivo[] = assertData(cultivos.data, 'los cultivos').map((row) => ({
    id: stringValue(row.id),
    nombre: stringValue(row.nombre),
  }));
  const mappedUnidades: Unidad[] = assertData(unidades.data, 'las unidades').map((row) => ({
    id: stringValue(row.id),
    nombre: stringValue(row.nombre),
    factor_a_kg: numberValue(row.factor_a_kg),
  }));
  const unitMap = new Map(mappedUnidades.map((unidad) => [unidad.id, unidad]));

  return {
    fincas: assertData(fincas.data, 'las fincas').map((row) => mapFinca(row as RawRow)),
    lotes: assertData(lotes.data, 'los lotes').map((row) => mapLote(row as RawRow)),
    proveedores: assertData(proveedores.data, 'los proveedores').map((row) => mapProveedor(row as RawRow)),
    ciclos_productivos: assertData(ciclos.data, 'los ciclos').map((row) => mapCiclo(row as RawRow)),
    actividades: assertData(actividades.data, 'las actividades').map((row) => mapActividad(row as RawRow)),
    insumos: assertData(insumos.data, 'los insumos').map((row) => mapInsumo(row as RawRow)),
    mano_de_obra: assertData(manoDeObra.data, 'la mano de obra').map((row) => mapManoDeObra(row as RawRow)),
    cultivos: mappedCultivos,
    unidades: mappedUnidades,
    cosechas: assertData(cosechas.data, 'las cosechas').map((row) => mapCosecha(row as RawRow, unitMap)),
    ventas: assertData(ventas.data, 'las ventas').map((row) => mapVenta(row as RawRow, unitMap)),
    clima: [],
  };
}
