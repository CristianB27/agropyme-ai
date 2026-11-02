-- Prueba de edición y eliminación segura de lotes.
-- Ejecutar con: supabase db query --linked --file supabase/tests/editar_eliminar_lote.sql
-- Todas las operaciones se revierten al final.

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);

insert into public.fincas (id, user_id, nombre, municipio, cod_mun, latitud, longitud)
values ('dddddddd-0000-4000-8000-000000000001', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'Finca de prueba de lotes', 'Municipio inicial', '50424', 1, -74);
insert into public.lotes (id, user_id, finca_id, nombre, area_ha, municipio, cod_mun)
values ('dddddddd-0000-4000-8000-000000000002', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'dddddddd-0000-4000-8000-000000000001', 'Lote de prueba', 1,
        'Municipio inicial', '50424');

insert into public.ciclos (id, user_id, lote_id, cultivo_id, fecha_inicio, estado)
values ('dddddddd-0000-4000-8000-000000000003', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'dddddddd-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000001',
        current_date, 'activo');
insert into public.actividades
  (id, user_id, ciclo_id, nombre, tipo, fecha, descripcion, otros_costos)
values ('dddddddd-0000-4000-8000-000000000004', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'dddddddd-0000-4000-8000-000000000003', 'Actividad inicial', 'Siembra',
        current_date, null, 0);
insert into public.insumos
  (id, user_id, ciclo_id, actividad_id, fecha, nombre, descripcion, cantidad, unidad, costo_unitario)
values ('dddddddd-0000-4000-8000-000000000005', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'dddddddd-0000-4000-8000-000000000003', 'dddddddd-0000-4000-8000-000000000004',
        current_date, 'Insumo inicial', null, 1, 'kg', 1000);
insert into public.mano_de_obra
  (id, user_id, ciclo_id, actividad_id, fecha, nombre, descripcion, num_jornales, valor_jornal)
values ('dddddddd-0000-4000-8000-000000000006', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'dddddddd-0000-4000-8000-000000000003', 'dddddddd-0000-4000-8000-000000000004',
        current_date, 'Jornal inicial', null, 1, 1000);
insert into public.cosechas
  (id, user_id, ciclo_id, fecha, cantidad, unidad_id, cantidad_kg)
values ('dddddddd-0000-4000-8000-000000000007', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'dddddddd-0000-4000-8000-000000000003', current_date, 1,
        '20000000-0000-0000-0000-000000000001', 1);
insert into public.ventas
  (id, user_id, ciclo_id, fecha, cantidad, unidad_id, cantidad_kg, precio_unitario, comprador)
values ('dddddddd-0000-4000-8000-000000000008', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'dddddddd-0000-4000-8000-000000000003', current_date, 1,
        '20000000-0000-0000-0000-000000000001', 1, 1000, null);

-- Un lote de otro usuario no puede eliminarse desde esta identidad.
reset role;
insert into public.fincas (id, user_id, nombre, municipio, latitud, longitud)
values ('cccccccc-0000-4000-8000-000000000001', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'Finca de otro usuario', 'Otro municipio', 1, -74);
insert into public.lotes (id, user_id, finca_id, nombre, area_ha, municipio)
values ('cccccccc-0000-4000-8000-000000000002', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'cccccccc-0000-4000-8000-000000000001', 'Lote de otro usuario', 1,
        'Otro municipio');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);

do $$
begin
  begin
    perform public.eliminar_lote('cccccccc-0000-4000-8000-000000000002');
    raise exception 'Se permitió eliminar un lote de otro usuario';
  exception
    when no_data_found then null;
  end;
end;
$$;

update public.lotes
   set nombre = 'Lote editado',
       area_ha = 2.5,
       municipio = 'Municipio editado',
       cod_mun = '50001'
 where id = 'dddddddd-0000-4000-8000-000000000002';

do $$
begin
  if (select nombre from public.lotes where id = 'dddddddd-0000-4000-8000-000000000002') <> 'Lote editado'
     or (select area_ha from public.lotes where id = 'dddddddd-0000-4000-8000-000000000002') <> 2.5
     or (select municipio from public.lotes where id = 'dddddddd-0000-4000-8000-000000000002') <> 'Municipio editado'
     or (select cod_mun from public.lotes where id = 'dddddddd-0000-4000-8000-000000000002') <> '50001' then
    raise exception 'No se aplicaron todos los cambios del lote';
  end if;
end;
$$;

select public.eliminar_lote('dddddddd-0000-4000-8000-000000000002');

do $$
begin
  if exists (select 1 from public.lotes where id = 'dddddddd-0000-4000-8000-000000000002')
     or exists (select 1 from public.ciclos where id = 'dddddddd-0000-4000-8000-000000000003')
     or exists (select 1 from public.actividades where id = 'dddddddd-0000-4000-8000-000000000004')
     or exists (select 1 from public.insumos where id = 'dddddddd-0000-4000-8000-000000000005')
     or exists (select 1 from public.mano_de_obra where id = 'dddddddd-0000-4000-8000-000000000006')
     or exists (select 1 from public.cosechas where id = 'dddddddd-0000-4000-8000-000000000007')
     or exists (select 1 from public.ventas where id = 'dddddddd-0000-4000-8000-000000000008') then
    raise exception 'El lote no se eliminó de forma segura';
  end if;
end;
$$;

reset role;
set constraints all immediate;
rollback;

select 'Edición y eliminación de lotes: OK' as resultado;
