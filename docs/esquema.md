# Esquema de AgroPyme AI

Este documento describe el esquema aplicado en Supabase. La fuente de verdad es la migración [`supabase/migrations/20261030210000_esquema_inicial.sql`](../supabase/migrations/20261030210000_esquema_inicial.sql).

## Convenciones

- Identificadores: `uuid` generados con `gen_random_uuid()`.
- Fechas de creación: `timestamptz` con valor por defecto `now()`.
- Fechas de actividad, cosecha y venta: `date`.
- Montos y áreas: `numeric`; no se permiten valores negativos.
- Cada tabla privada tiene `user_id`, `unique (id, user_id)` y RLS por `auth.uid()`.

## Tablas privadas

| Tabla | Campos principales | Relaciones y borrado |
|---|---|---|
| `fincas` | `nombre`, `municipio`, `cod_mun`, `latitud`, `longitud` | — |
| `lotes` | `finca_id`, `nombre`, `area_ha > 0` | Finca `on delete cascade` |
| `ciclos` | `lote_id`, `cultivo_id`, `fecha_inicio`, `fecha_fin`, `estado` | Lote `cascade`; cultivo `restrict` |
| `proveedores` | `nombre`, `contacto` | — |
| `actividades` | `ciclo_id`, `tipo`, `fecha`, `descripcion`, `otros_costos >= 0` | Ciclo `cascade` |
| `insumos` | `ciclo_id`, `actividad_id?`, `proveedor_id?`, fecha, cantidad, unidad y costo | Ciclo `cascade`; actividad/proveedor `restrict` |
| `mano_de_obra` | `ciclo_id`, `actividad_id?`, fecha, jornales y valor | Ciclo `cascade`; actividad `restrict` |
| `cosechas` | `ciclo_id`, fecha, cantidad, `unidad_id`, `cantidad_kg > 0` | Ciclo `cascade`; unidad `restrict` |
| `ventas` | `ciclo_id`, fecha, cantidad, `unidad_id`, `cantidad_kg`, precio y comprador | Ciclo `cascade`; unidad `restrict` |

Las relaciones incluyen `user_id`. Esto impide, además del RLS, vincular un lote a una finca de otro usuario o una actividad de otro ciclo.

## Catálogos compartidos

- `cultivos`: Maíz, Yuca, Ñame y Arroz.
- `unidades`: kg, bulto, tonelada, unidad y litro, con `factor_a_kg`.

Solo los usuarios autenticados pueden consultar estos catálogos. No tienen políticas de escritura para usuarios normales.

## RLS

RLS está activo en todas las tablas. Cada tabla privada tiene políticas `select`, `insert`, `update` y `delete` equivalentes a:

```sql
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id)
```

El rol `anon` no tiene permisos sobre datos privados. El rol `service_role` conserva acceso administrativo.

## Control de ventas

Los triggers diferibles `ventas_no_superan_cosecha` y `cosechas_no_superan_ventas` comparan, por ciclo:

- total vendido en kg;
- total cosechado en kg.

Si el total vendido supera al cosechado, PostgreSQL rechaza la operación con error `23514`. La validación también se ejecuta al cambiar o eliminar cosechas, para conservar la invariante.

## Prueba de aislamiento

El script [`supabase/tests/rls_dos_usuarios.sql`](../supabase/tests/rls_dos_usuarios.sql) prueba lectura, escritura y actualización con dos identidades autenticadas simuladas. Se ejecuta con:

```powershell
.\frontend\node_modules\.bin\supabase.cmd db query --linked --file .\supabase\tests\rls_dos_usuarios.sql
```

La prueba usa un `BEGIN` y `ROLLBACK`, por lo que no deja datos de prueba en el proyecto.
