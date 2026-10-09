import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, DollarSign, Wheat, Scale, Percent, CloudRain, AlertTriangle, Droplets, Thermometer } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calcularCiclo, cicloLabel, getLote, getFinca, getCultivo } from '../utils/calculos';
import { formatCOP, formatCOPDecimals, formatNumber, formatPercent } from '../utils/format';

const COLORS = ['#2E7D32', '#66BB6A', '#A5D6A7'];

export default function Dashboard() {
  const { data } = useApp();
  const [selectedCicloId, setSelectedCicloId] = useState(1);

  const ciclo = data.ciclos_productivos.find((c) => c.id === selectedCicloId)!;
  const calc = useMemo(() => calcularCiclo(data, ciclo), [data, ciclo]);
  const lote = getLote(data, ciclo.lote_id);
  const finca = lote ? getFinca(data, lote.finca_id) : undefined;
  const cultivo = getCultivo(data, ciclo.cultivo_id);
  const clima = finca ? data.clima.find((c) => c.finca_id === finca.id) : undefined;

  const barData = data.ciclos_productivos.map((c) => {
    const cc = calcularCiclo(data, c);
    const cl = getCultivo(data, c.cultivo_id);
    const lt = getLote(data, c.lote_id);
    return {
      name: `${cl?.nombre?.slice(0, 4)} ${lt?.nombre?.slice(0, 6)}`,
      costo: cc.costoTotal,
    };
  });

  const pieData = [
    { name: 'Insumos', value: calc.costoInsumos },
    { name: 'Jornales', value: calc.costoJornales },
    { name: 'Otros costos', value: calc.costoOtros },
  ];

  const indicators = [
    {
      label: 'Costo total del ciclo',
      value: formatCOP(calc.costoTotal),
      icon: DollarSign,
      color: '#2E7D32',
    },
    {
      label: 'Costo por hectárea',
      value: formatCOP(calc.costoPorHectarea),
      icon: Scale,
      color: '#1565C0',
    },
    {
      label: 'Costo por unidad producida',
      value: calc.costoPorUnidad !== null ? `${formatCOPDecimals(calc.costoPorUnidad)}/${calc.unidad}` : 'No disponible',
      icon: Wheat,
      color: '#F57C00',
    },
    {
      label: 'Rendimiento (kg/ha)',
      value: calc.rendimiento !== null ? `${formatNumber(calc.rendimiento, 0)} ${calc.unidad}/ha` : 'No disponible',
      icon: TrendingUp,
      color: '#00838F',
    },
    {
      label: 'Rentabilidad estimada',
      value: calc.rentabilidad !== null ? formatPercent(calc.rentabilidad * 100) : 'No disponible',
      icon: Percent,
      color: '#7B1FA2',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Resumen financiero de tus ciclos productivos</p>
      </div>

      {/* Cycle selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Ciclo productivo</label>
        <select
          value={selectedCicloId}
          onChange={(e) => setSelectedCicloId(Number(e.target.value))}
          className="w-full md:max-w-md px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
        >
          {data.ciclos_productivos.map((c) => (
            <option key={c.id} value={c.id}>
              {cicloLabel(data, c)}
            </option>
          ))}
        </select>
      </div>

      {/* Indicator cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {indicators.map((ind) => {
          const Icon = ind.icon;
          return (
            <div key={ind.label} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${ind.color}15` }}>
                  <Icon className="w-4 h-4" style={{ color: ind.color }} />
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-1">{ind.label}</p>
              <p className="text-lg font-bold text-gray-900 tnum">{ind.value}</p>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Costo total por ciclo</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                formatter={(v) => [formatCOP(Number(v)), 'Costo total']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              />
              <Bar dataKey="costo" fill="#2E7D32" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Distribución del costo</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => [formatCOP(Number(v)), '']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Climate card */}
      {clima && finca && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <CloudRain className="w-5 h-5 text-[#1565C0]" />
            <h3 className="text-sm font-semibold text-gray-900">Clima — {finca.nombre}</h3>
          </div>

          {clima.alerta && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">{clima.alerta}</p>
            </div>
          )}

          {!clima.alerta && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <p className="text-sm text-green-800">Sin alertas climáticas</p>
            </div>
          )}

          <div className="grid grid-cols-5 gap-2 md:gap-3">
            {clima.pronostico.map((dia) => (
              <div key={dia.dia} className="bg-gray-50 rounded-lg p-2 md:p-3 text-center">
                <p className="text-[10px] md:text-xs font-medium text-gray-500 mb-1">{dia.dia}</p>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Thermometer className="w-3 h-3 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-900 tnum">{dia.temp_max}°</span>
                  <span className="text-[10px] text-gray-400 tnum">/{dia.temp_min}°</span>
                </div>
                <div className="flex items-center justify-center gap-1">
                  <Droplets className="w-3 h-3 text-[#1565C0]" />
                  <span className="text-[10px] md:text-xs font-medium text-[#1565C0] tnum">{dia.lluvia_mm} mm</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-gray-400 mt-4 text-right">Datos meteorológicos: Open-Meteo.com</p>
        </div>
      )}
    </div>
  );
}
