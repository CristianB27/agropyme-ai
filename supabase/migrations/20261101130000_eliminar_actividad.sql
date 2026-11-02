-- Permite eliminar una actividad sin eliminar los registros de costos asociados.
-- Los insumos y jornales conservarán su información y quedarán sin actividad.
create or replace function public.eliminar_actividad(p_actividad_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.insumos
     set actividad_id = null
   where actividad_id = p_actividad_id;

  update public.mano_de_obra
     set actividad_id = null
   where actividad_id = p_actividad_id;

  delete from public.actividades
   where id = p_actividad_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'La actividad no existe o no pertenece al usuario.';
  end if;

  return true;
end;
$$;

revoke all on function public.eliminar_actividad(uuid) from public, anon;
grant execute on function public.eliminar_actividad(uuid) to authenticated;
