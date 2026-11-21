// FANTASMA no replay (Fase 3 · item 5 aprovado em 21/11, docs/fase3-formulas.md). Módulo puro.
// - Candidato: mesma modalidade (quem chama filtra), pelo menos 80% do percurso em comum NOS DOIS
//   SENTIDOS da comparação (o seu coberto pelo dele e o dele pelo seu, com o corredor de 25 m dos
//   segmentos) e distância até 10% diferente.
// - "Seu melhor": o candidato com o menor tempo. "Mais recente": o de data mais próxima. Os outros
//   por data. O padrão é "Sem fantasma".
// - Alinhamento pela distância: no seu km X, a diferença é o seu tempo menos o tempo dele no km X
//   (positivo = o fantasma está à frente). No mapa, ele anda no próprio relógio.

export const FANT_V = 1;
export const COBERTURA_MIN = 0.8;
export const DIF_DIST_MAX = 0.1;

const viz = (k) => { const [b, x, y] = k.split(':').map(Number); const o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) o.push(b + ':' + (x + dx) + ':' + (y + dy)); return o; };
// fração das quadrículas de A que ficam no corredor de B
export function cobertura(A, B) {
  if (!A || !A.length || !B || !B.length) return 0;
  const S = new Set(); for (const c of B) for (const v of viz(c)) S.add(v);
  let n = 0; for (const c of A) if (S.has(c)) n++;
  return n / A.length;
}
// alvo/outros: { w, cells } (cells = quadrículas sem repetição)
export function candidatos(alvo, outros) {
  const d0 = alvo.w.distKm;
  const out = [];
  for (const o of outros) {
    if (!o || o.w.id === alvo.w.id || !o.cells || !o.cells.length) continue;
    if (!(d0 > 0) || !(o.w.distKm > 0) || Math.abs(o.w.distKm - d0) / d0 > DIF_DIST_MAX) continue;
    const a = cobertura(alvo.cells, o.cells), b = cobertura(o.cells, alvo.cells);
    if (a >= COBERTURA_MIN && b >= COBERTURA_MIN) out.push({ w: o.w, cob: Math.min(a, b) });
  }
  return out;
}
const dias = (a, b) => Math.abs(new Date(a + 'T12:00:00Z').getTime() - new Date(b + 'T12:00:00Z').getTime()) / 864e5;
// ordem da lista: Seu melhor, Mais recente, os outros por data (mais nova primeiro)
export function ordena(alvoW, cands) {
  if (!cands.length) return [];
  const melhor = cands.slice().sort((a, b) => a.w.durationSec - b.w.durationSec || String(b.w.date).localeCompare(String(a.w.date)))[0];
  const resto = cands.filter((c) => c !== melhor);
  const recente = resto.slice().sort((a, b) => dias(a.w.date, alvoW.date) - dias(b.w.date, alvoW.date) || String(b.w.date).localeCompare(String(a.w.date)))[0] || null;
  const outros = resto.filter((c) => c !== recente).sort((a, b) => String(b.w.date).localeCompare(String(a.w.date)));
  return [{ ...melhor, rotulo: 'Seu melhor' }, ...(recente ? [{ ...recente, rotulo: 'Mais recente' }] : []), ...outros.map((c) => ({ ...c, rotulo: null }))];
}

// ---------------- alinhamento pela distância ----------------
function interp(xs, ys, x) {
  let lo = -1, hi = -1;
  for (let i = 0; i < xs.length; i++) { if (xs[i] == null || ys[i] == null) continue; if (xs[i] <= x) lo = i; if (xs[i] >= x) { hi = i; break; } }
  if (lo < 0 && hi < 0) return null;
  if (lo < 0) return ys[hi]; if (hi < 0) return ys[lo];
  if (xs[hi] === xs[lo]) return ys[lo];
  return ys[lo] + ((ys[hi] - ys[lo]) * (x - xs[lo])) / (xs[hi] - xs[lo]);
}
export const distNoTempo = (tr, t) => interp(tr.t, tr.dist, t);
export const tempoNaDist = (tr, d) => interp(tr.dist, tr.t, d);
export const distTotal = (tr) => { for (let i = tr.dist.length - 1; i >= 0; i--) if (tr.dist[i] != null) return tr.dist[i]; return 0; };
// diferença no seu tempo tV (s desde o início do seu treino). v0/f0: onde a comparação começa em cada
// treino (0 = largada; num segmento, o início da passagem). Positivo = o fantasma está à frente.
export function diferenca(trV, trF, tV, { v0 = 0, f0 = 0 } = {}) {
  const dv0 = distNoTempo(trV, v0), df0 = distNoTempo(trF, f0), dv = distNoTempo(trV, tV);
  if (dv == null || dv0 == null || df0 == null) return null;
  const alvo = df0 + (dv - dv0);
  if (alvo > distTotal(trF)) return null; // o fantasma já terminou: sem comparação nessa distância
  const tF = tempoNaDist(trF, alvo); if (tF == null) return null;
  return Math.round((tV - v0) - (tF - f0));
}
// no fim: a diferença na menor das duas distâncias
export function final(trV, trF, { v0 = 0, f0 = 0, v1 = null, f1 = null } = {}) {
  const dv0 = distNoTempo(trV, v0), df0 = distNoTempo(trF, f0);
  const lv = (v1 != null ? distNoTempo(trV, v1) : distTotal(trV)) - dv0, lf = (f1 != null ? distNoTempo(trF, f1) : distTotal(trF)) - df0;
  const L = Math.min(lv, lf);
  const tv = tempoNaDist(trV, dv0 + L), tf = tempoNaDist(trF, df0 + L);
  if (tv == null || tf == null) return null;
  return Math.round((tv - v0) - (tf - f0));
}
// texto da diferença (vivo e final)
export function textoDif(d, fim = false) {
  if (d == null) return null;
  if (fim) return d > 0 ? { t: 'Você terminou ' + d + ' s atrás', tom: 'atencao' } : d < 0 ? { t: 'Você terminou ' + -d + ' s à frente', tom: 'ok' } : { t: 'Empate', tom: 'neutro' };
  return d > 0 ? { t: 'Fantasma ' + d + ' s à frente', tom: 'atencao' } : d < 0 ? { t: 'Você ' + -d + ' s à frente', tom: 'ok' } : { t: 'Empatados', tom: 'neutro' };
}
