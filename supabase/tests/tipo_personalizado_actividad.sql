-- Prueba del tipo personalizado para actividades de tipo "Otra".
-- Ejecutar con: supabase db query --linked --file supabase/tests/tipo_personalizado_actividad.sql
-- Todas las operaciones se revierten al final.

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ffffffff-ffff-4fff-8fff-ffffffffffff', true);

insert into public.fincas (id, user_id, nombre, municipio, latitud, longitud)
values ('ffffffff-0000-4000-8000-000000000001', 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        'Finca de prueba de tipo', 'Prueba', 1, -74);
insert into public.lotes (id, user_id, finca_id, nombre, area_ha, municipio)
values ('ffffffff-0000-4000-8000-000000000002', 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        'ffffffff-0000-4000-8000-000000000001', 'Lote de prueba de tipo', 1, 'Prueba');
insert into public.ciclos (id, user_id, lote_id, cultivo_id, fecha_inicio, estado)
values ('ffffffff-0000-4000-8000-000000000003', 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        'ffffffff-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000001',
        current_date, 'activo');

insert into public.actividades
  (id, user_id, ciclo_id, nombre, tipo, tipo_personalizado, fecha, descripcion, otros_costos)
values
  ('ffffffff-0000-4000-8000-000000000004', 'ffffffff-ffff-4fff-8fff-ffffffffffff',
   'ffffffff-0000-4000-8000-000000000003', 'Aplicación foliar', 'Otra',
   'Aplicación foliar', current_date, null, 0),
  ('ffffffff-0000-4000-8000-000000000005', 'ffffffff-ffff-4fff-8fff-ffffffffffff',
   'ffffffff-0000-4000-8000-000000000003', 'Otra sin especificar', 'Otra',
   null, current_date, null, 0);

do $$
begin
  if (select tipo_personalizado from public.actividades
      where id = 'ffffffff-0000-4000-8000-000000000004') <> 'Aplicación foliar'
     or exists (
       select 1 from public.actividades
       where id = 'ffffffff-0000-4000-8000-000000000005'
         and tipo_personalizado is not null
     ) then
    raise exception 'No se persistió correctamente el tipo personalizado';
  end if;
end;
$$;

update public.actividades
   set tipo = 'Riego',
       tipo_personalizado = null
 where id = 'ffffffff-0000-4000-8000-000000000004';

do $$
begin
  begin
    update public.actividades
       set tipo_personalizado = 'Valor no válido'
     where id = 'ffffffff-0000-4000-8000-000000000004';
    raise exception 'Se aceptó un tipo personalizado para un tipo distinto de Otra';
  exception
    when check_violation then null;
  end;
end;
$$;

reset role;
set constraints all immediate;
rollback;

select 'Tipo personalizado de actividad: OK' as resultado;
