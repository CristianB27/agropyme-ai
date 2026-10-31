import datosCrudos from './rendimiento_esperado_maiz.json';

export type SistemaMaiz = 'TRADICIONAL' | 'TECNIFICADO';
export type SemestreMaiz = 'A' | 'B';

export interface RegistroRendimientoMaiz {
  cod_mun: string;
  municipio: string;
  departamento: string;
  sistema: SistemaMaiz;
  semestre: SemestreMaiz;
  esperado_kg_ha: number;
  min_kg_ha: number;
  max_kg_ha: number;
}

export interface MunicipioDane {
  cod_mun: string;
  municipio: string;
  departamento: string;
  etiqueta: string;
}

export const registrosRendimientoMaiz = datosCrudos.registros as RegistroRendimientoMaiz[];

export const municipiosDane: MunicipioDane[] = Array.from(
  new Map(
    registrosRendimientoMaiz.map((registro) => [
      registro.cod_mun,
      {
        cod_mun: registro.cod_mun,
        municipio: registro.municipio,
        departamento: registro.departamento,
        etiqueta: `${registro.municipio}, ${registro.departamento}`,
      },
    ]),
  ).values(),
).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
