-- Permite editar el nombre, área y municipio de cada lote.
-- El municipio se mantiene también en el lote para no modificar silenciosamente
-- los lotes hermanos cuando se edita un sub-lote.
alter table public.lotes
  add column municipio text,
  add column cod_mun text;

update public.lotes l
   set municipio = f.municipio,
       cod_mun = f.cod_mun
  from public.fincas f
 where f.id = l.finca_id
   and f.user_id = l.user_id;

alter table public.lotes
  alter column municipio set not null;

alter table public.lotes
  add constraint lotes_municipio_no_vacio
    check (char_length(btrim(municipio)) > 0);

alter table public.lotes
  add constraint lotes_cod_mun_opcional
    check (cod_mun is null or char_length(btrim(cod_mun)) > 0);

-- Elimina un lote de forma atómica. Primero se desvinculan los insumos y
-- jornales de las actividades porque sus claves foráneas usan ON DELETE RESTRICT.
-- Al eliminar el lote, PostgreSQL elimina en cascada sus ciclos y los registros
-- dependedientes (actividades, insumos, jornales, cosechas y ventas).
create or replace function public.eliminar_lote(p_lote_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform 1
    from public.lotes
   where id = p_lote_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'El lote no existe o no pertenece al usuario.';
  end if;

  update public.insumos
     set actividad_id = null
   where actividad_id in (
     select a.id
       from public.actividades a
       join public.ciclos c on c.id = a.ciclo_id
      where c.lote_id = p_lote_id
   );

  update public.mano_de_obra
     set actividad_id = null
   where actividad_id in (
     select a.id
       from public.actividades a
       join public.ciclos c on c.id = a.ciclo_id
      where c.lote_id = p_lote_id
   );

  delete from public.lotes
   where id = p_lote_id;

  return true;
end;
$$;

revoke all on function public.eliminar_lote(uuid) from public, anon;
grant execute on function public.eliminar_lote(uuid) to authenticated;
