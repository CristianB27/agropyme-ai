import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.57.4";
import type {
  ActividadRow,
  CicloRow,
  CosechaRow,
  CultivoRow,
  FincaRow,
  InsumoRow,
  LoteRow,
  ManoDeObraRow,
  UserData,
  VentaRow,
} from "./types.ts";

export class AuthenticationError extends Error {}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

async function fetchRows(
  client: SupabaseClient,
  table: string,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await client.from(table).select("*");
  if (error) {
    throw new Error(`No se pudieron cargar ${table}: ${error.message}`);
  }
  return (data ?? []) as Record<string, unknown>[];
}

function mapFinca(row: Record<string, unknown>): FincaRow {
  return {
    id: stringValue(row.id),
    nombre: stringValue(row.nombre),
    municipio: stringValue(row.municipio),
    latitud: numberValue(row.latitud),
    longitud: numberValue(row.longitud),
  };
}

function mapLote(row: Record<string, unknown>): LoteRow {
  return {
    id: stringValue(row.id),
    finca_id: stringValue(row.finca_id),
    nombre: stringValue(row.nombre),
    area_ha: numberValue(row.area_ha),
  };
}

function mapCiclo(row: Record<string, unknown>): CicloRow {
  return {
    id: stringValue(row.id),
    lote_id: stringValue(row.lote_id),
    cultivo_id: stringValue(row.cultivo_id),
    fecha_inicio: stringValue(row.fecha_inicio),
    fecha_fin: nullableString(row.fecha_fin),
    estado: row.estado === "finalizado" ? "finalizado" : "activo",
  };
}

function mapCultivo(row: Record<string, unknown>): CultivoRow {
  return {
    id: stringValue(row.id),
    nombre: stringValue(row.nombre),
  };
}

function mapActividad(row: Record<string, unknown>): ActividadRow {
  return {
    id: stringValue(row.id),
    ciclo_id: stringValue(row.ciclo_id),
    tipo: stringValue(row.tipo),
    fecha: stringValue(row.fecha),
    descripcion: stringValue(row.descripcion),
    otros_costos: numberValue(row.otros_costos),
  };
}

function mapInsumo(row: Record<string, unknown>): InsumoRow {
  return {
    id: stringValue(row.id),
    ciclo_id: stringValue(row.ciclo_id),
    actividad_id: nullableString(row.actividad_id),
    fecha: stringValue(row.fecha),
    nombre: stringValue(row.nombre),
    cantidad: numberValue(row.cantidad),
    costo_unitario: numberValue(row.costo_unitario),
  };
}

function mapManoDeObra(row: Record<string, unknown>): ManoDeObraRow {
  return {
    id: stringValue(row.id),
    ciclo_id: stringValue(row.ciclo_id),
    actividad_id: nullableString(row.actividad_id),
    fecha: stringValue(row.fecha),
    num_jornales: numberValue(row.num_jornales),
    valor_jornal: numberValue(row.valor_jornal),
  };
}

function mapCosecha(row: Record<string, unknown>): CosechaRow {
  return {
    id: stringValue(row.id),
    ciclo_id: stringValue(row.ciclo_id),
    fecha: stringValue(row.fecha),
    cantidad_kg: numberValue(row.cantidad_kg),
  };
}

function mapVenta(row: Record<string, unknown>): VentaRow {
  return {
    id: stringValue(row.id),
    ciclo_id: stringValue(row.ciclo_id),
    fecha: stringValue(row.fecha),
    cantidad_kg: numberValue(row.cantidad_kg),
    precio_unitario: numberValue(row.precio_unitario),
    comprador: nullableString(row.comprador),
  };
}

export async function loadUserData(accessToken: string): Promise<UserData> {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anonKey) {
    throw new Error(
      "La función no tiene configuradas las credenciales públicas de Supabase.",
    );
  }

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await client.auth.getUser(
    accessToken,
  );
  if (authError || !authData.user) {
    throw new AuthenticationError(
      "La sesión del usuario no es válida o ha expirado.",
    );
  }

  const [
    fincas,
    lotes,
    ciclos,
    cultivos,
    actividades,
    insumos,
    manoDeObra,
    cosechas,
    ventas,
  ] = await Promise.all([
    fetchRows(client, "fincas"),
    fetchRows(client, "lotes"),
    fetchRows(client, "ciclos"),
    fetchRows(client, "cultivos"),
    fetchRows(client, "actividades"),
    fetchRows(client, "insumos"),
    fetchRows(client, "mano_de_obra"),
    fetchRows(client, "cosechas"),
    fetchRows(client, "ventas"),
  ]);

  return {
    fincas: fincas.map(mapFinca),
    lotes: lotes.map(mapLote),
    ciclos: ciclos.map(mapCiclo),
    cultivos: cultivos.map(mapCultivo),
    actividades: actividades.map(mapActividad),
    insumos: insumos.map(mapInsumo),
    manoDeObra: manoDeObra.map(mapManoDeObra),
    cosechas: cosechas.map(mapCosecha),
    ventas: ventas.map(mapVenta),
  };
}
