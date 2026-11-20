// LEITURA DO TREINO (Fase 2 · Etapa 5). Itens aprovados pelo Lucas em 20/11
// (docs/fase2-formulas.md). Módulo puro: importa do motor o que precisa (GAP, faixas de
// inclinação, clima padrão), sem copiar nem mudar fórmulas existentes.
// Calculada uma vez, com o trajeto completo (1 Hz), e guardada em w.leitura (v = 1).
import * as E from './engine.mjs';
import { tirosDoTreino } from './laps.mjs';
import { melhoresEsforcos } from './efforts.mjs';
import { ventoDoTreino } from './wind.mjs';

export const LEITURA_V = 1;
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const cToF = (c) => (c * 9) / 5 + 32;

// ---------------- 1. pace em clima padrão (regra temperatura + orvalho) ----------------
const HADLEY = [[100, 0], [110, 0.25], [120, 0.75], [130, 1.5], [140, 2.5], [150, 3.75], [160, 5.25], [170, 7], [180, 9]];
export function correcaoHadley(tempC, dewC) {
  if (tempC == null || dewC == null) return null;
  const soma = cToF(tempC) + cToF(dewC);
  if (soma > 180) return { soma, pct: null, extremo: true };
  for (const [lim, pct] of HADLEY) if (soma <= lim) return { soma, pct };
  return { soma, pct: null, extremo: true };
}
export function climaPadrao(w, athlete) {
  if (E.isBike(w) || !(w.distKm > 0) || !(w.durationSec > 0)) return null;
  const wx = w.weather; if (!wx || wx.tempC == null) return null;
  const tags = E.climateTags(wx, E.climateOpts(athlete || {}, w.geo));
  if (tags.inStandard) return null;
  if (wx.tempC < 8) return null; // frio: sem fonte confiável (item 1)
  const c = correcaoHadley(wx.tempC, wx.dewC); if (!c || c.pct == null || !(c.pct > 0)) return null;
  const pace = w.durationSec / w.distKm;
  return { v: 1, paceSkm: Math.round(pace * (1 - c.pct / 100)), pct: c.pct, somaF: Math.round(c.soma), conf: 'Baixa a Moderada' };
}

// ---------------- 3. início da deriva ----------------
const CONTINUOS = ['facil', 'regenerativo', 'longão', 'tempo', 'limiar', 'prova'];
export function inicioDeriva(w) {
  if (E.isBike(w) || !CONTINUOS.includes(w.type)) return null;
  if (!(w.distKm >= 8 || w.durationSec >= 45 * 60)) return null;
  const sp = (w.splits || []).filter((s) => s && s.timeSec > 0);
  if (sp.length < 8 || sp.filter((s) => s.hrAvg).length < sp.length - 1) return null;
  const pace = sp.map((s) => s.timeSec / (s.distKm || 1));
  const medPace = median(pace);
  // fora: último km incompleto e sprint final (> 10% mais rápido que a mediana)
  let n = sp.length;
  while (n > 0 && ((sp[n - 1].distKm || 1) < 0.9 || pace[n - 1] < medPace * 0.9)) n--;
  const ef = sp.slice(0, n).map((s) => { if (!s.hrAvg) return null; const gt = E.gapTimeFromSplits([{ timeSec: s.timeSec, distKm: s.distKm || 1, elevDeltaM: s.elevDeltaM || 0 }]); return (((s.distKm || 1) * 1000) / gt) / s.hrAvg; });
  const terço = Math.max(3, Math.floor(n / 3));
  const baseArr = ef.slice(2, terço).filter((x) => x != null);
  if (baseArr.length < 2) return null;
  const base = median(baseArr), lim = base * 0.95;
  for (let k = terço; k + 1 < n; k++) {
    if (ef[k] == null || ef[k + 1] == null) continue;
    const resto = ef.slice(k).filter((x) => x != null);
    if ((ef[k] + ef[k + 1]) / 2 < lim && mean(resto) < lim) return { v: 1, km: k + 1, base: Math.round(base * 1e5) / 1e2, limiar: Math.round(lim * 1e5) / 1e2, conf: 'Moderada' };
  }
  return { v: 1, km: null, base: Math.round(base * 1e5) / 1e2, conf: 'Moderada' }; // sem deriva até o fim
}

// ---------------- 7. custo da subida ----------------
export const FAIXAS = ['< −5%', '−5 a −2%', '±2%', '2 a 5%', '> 5%'];
export function custoSubida(tr) {
  if (!tr || !tr.t || tr.t.length < 60 || !tr.grade.some((g) => g != null)) return null;
  const f = FAIXAS.map(() => ({ t: 0, d: 0, dGap: 0, hrT: 0, hrN: 0 }));
  for (let i = 1; i < tr.t.length; i++) {
    const g = tr.grade[i], v = tr.spd[i], dt = tr.t[i] - tr.t[i - 1];
    if (g == null || v == null || !(dt > 0) || dt > 30) continue; // pausas fora
    const b = f[E.gradeBandIdx(g)];
    b.t += dt; b.d += v * dt; b.dGap += E.vGap(v, g) * dt;
    if (tr.hr[i] != null) { b.hrT += tr.hr[i] * dt; b.hrN += dt; }
  }
  const faixas = f.map((b, k) => ({
    faixa: FAIXAS[k], tS: Math.round(b.t), paceSkm: b.d > 0 ? Math.round((b.t / b.d) * 1000) : null,
    gapSkm: b.dGap > 0 ? Math.round((b.t / b.dGap) * 1000) : null, hr: b.hrN ? Math.round(b.hrT / b.hrN) : null,
  })).map((x) => ({ ...x, custoSkm: x.paceSkm != null && x.gapSkm != null ? x.paceSkm - x.gapSkm : null }));
  const sub = [faixas[4], faixas[3]].filter((x) => x.tS >= 180 && x.custoSkm != null);
  const top = sub.sort((a, b) => b.custoSkm - a.custoSkm)[0] || null;
  return { v: 1, faixas, titulo: top ? { faixa: top.faixa, custoSkm: top.custoSkm } : null, plano: !top };
}

// ---------------- tudo junto (ao salvar / reimportar / recalcular) ----------------
export function computeLeitura({ w, tr, laps, wind, athlete }) {
  const L = { v: LEITURA_V };
  try { const c = climaPadrao(w, athlete); if (c) L.climaPadrao = c; } catch { /* item fica de fora */ }
  try { const d = inicioDeriva(w); if (d) L.deriva = d; } catch { /* idem */ }
  if (tr && !E.isBike(w)) {
    try { const qualidade = !CONTINUOS.includes(w.type) || (laps && laps.length > 1); const t = laps && laps.length ? tirosDoTreino(laps, qualidade ? tr : null) : (qualidade ? tirosDoTreino([], tr) : null); if (t) L.tiros = t; } catch { /* idem */ }
    if (!w.indoor) { try { const e = melhoresEsforcos(tr); if (e) L.esforcos = e; } catch { /* idem */ } }
    try { const s = custoSubida(tr); if (s) L.subida = s; } catch { /* idem */ }
    try { const v = ventoDoTreino(tr, wind); if (v) L.vento = v; } catch { /* idem */ }
  }
  if (laps && laps.length) L.voltas = laps.map((l) => ({ n: l.n, t: Math.round(l.t * 10) / 10, d: l.d != null ? Math.round(l.d * 10) / 10 : null, hr: l.hr, g: l.gatilho, i: l.intensidade, ini: l.inicio ?? null, ...(l.alvo ? { alvo: l.alvo } : {}) }));
  if (wind && wind.kmh != null) L.ventoHora = { kmh: wind.kmh, de: wind.de, hora: wind.hora || null };
  return L;
}
// Volta guardada (leitura.voltas) → formato de entrada (para recalcular sem o .FIT)
export function voltasParaLaps(voltas) {
  return (voltas || []).map((v) => ({ n: v.n, t: v.t, d: v.d, hr: v.hr, gatilho: v.g || null, intensidade: v.i || null, inicio: v.ini ?? null, alvo: v.alvo || null }));
}

// ---------------- 8. história do treino (3 frases, regras) ----------------
const pc = (s) => { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const dec1 = (x) => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',');
export function historia(w, ctx = {}) {
  const L = w.leitura || {}, out = [];
  const dc = E.isBike(w) ? null : E.computeDecoupling(w);
  // o que foi bem
  let bem = null;
  if (ctx.selo) bem = ctx.selo;
  else if (dc != null && dc < 5 && !(L.tiros)) bem = 'Deriva de ' + dec1(dc) + '%: base sólida até o fim.';
  else if (L.tiros && L.tiros.regularidadePct != null && L.tiros.regularidadePct < 3) bem = 'Tiros regulares: variação de ' + dec1(L.tiros.regularidadePct) + '%.';
  else if (ctx.negativeSplit) bem = 'Fechou mais rápido que abriu.';
  else if (ctx.efVsNormalPct != null && ctx.efVsNormalPct > 0) bem = 'Economia ' + dec1(ctx.efVsNormalPct) + '% melhor que o seu normal.';
  else bem = 'Treino cumprido: ' + (w.distKm ? dec1(w.distKm).replace(',0', '') + ' km' : '') + (w.durationSec ? ' em ' + E.hms(w.durationSec) : '') + '.';
  out.push({ tom: 'ok', texto: bem });
  // o que observar
  let obs = 'Nada fora do normal neste treino.';
  if (w.pain) obs = 'Você marcou dor: observe antes do próximo treino.';
  else if (dc != null && dc > 8) obs = 'Deriva de ' + dec1(dc) + '%: o ritmo cedeu no fim' + (L.deriva && L.deriva.km ? ', a partir do km ' + L.deriva.km : '') + '.';
  else if (w.rpe >= 7 && (w.type === 'facil' || w.type === 'regenerativo')) obs = 'RPE ' + w.rpe + ' num treino fácil: o corpo pediu mais que o planejado.';
  else if (w.weather && w.weather.inStandard === false && w.weather.tempC != null && w.weather.tempC > 18) obs = 'Calor e umidade (' + Math.round(w.weather.tempC) + ' °C, orvalho ' + Math.round(w.weather.dewC) + ' °C) pesaram no ritmo.';
  out.push({ tom: 'atencao', texto: obs });
  // amanhã
  let am = 'Amanhã: rodagem leve, em Z2.';
  if (ctx.recuperar || (ctx.tsb != null && ctx.tsb < -20)) am = 'Amanhã: descanso ou rodagem bem leve.';
  else if (ctx.proximoPlano) am = 'Amanhã: ' + ctx.proximoPlano + '.';
  out.push({ tom: 'ciano', texto: am });
  return out;
}
export { pc };

// Curva pessoal do custo da subida (item 7): mediana do custo de cada faixa entre os treinos
// do período com pelo menos 3 min nela. Precisa de pelo menos 3 treinos por faixa.
export function curvaSubida(ws) {
  return FAIXAS.map((faixa, k) => {
    const cs = (ws || []).map((w) => w && w.leitura && w.leitura.subida && w.leitura.subida.faixas && w.leitura.subida.faixas[k])
      .filter((f) => f && f.tS >= 180 && f.custoSkm != null).map((f) => f.custoSkm);
    return { faixa, n: cs.length, custoSkm: cs.length >= 3 ? Math.round(median(cs)) : null };
  });
}
// Melhores esforços do período: o melhor de cada distância entre os treinos dados.
export function melhoresDoPeriodo(ws) {
  const out = {};
  for (const w of ws || []) {
    const e = w && w.leitura && w.leitura.esforcos; if (!e) continue;
    for (const k of Object.keys(e)) if (!out[k] || e[k].t < out[k].t) out[k] = { t: e[k].t, id: w.id, date: w.date };
  }
  return out;
}
