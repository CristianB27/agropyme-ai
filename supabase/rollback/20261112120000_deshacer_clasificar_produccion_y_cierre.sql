-- DESHACE la migración 20261112120000_clasificar_produccion_y_cierre.sql y deja
-- la base exactamente como estaba antes (funciones restauradas a su definición
-- original, copiada de la base el 12/11/2026 antes de aplicar la migración).
--
-- Ejecutar con:
--   .\frontend\node_modules\.bin\supabase.cmd db query --linked --file .\supabase\rollback\20261112120000_deshacer_clasificar_produccion_y_cierre.sql
--
-- Después, mover o borrar supabase/migrations/20261112120000_clasificar_produccion_y_cierre.sql
-- (si no, el próximo `supabase db push` la volvería a aplicar) y volver el código
-- del frontend y de la Edge Function a la versión anterior con git.
--
-- Se pierde lo que sólo existe con la migración: salidas de producción,
-- calidad, tipo de comprador y estado de pago. Las cosechas y ventas se conservan.
-- Antes de aplicar la migración no había ciclos finalizados sin fecha, así que
-- no hubo datos modificados que restaurar.

begin;

-- 1. Funciones nuevas de borrado.
drop function if exists public.eliminar_finca(uuid);
drop function if exists public.eliminar_ciclo(uuid);

-- 2. Restricción de cierre de ciclos.
alter table public.ciclos drop constraint if exists ciclos_finalizado_con_fecha_fin;

-- 3. Salidas de producción (sus triggers y políticas caen con la tabla).
drop table if exists public.salidas_produccion;

-- 4. Clasificación de ventas y cosechas.
alter table public.ventas
  drop column if exists estado_pago,
  drop column if exists tipo_comprador,
  drop column if exists calidad;

alter table public.cosechas
  drop column if exists descripcion,
  drop column if exists calidad;

-- 5. Función original de validación (sólo ventas contra cosechas).
CREATE OR REPLACE FUNCTION public.validar_ventas_no_superan_cosecha()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ciclo_a_validar uuid;
  ciclos_afectados uuid[] := array[]::uuid[];
  total_ventas numeric;
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
    -- Serializa ventas concurrentes del mismo ciclo para mantener la invariante.
    perform pg_advisory_xact_lock(hashtextextended(ciclo_a_validar::text, 0));

    select coalesce(sum(v.cantidad_kg), 0)
      into total_ventas
      from public.ventas v
     where v.ciclo_id = ciclo_a_validar;

    select coalesce(sum(c.cantidad_kg), 0)
      into total_cosechas
      from public.cosechas c
     where c.ciclo_id = ciclo_a_validar;

    if total_ventas > total_cosechas then
      raise exception using
        errcode = '23514',
        message = format(
          'Las ventas del ciclo %s (%s kg) superan la cosecha total (%s kg)',
          ciclo_a_validar,
          total_ventas,
          total_cosechas
        );
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

-- 6. Función original de conversión a kg (sin restricción de unidades de peso).
CREATE OR REPLACE FUNCTION public.calcular_cantidad_kg()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  factor numeric(14, 6);
begin
  select u.factor_a_kg
    into factor
    from public.unidades u
   where u.id = new.unidad_id;

  if factor is null then
    raise exception using
      errcode = '23503',
      message = format('La unidad %s no existe', new.unidad_id);
  end if;

  new.cantidad_kg := round(new.cantidad * factor, 4);
  return new;
end;
$function$;

-- 7. La arroba no existía. Si se usó, esos registros pasan a kg con la misma
--    cantidad en kg (no se pierde información) y luego se elimina la unidad.
update public.cosechas
   set cantidad = cantidad_kg,
       unidad_id = '20000000-0000-0000-0000-000000000001'
 where unidad_id = '20000000-0000-0000-0000-000000000006';

update public.ventas
   set cantidad = cantidad_kg,
       unidad_id = '20000000-0000-0000-0000-000000000001'
 where unidad_id = '20000000-0000-0000-0000-000000000006';

delete from public.unidades where id = '20000000-0000-0000-0000-000000000006';

alter table public.unidades drop column if exists es_masa;

-- 8. Quitar la migración del historial para que el CLI la vea como pendiente.
delete from supabase_migrations.schema_migrations where version = '20261112120000';

commit;

select 'Migración 20261112120000 deshecha' as resultado;
