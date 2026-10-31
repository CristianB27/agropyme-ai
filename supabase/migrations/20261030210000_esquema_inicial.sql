-- AgroPyme AI: esquema inicial de producciÃ³n y datos del usuario.
-- La seguridad por fila se aplica en todas las tablas privadas.

create extension if not exists pgcrypto;

-- FINCAS ---------------------------------------------------------------------
create table public.fincas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid(),
  nombre text not null check (char_length(btrim(nombre)) > 0),
  municipio text not null check (char_length(btrim(municipio)) > 0),
  cod_mun text null check (cod_mun is null or char_length(btrim(cod_mun)) > 0),
  latitud double precision not null check (latitud between -90 and 90),
  longitud double precision not null check (longitud between -180 and 180),
  unique (id, user_id)
);

-- LOTES ---------------------------------------------------------------------
create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid(),
  finca_id uuid not null,
  nombre text not null check (char_length(btrim(nombre)) > 0),
  area_ha numeric(12, 4) not null check (area_ha > 0),
  unique (id, user_id),
  foreign key (finca_id, user_id)
    references public.fincas (id, user_id) on delete cascade
);

-- CATÃLOGOS COMPARTIDOS ------------------------------------------------------
create table public.cultivos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null unique check (char_length(btrim(nombre)) > 0)
);

create table public.unidades (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null unique check (char_length(btrim(nombre)) > 0),
  factor_a_kg numeric(14, 6) not null check (factor_a_kg > 0)
);

-- CICLOS --------------------------------------------------------------------
create table public.ciclos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid(),
  lote_id uuid not null,
  cultivo_id uuid not null,
  fecha_inicio date not null,
  fecha_fin date null,
  estado text not null check (estado in ('activo', 'finalizado')),
  unique (id, user_id),
  foreign key (lote_id, user_id)
    references public.lotes (id, user_id) on delete cascade,
  foreign key (cultivo_id) references public.cultivos (id) on delete restrict,
  check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

-- PROVEEDORES ---------------------------------------------------------------
create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid(),
  nombre text not null check (char_length(btrim(nombre)) > 0),
  contacto text null,
  unique (id, user_id)
);

-- ACTIVIDADES ---------------------------------------------------------------
create table public.actividades (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid(),
  ciclo_id uuid not null,
  tipo text not null check (char_length(btrim(tipo)) > 0),
  fecha date not null,
  descripcion text not null check (char_length(btrim(descripcion)) > 0),
  otros_costos numeric(14, 2) not null default 0 check (otros_costos >= 0),
  unique (id, user_id),
  unique (id, ciclo_id, user_id),
  foreign key (ciclo_id, user_id)
    references public.ciclos (id, user_id) on delete cascade
);

-- INSUMOS ------------------------------------------------------------------
create table public.insumos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid(),
  ciclo_id uuid not null,
  actividad_id uuid null,
  proveedor_id uuid null,
  fecha date not null,
  nombre text not null check (char_length(btrim(nombre)) > 0),
  cantidad numeric(14, 4) not null check (cantidad > 0),
  unidad text not null check (char_length(btrim(unidad)) > 0),
  costo_unitario numeric(14, 2) not null check (costo_unitario >= 0),
  unique (id, user_id),
  foreign key (ciclo_id, user_id)
    references public.ciclos (id, user_id) on delete cascade,
  foreign key (actividad_id, ciclo_id, user_id)
    references public.actividades (id, ciclo_id, user_id) on delete restrict,
  foreign key (proveedor_id, user_id)
    references public.proveedores (id, user_id) on delete restrict
);

-- MANO DE OBRA --------------------------------------------------------------
create table public.mano_de_obra (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid(),
  ciclo_id uuid not null,
  actividad_id uuid null,
  fecha date not null,
  num_jornales numeric(12, 2) not null check (num_jornales > 0),
  valor_jornal numeric(14, 2) not null check (valor_jornal >= 0),
  unique (id, user_id),
  foreign key (ciclo_id, user_id)
    references public.ciclos (id, user_id) on delete cascade,
  foreign key (actividad_id, ciclo_id, user_id)
    references public.actividades (id, ciclo_id, user_id) on delete restrict
);


-- COSECHAS -----------------------------------------------------------------
create table public.cosechas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid(),
  ciclo_id uuid not null,
  fecha date not null,
  cantidad numeric(14, 4) not null check (cantidad > 0),
  unidad_id uuid not null references public.unidades (id) on delete restrict,
  cantidad_kg numeric(16, 4) not null check (cantidad_kg > 0),
  unique (id, user_id),
  foreign key (ciclo_id, user_id)
    references public.ciclos (id, user_id) on delete cascade
);

-- VENTAS -------------------------------------------------------------------
create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid(),
  ciclo_id uuid not null,
  fecha date not null,
  cantidad numeric(14, 4) not null check (cantidad > 0),
  unidad_id uuid not null references public.unidades (id) on delete restrict,
  cantidad_kg numeric(16, 4) not null check (cantidad_kg > 0),
  precio_unitario numeric(14, 2) not null check (precio_unitario > 0),
  comprador text null,
  unique (id, user_id),
  foreign key (ciclo_id, user_id)
    references public.ciclos (id, user_id) on delete cascade
);

-- Un trigger diferible valida tanto ventas nuevas como cambios en cosechas.
-- De esta forma ninguna operaciÃ³n puede dejar ventas por encima de la cosecha.
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
$$;

create constraint trigger ventas_no_superan_cosecha
after insert or update or delete on public.ventas
deferrable initially deferred
for each row execute function public.validar_ventas_no_superan_cosecha();

create constraint trigger cosechas_no_superan_ventas
after insert or update or delete on public.cosechas
deferrable initially deferred
for each row execute function public.validar_ventas_no_superan_cosecha();

-- ÃNDICES DE CLAVES FORÃNEAS -------------------------------------------------
create index idx_lotes_finca_id on public.lotes (finca_id);
create index idx_ciclos_lote_id on public.ciclos (lote_id);
create index idx_ciclos_cultivo_id on public.ciclos (cultivo_id);
create index idx_actividades_ciclo_id on public.actividades (ciclo_id);
create index idx_insumos_ciclo_id on public.insumos (ciclo_id);
create index idx_insumos_actividad_id on public.insumos (actividad_id);
create index idx_insumos_proveedor_id on public.insumos (proveedor_id);
create index idx_mano_de_obra_ciclo_id on public.mano_de_obra (ciclo_id);
create index idx_mano_de_obra_actividad_id on public.mano_de_obra (actividad_id);
create index idx_cosechas_ciclo_id on public.cosechas (ciclo_id);
create index idx_cosechas_unidad_id on public.cosechas (unidad_id);
create index idx_ventas_ciclo_id on public.ventas (ciclo_id);
create index idx_ventas_unidad_id on public.ventas (unidad_id);

-- CATÃLOGOS INICIALES -------------------------------------------------------
insert into public.cultivos (id, nombre) values
  ('10000000-0000-0000-0000-000000000001', 'MaÃ­z'),
  ('10000000-0000-0000-0000-000000000002', 'Yuca'),
  ('10000000-0000-0000-0000-000000000003', 'Ã‘ame'),
  ('10000000-0000-0000-0000-000000000004', 'Arroz');

insert into public.unidades (id, nombre, factor_a_kg) values
  ('20000000-0000-0000-0000-000000000001', 'kg', 1),
  ('20000000-0000-0000-0000-000000000002', 'bulto', 50),
  ('20000000-0000-0000-0000-000000000003', 'tonelada', 1000),
  ('20000000-0000-0000-0000-000000000004', 'unidad', 1),
  ('20000000-0000-0000-0000-000000000005', 'litro', 1);

-- RLS ----------------------------------------------------------------------
alter table public.fincas enable row level security;
alter table public.lotes enable row level security;
alter table public.cultivos enable row level security;
alter table public.ciclos enable row level security;
alter table public.proveedores enable row level security;
alter table public.actividades enable row level security;
alter table public.insumos enable row level security;
alter table public.mano_de_obra enable row level security;
alter table public.unidades enable row level security;
alter table public.cosechas enable row level security;
alter table public.ventas enable row level security;

do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'fincas', 'lotes', 'ciclos', 'proveedores', 'actividades',
    'insumos', 'mano_de_obra', 'cosechas', 'ventas'
  ] loop
    execute format(
      'create policy "%1$s_select_own" on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)',
      tabla
    );
    execute format(
      'create policy "%1$s_insert_own" on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)',
      tabla
    );
    execute format(
      'create policy "%1$s_update_own" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      tabla
    );
    execute format(
      'create policy "%1$s_delete_own" on public.%1$I for delete to authenticated using ((select auth.uid()) = user_id)',
      tabla
    );
  end loop;
end;
$$;

create policy cultivos_read_authenticated
  on public.cultivos for select to authenticated using (true);
create policy unidades_read_authenticated
  on public.unidades for select to authenticated using (true);

-- Permisos: los datos privados solo se conceden a usuarios autenticados.
revoke all on public.fincas, public.lotes, public.ciclos, public.proveedores,
  public.actividades, public.insumos, public.mano_de_obra, public.cosechas,
  public.ventas from anon;
grant select, insert, update, delete on public.fincas, public.lotes, public.ciclos,
  public.proveedores, public.actividades, public.insumos, public.mano_de_obra,
  public.cosechas, public.ventas to authenticated;
revoke all on public.cultivos, public.unidades from anon;
grant select on public.cultivos, public.unidades to authenticated;
grant all on all tables in schema public to service_role;
