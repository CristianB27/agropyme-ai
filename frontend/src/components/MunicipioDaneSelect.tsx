import { useId, useMemo, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { municipiosDane } from '../data/rendimientoMaiz';

interface MunicipioDaneSelectProps {
  value: string | null;
  onChange: (codMun: string | null, municipio?: string) => void;
  placeholder?: string;
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

export default function MunicipioDaneSelect({
  value,
  onChange,
  placeholder = 'Buscar municipio DANE',
}: MunicipioDaneSelectProps) {
  const listId = useId();
  const seleccionada = municipiosDane.find((municipio) => municipio.cod_mun === value);
  const [consulta, setConsulta] = useState(seleccionada?.etiqueta ?? '');
  const [abierto, setAbierto] = useState(false);
  const [opcionActiva, setOpcionActiva] = useState(0);

  const opciones = useMemo(() => {
    const termino = normalizar(consulta.trim());
    if (!termino) return municipiosDane.slice(0, 60);
    return municipiosDane
      .filter((municipio) => {
        const texto = normalizar(
          `${municipio.etiqueta} ${municipio.cod_mun}`,
        );
        return texto.includes(termino);
      })
      .slice(0, 60);
  }, [consulta]);

  const seleccionar = (codMun: string) => {
    const municipio = municipiosDane.find((item) => item.cod_mun === codMun);
    if (!municipio) return;
    setConsulta(municipio.etiqueta);
    setAbierto(false);
    onChange(municipio.cod_mun, municipio.municipio);
  };

  const limpiar = () => {
    setConsulta('');
    setAbierto(false);
    onChange(null);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={abierto}
          aria-controls={listId}
          value={consulta}
          onChange={(event) => {
            setConsulta(event.target.value);
            setAbierto(true);
            setOpcionActiva(0);
            onChange(null);
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => window.setTimeout(() => setAbierto(false), 120)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setAbierto(true);
              setOpcionActiva((indice) => Math.min(indice + 1, opciones.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setOpcionActiva((indice) => Math.max(indice - 1, 0));
            } else if (event.key === 'Enter' && abierto && opciones[opcionActiva]) {
              event.preventDefault();
              seleccionar(opciones[opcionActiva].cod_mun);
            } else if (event.key === 'Escape') {
              setAbierto(false);
            }
          }}
          className="w-full pl-9 pr-20 px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
          placeholder={placeholder}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={limpiar}
              className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              aria-label="Limpiar municipio DANE"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className="w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {abierto && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1"
        >
          {opciones.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">No se encontraron municipios.</li>
          ) : (
            opciones.map((municipio, indice) => {
              const activa = indice === opcionActiva;
              const elegida = municipio.cod_mun === value;
              return (
                <li key={municipio.cod_mun} role="option" aria-selected={elegida}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setOpcionActiva(indice)}
                    onClick={() => seleccionar(municipio.cod_mun)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${activa ? 'bg-[#2E7D32]/10' : 'hover:bg-gray-50'}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{municipio.etiqueta}</span>
                    <span className="text-xs text-gray-400 tnum">{municipio.cod_mun}</span>
                    {elegida && <Check className="w-4 h-4 text-[#2E7D32]" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
