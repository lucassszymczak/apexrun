// =============================================================================
// Helpers geográficos e numéricos usados pelos cálculos.
// =============================================================================

const R_EARTH_M = 6_371_000; // raio médio da Terra (m)

/** Distância em metros entre dois pontos (lat/lng em graus) — Haversine. */
export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Interpolação linear entre a e b no fator t ∈ [0,1]. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Média simples de uma lista de números (ignora NaN/null). Null se vazia. */
export function mean(values: Array<number | null | undefined>): number | null {
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (v == null || Number.isNaN(v)) continue;
    sum += v;
    n += 1;
  }
  return n === 0 ? null : sum / n;
}

/**
 * Média móvel simples centrada, janela `window` (ímpar). Usada para suavizar a
 * altitude antes de somar ganho/GAP e reduzir ruído de GPS/barômetro.
 */
export function movingAverage(values: number[], window: number): number[] {
  if (window <= 1 || values.length === 0) return values.slice();
  const half = Math.floor(window / 2);
  const out: number[] = new Array(values.length);
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let n = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j < 0 || j >= values.length) continue;
      sum += values[j];
      n += 1;
    }
    out[i] = sum / n;
  }
  return out;
}

/** Limita x ao intervalo [min, max]. */
export function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}
