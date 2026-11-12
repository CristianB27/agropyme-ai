-- AgroPyme AI: clasificación de cosechas y ventas, salidas de producción sin
-- venta (autoconsumo, semilla, pérdidas…), cierre de ciclos y borrado seguro
-- de ciclos y fincas.
--
-- Motivación: hasta ahora una cosecha sólo guardaba fecha y cantidad, y una
-- venta sólo cantidad, precio y un comprador en texto libre. Todo lo que no se
-- vendía quedaba como "pendiente de venta" para siempre, aunque el productor
-- se lo hubiera comido o se le hubiera perdido, de modo que el ciclo nunca
-- quedaba completo y la proyección valoraba a precio de mercado producto que
-- ya no existía.

-- 1. UNIDADES DE PESO ---------------------------------------------------------
-- `unidad` y `litro` tienen factor 1 en el catálogo, lo que no representa un
-- peso real. Las cosechas, ventas y salidas sólo admiten unidades de peso.
alter table public.unidades
  add column es_masa boolean not null default false;

update public.unidades
   set es_masa = true
 where nombre in ('kg', 'bulto', 'tonelada');

-- La arroba (12,5 kg) es una unidad de uso corriente en el comercio agrícola
-- colombiano.
insert into public.unidades (id, nombre, factor_a_kg, es_masa)
values ('20000000-0000-0000-0000-000000000006', 'arroba', 12.5, true)
on conflict (nombre) do update set es_masa = true;

create or replace function public.calcular_cantidad_kg()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_factor numeric(14, 6);
  v_es_masa boolean;
  v_nombre text;
begin
  select u.factor_a_kg, u.es_masa, u.nombre
    into v_factor, v_es_masa, v_nombre
    from public.unidades u
   where u.id = new.unidad_id;

  if v_factor is null then
    raise exception using
      errcode = '23503',
      message = format('La unidad %s no existe', new.unidad_id);
  end if;

  if not v_es_masa then
    raise exception using
      errcode = '22023',
      message = format(
        'La unidad "%s" no es una unidad de peso. Usa kg, arroba, bulto o tonelada.',
        v_nombre
      );
  end if;

  new.cantidad_kg := round(new.cantidad * v_factor, 4);
  return new;
end;
$$;

-- 2. CLASIFICACIÓN DE COSECHAS -----------------------------------------------
alter table public.cosechas
  add column calidad text not null default 'sin_clasificar'
    constraint cosechas_calidad_valida
    check (calidad in ('primera', 'segunda', 'tercera', 'sin_clasificar')),
  add column descripcion text null;

-- 3. CLASIFICACIÓN DE VENTAS -------------------------------------------------
alter table public.ventas
  add column calidad text not null default 'sin_clasificar'
    constraint ventas_calidad_valida
    check (calidad in ('primera', 'segunda', 'tercera', 'sin_clasificar')),
  add column tipo_comprador text null
    constraint ventas_tipo_comprador_valido
    check (
      tipo_comprador is null or tipo_comprador in (
        'intermediario', 'cooperativa', 'plaza_mercado',
        'industria', 'consumidor_final', 'otro'
      )
    ),
  add column estado_pago text not null default 'pagado'
    constraint ventas_estado_pago_valido
    check (estado_pago in ('pagado', 'por_cobrar'));

-- 4. SALIDAS DE PRODUCCIÓN SIN VENTA -----------------------------------------
-- Producción cosechada que sale del inventario sin generar ingreso.
create table public.salidas_produccion (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid(),
  ciclo_id uuid not null,
  fecha date not null,
  tipo text not null
    constraint salidas_produccion_tipo_valido
    check (tipo in ('autoconsumo', 'alimento_animal', 'semilla', 'donacion', 'perdida')),
  cantidad numeric(14, 4) not null check (cantidad > 0),
  unidad_id uuid not null references public.unidades (id) on delete restrict,
  cantidad_kg numeric(16, 4) not null check (cantidad_kg > 0),
  descripcion text null,
  unique (id, user_id),
  foreign key (ciclo_id, user_id)
    references public.ciclos (id, user_id) on delete cascade
);

create index idx_salidas_produccion_ciclo_id on public.salidas_produccion (ciclo_id);
create index idx_salidas_produccion_unidad_id on public.salidas_produccion (unidad_id);

create trigger salidas_produccion_calcular_cantidad_kg
before insert or update of cantidad, unidad_id on public.salidas_produccion
for each row execute function public.calcular_cantidad_kg();

alter table public.salidas_produccion enable row level security;

create policy "salidas_produccion_select_own" on public.salidas_produccion
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "salidas_produccion_insert_own" on public.salidas_produccion
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "salidas_produccion_update_own" on public.salidas_produccion
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "salidas_produccion_delete_own" on public.salidas_produccion
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.salidas_produccion from anon;
grant select, insert, update, delete on public.salidas_produccion to authenticated;
grant all on public.salidas_produccion to service_role;

-- 5. INVARIANTE: VENTAS + SALIDAS <= COSECHA ---------------------------------
create or replace function public.validar_ventas_no_superan_cosecha()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ciclo_a_validar uuid;
  ciclos_afectados uuid[] := array[]::uuid[];
  total_ventas numeric;
  total_salidas numeric;
  total_cosechas numeric;
begin
  if tg_op = 'DELETE' then
    ciclo_a_validar := old.ciclo_id;
  else
    ciclo_a_validar := new.ciclo_id;
  end if;

  if tg_op = 'UPDATE' and old.ciclo_id is distinct from new.ciclo_id then
    ciclos_afectados := array_append(ciclos_afectados, old.ciclo_id);
  end if;
  ciclos_afectados := array_append(ciclos_afectados, ciclo_a_validar);

  foreach ciclo_a_validar in array array(select distinct unnest(ciclos_afectados)) loop
    -- Serializa operaciones concurrentes del mismo ciclo.
    perform pg_advisory_xact_lock(hashtextextended(ciclo_a_validar::text, 0));

    select coalesce(sum(v.cantidad_kg), 0)
      into total_ventas
      from public.ventas v
     where v.ciclo_id = ciclo_a_validar;

    select coalesce(sum(s.cantidad_kg), 0)
      into total_salidas
      from public.salidas_produccion s
     where s.ciclo_id = ciclo_a_validar;

    select coalesce(sum(c.cantidad_kg), 0)
      into total_cosechas
      from public.cosechas c
     where c.ciclo_id = ciclo_a_validar;

    if total_ventas + total_salidas > total_cosechas then
      raise exception using
        errcode = '23514',
        message = format(
          'Las ventas (%s kg) y salidas sin venta (%s kg) del ciclo %s superan la cosecha total (%s kg)',
          total_ventas,
          total_salidas,
          ciclo_a_validar,
          total_cosechas
        );
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create constraint trigger salidas_no_superan_cosecha
after insert or update or delete on public.salidas_produccion
deferrable initially deferred
for each row execute function public.validar_ventas_no_superan_cosecha();

-- 6. CIERRE DE CICLOS --------------------------------------------------------
-- Un ciclo finalizado siempre tiene fecha de cierre.
update public.ciclos
   set fecha_fin = greatest(fecha_inicio, current_date)
 where estado = 'finalizado'
   and fecha_fin is null;

alter table public.ciclos
  add constraint ciclos_finalizado_con_fecha_fin
  check (estado <> 'finalizado' or fecha_fin is not null);

-- 7. BORRADO SEGURO DE CICLOS Y FINCAS ---------------------------------------
-- Igual que `eliminar_lote`: los insumos y jornales referencian actividades con
-- ON DELETE RESTRICT, así que se desvinculan antes de borrar en cascada.
create or replace function public.eliminar_ciclo(p_ciclo_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform 1
    from public.ciclos
   where id = p_ciclo_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'El ciclo no existe o no pertenece al usuario.';
  end if;

  update public.insumos
     set actividad_id = null
   where ciclo_id = p_ciclo_id
     and actividad_id is not null;

  update public.mano_de_obra
     set actividad_id = null
   where ciclo_id = p_ciclo_id
     and actividad_id is not null;

  delete from public.ciclos
   where id = p_ciclo_id;

  return true;
end;
$$;

revoke all on function public.eliminar_ciclo(uuid) from public, anon;
grant execute on function public.eliminar_ciclo(uuid) to authenticated;

create or replace function public.eliminar_finca(p_finca_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform 1
    from public.fincas
   where id = p_finca_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'La finca no existe o no pertenece al usuario.';
  end if;

  update public.insumos i
     set actividad_id = null
    from public.ciclos c
    join public.lotes l on l.id = c.lote_id
   where i.ciclo_id = c.id
     and l.finca_id = p_finca_id
     and i.actividad_id is not null;

  update public.mano_de_obra m
     set actividad_id = null
    from public.ciclos c
    join public.lotes l on l.id = c.lote_id
   where m.ciclo_id = c.id
     and l.finca_id = p_finca_id
     and m.actividad_id is not null;

  delete from public.fincas
   where id = p_finca_id;

  return true;
end;
$$;

revoke all on function public.eliminar_finca(uuid) from public, anon;
grant execute on function public.eliminar_finca(uuid) to authenticated;
