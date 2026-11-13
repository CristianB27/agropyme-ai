# Esquema de AgroPyme AI

Este documento describe el esquema aplicado en Supabase. Las fuentes de verdad son las migraciones de [`supabase/migrations/`](../supabase/migrations/), desde [`20261030210000_esquema_inicial.sql`](../supabase/migrations/20261030210000_esquema_inicial.sql) hasta [`20261112120000_clasificar_produccion_y_cierre.sql`](../supabase/migrations/20261112120000_clasificar_produccion_y_cierre.sql).

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
| `lotes` | `finca_id`, `nombre`, `area_ha > 0`, `municipio`, `cod_mun?` | Finca `on delete cascade` |
| `ciclos` | `lote_id`, `cultivo_id`, `fecha_inicio`, `fecha_fin`, `estado` (`activo`/`finalizado`); un ciclo finalizado exige `fecha_fin` | Lote `cascade`; cultivo `restrict` |
| `proveedores` | `nombre`, `contacto` | — |
| `actividades` | `ciclo_id`, `nombre`, `tipo`, `tipo_personalizado?`, `fecha`, `descripcion?`, `otros_costos >= 0` | Ciclo `cascade` |
| `insumos` | `ciclo_id`, `actividad_id?`, `proveedor_id?`, fecha, `nombre`, `descripcion?`, cantidad, unidad y costo | Ciclo `cascade`; actividad/proveedor `restrict` |
| `mano_de_obra` | `ciclo_id`, `actividad_id?`, fecha, `nombre`, `descripcion?`, jornales y valor | Ciclo `cascade`; actividad `restrict` |
| `cosechas` | `ciclo_id`, fecha, cantidad, `unidad_id`, `cantidad_kg > 0`, `calidad`, `descripcion?` | Ciclo `cascade`; unidad `restrict` |
| `ventas` | `ciclo_id`, fecha, cantidad, `unidad_id`, `cantidad_kg`, `precio_unitario` (COP/kg), `comprador?`, `calidad`, `tipo_comprador?`, `estado_pago` | Ciclo `cascade`; unidad `restrict` |
| `salidas_produccion` | `ciclo_id`, fecha, `tipo`, cantidad, `unidad_id`, `cantidad_kg > 0`, `descripcion?` | Ciclo `cascade`; unidad `restrict` |

Las relaciones incluyen `user_id`. Esto impide, además del RLS, vincular un lote a una finca de otro usuario o una actividad de otro ciclo.

Cada lote conserva su propio `municipio` y su código DANE opcional `cod_mun`. Al agregar la migración, estos valores se copiaron desde la finca asociada para mantener el historial; posteriormente, editar el municipio de un sub-lote no modifica los demás lotes de la misma finca. El municipio de la finca continúa siendo la referencia geográfica para el pronóstico climático.

Los registros de insumos, actividades y mano de obra mantienen separados el campo `nombre`, que identifica el registro, y el campo opcional `descripcion`, que se muestra en la ventana de detalles. En una descripción vacía se almacena `NULL`.

Cuando el tipo general de una actividad es `Otra`, el campo opcional `tipo_personalizado` guarda el nombre específico que escribió el usuario. La base de datos exige que este valor no esté vacío y que sólo exista cuando `tipo = 'Otra'`; si el usuario cambia a un tipo estándar, el valor se almacena como `NULL`.

### Clasificación de la producción

| Campo | Valores | Uso |
|---|---|---|
| `cosechas.calidad`, `ventas.calidad` | `primera`, `segunda`, `tercera`, `sin_clasificar` (por defecto) | Comparar cuánto se produjo y a qué precio se vendió cada calidad |
| `ventas.tipo_comprador` | `intermediario`, `cooperativa`, `plaza_mercado`, `industria`, `consumidor_final`, `otro` o `NULL` | Saber a qué canal conviene vender |
| `ventas.estado_pago` | `pagado` (por defecto), `por_cobrar` | Separar lo cobrado de lo fiado |
| `salidas_produccion.tipo` | `autoconsumo`, `alimento_animal`, `semilla`, `donacion`, `perdida` | Producción que sale sin venderse |

Las salidas existen porque un pequeño productor rara vez vende todo: parte se consume en el hogar, se da a los animales, se guarda como semilla o se pierde. Sin registrarlas, ese producto quedaría como "pendiente de venta" para siempre, el ciclo nunca se cerraría y la proyección lo valoraría a precio de mercado.

## Catálogos compartidos

- `cultivos`: Maíz, Yuca, Ñame y Arroz.
- `unidades`: kg, arroba (12,5 kg), bulto (50 kg), tonelada, unidad y litro, con `factor_a_kg` y `es_masa`. Sólo las unidades de peso (`es_masa = true`) se aceptan en cosechas, ventas y salidas; `unidad` y `litro` se conservan para insumos.

Solo los usuarios autenticados pueden consultar estos catálogos. No tienen políticas de escritura para usuarios normales.

## RLS

RLS está activo en todas las tablas. Cada tabla privada tiene políticas `select`, `insert`, `update` y `delete` equivalentes a:

```sql
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id)
```

El rol `anon` no tiene permisos sobre datos privados. El rol `service_role` conserva acceso administrativo.

## Eliminación segura de actividades

La función `public.eliminar_actividad(p_actividad_id uuid)` elimina una actividad sin eliminar los insumos ni los jornales asociados. Primero establece `actividad_id = null` en ambos registros de costos y después elimina la actividad. Todas las operaciones se ejecutan en una sola transacción.

La función usa `security invoker`, por lo que las políticas RLS siguen aplicando: sólo se pueden modificar o eliminar registros del usuario autenticado. La migración revoca la ejecución para `public` y `anon`, y la concede a `authenticated`.

## Eliminación segura de lotes

La función `public.eliminar_lote(p_lote_id uuid)` elimina un lote y todos sus registros relacionados dentro de una sola transacción. Antes de borrar el lote, la función desvincula los insumos y jornales de sus actividades para resolver las claves foráneas `ON DELETE RESTRICT`. Después, la eliminación en cascada de PostgreSQL elimina sus ciclos, actividades, insumos, jornales, cosechas y ventas.

La función usa `security invoker`, por lo que las políticas RLS siguen aplicando: sólo se puede eliminar un lote del usuario autenticado. La interfaz de Mis Lotes muestra un diálogo de confirmación, explica que la acción no se puede deshacer y presenta el número de registros afectados antes de solicitar la confirmación.

## Eliminación segura de ciclos y fincas

`public.eliminar_ciclo(p_ciclo_id uuid)` y `public.eliminar_finca(p_finca_id uuid)` siguen el mismo patrón que `eliminar_lote`: desvinculan insumos y jornales de sus actividades y luego eliminan en cascada. Usan `security invoker`, de modo que RLS sigue aplicando.

## Conversión de cantidades a kg

El trigger `calcular_cantidad_kg` se ejecuta antes de insertar o modificar `cosechas`, `ventas` y `salidas_produccion`. Rechaza con error `22023` las unidades que no son de peso. Consulta `unidades.factor_a_kg` y escribe:

```sql
new.cantidad_kg := round(new.cantidad * factor, 4);
```

La aplicación inserta la cantidad en la unidad elegida y omite `cantidad_kg`; PostgreSQL conserva el resultado convertido. Esto evita que el frontend y la base de datos appliquen conversiones distintas.

## Control de ventas

Los triggers diferibles `ventas_no_superan_cosecha`, `salidas_no_superan_cosecha` y `cosechas_no_superan_ventas` comparan, por ciclo:

- total vendido más total de salidas sin venta, en kg;
- total cosechado en kg.

Si lo vendido más las salidas supera lo cosechado, PostgreSQL rechaza la operación con error `23514`. La validación también se ejecuta al cambiar o eliminar cosechas, para conservar la invariante.

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

El script [`supabase/tests/editar_eliminar_registros.sql`](../supabase/tests/editar_eliminar_registros.sql) comprueba la edición de proveedores, actividades, insumos y jornales; la desvinculación segura de una actividad y la eliminación de los registros editables:

```powershell
.\frontend\node_modules\.bin\supabase.cmd db query --linked --file .\supabase\tests\editar_eliminar_registros.sql
```

La prueba usa una transacción y termina con `ROLLBACK`, por lo que no deja datos de prueba en el proyecto.

El script [`supabase/tests/tipo_personalizado_actividad.sql`](../supabase/tests/tipo_personalizado_actividad.sql) comprueba que el nombre específico de una actividad de tipo `Otra` se persista, que el valor sea opcional y que no pueda asociarse a un tipo distinto:

```powershell
.\frontend\node_modules\.bin\supabase.cmd db query --linked --file .\supabase\tests\tipo_personalizado_actividad.sql
```

Este script también usa una transacción y termina con `ROLLBACK`.

El script [`supabase/tests/editar_eliminar_lote.sql`](../supabase/tests/editar_eliminar_lote.sql) comprueba la edición de nombre, área, municipio y código DANE de un lote, además de la eliminación atómica de sus ciclos y registros asociados:

```powershell
.\frontend\node_modules\.bin\supabase.cmd db query --linked --file .\supabase\tests\editar_eliminar_lote.sql
```

La prueba utiliza una transacción y termina con `ROLLBACK`, por lo que no deja datos de prueba en el proyecto.

El script [`supabase/tests/salidas_y_clasificacion.sql`](../supabase/tests/salidas_y_clasificacion.sql) comprueba la conversión de arrobas, la clasificación de cosechas y ventas, el rechazo de salidas que superan la cosecha y de unidades que no son de peso, la fecha obligatoria al finalizar un ciclo y el borrado con `eliminar_ciclo` y `eliminar_finca`:

```powershell
.\frontend\node_modules\.bin\supabase.cmd db query --linked --file .\supabase\tests\salidas_y_clasificacion.sql
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

- `fincas`, `lotes`, `ciclos`, `actividades`, `insumos`, `mano_de_obra`, `cosechas`, `ventas` y `salidas_produccion`;
- el catálogo compartido `cultivos`.

Las tablas privadas aplican RLS, por lo que cada consulta queda limitada a `auth.uid() = user_id`. Un token válido de otro usuario no puede consultar los datos del usuario que realiza la pregunta.

### Cálculo del resumen

`summary.ts` consolida los registros por ciclo con las mismas definiciones usadas por el frontend en `frontend/src/utils/calculos.ts`. La suite Deno compara ambas implementaciones con los mismos datos para impedir que sus fórmulas diverjan.

Para cada ciclo se usan estas magnitudes:

- `Q`: total cosechado en kg;
- `Qv`: total vendido en kg;
- `Qperdida`: salidas de tipo pérdida en kg;
- `QusoPropio`: autoconsumo, alimento animal, semilla y donación en kg;
- `Qnv = Q − Qv − Qperdida − QusoPropio`: producción en bodega, pendiente de venta;
- `C = costo de insumos + costo de jornales + otros costos`: costo total;
- `Ir = suma(cantidad_kg × precio_unitario)`: ingresos realizados.

Los indicadores se calculan así:

- costo unitario: `C / (Q − Qperdida)` (las pérdidas encarecen cada kg aprovechable; sin pérdidas equivale a `C / Q`);
- costo de lo vendido: `costo unitario × Qv`;
- costo del uso propio: `costo unitario × QusoPropio` (informativo);
- ingresos por cobrar: suma de las ventas con `estado_pago = por_cobrar` (están incluidas en `Ir`);
- precio promedio de venta: `Ir / Qv` (es el precio sugerido para la proyección);
- margen realizado: `Ir − costo de lo vendido`;
- margen sobre ventas: `margen realizado / Ir`;
- rentabilidad sobre costos: `margen realizado / costo de lo vendido`;
- resultado proyectado del ciclo: `Ir + Qnv × precio estimado − C`.

El resultado proyectado usa el precio estimado que edita el usuario. Siempre se presenta separado de lo realizado y rotulado **Estimación**; no es una utilidad realizada. La rentabilidad usa el costo de lo vendido como denominador, no `C`, para no imputar a las ventas la totalidad de los costos de producción.

Mientras `Qnv > 0`, los indicadores que dependen de lo vendido se rotulan **parcial**. Si `Q = 0`, `Qv = 0` o `Ir = 0`, cada indicador dependiente de esa base se muestra como **no disponible** (`null` internamente). Las implementaciones nunca dividen por cero.

El cálculo rechaza áreas, cantidades o precios no positivos y rechaza ventas cuya suma `Qv` supere `Q`. PostgreSQL mantiene además las restricciones `cantidad > 0` y `precio_unitario > 0`, y los triggers diferibles `ventas_no_superan_cosecha` y `cosechas_no_superan_ventas` preservan la invariante en cada ciclo.

El ciclo de regresión de maíz en Lote Norte, de 2,5 ha, valida estas fórmulas: insumos `$3.466.000`, jornales `$3.390.000`, otros costos `$2.000.000` y `C = $8.856.000`; `Q = 11.250 kg`, `Qv = 10.500 kg`, `Qnv = 750 kg` e `Ir = $11.775.000`. El costo unitario es `$787,20/kg`, el costo de lo vendido es `$8.265.600`, el margen realizado es `$3.509.400`, el margen sobre ventas es `29,8 %` y la rentabilidad sobre costos es `42,5 %`. El costo por hectárea es `$3.542.400` y el rendimiento es `4.500 kg/ha`. Si los 750 kg pendientes se venden a `$1.150/kg`, el resultado proyectado es `$3.781.500` y se presenta como estimación.

### Clasificador local y respuesta determinista

El asistente no usa un modelo de lenguaje externo. Para cada pregunta:

1. se quita el saludo inicial ("hola, ...", "porfa ...") si después viene una pregunta, y un clasificador local (TF-IDF de palabras y caracteres con regresión logística multinomial, entrenado con `scripts/asistente/entrenar.py` y exportado a `model.ts` y `model_data.ts`) elige una de 13 intenciones; los n-gramas de caracteres hacen que tolere errores de escritura;
2. un resolver acotado corrige casos conocidos y un veto server-side rechaza pedidos de recomendaciones o dosis de agroquímicos;
3. `fallback.ts` construye la respuesta con las cifras del resumen real del usuario y devuelve `source: "fallback"`.

`anthropic.ts` es código heredado: sin `ANTHROPIC_API_KEY` no hace ninguna llamada externa y, por decisión del proyecto, esa clave **no** se configura.

### Pruebas y despliegue

Las pruebas de resumen, fallback, paridad con el frontend y modelo se ejecutan con:

```powershell
npx --yes deno test --allow-read supabase/functions/asistente
```

La función se publica sin Docker mediante empaquetado server-side:

```powershell
.\frontend\node_modules\.bin\supabase.cmd functions deploy asistente --project-ref uedjzflmzpyzriyjxhyd --use-api
```

El estado desplegado de la función puede comprobarse con:

```powershell
.\frontend\node_modules\.bin\supabase.cmd functions list --project-ref uedjzflmzpyzriyjxhyd
```
