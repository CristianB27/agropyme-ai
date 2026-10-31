import {
  registrosRendimientoMaiz,
  type RegistroRendimientoMaiz,
  type SemestreMaiz,
  type SistemaMaiz,
} from '../data/rendimientoMaiz';

export function derivarSemestre(fechaInicio: string): SemestreMaiz | null {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaInicio);
  if (!coincidencia) return null;

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  const esBisiesto = anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);
  const diasPorMes = [31, esBisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasPorMes[mes - 1]) return null;
  return mes <= 6 ? 'A' : 'B';
}

export function buscarRegistroRendimientoMaiz(
  codMun: string | null | undefined,
  sistema: SistemaMaiz,
  semestre: SemestreMaiz,
  registros: RegistroRendimientoMaiz[] = registrosRendimientoMaiz,
): RegistroRendimientoMaiz | undefined {
  const codigo = codMun?.trim();
  if (!codigo || !/^\d{1,5}$/.test(codigo)) return undefined;
  const codigoNormalizado = codigo.padStart(5, '0');
  return registros.find((registro) =>
    registro.cod_mun === codigoNormalizado &&
    registro.sistema === sistema &&
    registro.semestre === semestre
  );
}

export function calcularDiferenciaPorcentual(
  rendimientoReal: number | null | undefined,
  esperado: number | null | undefined,
): number | null {
  if (
    rendimientoReal === null ||
    rendimientoReal === undefined ||
    esperado === null ||
    esperado === undefined ||
    !Number.isFinite(rendimientoReal) ||
    !Number.isFinite(esperado) ||
    esperado <= 0
  ) {
    return null;
  }
  return ((rendimientoReal - esperado) / esperado) * 100;
}

export function esCultivoMaiz(nombre: string | null | undefined): boolean {
  if (!nombre) return false;
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es') === 'maiz';
}
