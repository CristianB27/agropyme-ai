-- Prueba de conversión automática de cantidad a kg.
-- Ejecutar con: supabase db query --linked --file supabase/tests/cantidad_kg.sql
-- Todas las operaciones se revierten al final.

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);

insert into public.fincas (id, user_id, nombre, municipio, latitud, longitud)
values ('cccccccc-0000-4000-8000-000000000001', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'Finca de prueba de conversión', 'Prueba', 1, -74);

insert into public.lotes (id, user_id, finca_id, nombre, area_ha)
values ('cccccccc-0000-4000-8000-000000000002', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'cccccccc-0000-4000-8000-000000000001', 'Lote de prueba de conversión', 1);

insert into public.ciclos (id, user_id, lote_id, cultivo_id, fecha_inicio, estado)
values ('cccccccc-0000-4000-8000-000000000003', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'cccccccc-0000-4000-8000-000000000002',
        '10000000-0000-0000-0000-000000000001', current_date, 'activo');

-- 2 bultos deben convertirse a 100 kg. La columna se omite para probar el trigger.
insert into public.cosechas (id, user_id, ciclo_id, fecha, cantidad, unidad_id)
values ('cccccccc-0000-4000-8000-000000000004', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'cccccccc-0000-4000-8000-000000000003', current_date, 2,
        '20000000-0000-0000-0000-000000000002');

do $$
declare
  v_cantidad_kg numeric;
begin
  select c.cantidad_kg into v_cantidad_kg
    from public.cosechas c
   where c.id = 'cccccccc-0000-4000-8000-000000000004';

  if v_cantidad_kg is distinct from 100.0000 then
    raise exception 'Se esperaba 100 kg y se obtuvo %', v_cantidad_kg;
  end if;
end;
$$;

-- 2 toneladas deben convertirse a 2.000 kg para la cosecha.
insert into public.cosechas (id, user_id, ciclo_id, fecha, cantidad, unidad_id)
values ('cccccccc-0000-4000-8000-000000000005', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'cccccccc-0000-4000-8000-000000000003', current_date, 2,
        '20000000-0000-0000-0000-000000000003');

-- 1,5 toneladas deben convertirse a 1.500 kg para la venta.
insert into public.ventas (id, user_id, ciclo_id, fecha, cantidad, unidad_id, precio_unitario, comprador)
values ('cccccccc-0000-4000-8000-000000000006', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'cccccccc-0000-4000-8000-000000000003', current_date, 1.5,
        '20000000-0000-0000-0000-000000000003', 1000, 'Comprador de prueba');

do $$
declare
  v_cantidad_kg numeric;
begin
  select v.cantidad_kg into v_cantidad_kg
    from public.ventas v
   where v.id = 'cccccccc-0000-4000-8000-000000000006';

  if v_cantidad_kg is distinct from 1500.0000 then
    raise exception 'Se esperaba 1500 kg y se obtuvo %', v_cantidad_kg;
  end if;
end;
$$;

-- Una unidad inexistente debe ser rechazada.
do $$
begin
  begin
    insert into public.cosechas (id, user_id, ciclo_id, fecha, cantidad, unidad_id)
    values ('cccccccc-0000-4000-8000-000000000007', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            'cccccccc-0000-4000-8000-000000000003', current_date, 1,
            '99999999-9999-9999-9999-999999999999');
    raise exception 'La unidad inexistente debió ser rechazada';
  exception
    when foreign_key_violation then
      null;
  end;
end;
$$;

reset role;
set constraints all immediate;
rollback;

select 'Conversión automática a kg: OK' as resultado;
