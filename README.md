# AgroPyme AI

Aplicación web para que pequeños y medianos productores agrícolas sepan **cuánto les cuesta producir, cuánto venden y si ganan o pierden** en cada lote y en cada siembra. El productor registra fincas, lotes, ciclos, costos, cosechas y ventas. La aplicación calcula costos, rendimiento y rentabilidad, muestra el pronóstico del clima por finca y responde preguntas sobre los propios datos en un chat.

- **Aplicación publicada:** [agropyme-ai.vercel.app](https://agropyme-ai.vercel.app)
- **Proyecto académico:** Proyecto de Ingeniería I (NRC 1236), Universidad Tecnológica de Bolívar. Integrantes: Cristian Matteo Benitez Montes y Santiago Payares.
- **Estado:** avance funcional y probado (Avances 1 a 5). No es una versión 1.0 ni un producto comercial.

> Para revisar o editar el informe [`IETR1433_Lab.tex`](IETR1433_Lab.tex), lee primero [`docs/guia_informe_latex.md`](docs/guia_informe_latex.md). Allí están las reglas editoriales, el detalle metodológico del ML y la lista de afirmaciones del informe que ya no coinciden con el código.

## Contenido

1. [Cómo funciona](#1-cómo-funciona)
2. [Qué se registra](#2-qué-se-registra)
3. [Cómo se calculan los resultados](#3-cómo-se-calculan-los-resultados)
4. [Pantallas](#4-pantallas)
5. [Arquitectura](#5-arquitectura)
6. [Clima, referencia de maíz y asistente](#6-clima-referencia-de-maíz-y-asistente)
7. [Estado de los requisitos y pendientes](#7-estado-de-los-requisitos-y-pendientes)
8. [Instalación y ejecución](#8-instalación-y-ejecución)
9. [Pruebas](#9-pruebas)
10. [Despliegue](#10-despliegue)
11. [Cómo deshacer la migración del 12/11/2026](#11-cómo-deshacer-la-migración-del-12112026)
12. [Mapa del repositorio](#12-mapa-del-repositorio)
13. [Glosario](#13-glosario)

## 1. Cómo funciona

El problema que resuelve: un productor sabe cuánto cosechó, pero rara vez sabe cuánto le costó producir cada kilo, qué lote fue más rentable o si al final de la temporada ganó dinero. Las herramientas comerciales que lo resuelven (Granular, Conservis) están pensadas para fincas grandes y son costosas.

AgroPyme organiza la información así:

```text
Productor (cuenta de usuario)
 └─ Finca            nombre, municipio DANE, ubicación (para el clima)
     └─ Lote         nombre, área en hectáreas
         └─ Ciclo    un cultivo sembrado en el lote: inicio, fin, estado
             ├─ Costos:      insumos · jornales · actividades (otros costos)
             └─ Producción:  cosechas · ventas · salidas sin venta
```

El **ciclo** es la unidad que se evalúa: una siembra de un cultivo (maíz, yuca, ñame o arroz) en un lote, desde que empieza hasta que se cierra. Todos los indicadores se calculan por ciclo.

El flujo de uso es: crear la finca y el lote → abrir un ciclo → registrar costos a medida que ocurren → registrar cosechas, ventas y lo que se consumió o perdió → revisar el Dashboard → finalizar el ciclo.

**Modelo de negocio comercial:** todavía no está definido (no hay precio, plan de suscripción ni cliente pagador decidido). Hoy la aplicación es gratuita y de uso académico.

## 2. Qué se registra

| Registro | Datos que se piden | Para qué sirve |
|---|---|---|
| Finca | nombre, municipio (selector DANE), latitud y longitud (botón “Usar mi ubicación actual”) | Agrupa lotes; la ubicación da el pronóstico del clima; el código DANE activa la referencia histórica de maíz |
| Lote | nombre, área (ha), municipio | El área permite calcular costo por hectárea y rendimiento |
| Ciclo | lote, cultivo, fecha de inicio; al cerrarlo, fecha de fin | Agrupa todo lo que pasa en una siembra |
| Insumo | nombre, cantidad × costo unitario, unidad, proveedor, actividad (opcional) | Semillas, fertilizantes, agroquímicos… |
| Jornal | nombre, número de jornales × valor del jornal, actividad (opcional) | Mano de obra |
| Actividad | tipo (preparación, siembra, riego, fertilización, deshierba, control de plagas, cosecha u otra), fecha, otros costos | Labores del ciclo y costos que no son insumo ni jornal (por ejemplo, alquiler de tractor) |
| Cosecha | cantidad y unidad (kg, arroba, bulto, tonelada), **calidad** | Cuánto se produjo y de qué calidad |
| Venta | cantidad y unidad, **precio en la unidad negociada**, calidad, tipo de comprador, nombre del comprador, **pagado o por cobrar** | Ingresos; la app convierte el precio a COP/kg |
| Salida sin venta | tipo (consumo del hogar, alimento para animales, semilla, regalo, **pérdida**), cantidad y unidad | Producción que no se vendió |

Clasificaciones disponibles:

- **Calidad:** primera, segunda, tercera/descarte o sin clasificar.
- **Tipo de comprador:** intermediario, cooperativa, plaza de mercado, industria, consumidor final u otro.
- **Estado de pago:** pagado o por cobrar (fiado).

Todas las cantidades se guardan también en kg. La conversión la hace PostgreSQL con el factor de cada unidad: arroba 12,5 kg, bulto 50 kg y tonelada 1.000 kg. Cosechas, ventas y salidas sólo aceptan unidades de peso. La suma de lo vendido y de las salidas nunca puede superar lo cosechado; la base de datos lo impide.

## 3. Cómo se calculan los resultados

Para un ciclo en un lote de área `A` (ha):

| Símbolo | Significado |
|---|---|
| `C` | costo total = insumos + jornales + otros costos |
| `Q` | kg cosechados |
| `Qv` | kg vendidos |
| `Qperdida` | kg perdidos |
| `QusoPropio` | kg consumidos en el hogar, dados a animales, guardados como semilla o regalados |
| `Qnv` | kg en bodega sin vender = `Q − Qv − Qperdida − QusoPropio` |
| `Ir` | ingresos = Σ (kg vendidos × precio por kg), incluidas las ventas por cobrar |

| Indicador | Fórmula | Lectura |
|---|---|---|
| Costo por hectárea | `C / A` | Compara lotes de distinto tamaño |
| Costo por kg | `C / (Q − Qperdida)` | Cuánto costó producir cada kg aprovechable. Las pérdidas lo encarecen; sin pérdidas es `C / Q` |
| Costo de lo vendido | costo por kg × `Qv` | Parte del costo que corresponde a lo vendido |
| Margen realizado | `Ir − costo de lo vendido` | Ganancia sobre lo vendido. **No** es `Ir − C` |
| Margen sobre ventas | margen / `Ir` | De cada $100 vendidos, cuánto es ganancia |
| Rentabilidad sobre costos | margen / costo de lo vendido | De cada $100 de costo, cuánto se ganó |
| Rendimiento | `Q / A` | kg por hectárea |
| Precio promedio de venta | `Ir / Qv` | Precio sugerido para la proyección |
| Ventas por cobrar | Σ ventas marcadas “por cobrar” | Dinero que aún no ha entrado |
| Costo del uso propio | costo por kg × `QusoPropio` | Lo que costó producir lo que se quedó en la finca |
| Resultado proyectado | `Ir + Qnv × precio estimado − C` | **Estimación** si se vende lo que queda en bodega |

Reglas:

- Mientras quede producto en bodega (`Qnv > 0`), los indicadores de venta se marcan **parciales**.
- Si no hay cosecha o ventas, los indicadores que dependen de ellas aparecen como **no disponible**. Nunca se divide por cero.
- Lo consumido o perdido no cuenta como “pendiente de venta”. Por eso el ciclo puede quedar completo y la proyección no valora a precio de mercado un producto que ya no existe.
- El resultado proyectado siempre se presenta separado y rotulado como estimación.
- Las fórmulas están duplicadas a propósito en [`frontend/src/utils/calculos.ts`](frontend/src/utils/calculos.ts) y [`supabase/functions/asistente/summary.ts`](supabase/functions/asistente/summary.ts). Una prueba comprueba que ambas den resultados idénticos.

### Ejemplo de referencia (caso de prueba oficial)

Lote de 2,5 ha de maíz, sin pérdidas ni uso propio:

| Concepto | Valor |
|---|---:|
| Insumos | $3.466.000 |
| Jornales (42 × $45.000 + 30 × $50.000) | $3.390.000 |
| Otros costos (alquiler de tractor) | $2.000.000 |
| **Costo total `C`** | **$8.856.000** |
| Costo por hectárea | $3.542.400 |
| Cosechado / vendido / en bodega | 11.250 / 10.500 / 750 kg |
| Costo por kg | $787,20 |
| Ingresos `Ir` | $11.775.000 |
| Costo de lo vendido | $8.265.600 |
| **Margen realizado** | **$3.509.400** |
| Margen sobre ventas / rentabilidad sobre costos | 29,8 % / 42,5 % |
| Rendimiento | 4.500 kg/ha |
| Resultado proyectado si los 750 kg se venden a $1.150/kg | $3.781.500 (estimación) |

## 4. Pantallas

| Pantalla | Qué hace |
|---|---|
| **Acceso** | Registro e inicio de sesión (Supabase Auth) |
| **Dashboard** | Selector de ciclo; costo total, ingresos, rentabilidad y producto en bodega; detalle de costo por ha y por kg, precio promedio, margen, rendimiento, uso propio, pérdidas y ventas por cobrar; producción y precio por calidad; gráficos; estimación con precio editable; clima; referencia histórica de maíz |
| **Mis Lotes** | Crear, editar y eliminar fincas (con ubicación GPS) y lotes; crear ciclos; finalizar, reabrir y eliminar ciclos; detalle de costos por lote |
| **Registro de Costos** | Alta, edición y eliminación de insumos, jornales y actividades; alta de proveedores |
| **Cosechas y Ventas** | Cosechas, ventas y salidas sin venta con su clasificación; balance de la producción; edición, eliminación y “marcar como pagada” |
| **Asistente IA** | Chat sobre los datos del usuario, con preguntas sugeridas |

## 5. Arquitectura

```text
Navegador (React 18 + TypeScript + Vite + Tailwind)
  ├─ Supabase Auth ─────────── sesión y JWT
  ├─ Supabase PostgreSQL ───── lectura/escritura con RLS (cada usuario ve sólo lo suyo)
  ├─ Open-Meteo ────────────── pronóstico de 5 días por finca (sin clave)
  └─ Edge Function `asistente` (Deno)
       ├─ valida el JWT y lee los datos del usuario con RLS (no usa service_role)
       ├─ clasificador local de 13 intenciones
       ├─ veto de recomendaciones de agroquímicos
       └─ respuesta calculada con los datos reales
```

- **Datos:** el esquema completo, las restricciones y RLS están en [`docs/esquema.md`](docs/esquema.md). Las migraciones de [`supabase/migrations/`](supabase/migrations/) son la fuente de verdad.
- **Seguridad:** todas las tablas privadas tienen RLS `auth.uid() = user_id` y claves foráneas que incluyen al propietario. El rol `anon` no tiene acceso a datos privados.
- **Borrado seguro:** las funciones `eliminar_actividad`, `eliminar_lote`, `eliminar_ciclo` y `eliminar_finca` borran en una transacción y respetan RLS.

## 6. Clima, referencia de maíz y asistente

**Clima.** El navegador consulta Open-Meteo con la ubicación de cada finca: temperatura máxima, mínima y lluvia para 5 días, con caché de 30 minutos y timeout de 10 s. Muestra un aviso cuando se prevén 40 mm o más de lluvia en un día. El aviso es informativo y ese umbral aún no tiene validación agronómica.

**Referencia histórica de rendimiento de maíz.** Un Random Forest entrenado con las Evaluaciones Agropecuarias Municipales (EVA 2007–2018) y clima ERA5-Land produce el rendimiento típico por municipio, sistema (tradicional o tecnificado) y semestre: 2.831 combinaciones en 1.065 municipios. La app lo muestra junto al rendimiento real del lote. Es una **referencia histórica, no una predicción**:

- en la prueba 2019–2024 su error (MAE 0,877 t/ha) es prácticamente igual al de la mediana histórica (0,887 t/ha), y la diferencia no es estadísticamente significativa;
- el rango típico de error cubre el 60,5 % de los casos, no el 80 %.

El pipeline está en [`ml/`](ml/) y el detalle metodológico en la guía del informe.

**Asistente.** No usa un modelo de lenguaje externo. Un clasificador local (regresión logística exportada a TypeScript) identifica el tipo de pregunta entre 13 intenciones: costos, costo por ha, costo por kg, jornales, insumos, ventas, rentabilidad, producción, comparación de ciclos, clima, explicación de indicadores, saludo y fuera de alcance. Luego responde con cifras calculadas sobre los datos reales del usuario. Por seguridad rechaza pedidos de recomendaciones o dosis de agroquímicos. El archivo [`anthropic.ts`](supabase/functions/asistente/anthropic.ts) es código heredado que no se usa: no hay ni se debe configurar `ANTHROPIC_API_KEY`.

## 7. Estado de los requisitos y pendientes

| Requisito | Estado |
|---|---|
| RF1 Usuarios, fincas, lotes, cultivos y ciclos | Implementado (incluye edición y borrado de fincas, lotes y ciclos, y cierre de ciclos) |
| RF2 Actividades, insumos, proveedores y jornales | Implementado. Los proveedores sólo se pueden crear, no editar ni eliminar |
| RF3 Producción y ventas por ciclo | Implementado: cosechas, ventas y salidas sin venta, con clasificación |
| RF4 Costos e indicadores de rentabilidad | Implementado |
| RF5 Clima y alertas por finca | Implementado; falta validar el umbral de 40 mm con un agrónomo |
| RF6 Asistente conversacional | Implementado; sin métrica de exactitud posterior a la integración |
| RF7 Roles y acceso compartido a fincas | Pendiente |
| RNF1 Usabilidad móvil | Interfaz responsiva; faltan pruebas con al menos 3 productores |
| RNF2 Seguridad | RLS probada con dos usuarios (prueba SQL); falta evidencia visual |
| RNF3 Desempeño | Sin medición p95 |
| RNF4 Uso sin conexión | Pendiente |

Otros pendientes: reportes automáticos del ciclo, histórico comparativo dedicado, modelos de yuca y ñame, edición de proveedores y definición del modelo de negocio comercial.

## 8. Instalación y ejecución

Requisitos: Node.js 18 o posterior, un proyecto Supabase y, para el ML, Python 3.12.

```powershell
cd frontend
npm install
Copy-Item .env.example .env   # completar con la URL y la clave pública de Supabase
npm run dev                   # http://localhost:5173
```

`frontend/.env` sólo lleva valores públicos:

```dotenv
VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
```

Nunca coloques `service_role` ni otros secretos en el `.env` de Vite.

Para el pipeline de maíz, sigue [`ml/README.md`](ml/README.md). Los datos EVA crudos (`data/`) no están en Git y se colocan a mano.

## 9. Pruebas

| Conjunto | Comando | Resultado al 12/11/2026 |
|---|---|---|
| Frontend (Vitest) | `cd frontend; npm test` | 39 pruebas en 6 archivos |
| Tipos, lint y build | `npm run typecheck; npm run lint; npm run build` | Sin errores (5 advertencias de lint previas) |
| Edge Function (Deno) | `npx --yes deno test --allow-read supabase/functions/asistente` | 17 pruebas, incluida la paridad de fórmulas con el frontend |
| SQL contra Supabase | `.\frontend\node_modules\.bin\supabase.cmd db query --linked --file .\supabase\tests\<archivo>.sql` | 6 scripts aprobados |
| ML | `python -m pytest ml/tests` | Requiere `data/processed/` local |

Los scripts SQL ([`supabase/tests/`](supabase/tests/)) envuelven todo en una transacción con `ROLLBACK`, así que no dejan datos:

- `rls_dos_usuarios`: aislamiento entre dos usuarios;
- `cantidad_kg`: conversión a kg;
- `salidas_y_clasificacion`: arrobas, calidad, salidas, unidades de peso, cierre y borrado de ciclos y fincas;
- `editar_eliminar_registros`, `editar_eliminar_lote` y `tipo_personalizado_actividad`.

## 10. Despliegue

Proyecto Supabase enlazado: `uedjzflmzpyzriyjxhyd` (región `us-west-2`).

```powershell
# Base de datos: aplica las migraciones pendientes
.\frontend\node_modules\.bin\supabase.cmd db push --linked

# Edge Function del asistente (versión 7 desde el 12/11/2026)
.\frontend\node_modules\.bin\supabase.cmd functions deploy asistente --project-ref uedjzflmzpyzriyjxhyd --use-api
.\frontend\node_modules\.bin\supabase.cmd functions list --project-ref uedjzflmzpyzriyjxhyd
```

El frontend se publica en Vercel ([`frontend/vercel.json`](frontend/vercel.json) reescribe las rutas de la SPA). No hay CI/CD: cada cambio de la función o de la base se despliega a mano.

## 11. Cómo deshacer la migración del 12/11/2026

La migración [`20261112120000_clasificar_produccion_y_cierre.sql`](supabase/migrations/20261112120000_clasificar_produccion_y_cierre.sql) agregó la clasificación de cosechas y ventas, las salidas sin venta, la arroba, la regla de fecha de cierre y las funciones `eliminar_ciclo` y `eliminar_finca`. Al aplicarla no se modificó ningún dato existente.

Para volver al estado anterior:

```powershell
# 1. Deshacer en la base (restaura las funciones originales y quita lo agregado)
.\frontend\node_modules\.bin\supabase.cmd db query --linked --file .\supabase\rollback\20261112120000_deshacer_clasificar_produccion_y_cierre.sql

# 2. Retirar la migración para que `db push` no la vuelva a aplicar
Remove-Item .\supabase\migrations\20261112120000_clasificar_produccion_y_cierre.sql

# 3. Volver el código anterior y redesplegar la función
git checkout 876fc44 -- frontend supabase/functions   # 876fc44 = último commit antes de estos cambios
.\frontend\node_modules\.bin\supabase.cmd functions deploy asistente --project-ref uedjzflmzpyzriyjxhyd --use-api
```

`git checkout` no borra los archivos que se crearon después de ese commit: elimina también `frontend/src/screens/RegistroProduccion.tsx`, `frontend/src/utils/cosechasVentas.ts` y `frontend/tests/produccion.test.ts`, `frontend/tests/cosechasVentas.test.ts`.

Se pierden sólo los datos que dependen de la migración: salidas sin venta, calidad, tipo de comprador y estado de pago. Las cosechas y ventas se conservan; si alguna usó arroba, pasa a kg con la misma cantidad.

## 12. Mapa del repositorio

```text
├─ README.md                     este documento
├─ IETR1433_Lab.tex              informe académico (Avances 1 a 5)
├─ docs/
│  ├─ esquema.md                 esquema de datos, RLS, triggers y fórmulas
│  ├─ guia_informe_latex.md      guía para revisar/editar el informe y detalle del ML
│  └─ trazabilidad_documento.md  evidencia del corte del 31/10/2026
├─ frontend/
│  ├─ src/screens/               Auth, Dashboard, MisLotes, RegistroCostos, RegistroProduccion, AsistenteIA
│  ├─ src/components/            layout, modales, selector DANE, tarjeta de maíz
│  ├─ src/services/              Supabase, clima y cliente del asistente
│  ├─ src/utils/                 cálculos, catálogos de producción, formato, maíz
│  ├─ src/data/                  referencia de maíz en JSON
│  └─ tests/                     pruebas Vitest
├─ supabase/
│  ├─ migrations/                esquema y cambios (fuente de verdad)
│  ├─ rollback/                  scripts para deshacer migraciones
│  ├─ tests/                     pruebas SQL (transaccionales)
│  └─ functions/asistente/       Edge Function: datos, resumen, modelo, fallback, pruebas
├─ ml/                           pipeline de rendimiento de maíz y reportes
└─ scripts/export_assistant_model.py   exporta el clasificador sklearn a TypeScript
```

No versionados: `data/` (datos EVA y artefactos), `ml/models/` y `experimentos/asistente_propio/` (fuentes del clasificador). [`model_data.ts`](supabase/functions/asistente/model_data.ts) es generado: no editarlo a mano.

## 13. Glosario

| Término | Significado |
|---|---|
| Ciclo | Una siembra de un cultivo en un lote, de inicio a cierre |
| Jornal | Un día de trabajo de una persona |
| Salida sin venta | Producción cosechada que no se vende: consumo, animales, semilla, regalo o pérdida |
| En bodega | Producción cosechada que aún no se vende ni tiene otro destino (`Qnv`) |
| DANE | Departamento Administrativo Nacional de Estadística (códigos de municipio) |
| EVA | Evaluaciones Agropecuarias Municipales (UPRA/MADR) |
| ERA5-Land | Reanálisis climático de Copernicus/ECMWF |
| MAE | Error absoluto medio |
| RLS | Row Level Security: cada fila sólo es visible para su dueño |
| JWT | Token de sesión firmado por Supabase Auth |
| Edge Function | Función de servidor de Supabase que corre sobre Deno |
