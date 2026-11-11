-- Datos de demostración para AgroPyme AI.
-- CAMBIE SOLO CORREO_DEMO por el correo del usuario de prueba.
-- Pegue este archivo completo en el SQL Editor de Supabase.

begin;

do $$
declare
  v_user_id uuid;
  v_finca_id uuid := gen_random_uuid();
  v_lote_id uuid := gen_random_uuid();
  v_ciclo_id uuid := gen_random_uuid();
  v_actividad_id uuid := gen_random_uuid();
begin
  select id
    into v_user_id
    from auth.users
   where email = 'CORREO_DEMO';

  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'No se encontró el usuario CORREO_DEMO. Cambie CORREO_DEMO por un correo existente en auth.users y vuelva a ejecutar el script.';
  end if;

  -- Limpieza idempotente de la finca de demostración de este usuario.
  delete from public.ventas v
   using public.ciclos c, public.lotes l, public.fincas f
   where v.ciclo_id = c.id
     and c.lote_id = l.id
     and l.finca_id = f.id
     and f.user_id = v_user_id
     and f.nombre = 'Finca Demo Lote Norte';

  delete from public.cosechas co
   using public.ciclos c, public.lotes l, public.fincas f
   where co.ciclo_id = c.id
     and c.lote_id = l.id
     and l.finca_id = f.id
     and f.user_id = v_user_id
     and f.nombre = 'Finca Demo Lote Norte';

  delete from public.insumos i
   using public.ciclos c, public.lotes l, public.fincas f
   where i.ciclo_id = c.id
     and c.lote_id = l.id
     and l.finca_id = f.id
     and f.user_id = v_user_id
     and f.nombre = 'Finca Demo Lote Norte';

  delete from public.mano_de_obra m
   using public.ciclos c, public.lotes l, public.fincas f
   where m.ciclo_id = c.id
     and c.lote_id = l.id
     and l.finca_id = f.id
     and f.user_id = v_user_id
     and f.nombre = 'Finca Demo Lote Norte';

  delete from public.actividades a
   using public.ciclos c, public.lotes l, public.fincas f
   where a.ciclo_id = c.id
     and c.lote_id = l.id
     and l.finca_id = f.id
     and f.user_id = v_user_id
     and f.nombre = 'Finca Demo Lote Norte';

  delete from public.ciclos c
   using public.lotes l, public.fincas f
   where c.lote_id = l.id
     and l.finca_id = f.id
     and f.user_id = v_user_id
     and f.nombre = 'Finca Demo Lote Norte';

  delete from public.lotes l
   using public.fincas f
   where l.finca_id = f.id
     and f.user_id = v_user_id
     and f.nombre = 'Finca Demo Lote Norte';

  delete from public.fincas
   where user_id = v_user_id
     and nombre = 'Finca Demo Lote Norte';

  insert into public.fincas
    (id, user_id, nombre, municipio, cod_mun, latitud, longitud)
  values
    (v_finca_id, v_user_id, 'Finca Demo Lote Norte', 'María la Baja', null, 9.98, -75.30);

  insert into public.lotes
    (id, user_id, finca_id, nombre, area_ha, municipio, cod_mun)
  values
    (v_lote_id, v_user_id, v_finca_id, 'Lote Norte', 2.5, 'María la Baja', null);

  insert into public.ciclos
    (id, user_id, lote_id, cultivo_id, fecha_inicio, fecha_fin, estado)
  values
    (v_ciclo_id, v_user_id, v_lote_id, '10000000-0000-0000-0000-000000000001',
     '2026-01-01', '2026-06-30', 'finalizado');

  insert into public.actividades
    (id, user_id, ciclo_id, nombre, tipo, tipo_personalizado, fecha, descripcion, otros_costos)
  values
    (v_actividad_id, v_user_id, v_ciclo_id, 'Preparación y manejo', 'Preparación del suelo', null,
     '2026-01-02', 'Incluye el alquiler del tractor para la preparación del lote.', 2000000);

  insert into public.insumos
    (user_id, ciclo_id, actividad_id, proveedor_id, fecha, nombre, descripcion,
     cantidad, unidad, costo_unitario)
  values
    (v_user_id, v_ciclo_id, v_actividad_id, null, '2026-01-02', 'Insumos del ciclo',
     'Fertilizante, semillas y otros insumos.', 1, 'bulto', 3466000);

  insert into public.mano_de_obra
    (user_id, ciclo_id, actividad_id, fecha, nombre, descripcion, num_jornales, valor_jornal)
  values
    (v_user_id, v_ciclo_id, v_actividad_id, '2026-01-03', 'Siembra',
     '42 jornales de siembra.', 42, 45000),
    (v_user_id, v_ciclo_id, v_actividad_id, '2026-01-04', 'Manejo del cultivo',
     '30 jornales de manejo.', 30, 50000);

  -- `cantidad_kg` se omite: lo calcula el trigger `calcular_cantidad_kg`.
  insert into public.cosechas
    (user_id, ciclo_id, fecha, cantidad, unidad_id)
  values
    (v_user_id, v_ciclo_id, '2026-06-15', 11250, '20000000-0000-0000-0000-000000000001');

  -- `cantidad_kg` se omite y `precio_unitario` siempre se guarda en COP/kg.
  insert into public.ventas
    (user_id, ciclo_id, fecha, cantidad, unidad_id, precio_unitario, comprador)
  values
    (v_user_id, v_ciclo_id, '2026-06-20', 4000, '20000000-0000-0000-0000-000000000001',
     1100, 'Mercado Demo A'),
    (v_user_id, v_ciclo_id, '2026-06-22', 2000, '20000000-0000-0000-0000-000000000001',
     1100, 'Mercado Demo B'),
    (v_user_id, v_ciclo_id, '2026-06-24', 4500, '20000000-0000-0000-0000-000000000001',
     1150, 'Mercado Demo C');
end;
$$;

commit;

-- Verificación: una fila con los totales esperados del ciclo de demostración.
select
  round((
    select coalesce(sum(i.cantidad * i.costo_unitario), 0)
      from public.insumos i
     where i.ciclo_id = c.id
  ) + (
    select coalesce(sum(m.num_jornales * m.valor_jornal), 0)
      from public.mano_de_obra m
     where m.ciclo_id = c.id
  ) + (
    select coalesce(sum(a.otros_costos), 0)
      from public.actividades a
     where a.ciclo_id = c.id
  )) as costo_total,
  round((
    select coalesce(sum(co.cantidad_kg), 0)
      from public.cosechas co
     where co.ciclo_id = c.id
  )) as cosechado_kg,
  round((
    select coalesce(sum(v.cantidad_kg), 0)
      from public.ventas v
     where v.ciclo_id = c.id
  )) as vendido_kg,
  round((
    select coalesce(sum(co.cantidad_kg), 0)
      from public.cosechas co
     where co.ciclo_id = c.id
  ) - coalesce((
    select sum(v.cantidad_kg)
      from public.ventas v
     where v.ciclo_id = c.id
  ), 0)) as sin_vender_kg,
  round((
    select coalesce(sum(v.cantidad_kg * v.precio_unitario), 0)
      from public.ventas v
     where v.ciclo_id = c.id
  )) as ingresos_realizados
from public.ciclos c
join public.lotes l on l.id = c.lote_id
join public.fincas f on f.id = l.finca_id
where f.user_id = (select id from auth.users where email = 'CORREO_DEMO')
  and f.nombre = 'Finca Demo Lote Norte'
  and l.nombre = 'Lote Norte';
