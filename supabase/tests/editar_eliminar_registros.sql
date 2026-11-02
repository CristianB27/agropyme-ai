-- Prueba de edición, eliminación y gestión dinámica de proveedores.
-- Ejecutar con: supabase db query --linked --file supabase/tests/editar_eliminar_registros.sql
-- Todas las operaciones se revierten al final.

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', true);

insert into public.fincas (id, user_id, nombre, municipio, latitud, longitud)
values ('eeeeeeee-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        'Finca de prueba CRUD', 'Prueba', 1, -74);
insert into public.lotes (id, user_id, finca_id, nombre, area_ha)
values ('eeeeeeee-0000-4000-8000-000000000002', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        'eeeeeeee-0000-4000-8000-000000000001', 'Lote de prueba CRUD', 1);
insert into public.ciclos (id, user_id, lote_id, cultivo_id, fecha_inicio, estado)
values ('eeeeeeee-0000-4000-8000-000000000003', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        'eeeeeeee-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000001',
        current_date, 'activo');
insert into public.proveedores (id, user_id, nombre, contacto)
values ('eeeeeeee-0000-4000-8000-000000000004', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        'Proveedor de prueba CRUD', ' contacto de prueba');

insert into public.actividades (id, user_id, ciclo_id, nombre, tipo, fecha, descripcion, otros_costos)
values ('eeeeeeee-0000-4000-8000-000000000005', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        'eeeeeeee-0000-4000-8000-000000000003', 'Actividad inicial', 'Siembra', current_date, null, 0);
insert into public.insumos
  (id, user_id, ciclo_id, actividad_id, proveedor_id, fecha, nombre, descripcion, cantidad, unidad, costo_unitario)
values ('eeeeeeee-0000-4000-8000-000000000006', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        'eeeeeeee-0000-4000-8000-000000000003', 'eeeeeeee-0000-4000-8000-000000000005',
        'eeeeeeee-0000-4000-8000-000000000004', current_date, 'Insumo inicial', null, 1, 'kg', 1000);
insert into public.mano_de_obra
  (id, user_id, ciclo_id, actividad_id, fecha, nombre, descripcion, num_jornales, valor_jornal)
values ('eeeeeeee-0000-4000-8000-000000000007', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        'eeeeeeee-0000-4000-8000-000000000003', 'eeeeeeee-0000-4000-8000-000000000005',
        current_date, 'Jornal inicial', null, 1, 1000);

update public.proveedores
   set nombre = 'Proveedor editado',
       contacto = 'Contacto editado'
 where id = 'eeeeeeee-0000-4000-8000-000000000004';
update public.actividades
   set nombre = 'Actividad editada',
       descripcion = 'Descripción editada'
 where id = 'eeeeeeee-0000-4000-8000-000000000005';
update public.insumos
   set nombre = 'Insumo editado',
       cantidad = 2,
       costo_unitario = 1500
 where id = 'eeeeeeee-0000-4000-8000-000000000006';
update public.mano_de_obra
   set nombre = 'Jornal editado',
       num_jornales = 2,
       valor_jornal = 1500
 where id = 'eeeeeeee-0000-4000-8000-000000000007';

do $$
begin
  if (select nombre from public.proveedores where id = 'eeeeeeee-0000-4000-8000-000000000004') <> 'Proveedor editado'
     or (select nombre from public.actividades where id = 'eeeeeeee-0000-4000-8000-000000000005') <> 'Actividad editada'
     or (select nombre from public.insumos where id = 'eeeeeeee-0000-4000-8000-000000000006') <> 'Insumo editado'
     or (select nombre from public.mano_de_obra where id = 'eeeeeeee-0000-4000-8000-000000000007') <> 'Jornal editado' then
    raise exception 'No se aplicaron todas las ediciones';
  end if;
end;
$$;

select public.eliminar_actividad('eeeeeeee-0000-4000-8000-000000000005');

do $$
begin
  if exists (select 1 from public.actividades where id = 'eeeeeeee-0000-4000-8000-000000000005')
     or exists (select 1 from public.insumos where id = 'eeeeeeee-0000-4000-8000-000000000006' and actividad_id is not null)
     or exists (select 1 from public.mano_de_obra where id = 'eeeeeeee-0000-4000-8000-000000000007' and actividad_id is not null) then
    raise exception 'La actividad no se eliminó de forma segura';
  end if;
end;
$$;

delete from public.insumos where id = 'eeeeeeee-0000-4000-8000-000000000006';
delete from public.mano_de_obra where id = 'eeeeeeee-0000-4000-8000-000000000007';
delete from public.proveedores where id = 'eeeeeeee-0000-4000-8000-000000000004';

do $$
begin
  if exists (select 1 from public.insumos where id = 'eeeeeeee-0000-4000-8000-000000000006')
     or exists (select 1 from public.mano_de_obra where id = 'eeeeeeee-0000-4000-8000-000000000007')
     or exists (select 1 from public.proveedores where id = 'eeeeeeee-0000-4000-8000-000000000004') then
    raise exception 'No se eliminaron todos los registros editables';
  end if;
end;
$$;

reset role;
set constraints all immediate;
rollback;

select 'Edición, eliminación y proveedores: OK' as resultado;
