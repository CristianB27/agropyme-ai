-- Permite registrar el nombre específico de una actividad cuyo tipo es "Otra".
-- El valor es opcional y sólo puede existir cuando el tipo general es "Otra".

alter table public.actividades
  add column tipo_personalizado text;

alter table public.actividades
  add constraint actividades_tipo_personalizado_opcional
  check (
    tipo_personalizado is null
    or (
      tipo = 'Otra'
      and char_length(btrim(tipo_personalizado)) > 0
    )
  );
