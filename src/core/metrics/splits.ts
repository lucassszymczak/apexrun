// =============================================================================
// Cálculo de splits por km a partir dos streams normalizados.
// Determinístico. Recorta a cada 1000m interpolando no ponto exato do corte.
// O último km parcial é SINALIZADO (parcial=true), nunca misturado.
// =============================================================================

import type { SplitResult, StreamSample } from '../types';
import { gradeAdjustedDistance } from './gap';
import { lerp, mean, movingAverage } from '../geo';

const KM = 1000;
const ELEV_SMOOTH_WINDOW = 5; // suaviza altitude p/ reduzir ruído GPS/barômetro

/** Altitude suavizada alinhada às amostras (null onde ausente). */
export function smoothedAltitude(samples: StreamSample[]): Array<number | null> {
  const hasAll = samples.every((s) => s.altitude_m != null);
  if (!hasAll) return samples.map((s) => s.altitude_m);
  const alts = samples.map((s) => s.altitude_m as number);
  return movingAverage(alts, ELEV_SMOOTH_WINDOW);
}

interface Acc {
  dist: number;
  time: number;
  adjDist: number; // distância ajustada ao gradiente (Minetti)
  distWithAlt: number; // distância coberta com altitude conhecida
  gain: number; // ganho de elevação (m)
  hrTimeSum: number; // Σ hr·dt (para média ponderada no tempo)
  hrTime: number; // Σ dt com hr disponível
  hrMax: number | null;
}

function newAcc(): Acc {
  return {
    dist: 0,
    time: 0,
    adjDist: 0,
    distWithAlt: 0,
    gain: 0,
    hrTimeSum: 0,
    hrTime: 0,
    hrMax: null,
  };
}

/** Adiciona um sub-segmento [d0,d1] totalmente dentro do km atual. */
function addSubSegment(
  acc: Acc,
  d0: number,
  d1: number,
  t0: number,
  t1: number,
  alt0: number | null,
  alt1: number | null,
  hr0: number | null,
  hr1: number | null,
): void {
  const dd = d1 - d0;
  const dt = t1 - t0;
  if (dd < 0) return;
  acc.dist += dd;
  acc.time += dt;

  // Elevação + GAP.
  if (alt0 != null && alt1 != null) {
    const dAlt = alt1 - alt0;
    acc.distWithAlt += dd;
    acc.gain += Math.max(0, dAlt);
    acc.adjDist += gradeAdjustedDistance(dd, dAlt);
  } else {
    // Sem altitude neste trecho: assume plano (fator 1) para não distorcer o GAP.
    acc.adjDist += dd;
  }

  // FC média ponderada pelo tempo.
  const hrs = [hr0, hr1].filter((h): h is number => h != null);
  if (hrs.length > 0 && dt > 0) {
    const avg = mean(hrs) as number;
    acc.hrTimeSum += avg * dt;
    acc.hrTime += dt;
    acc.hrMax = Math.max(acc.hrMax ?? -Infinity, ...hrs);
  }
}

function finalizeSplit(acc: Acc, kmIndex: number, parcial: boolean): SplitResult {
  const pace =
    acc.dist > 0 && acc.time > 0 ? (acc.time / acc.dist) * KM : null;
  const gap =
    acc.distWithAlt > 0 && acc.adjDist > 0 && acc.time > 0
      ? (acc.time / acc.adjDist) * KM
      : null; // null = sem elevação suficiente ("dados insuficientes")
  return {
    km_index: kmIndex,
    distancia_m: round(acc.dist, 2),
    parcial,
    duracao_s: acc.time > 0 ? Math.round(acc.time) : null,
    pace_s_por_km: pace != null ? round(pace, 1) : null,
    fc_media: acc.hrTime > 0 ? Math.round(acc.hrTimeSum / acc.hrTime) : null,
    // Arredonda: a FC no ponto de corte do km é interpolada e pode ser fracionária.
    fc_max: acc.hrMax != null ? Math.round(acc.hrMax) : null,
    elevacao_ganho_m: acc.distWithAlt > 0 ? round(acc.gain, 1) : null,
    gap_s_por_km: gap != null ? round(gap, 1) : null,
  };
}

/**
 * Gera os splits por km. Cada corte a 1000m interpola tempo/altitude/FC no
 * ponto exato do limite, para o pace do km não "vazar" para o próximo.
 */
export function computeSplits(samples: StreamSample[]): SplitResult[] {
  const n = samples.length;
  if (n < 2) return [];

  const altS = smoothedAltitude(samples);
  const splits: SplitResult[] = [];
  let kmIndex = 1;
  let boundary = KM;
  let acc = newAcc();

  for (let i = 0; i < n - 1; i++) {
    let aDist = samples[i].distance_m;
    const bDist = samples[i + 1].distance_m;
    let aTime = samples[i].time_s;
    const bTime = samples[i + 1].time_s;
    let aAlt = altS[i];
    const bAlt = altS[i + 1];
    let aHr = samples[i].hr;
    const bHr = samples[i + 1].hr;

    // Segmento sem avanço de distância (parado): soma só o tempo.
    if (bDist <= aDist) {
      addSubSegment(acc, aDist, aDist, aTime, bTime, aAlt, aAlt, aHr, bHr);
      continue;
    }

    // Pode cruzar um ou mais limites de km dentro do mesmo segmento.
    while (bDist >= boundary && aDist < boundary) {
      const t = (boundary - aDist) / (bDist - aDist);
      const midTime = lerp(aTime, bTime, t);
      const midAlt =
        aAlt != null && bAlt != null ? lerp(aAlt, bAlt, t) : (aAlt ?? bAlt);
      const midHr =
        aHr != null && bHr != null ? lerp(aHr, bHr, t) : (aHr ?? bHr);

      addSubSegment(acc, aDist, boundary, aTime, midTime, aAlt, midAlt, aHr, midHr);
      splits.push(finalizeSplit(acc, kmIndex, false));
      kmIndex += 1;
      acc = newAcc();

      aDist = boundary;
      aTime = midTime;
      aAlt = midAlt;
      aHr = midHr;
      boundary += KM;
    }

    addSubSegment(acc, aDist, bDist, aTime, bTime, aAlt, bAlt, aHr, bHr);
  }

  // Último km parcial (se sobrou distância significativa).
  if (acc.dist > 0.5) {
    const parcial = acc.dist < KM - 0.5;
    splits.push(finalizeSplit(acc, kmIndex, parcial));
  }

  return splits;
}

function round(x: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}
