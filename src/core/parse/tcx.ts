// =============================================================================
// Parser de .TCX → ParsedActivity. TCX traz DistanceMeters por ponto (usamos
// direto) e FC em <HeartRateBpm><Value>. Cadência/velocidade em <Extensions>.
// =============================================================================

import { XMLParser } from 'fast-xml-parser';
import type { DeviceSummary, ParsedActivity, StreamSample } from '../types';
import { findBySuffix, num, toArray } from './xml';

interface TcxTrackpoint {
  Time?: string;
  Position?: { LatitudeDegrees?: number; LongitudeDegrees?: number };
  AltitudeMeters?: number;
  DistanceMeters?: number;
  HeartRateBpm?: { Value?: number } | number;
  Extensions?: unknown;
}

export function parseTcx(xml: string): ParsedActivity {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  const doc = parser.parse(xml) as {
    TrainingCenterDatabase?: { Activities?: { Activity?: unknown } };
  };
  const activities = doc.TrainingCenterDatabase?.Activities;
  if (!activities) throw new Error('Arquivo .TCX inválido (sem <Activities>).');

  const activityList = toArray(activities.Activity as unknown);
  const sport =
    (activityList[0] as { '@_Sport'?: string } | undefined)?.['@_Sport'] ?? null;

  const pts: TcxTrackpoint[] = [];
  for (const act of activityList) {
    for (const lap of toArray((act as { Lap?: unknown }).Lap)) {
      for (const track of toArray((lap as { Track?: unknown }).Track)) {
        for (const tp of toArray((track as { Trackpoint?: unknown }).Trackpoint)) {
          pts.push(tp as TcxTrackpoint);
        }
      }
    }
  }
  if (pts.length === 0) {
    throw new Error('Arquivo .TCX sem pontos de trajeto (<Trackpoint>).');
  }

  const startMs = pts[0].Time ? Date.parse(pts[0].Time) : null;
  let lastDist = 0;

  const samples: StreamSample[] = pts.map((p) => {
    const dist = num(p.DistanceMeters);
    if (dist != null) lastDist = dist;
    const hrVal =
      typeof p.HeartRateBpm === 'number'
        ? p.HeartRateBpm
        : num((p.HeartRateBpm as { Value?: number } | undefined)?.Value);
    const time_s =
      p.Time != null && startMs != null ? (Date.parse(p.Time) - startMs) / 1000 : 0;
    return {
      time_s,
      distance_m: dist ?? lastDist,
      hr: hrVal,
      altitude_m: num(p.AltitudeMeters),
      lat: num(p.Position?.LatitudeDegrees),
      lng: num(p.Position?.LongitudeDegrees),
      speed_mps: findBySuffix(p.Extensions, 'Speed'),
      cadence_spm: findBySuffix(p.Extensions, 'RunCadence'),
    };
  });

  const device: DeviceSummary = {
    sport,
    start_time: pts[0].Time ?? null,
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

  return { source_format: 'tcx', samples, device };
}
