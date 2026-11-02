-- Separa el nombre identificable del registro de su descripción opcional.
-- La migración conserva los datos históricos: las actividades usan su tipo como
-- nombre inicial y los registros antiguos de mano de obra se llaman "Jornal".

alter table public.actividades
  add column nombre text;

update public.actividades
set nombre = tipo
where nombre is null;

alter table public.actividades
  alter column nombre set not null;

alter table public.actividades
  add constraint actividades_nombre_no_vacio
  check (char_length(btrim(nombre)) > 0);

alter table public.actividades
  alter column descripcion drop not null;

alter table public.actividades
  drop constraint if exists actividades_descripcion_check;

alter table public.actividades
  add constraint actividades_descripcion_opcional
  check (descripcion is null or char_length(btrim(descripcion)) > 0);

alter table public.insumos
  add column descripcion text;

alter table public.insumos
  add constraint insumos_descripcion_opcional
  check (descripcion is null or char_length(btrim(descripcion)) > 0);

alter table public.mano_de_obra
  add column nombre text,
  add column descripcion text;

update public.mano_de_obra
set nombre = 'Jornal'
where nombre is null;

alter table public.mano_de_obra
  alter column nombre set not null;

alter table public.mano_de_obra
  add constraint mano_de_obra_nombre_no_vacio
  check (char_length(btrim(nombre)) > 0);

alter table public.mano_de_obra
  add constraint mano_de_obra_descripcion_opcional
  check (descripcion is null or char_length(btrim(descripcion)) > 0);
