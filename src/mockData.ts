import type { AppData } from './types';

export const mockData: AppData = {
  usuarios: [
    { id: 1, nombre: 'Carlos Ramírez', correo: 'carlos@ejemplo.com', rol: 'productor' },
  ],
  proveedores: [
    { id: 1, usuario_id: 1, nombre: 'Agroinsumos del Caribe', contacto: '300 111 2233' },
    { id: 2, usuario_id: 1, nombre: 'Ferretería Agrícola La Cosecha', contacto: '300 444 5566' },
  ],
  fincas: [
    { id: 1, usuario_id: 1, nombre: 'Finca El Progreso', municipio: 'María la Baja', latitud: 9.98, longitud: -75.30 },
    { id: 2, usuario_id: 1, nombre: 'Finca La Esperanza', municipio: 'Arjona', latitud: 10.25, longitud: -75.35 },
  ],
  lotes: [
    { id: 1, finca_id: 1, nombre: 'Lote Norte', area_ha: 2.5 },
    { id: 2, finca_id: 1, nombre: 'Lote Río', area_ha: 1.8 },
    { id: 3, finca_id: 1, nombre: 'Lote Loma', area_ha: 3.0 },
    { id: 4, finca_id: 2, nombre: 'Lote 1', area_ha: 4.0 },
  ],
  cultivos: [
    { id: 1, nombre: 'Maíz' },
    { id: 2, nombre: 'Yuca' },
    { id: 3, nombre: 'Ñame' },
    { id: 4, nombre: 'Arroz' },
  ],
  ciclos_productivos: [
    { id: 1, lote_id: 1, cultivo_id: 1, fecha_inicio: '2026-03-01', fecha_fin: '2026-07-05', estado: 'Finalizado' },
    { id: 2, lote_id: 2, cultivo_id: 2, fecha_inicio: '2026-02-01', fecha_fin: null, estado: 'Activo' },
    { id: 3, lote_id: 3, cultivo_id: 3, fecha_inicio: '2026-04-15', fecha_fin: null, estado: 'Activo' },
    { id: 4, lote_id: 4, cultivo_id: 1, fecha_inicio: '2026-08-01', fecha_fin: null, estado: 'Activo' },
  ],
  actividades: [
    { id: 1, ciclo_id: 1, tipo: 'Preparación de suelo', fecha: '2026-03-01', descripcion: 'Alquiler de tractor para 2,5 ha', otros_costos: 2000000 },
    { id: 2, ciclo_id: 1, tipo: 'Siembra', fecha: '2026-03-10', descripcion: 'Siembra manual de semilla híbrida', otros_costos: 0 },
    { id: 3, ciclo_id: 1, tipo: 'Fertilización', fecha: '2026-04-05', descripcion: 'Aplicación de NPK y urea', otros_costos: 0 },
    { id: 4, ciclo_id: 1, tipo: 'Deshierba', fecha: '2026-04-20', descripcion: 'Control de arvenses', otros_costos: 0 },
    { id: 5, ciclo_id: 1, tipo: 'Cosecha', fecha: '2026-06-28', descripcion: 'Cosecha y desgrane', otros_costos: 0 },
    { id: 6, ciclo_id: 2, tipo: 'Preparación de suelo', fecha: '2026-02-01', descripcion: 'Alquiler de tractor para 1,8 ha', otros_costos: 1440000 },
    { id: 7, ciclo_id: 2, tipo: 'Siembra', fecha: '2026-02-10', descripcion: 'Siembra de estacas de yuca', otros_costos: 0 },
    { id: 8, ciclo_id: 2, tipo: 'Deshierba', fecha: '2026-03-20', descripcion: 'Control de arvenses', otros_costos: 0 },
    { id: 9, ciclo_id: 3, tipo: 'Preparación de suelo', fecha: '2026-04-15', descripcion: 'Alquiler de tractor para 3,0 ha', otros_costos: 2400000 },
    { id: 10, ciclo_id: 3, tipo: 'Siembra', fecha: '2026-04-25', descripcion: 'Siembra de semilla de ñame', otros_costos: 0 },
    { id: 11, ciclo_id: 3, tipo: 'Otra', fecha: '2026-06-10', descripcion: 'Instalación de tutores', otros_costos: 0 },
    { id: 12, ciclo_id: 4, tipo: 'Preparación de suelo', fecha: '2026-08-01', descripcion: 'Alquiler de tractor para 4,0 ha', otros_costos: 3200000 },
    { id: 13, ciclo_id: 4, tipo: 'Siembra', fecha: '2026-08-10', descripcion: 'Siembra manual de semilla híbrida', otros_costos: 0 },
  ],
  insumos: [
    { id: 1, ciclo_id: 1, actividad_id: 2, proveedor_id: 1, fecha: '2026-03-10', nombre: 'Semilla híbrida de maíz', cantidad: 50, unidad: 'kg', costo_unitario: 14000 },
    { id: 2, ciclo_id: 1, actividad_id: 3, proveedor_id: 1, fecha: '2026-04-05', nombre: 'Fertilizante NPK', cantidad: 10, unidad: 'bulto', costo_unitario: 135000 },
    { id: 3, ciclo_id: 1, actividad_id: 3, proveedor_id: 2, fecha: '2026-04-05', nombre: 'Urea', cantidad: 8, unidad: 'bulto', costo_unitario: 120000 },
    { id: 4, ciclo_id: 1, actividad_id: 4, proveedor_id: 2, fecha: '2026-04-20', nombre: 'Herbicida', cantidad: 12, unidad: 'L', costo_unitario: 38000 },
    { id: 5, ciclo_id: 2, actividad_id: 7, proveedor_id: 1, fecha: '2026-02-10', nombre: 'Estacas de yuca', cantidad: 9000, unidad: 'unidad', costo_unitario: 50 },
    { id: 6, ciclo_id: 2, actividad_id: 7, proveedor_id: 1, fecha: '2026-02-10', nombre: 'Fertilizante NPK', cantidad: 4, unidad: 'bulto', costo_unitario: 135000 },
    { id: 7, ciclo_id: 3, actividad_id: 10, proveedor_id: 1, fecha: '2026-04-25', nombre: 'Semilla de ñame', cantidad: 900, unidad: 'kg', costo_unitario: 3500 },
    { id: 8, ciclo_id: 3, actividad_id: 10, proveedor_id: 1, fecha: '2026-04-25', nombre: 'Fertilizante NPK', cantidad: 6, unidad: 'bulto', costo_unitario: 135000 },
    { id: 9, ciclo_id: 4, actividad_id: 13, proveedor_id: 1, fecha: '2026-08-10', nombre: 'Semilla híbrida de maíz', cantidad: 80, unidad: 'kg', costo_unitario: 14000 },
  ],
  mano_de_obra: [
    { id: 1, ciclo_id: 1, actividad_id: 2, fecha: '2026-03-10', num_jornales: 12, valor_jornal: 45000 },
    { id: 2, ciclo_id: 1, actividad_id: 3, fecha: '2026-04-05', num_jornales: 10, valor_jornal: 45000 },
    { id: 3, ciclo_id: 1, actividad_id: 4, fecha: '2026-04-20', num_jornales: 20, valor_jornal: 45000 },
    { id: 4, ciclo_id: 1, actividad_id: 5, fecha: '2026-06-28', num_jornales: 30, valor_jornal: 50000 },
    { id: 5, ciclo_id: 2, actividad_id: 7, fecha: '2026-02-10', num_jornales: 10, valor_jornal: 45000 },
    { id: 6, ciclo_id: 2, actividad_id: 8, fecha: '2026-03-20', num_jornales: 14, valor_jornal: 45000 },
    { id: 7, ciclo_id: 3, actividad_id: 10, fecha: '2026-04-25', num_jornales: 18, valor_jornal: 45000 },
    { id: 8, ciclo_id: 3, actividad_id: 11, fecha: '2026-06-10', num_jornales: 12, valor_jornal: 45000 },
    { id: 9, ciclo_id: 4, actividad_id: 13, fecha: '2026-08-10', num_jornales: 16, valor_jornal: 45000 },
  ],
  produccion_ventas: [
    { id: 1, ciclo_id: 1, fecha: '2026-07-05', cantidad_producida: 11250, cantidad_vendida: 6000, unidad: 'kg', precio_unitario: 1100 },
    { id: 2, ciclo_id: 1, fecha: '2026-07-20', cantidad_producida: 0, cantidad_vendida: 4500, unidad: 'kg', precio_unitario: 1150 },
  ],
  clima: [
    {
      finca_id: 1,
      pronostico: [
        { dia: 'Hoy', temp_max: 32, temp_min: 24, lluvia_mm: 0 },
        { dia: 'Mañana', temp_max: 31, temp_min: 24, lluvia_mm: 2 },
        { dia: 'En 2 días', temp_max: 29, temp_min: 23, lluvia_mm: 48 },
        { dia: 'En 3 días', temp_max: 30, temp_min: 24, lluvia_mm: 15 },
        { dia: 'En 4 días', temp_max: 32, temp_min: 24, lluvia_mm: 0 },
      ],
      alerta: 'Lluvia intensa prevista en 2 días (48 mm) en Finca El Progreso. Revisa las labores programadas para ese día.',
    },
    {
      finca_id: 2,
      pronostico: [
        { dia: 'Hoy', temp_max: 33, temp_min: 25, lluvia_mm: 0 },
        { dia: 'Mañana', temp_max: 31, temp_min: 24, lluvia_mm: 5 },
        { dia: 'En 2 días', temp_max: 32, temp_min: 24, lluvia_mm: 2 },
        { dia: 'En 3 días', temp_max: 31, temp_min: 24, lluvia_mm: 0 },
        { dia: 'En 4 días', temp_max: 33, temp_min: 25, lluvia_mm: 3 },
      ],
      alerta: null,
    },
  ],
};
