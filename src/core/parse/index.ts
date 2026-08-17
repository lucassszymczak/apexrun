// Dispatch de parsing por extensão de arquivo.
import type { ParsedActivity, SourceFormat } from '../types';
import { parseFit } from './fit';
import { parseGpx } from './gpx';
import { parseTcx } from './tcx';

export function detectFormat(filename: string): SourceFormat | null {
  const m = filename.toLowerCase().match(/\.(fit|gpx|tcx)$/);
  return m ? (m[1] as SourceFormat) : null;
}

/** Parseia um arquivo de atividade a partir dos bytes crus + nome do arquivo. */
export async function parseActivityBytes(
  filename: string,
  bytes: ArrayBuffer,
): Promise<ParsedActivity> {
  const fmt = detectFormat(filename);
  switch (fmt) {
    case 'fit':
      return parseFit(bytes);
    case 'gpx':
      return parseGpx(new TextDecoder().decode(bytes));
    case 'tcx':
      return parseTcx(new TextDecoder().decode(bytes));
    default:
      throw new Error(
        `Formato não suportado: "${filename}". Envie .FIT, .TCX ou .GPX.`,
      );
  }
}

export { parseFit, parseGpx, parseTcx };
