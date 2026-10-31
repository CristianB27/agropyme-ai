-- AgroPyme AI: conversión de cantidades a kg mediante el factor del catálogo.
--
-- Las tablas cosechas y ventas reciben `cantidad` en la unidad seleccionada y
-- `cantidad_kg` se calcula en PostgreSQL para mantener una única fuente de verdad.

create or replace function public.calcular_cantidad_kg()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
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
$$;

create trigger cosechas_calcular_cantidad_kg
before insert or update of cantidad, unidad_id on public.cosechas
for each row execute function public.calcular_cantidad_kg();

create trigger ventas_calcular_cantidad_kg
before insert or update of cantidad, unidad_id on public.ventas
for each row execute function public.calcular_cantidad_kg();
