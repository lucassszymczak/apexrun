// =============================================================================
// Parser de arquivos .FIT (Garmin/Strava export) → ParsedActivity normalizado.
// Usa `fit-file-parser` (v4). API verificada no README/typings do pacote:
//   new FitParser(options).parseAsync(ArrayBuffer|Buffer) => ParsedFit
// Opções: mode='list', lengthUnit='m', speedUnit='m/s', elapsedRecordField=true.
// =============================================================================

import FitParser from 'fit-file-parser';
import type { DeviceSummary, ParsedActivity, StreamSample } from '../types';

// Tipagem frouxa dos registros (o pacote expõe muitos campos opcionais).
interface FitRecord {
  timestamp?: Date;
  position_lat?: number; // já em graus decimais (o parser converte semicírculos)
  position_long?: number;
  distance?: number; // m
  altitude?: number; // m
  enhanced_altitude?: number;
  speed?: number; // m/s
  heart_rate?: number;
  cadence?: number; // RPM de UMA perna (multiplicar por 2 p/ passos/min)
  fractional_cadence?: number;
  elapsed_time?: number; // s
}

interface FitSession {
  sport?: string;
  start_time?: Date;
  total_distance?: number;
  total_timer_time?: number;
  total_elapsed_time?: number;
  total_ascent?: number;
  total_descent?: number;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  avg_speed?: number;
  avg_cadence?: number;
}

export async function parseFit(
  content: ArrayBuffer | Uint8Array,
): Promise<ParsedActivity> {
  const buffer =
    content instanceof Uint8Array
      ? content.buffer.slice(
          content.byteOffset,
          content.byteOffset + content.byteLength,
        )
      : content;

  const parser = new FitParser({
    mode: 'list',
    force: true,
    lengthUnit: 'm',
    speedUnit: 'm/s',
    elapsedRecordField: true,
  });

  let data: { records?: FitRecord[]; sessions?: FitSession[] };
  try {
    data = (await parser.parseAsync(buffer as ArrayBuffer)) as typeof data;
  } catch (err) {
    // Erro de parse vem como string no fit-file-parser — normalizamos.
    throw new Error(
      `Falha ao ler o arquivo .FIT: ${typeof err === 'string' ? err : (err as Error).message}`,
    );
  }

  const records = data.records ?? [];
  if (records.length === 0) {
    throw new Error('Arquivo .FIT sem registros de trajeto (record messages).');
  }

  const session = data.sessions?.[0] ?? {};
  const startMs =
    session.start_time?.getTime() ?? records[0].timestamp?.getTime() ?? 0;
  const isRunning = (session.sport ?? '').toLowerCase().includes('run');

  const samples: StreamSample[] = records
    .filter((r) => r.timestamp != null || r.elapsed_time != null)
    .map((r) => {
      const time_s =
        r.elapsed_time != null
          ? r.elapsed_time
          : r.timestamp != null
            ? (r.timestamp.getTime() - startMs) / 1000
            : 0;
      const cadRpm =
        r.cadence != null ? r.cadence + (r.fractional_cadence ?? 0) : null;
      return {
        time_s,
        distance_m: r.distance ?? 0,
        hr: r.heart_rate ?? null,
        altitude_m: r.altitude ?? r.enhanced_altitude ?? null,
        lat: r.position_lat ?? null,
        lng: r.position_long ?? null,
        speed_mps: r.speed ?? null,
        cadence_spm: cadRpm != null ? cadRpm * 2 : null,
      };
    });

  const device: DeviceSummary = {
    sport: session.sport ?? null,
    start_time: session.start_time?.toISOString() ?? null,
    total_distance_m: session.total_distance ?? null,
    total_timer_s: session.total_timer_time ?? null,
    total_elapsed_s: session.total_elapsed_time ?? null,
    total_ascent_m: session.total_ascent ?? null,
    total_descent_m: session.total_descent ?? null,
    avg_hr: session.avg_heart_rate ?? null,
    max_hr: session.max_heart_rate ?? null,
    avg_speed_mps: session.avg_speed ?? null,
    avg_cadence_spm:
      session.avg_cadence != null
        ? session.avg_cadence * (isRunning ? 2 : 1)
        : null,
  };

  return { source_format: 'fit', samples, device };
}
