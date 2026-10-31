import { useState } from 'react';
import { Info, Wheat } from 'lucide-react';
import type { Finca } from '../types';
import type { SistemaMaiz } from '../data/rendimientoMaiz';
import {
  buscarRegistroRendimientoMaiz,
  calcularDiferenciaPorcentual,
  derivarSemestre,
} from '../utils/rendimientoMaiz';
import { formatNumber, formatPercent } from '../utils/format';

interface ReferenciaRendimientoMaizCardProps {
  finca?: Finca;
  fechaInicio: string;
  rendimientoReal: number | null;
}

export default function ReferenciaRendimientoMaizCard({
  finca,
  fechaInicio,
  rendimientoReal,
}: ReferenciaRendimientoMaizCardProps) {
  const [sistema, setSistema] = useState<SistemaMaiz>('TRADICIONAL');
  const semestre = derivarSemestre(fechaInicio);
  const registro = semestre
    ? buscarRegistroRendimientoMaiz(finca?.cod_mun, sistema, semestre)
    : undefined;
  const diferencia = registro
    ? calcularDiferenciaPorcentual(rendimientoReal, registro.esperado_kg_ha)
    : null;

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#F57C00]/10 flex items-center justify-center flex-shrink-0">
            <Wheat className="w-4 h-4 text-[#F57C00]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Referencia de rendimiento en tu municipio
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Semestre {semestre ?? 'no disponible'}
              {finca?.municipio ? ` · ${finca.municipio}` : ''}
            </p>
          </div>
        </div>

        <div className="flex self-start rounded-lg border border-gray-300 bg-gray-50 p-1">
          {(['TRADICIONAL', 'TECNIFICADO'] as SistemaMaiz[]).map((opcion) => (
            <button
              key={opcion}
              type="button"
              aria-pressed={sistema === opcion}
              onClick={() => setSistema(opcion)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                sistema === opcion
                  ? 'bg-white text-[#2E7D32] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opcion === 'TRADICIONAL' ? 'Tradicional' : 'Tecnificado'}
            </button>
          ))}
        </div>
      </div>

      {!finca?.cod_mun ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-sm text-amber-900">
            Agrega el municipio (DANE) de la finca en Mis Lotes para consultar la referencia de tu municipio.
          </p>
        </div>
      ) : !registro ? (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
          <p className="text-sm text-gray-700">
            No hay referencia para este municipio, sistema y semestre.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-1">Rendimiento esperado</p>
              <p className="text-lg font-bold text-gray-900 tnum">
                {formatNumber(registro.esperado_kg_ha)} kg/ha
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-1">Rango típico de error</p>
              <p className="text-lg font-bold text-gray-900 tnum">
                {formatNumber(registro.min_kg_ha)}–{formatNumber(registro.max_kg_ha)} kg/ha
              </p>
            </div>
          </div>

          {rendimientoReal !== null && diferencia !== null && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="rounded-lg bg-[#2E7D32]/5 p-3">
                <p className="text-xs text-gray-500 mb-1">Rendimiento real del lote</p>
                <p className="text-lg font-bold text-gray-900 tnum">
                  {formatNumber(rendimientoReal)} kg/ha
                </p>
              </div>
              <div className="rounded-lg bg-[#2E7D32]/5 p-3">
                <p className="text-xs text-gray-500 mb-1">Diferencia contra el esperado</p>
                <p className="text-lg font-bold text-gray-900 tnum">
                  {diferencia >= 0 ? '+' : ''}{formatPercent(diferencia)}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#F57C00]/15 bg-[#F57C00]/5 px-4 py-3">
        <Info className="w-4 h-4 text-[#F57C00] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-700 leading-relaxed">
          Referencia histórica de tu zona basada en datos públicos (EVA); no es una predicción de tu cosecha. El rango típico de error cubrió cerca del 60 % de los casos en la prueba.
        </p>
      </div>
    </section>
  );
}
