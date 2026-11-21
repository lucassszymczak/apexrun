// SIMULADOR DE META (Fase 4 · item 4 aprovado em 21/11, com a decisão do Lucas sobre a faixa da
// maratona). Módulo puro: a faixa vem de tempoRealista (plano.mjs); aqui ela é aberta em passos
// visíveis, que somam exatamente a faixa mostrada.
import { tempoRealista, MARATONA_EXTRA_S, FAIXA_CURTA_PCT } from './plano.mjs';
import { correcaoHadley } from './leitura.mjs';

// cenário "Quente e úmido" do simulador: um dia de calor úmido típico de verão (24 °C, orvalho
// 20 °C), corrigido pela mesma regra temperatura + orvalho já aprovada (item 3).
export const QUENTE = { tempC: 24, dewC: 20 };
export const climaQuentePct = () => correcaoHadley(QUENTE.tempC, QUENTE.dewC).pct;
export const PASSO_ALVO_S = 5 * 60;

// passos: [{ id, titulo, detalhe, rapido: Δs, lento: Δs }] e a faixa final; Σ Δ = faixa (exato)
export function passos({ anchor, distKm, kmsPercurso = null, climaPct = 0 }) {
  const r = tempoRealista({ anchor, distKm, kmsPercurso, climaPct });
  if (!r) return null;
  const R = r.riegelS, p = 1 + r.percursoPct / 100, c = 1 + r.climaPct / 100;
  const base = r.maratona ? [R, R + MARATONA_EXTRA_S] : [R * (1 - FAIXA_CURTA_PCT / 100), R * (1 + FAIXA_CURTA_PCT / 100)];
  // acumulados (arredondados ao segundo) depois de cada passo
  const etapas = [
    { id: 'riegel', v: [R, R] },
    { id: r.maratona ? 'maratona' : 'margem', v: base },
    { id: 'percurso', v: base.map((x) => x * p) },
    { id: 'clima', v: base.map((x) => x * p * c) },
  ].map((e) => ({ ...e, v: e.v.map(Math.round) }));
  const out = etapas.map((e, i) => ({ id: e.id, rapido: i ? e.v[0] - etapas[i - 1].v[0] : e.v[0], lento: i ? e.v[1] - etapas[i - 1].v[1] : e.v[1] }));
  const fim = etapas[etapas.length - 1].v;
  return { realista: r, passos: out, rapidoS: fim[0], lentoS: fim[1] };
}

// veredito da meta diante da faixa
export function veredito(alvoS, faixa) {
  if (!faixa || !(alvoS > 0)) return null;
  if (alvoS < faixa.rapidoS) return { id: 'abaixo', texto: 'Mais rápida que a faixa realista: meta arriscada hoje', tom: 'atencao' };
  if (alvoS <= faixa.lentoS) return { id: 'dentro', texto: 'Dentro da faixa realista', tom: 'ok' };
  return { id: 'acima', texto: 'Mais lenta que a faixa: meta com folga', tom: 'ok' };
}
// tempo-alvo de 5 em 5 min
export const arredonda5 = (s) => Math.round(s / PASSO_ALVO_S) * PASSO_ALVO_S;
