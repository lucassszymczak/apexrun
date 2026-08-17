// =============================================================================
// Métricas agregadas da atividade inteira (distância, tempo, pace, GAP, FC,
// elevação) + deriva cardíaca (cardiac drift).
// Fonte de verdade = os streams (samples), nunca o resumo do dispositivo.
// =============================================================================

import type { CardiacDrift, QualityMetrics, StreamSample } from '../types';
import { gradeAdjustedDistance } from './gap';
import { smoothedAltitude } from './splits';

// Abaixo desta velocidade consideramos o atleta parado (não conta no tempo em
// movimento). ~0,5 m/s = 1,8 km/h, mais lento que uma caminhada.
const MOVING_SPEED_MPS = 0.5;

// Deriva cardíaca só é interpretável se o pace ficou estável entre as metades.
// Tolerância de variação de pace (s/km) para considerar "estável".
const DRIFT_PACE_STABLE_S_PER_KM = 15;

export function computeAggregate(samples: StreamSample[]): QualityMetrics {
  const n = samples.length;
  const empty: QualityMetrics = {
    distancia_total_m: null,
    duracao_movel_s: null,
    duracao_total_s: null,
    pace_medio_s_por_km: null,
    gap_medio_s_por_km: null,
    fc_media: null,
    fc_max: null,
    elevacao_ganho_m: null,
    cardiac_drift: null,
  };
  if (n < 2) return empty;

  const altS = smoothedAltitude(samples);
  const first = samples[0];
  const last = samples[n - 1];

  let movingTime = 0;
  let adjDist = 0;
  let distWithAlt = 0;
  let gain = 0;
  let hrTimeSum = 0;
  let hrTime = 0;
  let hrMax: number | null = null;

  for (let i = 0; i < n - 1; i++) {
    const dd = samples[i + 1].distance_m - samples[i].distance_m;
    const dt = samples[i + 1].time_s - samples[i].time_s;
    if (dt <= 0) continue;

    const moving = dd / dt >= MOVING_SPEED_MPS;
    if (moving) movingTime += dt;

    const a = altS[i];
    const b = altS[i + 1];
    if (dd > 0) {
      if (a != null && b != null) {
        distWithAlt += dd;
        gain += Math.max(0, b - a);
        adjDist += gradeAdjustedDistance(dd, b - a);
      } else {
        adjDist += dd; // sem altitude: assume plano
      }
    }

    const hrs = [samples[i].hr, samples[i + 1].hr].filter(
      (h): h is number => h != null,
    );
    if (hrs.length > 0) {
      const avg = hrs.reduce((s, v) => s + v, 0) / hrs.length;
      hrTimeSum += avg * dt;
      hrTime += dt;
      hrMax = Math.max(hrMax ?? -Infinity, ...hrs);
    }
  }

  const distTotal = last.distance_m - first.distance_m;
  const durTotal = last.time_s - first.time_s;
  const paceMedio =
    distTotal > 0 && movingTime > 0 ? (movingTime / distTotal) * 1000 : null;
  const gapMedio =
    distWithAlt > 0 && adjDist > 0 && movingTime > 0
      ? (movingTime / adjDist) * 1000
      : null;

  return {
    distancia_total_m: round(distTotal, 2),
    duracao_movel_s: Math.round(movingTime),
    duracao_total_s: Math.round(durTotal),
    pace_medio_s_por_km: paceMedio != null ? round(paceMedio, 1) : null,
    gap_medio_s_por_km: gapMedio != null ? round(gapMedio, 1) : null,
    fc_media: hrTime > 0 ? Math.round(hrTimeSum / hrTime) : null,
    fc_max: hrMax,
    elevacao_ganho_m: distWithAlt > 0 ? round(gain, 1) : null,
    cardiac_drift: computeCardiacDrift(samples),
  };
}

/**
 * Deriva cardíaca: compara a FC média da 1ª metade vs 2ª metade da corrida
 * (divididas pela distância). Reporta o delta de bpm e sinaliza se o pace ficou
 * estável — só assim o drift é atribuível à fadiga, não a variação de esforço.
 */
export function computeCardiacDrift(samples: StreamSample[]): CardiacDrift | null {
  const n = samples.length;
  if (n < 4) return null;

  const first = samples[0];
  const last = samples[n - 1];
  const totalDist = last.distance_m - first.distance_m;
  if (totalDist <= 0) return null;
  const halfDist = first.distance_m + totalDist / 2;

  const half = () => ({ hrSum: 0, hrTime: 0, time: 0, dist: 0 });
  const h1 = half();
  const h2 = half();

  for (let i = 0; i < n - 1; i++) {
    const dd = samples[i + 1].distance_m - samples[i].distance_m;
    const dt = samples[i + 1].time_s - samples[i].time_s;
    if (dt <= 0) continue;
    const midDist = (samples[i].distance_m + samples[i + 1].distance_m) / 2;
    const bucket = midDist < halfDist ? h1 : h2;
    bucket.time += dt;
    bucket.dist += Math.max(0, dd);
    const hrs = [samples[i].hr, samples[i + 1].hr].filter(
      (x): x is number => x != null,
    );
    if (hrs.length > 0) {
      bucket.hrSum += (hrs.reduce((s, v) => s + v, 0) / hrs.length) * dt;
      bucket.hrTime += dt;
    }
  }

  if (h1.hrTime === 0 || h2.hrTime === 0) return null;

  const fc1 = h1.hrSum / h1.hrTime;
  const fc2 = h2.hrSum / h2.hrTime;
  const pace1 = h1.dist > 0 ? (h1.time / h1.dist) * 1000 : null;
  const pace2 = h2.dist > 0 ? (h2.time / h2.dist) * 1000 : null;
  const varPace =
    pace1 != null && pace2 != null ? Math.abs(pace2 - pace1) : null;

  return {
    pace_estavel: varPace != null && varPace < DRIFT_PACE_STABLE_S_PER_KM,
    variacao_pace_s_por_km: varPace != null ? round(varPace, 1) : null,
    fc_media_1a_metade: Math.round(fc1),
    fc_media_2a_metade: Math.round(fc2),
    delta_bpm: Math.round(fc2 - fc1),
  };
}

function round(x: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}
