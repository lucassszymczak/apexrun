// =============================================================================
// Parser de .GPX → ParsedActivity. GPX não traz distância nem, em geral, tempo
// em movimento: a distância acumulada é calculada por Haversine ponto a ponto.
// FC/cadência (quando existem) ficam em <extensions> (gpxtpx:hr, etc.).
// =============================================================================

import { XMLParser } from 'fast-xml-parser';
import type { DeviceSummary, ParsedActivity, StreamSample } from '../types';
import { haversineM } from '../geo';
import { findBySuffix, num, toArray } from './xml';

interface GpxTrkpt {
  '@_lat'?: number;
  '@_lon'?: number;
  ele?: number;
  time?: string;
  extensions?: unknown;
}

export function parseGpx(xml: string): ParsedActivity {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  const doc = parser.parse(xml) as {
    gpx?: { trk?: unknown };
  };
  if (!doc.gpx) throw new Error('Arquivo .GPX inválido (sem elemento <gpx>).');

  const pts: GpxTrkpt[] = [];
  for (const trk of toArray(doc.gpx.trk as unknown)) {
    for (const seg of toArray((trk as { trkseg?: unknown }).trkseg)) {
      for (const p of toArray((seg as { trkpt?: unknown }).trkpt)) {
        pts.push(p as GpxTrkpt);
      }
    }
  }
  if (pts.length === 0) {
    throw new Error('Arquivo .GPX sem pontos de trajeto (<trkpt>).');
  }

  const startMs = pts[0].time ? Date.parse(pts[0].time) : null;
  let cumDist = 0;
  let prevLat: number | null = null;
  let prevLng: number | null = null;

  const samples: StreamSample[] = pts.map((p) => {
    const lat = num(p['@_lat']);
    const lng = num(p['@_lon']);
    if (prevLat != null && prevLng != null && lat != null && lng != null) {
      cumDist += haversineM(prevLat, prevLng, lat, lng);
    }
    prevLat = lat;
    prevLng = lng;
    const time_s =
      p.time != null && startMs != null ? (Date.parse(p.time) - startMs) / 1000 : 0;
    return {
      time_s,
      distance_m: cumDist,
      hr: findBySuffix(p.extensions, 'hr'),
      altitude_m: num(p.ele),
      lat,
      lng,
      speed_mps: null,
      cadence_spm: findBySuffix(p.extensions, 'cad'),
    };
  });

  const device: DeviceSummary = {
    sport: null,
    start_time: pts[0].time ?? null,
    total_distance_m: null,
    total_timer_s: null,
    total_elapsed_s: null,
    total_ascent_m: null,
    total_descent_m: null,
    avg_hr: null,
    max_hr: null,
    avg_speed_mps: null,
    avg_cadence_spm: null,
  };

  return { source_format: 'gpx', samples, device };
}
