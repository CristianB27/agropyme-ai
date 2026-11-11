import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { calcularIndicadoresCiclo } from '../src/utils/calculos.ts';

function leerEntorno(ruta) {
  return Object.fromEntries(
    fs.readFileSync(ruta, 'utf8')
      .split(/\r?\n/)
      .filter((linea) => linea.trim() && !linea.startsWith('#'))
      .map((linea) => {
        const separador = linea.indexOf('=');
        return [linea.slice(0, separador).trim(), linea.slice(separador + 1).trim()];
      }),
  );
}

function afirmar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

function redondearPorcentaje(valor) {
  return Math.round((valor ?? 0) * 1000) / 10;
}

const entorno = leerEntorno(new URL('../.env', import.meta.url));
const cliente = createClient(entorno.VITE_SUPABASE_URL, entorno.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const correo = `agropyme-smoke-${sufijo}@example.invalid`;
const password = `Tmp-${crypto.randomUUID()}-Aa1!`;
let userId = null;
let fincaId = null;
let loteId = null;
let cicloId = null;

try {
  const { data: registro, error: errorRegistro } = await cliente.auth.signUp({
    email: correo,
    password,
    options: { data: { nombre: 'Prueba temporal' } },
  });
  afirmar(!errorRegistro, `No se pudo crear el usuario temporal: ${errorRegistro?.message}`);
  afirmar(registro.user && registro.session, 'El usuario temporal no quedó autenticado.');
  userId = registro.user.id;
  cliente.auth.setSession({
    access_token: registro.session.access_token,
    refresh_token: registro.session.refresh_token,
  });

  const { data: cultivos, error: errorCultivos } = await cliente
    .from('cultivos').select('id').eq('nombre', 'Maíz').single();
  afirmar(!errorCultivos && cultivos, 'No se encontró el cultivo Maíz.');
  const { data: unidades, error: errorUnidades } = await cliente
    .from('unidades').select('id, factor_a_kg').eq('nombre', 'kg').single();
  afirmar(!errorUnidades && unidades, 'No se encontró la unidad kg.');

  fincaId = crypto.randomUUID();
  loteId = crypto.randomUUID();
  cicloId = crypto.randomUUID();
  const hoy = new Date().toISOString().slice(0, 10);

  const { error: errorFinca } = await cliente.from('fincas').insert({
    id: fincaId,
    nombre: 'Finca Smoke Temporal',
    municipio: 'María la Baja',
    latitud: 9.98,
    longitud: -75.3,
  });
  afirmar(!errorFinca, `No se pudo crear la finca: ${errorFinca?.message}`);

  const { error: errorLote } = await cliente.from('lotes').insert({
    id: loteId,
    finca_id: fincaId,
    nombre: 'Lote Smoke Temporal',
    area_ha: 2.5,
    municipio: 'María la Baja',
  });
  afirmar(!errorLote, `No se pudo crear el lote: ${errorLote?.message}`);

  const { error: errorCiclo } = await cliente.from('ciclos').insert({
    id: cicloId,
    lote_id: loteId,
    cultivo_id: cultivos.id,
    fecha_inicio: hoy,
    estado: 'activo',
  });
  afirmar(!errorCiclo, `No se pudo crear el ciclo: ${errorCiclo?.message}`);

  const { error: errorInsumo } = await cliente.from('insumos').insert({
    ciclo_id: cicloId,
    fecha: hoy,
    nombre: 'Costo total temporal',
    descripcion: null,
    cantidad: 1,
    unidad: 'kg',
    costo_unitario: 8_856_000,
  });
  afirmar(!errorInsumo, `No se pudo crear el insumo: ${errorInsumo?.message}`);

  const { data: cosecha, error: errorCosecha } = await cliente.from('cosechas').insert({
    ciclo_id: cicloId,
    fecha: hoy,
    cantidad: 11_250,
    unidad_id: unidades.id,
  }).select('cantidad_kg').single();
  afirmar(!errorCosecha, `No se pudo crear la cosecha: ${errorCosecha?.message}`);
  afirmar(Number(cosecha.cantidad_kg) === 11_250, 'El trigger no calculó cantidad_kg de la cosecha.');

  const ventas = [
    { cantidad: 4_000, precio_unitario: 1_100 },
    { cantidad: 2_000, precio_unitario: 1_100 },
    { cantidad: 4_500, precio_unitario: 1_150 },
  ];
  for (const venta of ventas) {
    const { error: errorVenta } = await cliente.from('ventas').insert({
      ciclo_id: cicloId,
      fecha: hoy,
      cantidad: venta.cantidad,
      unidad_id: unidades.id,
      precio_unitario: venta.precio_unitario,
      comprador: null,
    });
    afirmar(!errorVenta, `No se pudo crear una venta: ${errorVenta?.message}`);
  }

  const { error: errorVentaExtra } = await cliente.from('ventas').insert({
    ciclo_id: cicloId,
    fecha: hoy,
    cantidad: 1_000,
    unidad_id: unidades.id,
    precio_unitario: 1_100,
    comprador: null,
  });
  afirmar(errorVentaExtra?.code === '23514', 'La venta adicional no fue rechazada con el error 23514.');

  const { data: cosechas, error: errorCosechas } = await cliente
    .from('cosechas').select('cantidad_kg').eq('ciclo_id', cicloId);
  afirmar(!errorCosechas, 'No se pudieron leer las cosechas.');
  const { data: ventasGuardadas, error: errorVentas } = await cliente
    .from('ventas').select('cantidad_kg, precio_unitario').eq('ciclo_id', cicloId);
  afirmar(!errorVentas, 'No se pudieron leer las ventas.');

  const indicadores = calcularIndicadoresCiclo({
    areaHa: 2.5,
    costoInsumos: 8_856_000,
    costoJornales: 0,
    costoOtros: 0,
    cosechas: cosechas.map((fila) => ({ cantidadKg: Number(fila.cantidad_kg) })),
    ventas: ventasGuardadas.map((fila) => ({
      cantidadKg: Number(fila.cantidad_kg),
      precioUnitario: Number(fila.precio_unitario),
    })),
  });

  afirmar(redondearPorcentaje(indicadores.margenSobreVentas) === 29.8, 'El margen sobre ventas no es 29,8 %.');
  afirmar(redondearPorcentaje(indicadores.rentabilidadSobreCostos) === 42.5, 'La rentabilidad sobre costos no es 42,5 %.');

  console.log(JSON.stringify({
    ok: true,
    cantidad_kg_calculada: Number(cosecha.cantidad_kg),
    venta_adicional_rechazada: errorVentaExtra.code,
    margen_sobre_ventas: redondearPorcentaje(indicadores.margenSobreVentas),
    rentabilidad_sobre_costos: redondearPorcentaje(indicadores.rentabilidadSobreCostos),
  }));
} finally {
  if (userId) {
    await cliente.from('ventas').delete().eq('ciclo_id', cicloId);
    await cliente.from('cosechas').delete().eq('ciclo_id', cicloId);
    await cliente.from('insumos').delete().eq('ciclo_id', cicloId);
    await cliente.from('ciclos').delete().eq('id', cicloId);
    await cliente.from('lotes').delete().eq('id', loteId);
    await cliente.from('fincas').delete().eq('id', fincaId);
  }

  if (userId) {
    const sql = `delete from auth.users where id = '${userId}'; select count(*)::int as usuarios from auth.users where id = '${userId}';`;
    const raizFrontend = fileURLToPath(new URL('..', import.meta.url));
    const cliSupabase = path.join(raizFrontend, 'node_modules', 'supabase', 'dist', 'supabase.js');
    const salida = execFileSync(
      process.execPath,
      [cliSupabase, 'db', 'query', '--linked', sql, '--output-format', 'json'],
      { cwd: raizFrontend, stdio: 'pipe', encoding: 'utf8' },
    );
    if (!salida.includes('"usuarios": 0') && !salida.includes('"usuarios":0')) {
      throw new Error('No se pudo verificar el borrado del usuario temporal.');
    }
  }
}
