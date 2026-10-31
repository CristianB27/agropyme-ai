-- Prueba de aislamiento RLS con dos identidades autenticadas.
-- Ejecutar con: supabase db query --linked --file supabase/tests/rls_dos_usuarios.sql
-- Todas las operaciones se revierten al final.

begin;
set local role authenticated;

-- Identidad A: crea un juego completo de datos propios.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

insert into public.fincas (id, user_id, nombre, municipio, latitud, longitud)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'Finca de prueba A', 'María la Baja', 9.98, -75.30);

insert into public.lotes (id, user_id, finca_id, nombre, area_ha)
values ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'aaaaaaaa-0000-4000-8000-000000000001', 'Lote de prueba A', 1.0);

insert into public.proveedores (id, user_id, nombre)
values ('aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'Proveedor de prueba A');

insert into public.ciclos (id, user_id, lote_id, cultivo_id, fecha_inicio, estado)
values ('aaaaaaaa-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'aaaaaaaa-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000001',
        '2026-01-01', 'activo');

insert into public.actividades (id, user_id, ciclo_id, tipo, fecha, descripcion, otros_costos)
values ('aaaaaaaa-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'aaaaaaaa-0000-4000-8000-000000000004', 'Siembra', '2026-01-02',
        'Actividad de prueba A', 0);

insert into public.insumos
  (id, user_id, ciclo_id, actividad_id, proveedor_id, fecha, nombre, cantidad, unidad, costo_unitario)
values ('aaaaaaaa-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'aaaaaaaa-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000005',
        'aaaaaaaa-0000-4000-8000-000000000003', '2026-01-02', 'Semilla de prueba A',
        1, 'kg', 1000);

insert into public.mano_de_obra
  (id, user_id, ciclo_id, actividad_id, fecha, num_jornales, valor_jornal)
values ('aaaaaaaa-0000-4000-8000-000000000007', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'aaaaaaaa-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000005',
        '2026-01-02', 1, 1000);

insert into public.cosechas
  (id, user_id, ciclo_id, fecha, cantidad, unidad_id, cantidad_kg)
values ('aaaaaaaa-0000-4000-8000-000000000008', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'aaaaaaaa-0000-4000-8000-000000000004', '2026-06-01', 100,
        '20000000-0000-0000-0000-000000000001', 100);

insert into public.ventas
  (id, user_id, ciclo_id, fecha, cantidad, unidad_id, cantidad_kg, precio_unitario)
values ('aaaaaaaa-0000-4000-8000-000000000009', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'aaaaaaaa-0000-4000-8000-000000000004', '2026-06-02', 50,
        '20000000-0000-0000-0000-000000000001', 50, 1100);

do $$
begin
  if (select count(*) from public.fincas) <> 1
     or (select count(*) from public.lotes) <> 1
     or (select count(*) from public.proveedores) <> 1
     or (select count(*) from public.ciclos) <> 1
     or (select count(*) from public.actividades) <> 1
     or (select count(*) from public.insumos) <> 1
     or (select count(*) from public.mano_de_obra) <> 1
     or (select count(*) from public.cosechas) <> 1
     or (select count(*) from public.ventas) <> 1 then
    raise exception 'A no leyó exactamente sus propios datos';
  end if;
  if (select count(*) from public.cultivos) <> 4
     or (select count(*) from public.unidades) <> 5 then
    raise exception 'Los catálogos compartidos no están disponibles';
  end if;
end;
$$;

-- A no puede escribir usando el user_id de B.
do $$
begin
  begin
    insert into public.fincas (user_id, nombre, municipio, latitud, longitud)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Finca prohibida', 'Arjona', 10.25, -75.35);
    raise exception 'La escritura con user_id ajeno no fue bloqueada';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

-- Identidad B: no puede leer ni modificar los datos de A.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);

do $$
begin
  if (select count(*) from public.fincas) <> 0
     or (select count(*) from public.lotes) <> 0
     or (select count(*) from public.ciclos) <> 0
     or (select count(*) from public.actividades) <> 0
     or (select count(*) from public.insumos) <> 0
     or (select count(*) from public.mano_de_obra) <> 0
     or (select count(*) from public.cosechas) <> 0
     or (select count(*) from public.ventas) <> 0 then
    raise exception 'B leyó datos de A';
  end if;
end;
$$;

do $$
declare
  filas_modificadas integer;
begin
  update public.fincas set nombre = 'Nombre alterado'
   where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics filas_modificadas = row_count;
  if filas_modificadas <> 0 then
    raise exception 'B pudo modificar la finca de A';
  end if;
end;
$$;

do $$
declare
  filas_eliminadas integer;
begin
  delete from public.fincas where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics filas_eliminadas = row_count;
  if filas_eliminadas <> 0 then
    raise exception 'B pudo borrar la finca de A';
  end if;
end;
$$;

-- B sí puede escribir sus propios datos.
insert into public.fincas (id, user_id, nombre, municipio, latitud, longitud)
values ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'Finca de prueba B', 'Arjona', 10.25, -75.35);

do $$
begin
  if (select count(*) from public.fincas) <> 1 then
    raise exception 'B no pudo escribir su propia finca';
  end if;
end;
$$;

-- Una venta no puede superar la cosecha total del ciclo.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
do $$
begin
  begin
    insert into public.ventas
      (user_id, ciclo_id, fecha, cantidad, unidad_id, cantidad_kg, precio_unitario)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000004',
            '2026-06-03', 60, '20000000-0000-0000-0000-000000000001', 60, 1100);
    set constraints all immediate;
    raise exception 'La venta por encima de la cosecha no fue bloqueada';
  exception
    when check_violation then
      null;
  end;
end;
$$;

reset role;
set constraints all immediate;
rollback;

select 'RLS dos usuarios: OK' as resultado;
