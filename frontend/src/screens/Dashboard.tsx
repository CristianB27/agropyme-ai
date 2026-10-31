import { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  TrendingUp, DollarSign, Wheat, Scale, Percent, CloudRain, AlertTriangle,
  Droplets, Thermometer, ShoppingCart, Package, Info, Calculator, ChevronDown, RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { ClimaFinca, Finca } from '../types';
import {
  calcularCiclo,
  calcularResultadoProyectado,
  cicloLabel,
  getLote,
  getFinca,
  getCultivo,
} from '../utils/calculos';
import { formatCOP, formatCOPDecimals, formatNumber, formatPercent } from '../utils/format';

const COLORS = ['#2E7D32', '#66BB6A', '#A5D6A7'];

interface ClimaCardProps {
  finca?: Finca;
  clima?: ClimaFinca;
  loading: boolean;
  onRetry: () => void;
}

function ClimaCard({ finca, clima, loading, onRetry }: ClimaCardProps) {
  const [showPronostico, setShowPronostico] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <CloudRain className="w-5 h-5 text-[#1565C0]" />
        <h3 className="text-sm font-semibold text-gray-900">
          Clima — {finca?.nombre ?? 'tus fincas'}
        </h3>
        {loading && clima && (
          <RefreshCw className="ml-auto w-4 h-4 text-[#1565C0] animate-spin" aria-label="Actualizando pronóstico" />
        )}
      </div>

      {!finca && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <CloudRain className="w-5 h-5 text-[#1565C0] flex-shrink-0" />
          <p className="text-sm text-blue-800">Registra una finca para consultar su pronóstico.</p>
        </div>
      )}

      {loading && !clima && finca && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <RefreshCw className="w-4 h-4 text-[#1565C0] animate-spin" />
          <p className="text-sm text-blue-800">Consultando el pronóstico de 5 días…</p>
        </div>
      )}

      {clima?.error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">No se pudo consultar el clima: {clima.error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:underline focus:outline-none focus:ring-2 focus:ring-red-600 rounded"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar pronóstico
            </button>
          </div>
        </div>
      )}

      {clima && !clima.error && clima.alerta && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">{clima.alerta}</p>
        </div>
      )}

      {clima && !clima.error && !clima.alerta && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <p className="text-sm text-green-800">Sin alertas climáticas</p>
        </div>
      )}

      {clima && !clima.error && (
        <>
          <button
            type="button"
            onClick={() => setShowPronostico((value) => !value)}
            aria-expanded={showPronostico}
            className="flex items-center gap-1 text-xs font-medium text-[#1565C0] hover:underline min-h-[44px] py-2 focus:outline-none focus:ring-2 focus:ring-[#1565C0] focus:ring-offset-1 rounded px-1"
          >
            {showPronostico ? 'Ocultar pronóstico' : 'Ver pronóstico de 5 días'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showPronostico ? 'rotate-180' : ''}`} />
          </button>

          {showPronostico && (
            <div className="grid grid-cols-5 gap-1.5 md:gap-3 mt-2">
              {clima.pronostico.map((dia) => (
                <div key={dia.dia} className="bg-gray-50 rounded-lg p-1.5 md:p-3 text-center">
                  <p className="text-[9px] md:text-xs font-medium text-gray-500 mb-1">{dia.dia}</p>
                  <div className="flex items-center justify-center gap-0.5 mb-1">
                    <Thermometer className="w-3 h-3 text-gray-400" />
                    <span className="text-[10px] md:text-xs font-semibold text-gray-900 tnum">{dia.temp_max}°</span>
                    <span className="text-[9px] md:text-[10px] text-gray-400 tnum">/{dia.temp_min}°</span>
                  </div>
                  <div className="flex items-center justify-center gap-0.5">
                    <Droplets className="w-3 h-3 text-[#1565C0]" />
                    <span className="text-[9px] md:text-[10px] font-medium text-[#1565C0] tnum">{dia.lluvia_mm} mm</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <p className="text-[10px] text-gray-400 mt-4 text-right">Datos meteorológicos: Open-Meteo.com</p>
    </div>
  );
}

export default function Dashboard() {
  const { data, loading, climaLoading, error, refresh, refreshClima } = useApp();
  const [selectedCicloId, setSelectedCicloId] = useState<string>('');
  const [precioEstimado, setPrecioEstimado] = useState('1150');
  const [showDetalles, setShowDetalles] = useState(false);

  useEffect(() => {
    if (!selectedCicloId && data.ciclos_productivos[0]) {
      setSelectedCicloId(data.ciclos_productivos[0].id);
    }
  }, [data.ciclos_productivos, selectedCicloId]);

  const ciclo = data.ciclos_productivos.find((c) => c.id === selectedCicloId) ?? data.ciclos_productivos[0];
  const calc = useMemo(() => ciclo ? calcularCiclo(data, ciclo) : null, [data, ciclo]);
  const lote = ciclo ? getLote(data, ciclo.lote_id) : undefined;
  const cycleFinca = lote ? getFinca(data, lote.finca_id) : undefined;
  const finca = cycleFinca ?? data.fincas[0];
  const clima = finca ? data.clima.find((c) => c.finca_id === finca.id) : undefined;

  if (loading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Cargando tus datosAgrícolas…</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <button onClick={() => void refresh()} className="mt-3 rounded-lg bg-[#2E7D32] px-4 py-2 text-sm font-semibold text-white">Reintentar</button>
      </div>
    );
  }

  if (!ciclo || !calc) {
    return (
      <div className="space-y-5 pb-24 md:pb-0">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Resumen financiero de tus ciclos productivos</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <h3 className="text-lg font-bold text-gray-900">Aún no tienes ciclos productivos</h3>
          <p className="mt-2 text-sm text-gray-500">Crea una finca, un lote y un ciclo en “Mis Lotes” para ver tu resumen financiero.</p>
        </div>
        <ClimaCard
          finca={finca}
          clima={clima}
          loading={climaLoading}
          onRetry={() => void refreshClima()}
        />
      </div>
    );
  }

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
    { name: 'Insumos', value: calc?.costoInsumos ?? 0 },
    { name: 'Jornales', value: calc?.costoJornales ?? 0 },
    { name: 'Otros costos', value: calc?.costoOtros ?? 0 },
  ];

  const precioEst = Number(precioEstimado) || 0;
  const ingresoEstimadoPorVender = calc.Qnv * precioEst;
  const ingresoTotalProyectado = calc.ingresosRealizados + ingresoEstimadoPorVender;
  const resultadoProyectado = calcularResultadoProyectado(calc, precioEst);

  const primaryCards = [
    {
      label: 'Costo total del ciclo',
      value: formatCOP(calc.costoTotal),
      icon: DollarSign,
      color: '#2E7D32',
      parcial: false,
    },
    {
      label: 'Ingresos realizados',
      value: calc.ingresosRealizados > 0 ? formatCOP(calc.ingresosRealizados) : 'No disponible',
      icon: ShoppingCart,
      color: '#0277BD',
      parcial: calc.esParcial,
    },
    {
      label: 'Rentabilidad sobre costo de lo vendido',
      value: calc.rentabilidadSobreCostos !== null ? formatPercent(calc.rentabilidadSobreCostos * 100) : 'No disponible',
      icon: Percent,
      color: '#7B1FA2',
      parcial: calc.esParcial,
    },
  ];

  const secondaryIndicators = [
    {
      label: 'Costo por hectárea',
      value: formatCOP(calc.costoPorHectarea),
      icon: Scale,
      color: '#1565C0',
      parcial: false,
    },
    {
      label: 'Costo unitario producido (C/Q)',
      value: calc.costoUnitario !== null ? `${formatCOPDecimals(calc.costoUnitario)}/${calc.unidad}` : 'No disponible',
      icon: Wheat,
      color: '#F57C00',
      parcial: false,
    },
    {
      label: 'Costo de lo vendido',
      value: calc.costoDeLoVendido !== null ? formatCOP(calc.costoDeLoVendido) : 'No disponible',
      icon: ShoppingCart,
      color: '#455A64',
      parcial: calc.esParcial,
    },
    {
      label: 'Rendimiento (kg/ha)',
      value: calc.rendimiento !== null ? `${formatNumber(calc.rendimiento, 0)} ${calc.unidad}/ha` : 'No disponible',
      icon: TrendingUp,
      color: '#00838F',
      parcial: false,
    },
    {
      label: 'Cosechado / Vendido / Sin vender',
      value: calc.Q > 0 ? `${formatNumber(calc.Q)} / ${formatNumber(calc.Qv)} / ${formatNumber(calc.Qnv)} ${calc.unidad}` : 'No disponible',
      icon: Package,
      color: '#5D4037',
      parcial: calc.esParcial,
    },
    {
      label: 'Margen realizado',
      value: calc.margenRealizado !== null ? formatCOP(calc.margenRealizado) : 'No disponible',
      icon: Calculator,
      color: '#AD1457',
      parcial: calc.esParcial,
    },
    {
      label: 'Margen sobre ventas',
      value: calc.margenSobreVentas !== null ? formatPercent(calc.margenSobreVentas * 100) : 'No disponible',
      icon: Percent,
      color: '#C2185B',
      parcial: calc.esParcial,
    },
  ];

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      {/* Encabezado */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Resumen financiero de tus ciclos productivos</p>
      </div>

      {/* Selector de ciclo */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Ciclo productivo</label>
        <select
          value={selectedCicloId}
          onChange={(e) => setSelectedCicloId(e.target.value)}
          className="w-full md:max-w-md px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
        >
          {data.ciclos_productivos.map((c) => (
            <option key={c.id} value={c.id}>
              {cicloLabel(data, c)}
            </option>
          ))}
        </select>
      </div>

      {/* Aviso de resultado parcial */}
      {calc.esParcial && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-900">
            Resultado parcial: hay <strong>{formatNumber(calc.Qnv)} {calc.unidad}</strong> sin vender.
          </p>
        </div>
      )}

      {/* Cuatro tarjetas principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {primaryCards.map((ind) => {
          const Icon = ind.icon;
          return (
            <div key={ind.label} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${ind.color}15` }}>
                  <Icon className="w-4 h-4" style={{ color: ind.color }} />
                </div>
                {ind.parcial && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Parcial</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-1">{ind.label}</p>
              <p className="text-lg md:text-xl font-bold text-gray-900 tnum leading-tight">{ind.value}</p>
            </div>
          );
        })}

        {/* Tarjeta "Sin vender" */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#5D403715' }}>
              <Package className="w-4 h-4" style={{ color: '#5D4037' }} />
            </div>
            {calc.esParcial && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Parcial</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-1">Sin vender</p>
          {calc.Q > 0 ? (
            <>
              <p className="text-lg md:text-xl font-bold text-gray-900 tnum leading-tight">{formatNumber(calc.Qnv)} {calc.unidad}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">de {formatNumber(calc.Q)} {calc.unidad} cosechados</p>
            </>
          ) : (
            <p className="text-lg md:text-xl font-bold text-gray-900 leading-tight">No disponible</p>
          )}
        </div>
      </div>

      {/* Botón Ver más detalles */}
      <button
        onClick={() => setShowDetalles((v) => !v)}
        aria-expanded={showDetalles}
        className="w-full md:max-w-md flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-white border border-gray-300 rounded-xl text-sm font-semibold text-[#2E7D32] hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:ring-offset-1"
      >
        {showDetalles ? 'Ocultar detalles' : 'Ver más detalles'}
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${showDetalles ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Sección de detalles colapsable */}
      {showDetalles && (
        <div className="space-y-5">
          {/* Indicadores secundarios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {secondaryIndicators.map((ind) => {
              const Icon = ind.icon;
              return (
                <div key={ind.label} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${ind.color}15` }}>
                      <Icon className="w-4 h-4" style={{ color: ind.color }} />
                    </div>
                    {ind.parcial && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Parcial</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{ind.label}</p>
                  <p className="text-base font-bold text-gray-900 tnum">{ind.value}</p>
                </div>
              );
            })}
          </div>

          {/* Nota rentabilidad vs margen */}
          <div className="bg-[#2E7D32]/5 border border-[#2E7D32]/15 rounded-lg px-4 py-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-[#2E7D32] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-700 leading-relaxed">
                <strong>Rentabilidad sobre costo de lo vendido</strong> mide el margen realizado por cada peso de costo vendido. <strong>Margen sobre ventas</strong> mide el margen realizado por cada peso de ingreso. Son medidas distintas y no deben confundirse.
              </p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Costo total por ciclo</h3>
              <ResponsiveContainer width="100%" height={220} className="md:!h-[280px]">
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

            <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Distribución del costo</h3>
              <ResponsiveContainer width="100%" height={220} className="md:!h-[280px]">
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

          {/* Estimación */}
          {calc.Qnv > 0 && (
            <div className="bg-white rounded-xl border-2 border-dashed border-[#1565C0]/30 p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#1565C0]/10 flex items-center justify-center">
                  <Calculator className="w-4 h-4 text-[#1565C0]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Estimación</h3>
                  <p className="text-[10px] text-gray-500">Proyección si se vende el resto de la cosecha</p>
                </div>
                <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded bg-[#1565C0]/10 text-[#1565C0]">Estimación</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad sin vender</label>
                  <p className="text-sm font-bold text-gray-900 tnum">{formatNumber(calc.Qnv)} {calc.unidad}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Precio estimado (COP/{calc.unidad})</label>
                  <input
                    type="number"
                    value={precioEstimado}
                    onChange={(e) => setPrecioEstimado(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1565C0] tnum"
                    placeholder="Ej. 1150"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 mb-0.5">Ingreso estimado por venta pendiente</p>
                  <p className="text-sm font-bold text-[#1565C0] tnum">{formatCOP(ingresoEstimadoPorVender)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 mb-0.5">Ingreso total proyectado (estimación)</p>
                  <p className="text-sm font-bold text-gray-900 tnum">{formatCOP(ingresoTotalProyectado)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 mb-0.5">Resultado proyectado (estimación)</p>
                  <p className="text-sm font-bold text-gray-900 tnum">{formatCOP(resultadoProyectado)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tarjeta de Clima */}
      <ClimaCard
        finca={finca}
        clima={clima}
        loading={climaLoading}
        onRetry={() => void refreshClima()}
      />
    </div>
  );
}
