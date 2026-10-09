# AgroPyme AI

Aplicación web para ayudar a pequeños productores agrícolas a llevar el control de sus lotes y costos. Proyecto universitario.

## ¿Qué tiene?

- **Dashboard:** resumen de costos, ingresos y utilidad.
- **Mis Lotes:** lista de lotes y sus ciclos de cultivo.
- **Registro de Costos:** para anotar insumos, jornales y otros gastos.
- **Asistente IA:** chat para hacer preguntas sobre los costos y los lotes.

> **Nota:** por ahora la app usa datos de ejemplo (`src/mockData.ts`) y el asistente responde con respuestas predefinidas. No está conectada a una base de datos ni a una IA real.

## Tecnologías

- React + TypeScript
- Vite
- Tailwind CSS
- Recharts (gráficas)
- Lucide React (iconos)

## Requisitos

- [Node.js](https://nodejs.org/) versión 18 o superior

## Cómo ejecutarlo

1. Descargar o clonar el proyecto y abrir una terminal en la carpeta.
2. Instalar las dependencias:

   ```bash
   npm install
   ```

3. Iniciar la app:

   ```bash
   npm run dev
   ```

4. Abrir en el navegador la dirección que aparece en la terminal (normalmente `http://localhost:5173`).

## Otros comandos

| Comando | Para qué sirve |
| --- | --- |
| `npm run build` | Genera la versión final en la carpeta `dist/` |
| `npm run preview` | Prueba la versión final en local |
| `npm run lint` | Revisa el código con ESLint |
| `npm run typecheck` | Revisa los tipos de TypeScript |

## Estructura del proyecto

```
src/
├── components/   # Componentes compartidos (menú, layout)
├── context/      # Estado global de la app
├── screens/      # Pantallas: Dashboard, Lotes, Costos, Asistente
├── utils/        # Funciones de cálculo y formato
├── mockData.ts   # Datos de ejemplo
└── types.ts      # Tipos de TypeScript
```
