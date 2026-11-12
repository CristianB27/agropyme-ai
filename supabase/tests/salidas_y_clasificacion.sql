-- Prueba de la migración 20261112120000_clasificar_produccion_y_cierre.
-- Ejecutar con: supabase db query --linked --file supabase/tests/salidas_y_clasificacion.sql
-- Todas las operaciones se revierten al final.

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);

insert into public.fincas (id, user_id, nombre, municipio, latitud, longitud)
values ('dddddddd-0000-4000-8000-000000000001', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'Finca de prueba de salidas', 'Prueba', 10, -75);

insert into public.lotes (id, user_id, finca_id, nombre, area_ha, municipio)
values ('dddddddd-0000-4000-8000-000000000002', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'dddddddd-0000-4000-8000-000000000001', 'Lote de prueba de salidas', 1, 'Prueba');

insert into public.ciclos (id, user_id, lote_id, cultivo_id, fecha_inicio, estado)
values ('dddddddd-0000-4000-8000-000000000003', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'dddddddd-0000-4000-8000-000000000002',
        '10000000-0000-0000-0000-000000000001', current_date, 'activo');

-- 1. Cosecha de 40 arrobas (500 kg) clasificada como primera.
insert into public.cosechas (id, user_id, ciclo_id, fecha, cantidad, unidad_id, calidad)
values ('dddddddd-0000-4000-8000-000000000004', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'dddddddd-0000-4000-8000-000000000003', current_date, 40,
        '20000000-0000-0000-0000-000000000006', 'primera');

do $$
declare
  v_kg numeric;
  v_calidad text;
begin
  select cantidad_kg, calidad into v_kg, v_calidad
    from public.cosechas
   where id = 'dddddddd-0000-4000-8000-000000000004';
  if v_kg is distinct from 500.0000 then
    raise exception '40 arrobas deben ser 500 kg y se obtuvo %', v_kg;
  end if;
  if v_calidad is distinct from 'primera' then
    raise exception 'Se esperaba calidad primera y se obtuvo %', v_calidad;
  end if;
end;
$$;

-- 2. Venta por cobrar de 300 kg y salidas de 100 kg (autoconsumo) y 50 kg (pérdida).
insert into public.ventas (id, user_id, ciclo_id, fecha, cantidad, unidad_id, precio_unitario,
                           calidad, tipo_comprador, estado_pago)
values ('dddddddd-0000-4000-8000-000000000005', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'dddddddd-0000-4000-8000-000000000003', current_date, 300,
        '20000000-0000-0000-0000-000000000001', 1500, 'primera', 'cooperativa', 'por_cobrar');

insert into public.salidas_produccion (id, user_id, ciclo_id, fecha, tipo, cantidad, unidad_id)
values ('dddddddd-0000-4000-8000-000000000006', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'dddddddd-0000-4000-8000-000000000003', current_date, 'autoconsumo', 100,
        '20000000-0000-0000-0000-000000000001'),
       ('dddddddd-0000-4000-8000-000000000007', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'dddddddd-0000-4000-8000-000000000003', current_date, 'perdida', 50,
        '20000000-0000-0000-0000-000000000001');

set constraints all immediate;

-- 3. Una salida que haga superar la cosecha (300 + 150 + 51 > 500) debe rechazarse.
do $$
begin
  begin
    insert into public.salidas_produccion (user_id, ciclo_id, fecha, tipo, cantidad, unidad_id)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'dddddddd-0000-4000-8000-000000000003',
            current_date, 'semilla', 51, '20000000-0000-0000-0000-000000000001');
    set constraints all immediate;
    raise exception 'Se esperaba rechazo por superar la cosecha';
  exception
    when check_violation then
      null;
  end;
end;
$$;

-- 4. Las unidades que no son de peso se rechazan.
do $$
begin
  begin
    insert into public.cosechas (user_id, ciclo_id, fecha, cantidad, unidad_id)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'dddddddd-0000-4000-8000-000000000003',
            current_date, 10, '20000000-0000-0000-0000-000000000005');
    raise exception 'Se esperaba rechazo de la unidad litro';
  exception
    when invalid_parameter_value then
      null;
  end;
end;
$$;

-- 5. Valores de clasificación inválidos se rechazan.
do $$
begin
  begin
    update public.ventas set estado_pago = 'regalado'
     where id = 'dddddddd-0000-4000-8000-000000000005';
    raise exception 'Se esperaba rechazo del estado de pago';
  exception
    when check_violation then
      null;
  end;
end;
$$;

-- 6. Un ciclo no puede finalizarse sin fecha de cierre.
do $$
begin
  begin
    update public.ciclos set estado = 'finalizado', fecha_fin = null
     where id = 'dddddddd-0000-4000-8000-000000000003';
    raise exception 'Se esperaba rechazo de ciclo finalizado sin fecha';
  exception
    when check_violation then
      null;
  end;
end;
$$;

update public.ciclos set estado = 'finalizado', fecha_fin = current_date
 where id = 'dddddddd-0000-4000-8000-000000000003';

-- 7. eliminar_ciclo borra el ciclo con todos sus registros de producción.
select public.eliminar_ciclo('dddddddd-0000-4000-8000-000000000003');

do $$
begin
  if exists (select 1 from public.salidas_produccion where ciclo_id = 'dddddddd-0000-4000-8000-000000000003')
     or exists (select 1 from public.ventas where ciclo_id = 'dddddddd-0000-4000-8000-000000000003')
     or exists (select 1 from public.cosechas where ciclo_id = 'dddddddd-0000-4000-8000-000000000003') then
    raise exception 'eliminar_ciclo debía borrar cosechas, ventas y salidas';
  end if;
end;
$$;

-- 8. eliminar_finca borra la finca con sus lotes.
select public.eliminar_finca('dddddddd-0000-4000-8000-000000000001');

do $$
begin
  if exists (select 1 from public.lotes where id = 'dddddddd-0000-4000-8000-000000000002') then
    raise exception 'eliminar_finca debía borrar el lote';
  end if;
end;
$$;

select 'OK: salidas, clasificación, cierre y borrado seguro' as resultado;

rollback;
