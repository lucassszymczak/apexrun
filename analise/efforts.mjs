// MELHORES ESFORÇOS (Fase 2 · item 6 aprovado em 20/11, docs/fase2-formulas.md). Módulo puro.
// Janela contínua mais curta (tempo decorrido, pausas incluídas) que cobre a distância, com a
// distância do relógio interpolada entre os pontos. Janela com pausa > 60 s não vale.
export const DISTANCIAS = [400, 800, 1000, 5000, 10000, 21097.5];
export const PAUSA_MAX_S = 60;
export const ROTULO = { 400: '400 m', 800: '800 m', 1000: '1 km', 5000: '5 km', 10000: '10 km', 21097.5: '21,1 km' };

export function melhoresEsforcos(tr) {
  if (!tr || !tr.t || tr.t.length < 2) return null;
  // pontos com distância (crescente)
  const T = [], D = [];
  for (let i = 0; i < tr.t.length; i++) { const d = tr.dist[i]; if (d == null) continue; if (D.length && d < D[D.length - 1]) continue; T.push(tr.t[i]); D.push(d); }
  if (T.length < 2) return null;
  // pausas: intervalos sem avanço de distância por mais de 60 s (ou buracos de tempo)
  const pausaAte = new Array(T.length).fill(0); // nº de pausas longas até i (prefixo)
  for (let i = 1; i < T.length; i++) pausaAte[i] = pausaAte[i - 1] + (T[i] - T[i - 1] > PAUSA_MAX_S ? 1 : 0);
  const out = {};
  for (const alvo of DISTANCIAS) {
    if (D[D.length - 1] - D[0] < alvo) continue;
    let best = null, j = 0;
    for (let i = 0; i < T.length; i++) {
      if (j < i) j = i;
      while (j < T.length && D[j] - D[i] < alvo) j++;
      if (j >= T.length) break;
      // interpola o instante exato em que a distância alvo foi atingida entre j−1 e j
      const d0 = D[j - 1] - D[i], d1 = D[j] - D[i];
      const tFim = d1 === d0 ? T[j] : T[j - 1] + ((alvo - d0) / (d1 - d0)) * (T[j] - T[j - 1]);
      if (pausaAte[j] - pausaAte[i] > 0) continue;
      const t = tFim - T[i];
      if (best == null || t < best.t) best = { t: Math.round(t * 10) / 10, ini: T[i], fim: Math.round(tFim * 10) / 10 };
    }
    if (best) out[alvo] = best;
  }
  return Object.keys(out).length ? out : null;
}

// Selos: compara um treino com os outros (que têm leitura.esforcos)
export function selos(w, todos, inicioCiclo) {
  const e = w && w.leitura && w.leitura.esforcos; if (!e) return {};
  const res = {};
  for (const k of Object.keys(e)) {
    const t = e[k].t;
    let pr = true, ciclo = true, comparou = 0;
    for (const o of todos) {
      if (!o || o.id === w.id) continue;
      const oe = o.leitura && o.leitura.esforcos && o.leitura.esforcos[k]; if (!oe) continue;
      comparou++;
      if (oe.t < t) { pr = false; if (inicioCiclo && o.date >= inicioCiclo) ciclo = false; }
    }
    if (!comparou) continue; // sem outro treino com essa distância, não há com o que comparar
    if (pr) res[k] = 'pr'; else if (inicioCiclo && w.date >= inicioCiclo && ciclo) res[k] = 'ciclo';
  }
  return res;
}
