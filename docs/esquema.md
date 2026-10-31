# Esquema de AgroPyme AI

Este documento describe el esquema aplicado en Supabase. Las fuentes de verdad son las migraciones [`supabase/migrations/20261030210000_esquema_inicial.sql`](../supabase/migrations/20261030210000_esquema_inicial.sql) y [`supabase/migrations/20261030220000_calcular_cantidad_kg.sql`](../supabase/migrations/20261030220000_calcular_cantidad_kg.sql).

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

## Conversión de cantidades a kg

El trigger `calcular_cantidad_kg` se ejecuta antes de insertar o modificar `cosechas` y `ventas`. Consulta `unidades.factor_a_kg` y escribe:

```sql
new.cantidad_kg := round(new.cantidad * factor, 4);
```

La aplicación inserta la cantidad en la unidad elegida y omite `cantidad_kg`; PostgreSQL conserva el resultado convertido. Esto evita que el frontend y la base de datos appliquen conversiones distintas.

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

El script [`supabase/tests/cantidad_kg.sql`](../supabase/tests/cantidad_kg.sql) comprueba la conversión de bultos y toneladas a kg y el rechazo de una unidad inexistente:

```powershell
.\frontend\node_modules\.bin\supabase.cmd db query --linked --file .\supabase\tests\cantidad_kg.sql
```

## Clima por finca

El frontend consulta `https://api.open-meteo.com/v1/forecast` con la latitud y longitud de cada finca. El resultado se conserva en memoria durante 30 minutos y la clave incluye el UUID y las coordenadas para invalidarlo si la ubicación cambia.

Cada `ClimaFinca` contiene:

- `finca_id`: UUID de la finca asociada;
- `pronostico`: cinco días con temperatura máxima, mínima y precipitación;
- `alerta`: aviso informativo cuando se prevén 40 mm o más de lluvia;
- `error`: mensaje de error o timeout, si la consulta no pudo completarse.

Open-Meteo no recibe ni requiere el JWT del usuario. La carga del clima es independiente de la carga principal y no bloquea el render de la aplicación.

## Asistente IA

La Supabase Edge Function [`supabase/functions/asistente/index.ts`](../supabase/functions/asistente/index.ts) recibe `POST` en JSON con:

```json
{
  "question": "¿Cuánto costó producir Maíz?",
  "history": [{ "role": "user", "content": "..." }],
  "clima": [{ "finca_id": "...", "pronostico": [], "alerta": null, "error": null }]
}
```

La función exige un JWT de Supabase. `supabase/config.toml` mantiene `verify_jwt = true` y la propia función vuelve a validar el token mediante `auth.getUser()`. Antes de resumir, limita y valida el contrato de los snapshots climáticos enviados por el cliente: identificadores y textos acotados, máximo cinco días por finca y valores numéricos finitos. Un snapshot malformado se descarta.

### Acceso a datos y RLS

`data.ts` crea un cliente Supabase con la clave pública y el JWT del usuario como rol `authenticated`; no usa `service_role`. Lee por separado:

- `fincas`, `lotes`, `ciclos`, `actividades`, `insumos`, `mano_de_obra`, `cosechas` y `ventas`;
- el catálogo compartido `cultivos`.

Las tablas privadas aplican RLS, por lo que cada consulta queda limitada a `auth.uid() = user_id`. Un token válido de otro usuario no puede consultar los datos del usuario que realiza la pregunta.

### Cálculo del resumen

`summary.ts` consolida los registros por ciclo con las mismas definiciones usadas por el frontend en `frontend/src/utils/calculos.ts`. La suite Deno compara ambas implementaciones con los mismos datos para impedir que sus fórmulas diverjan.

Para cada ciclo se usan estas magnitudes:

- `Q`: total cosechado en kg;
- `Qv`: total vendido en kg;
- `Qnv = Q − Qv`: cosecha pendiente de venta en kg;
- `C = costo de insumos + costo de jornales + otros costos`: costo total;
- `Ir = suma(cantidad_kg × precio_unitario)`: ingresos realizados.

Los indicadores se calculan así:

- costo unitario: `C / Q`;
- costo de lo vendido: `(C / Q) × Qv`;
- margen realizado: `Ir − costo de lo vendido`;
- margen sobre ventas: `margen realizado / Ir`;
- rentabilidad sobre costos: `margen realizado / costo de lo vendido`;
- resultado proyectado del ciclo: `Ir + Qnv × precio estimado − C`.

El resultado proyectado usa el precio estimado que edita el usuario. Siempre se presenta separado de lo realizado y rotulado **Estimación**; no es una utilidad realizada. La rentabilidad usa el costo de lo vendido como denominador, no `C`, para no imputar a las ventas la totalidad de los costos de producción.

Mientras `Qnv > 0`, los indicadores que dependen de lo vendido se rotulan **parcial**. Si `Q = 0`, `Qv = 0` o `Ir = 0`, cada indicador dependiente de esa base se muestra como **no disponible** (`null` internamente). Las implementaciones nunca dividen por cero.

El cálculo rechaza áreas, cantidades o precios no positivos y rechaza ventas cuya suma `Qv` supere `Q`. PostgreSQL mantiene además las restricciones `cantidad > 0` y `precio_unitario > 0`, y los triggers diferibles `ventas_no_superan_cosecha` y `cosechas_no_superan_ventas` preservan la invariante en cada ciclo.

El ciclo de regresión de maíz en Lote Norte, de 2,5 ha, valida estas fórmulas: insumos `$3.466.000`, jornales `$3.390.000`, otros costos `$2.000.000` y `C = $8.856.000`; `Q = 11.250 kg`, `Qv = 10.500 kg`, `Qnv = 750 kg` e `Ir = $11.775.000`. El costo unitario es `$787,20/kg`, el costo de lo vendido es `$8.265.600`, el margen realizado es `$3.509.400`, el margen sobre ventas es `29,8 %` y la rentabilidad sobre costos es `42,5 %`. El costo por hectárea es `$3.542.400` y el rendimiento es `4.500 kg/ha`. Si los 750 kg pendientes se venden a `$1.150/kg`, el resultado proyectado es `$3.781.500` y se presenta como estimación.

### Anthropic y fallback

`anthropic.ts` llama server-side a la Messages API de Anthropic con timeout de 30 segundos. El modelo por defecto es el alias oficial activo `claude-sonnet-5-5` y puede cambiarse mediante el secreto `ANTHROPIC_MODEL`.

La API key se lee exclusivamente desde `ANTHROPIC_API_KEY` en el entorno de Edge Functions. Nunca se expone al bundle de Vite ni se incluye en Git.

- Si existe la clave y Anthropic responde, la respuesta usa `source: "anthropic"`.
- Si falta la clave o Anthropic falla, `fallback.ts` calcula una respuesta determinística según la intención (costos, rentabilidad, jornales, insumos, clima o resumen) y devuelve `source: "fallback"`.
- En ambos casos, las cifras provienen del consolidado de datos reales del usuario autenticado. No hay mocks en producción. El frontend etiqueta la respuesta determinística y muestra el aviso de fallback.

### Pruebas y despliegue

Las pruebas unitarias de resumen y fallback se ejecutan con:

```powershell
npx --yes deno test supabase/functions/asistente/asistente_test.ts
```

La función se publica sin Docker mediante empaquetado server-side:

```powershell
.\frontend\node_modules\.bin\supabase.cmd functions deploy asistente --project-ref TU_PROJECT_REF --use-api
```

La configuración de la clave se realiza como secreto:

```powershell
.\frontend\node_modules\.bin\supabase.cmd secrets set ANTHROPIC_API_KEY=CLAVE_DE_ANTHROPIC
```

El estado desplegado de la función puede comprobarse con:

```powershell
.\frontend\node_modules\.bin\supabase.cmd functions list --project-ref TU_PROJECT_REF
```
