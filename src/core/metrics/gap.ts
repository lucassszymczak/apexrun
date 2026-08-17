// =============================================================================
// GAP — Grade Adjusted Pace (pace ajustado à inclinação)
// -----------------------------------------------------------------------------
// FONTE (documentada conforme exigência do projeto):
//   Minetti AE, Moia C, Roi GS, Susta D, Ferretti G. "Energy cost of walking
//   and running at extreme uphill and downhill slopes." J Appl Physiol (2002)
//   93(3):1039-1046.
//
// Minetti mediu o custo energético da corrida Cr (J·kg⁻¹·m⁻¹) em função do
// gradiente i (adimensional = subida/avanço horizontal; 0.10 = 10%). Ajustou
// um polinômio de 5º grau, válido para i ∈ [-0.45, +0.45]:
//
//   Cr(i) = 155.4·i⁵ − 30.4·i⁴ − 43.3·i³ + 46.3·i² + 19.5·i + 3.6
//
// No plano (i=0), Cr(0) = 3.6 J·kg⁻¹·m⁻¹.
//
// IDEIA DO GAP: correr num gradiente i à velocidade v custa potência ∝ Cr(i)·v.
// A velocidade equivalente no plano (mesmo custo metabólico) é
//   v_plano = v · Cr(i)/Cr(0).
// Logo cada metro percorrido no gradiente i "vale" Cr(i)/Cr(0) metros planos.
// Somamos essa "distância ajustada" e o GAP (s/km) = tempo / distância_ajustada.
//
// Consistência de sinal: subida (Cr>Cr0) → distância_ajustada MAIOR → GAP mais
// RÁPIDO que o pace real (você correu devagar por causa da subida). Descida
// leve alivia; descida forte volta a custar (o polinômio captura isso).
//
// Regra prática do treinador (seção 8.3 do contexto): "~3,5% de custo extra por
// 1% de subida". É a inclinação linear do polinômio perto de i=0
// (dCr/di em 0 = 19.5; 19.5/3.6 ≈ 5,4 por unidade de i, ou ~0,054 por 1% ...
// na prática ~3–5%/1% dependendo da faixa) — usamos o polinômio completo, que
// é mais fiel, e mantemos a regra como referência mental.
// =============================================================================

import { clamp } from '../geo';

const CR_FLAT = 3.6; // Cr(0) J·kg⁻¹·m⁻¹
const GRADE_MIN = -0.45;
const GRADE_MAX = 0.45;

/** Custo metabólico da corrida (J·kg⁻¹·m⁻¹) no gradiente i (Minetti 2002). */
export function minettiCost(gradient: number): number {
  const i = clamp(gradient, GRADE_MIN, GRADE_MAX);
  return (
    155.4 * i ** 5 -
    30.4 * i ** 4 -
    43.3 * i ** 3 +
    46.3 * i ** 2 +
    19.5 * i +
    3.6
  );
}

/**
 * Fator de ajuste de distância para um gradiente: Cr(i)/Cr(0).
 * 1 metro no gradiente i equivale a `factor` metros no plano (mesmo custo).
 */
export function gradeAdjustFactor(gradient: number): number {
  return minettiCost(gradient) / CR_FLAT;
}

/**
 * Distância ajustada ao gradiente (metros-plano-equivalentes) para um segmento
 * de distância horizontal `dist_m` com variação de altitude `d_alt_m`.
 * O gradiente é limitado à faixa validada por Minetti.
 */
export function gradeAdjustedDistance(dist_m: number, d_alt_m: number): number {
  if (dist_m <= 0) return 0;
  const gradient = d_alt_m / dist_m;
  return dist_m * gradeAdjustFactor(gradient);
}

/**
 * GAP (s/km) a partir de tempo, distância e distância ajustada acumulados.
 * Retorna null se não houver distância ajustada (sem dados de elevação).
 */
export function gapPaceFromAdjusted(
  duracao_s: number,
  distancia_ajustada_m: number,
): number | null {
  if (distancia_ajustada_m <= 0 || duracao_s <= 0) return null;
  return (duracao_s / distancia_ajustada_m) * 1000;
}
