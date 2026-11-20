// TIROS (Fase 2 · itens 4 e 5 aprovados em 20/11, docs/fase2-formulas.md). Módulo puro.
// Ordem: 1) treino estruturado (intensity) · 2) voltas (manual, tempo OU distância) que
// alternam rápido e lento — escolha automática pelos dados · 3) detecção automática pela
// velocidade quando não há voltas aproveitáveis. O km automático não vira tiro (cai fora da
// regra 2 porque não alterna).

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const cv = (a) => { const m = mean(a); if (!m) return null; const sd = Math.sqrt(mean(a.map((x) => (x - m) ** 2))); return sd / m; };

// Resumo das voltas do .FIT (o que fica em leitura.voltas)
export function lapsFromMessages(msgs) {
  const laps = (msgs && msgs.lapMesgs) || [];
  const steps = (msgs && msgs.workoutStepMesgs) || [];
  return laps.map((l, i) => {
    const st = l.wktStepIndex != null ? steps.find((s) => s.messageIndex === l.wktStepIndex) || steps[l.wktStepIndex] : null;
    const lo = st && (st.customTargetSpeedLow ?? st.customTargetValueLow), hi = st && (st.customTargetSpeedHigh ?? st.customTargetValueHigh);
    return {
      n: i + 1, t: l.totalTimerTime ?? l.totalElapsedTime ?? null, d: l.totalDistance ?? null, hr: l.avgHeartRate ?? null,
      inicio: l.startTime instanceof Date ? l.startTime.getTime() / 1000 : null,
      gatilho: l.lapTrigger || null, intensidade: l.intensity || null,
      alvo: st && st.targetType === 'speed' && lo > 0 && hi > 0 ? { vMin: Math.min(lo, hi), vMax: Math.max(lo, hi) } : null,
    };
  }).filter((l) => l.t > 0);
}

const vel = (l) => (l.d > 0 && l.t > 0 ? l.d / l.t : 0);
function medida(tiros) {
  const ds = tiros.map((l) => l.d).filter((x) => x > 0), ts = tiros.map((l) => l.t);
  if (ds.length === tiros.length && cv(ds) != null && cv(ds) < 0.05) { const m = Math.round(mean(ds) / 50) * 50; return { tipo: 'distancia', valor: m, rotulo: tiros.length + ' × ' + (m >= 1000 ? (m / 1000).toString().replace('.', ',') + ' km' : m + ' m') }; }
  if (cv(ts) != null && cv(ts) < 0.05) { const m = Math.round(mean(ts) / 5) * 5; return { tipo: 'tempo', valor: m, rotulo: tiros.length + ' × ' + (m >= 60 && m % 60 === 0 ? m / 60 + ' min' : m + ' s') }; }
  return { tipo: 'misto', valor: null, rotulo: tiros.length + ' tiros' };
}
function pacote(origem, laps, isTiro) {
  const out = [];
  for (let i = 0; i < laps.length; i++) {
    if (!isTiro[i]) continue;
    const l = laps[i], prox = laps[i + 1] && !isTiro[i + 1] ? laps[i + 1] : null;
    out.push({ n: out.length + 1, volta: l.n, t: l.t, d: l.d, paceSkm: l.d > 0 ? (l.t / l.d) * 1000 : null, hr: l.hr, recT: prox ? prox.t : null, inicio: l.inicio, alvo: l.alvo || null });
  }
  if (out.length < 3) return null;
  const paces = out.map((x) => x.paceSkm).filter((x) => x != null);
  return { v: 1, origem, ...medida(out), tiros: out, regularidadePct: paces.length >= 3 ? Math.round(cv(paces) * 1000) / 10 : null };
}

// 1) treino estruturado
export function tirosEstruturado(laps) {
  if (!laps.some((l) => l.intensidade)) return null;
  return pacote('estruturado', laps, laps.map((l) => l.intensidade === 'active'));
}
// 2) voltas que alternam rápido e lento (qualquer gatilho)
export function tirosDeVoltas(laps) {
  const cand = laps.map((l, i) => ({ l, i })).filter(({ l }) => l.t < 600 && vel(l) > 0);
  if (cand.length < 5) return null;
  const vs = cand.map(({ l }) => vel(l)).sort((a, b) => a - b);
  let gap = 0, corte = null;
  for (let i = 1; i < vs.length; i++) if (vs[i] - vs[i - 1] > gap) { gap = vs[i] - vs[i - 1]; corte = (vs[i] + vs[i - 1]) / 2; }
  if (corte == null) return null;
  const rap = cand.filter(({ l }) => vel(l) > corte), len = cand.filter(({ l }) => vel(l) <= corte);
  if (rap.length < 3 || !len.length) return null;
  if (mean(rap.map(({ l }) => vel(l))) < 1.15 * mean(len.map(({ l }) => vel(l)))) return null;
  // alternância: entre dois tiros consecutivos existe ao menos uma volta lenta
  const idx = rap.map(({ i }) => i);
  for (let k = 1; k < idx.length; k++) if (idx[k] - idx[k - 1] < 2) return null;
  const isT = laps.map((_, i) => idx.includes(i));
  const g = new Set(rap.map(({ l }) => l.gatilho));
  return pacote(g.size === 1 && g.has('manual') ? 'voltas manuais' : 'voltas do relógio', laps, isT);
}
// 5) detecção automática pela velocidade (média de 15 s)
export function tirosAuto(tr) {
  if (!tr || !tr.t || tr.t.length < 60) return null;
  const n = tr.t.length, v = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let j = i; j >= 0 && tr.t[i] - tr.t[j] <= 15; j--) if (tr.spd[j] != null) { s += tr.spd[j]; c++; }
    v[i] = c ? s / c : null;
  }
  const vv = v.filter((x) => x != null && x > 0.5).sort((a, b) => a - b); if (vv.length < 60) return null;
  const med = vv[Math.floor(vv.length / 2)], lim = Math.max(med * 1.15, med + 0.4);
  const segs = []; let ini = null;
  for (let i = 0; i < n; i++) {
    const acima = v[i] != null && v[i] > lim;
    if (acima && ini == null) ini = i;
    if ((!acima || i === n - 1) && ini != null) { const fim = acima ? i : i - 1; const dur = tr.t[fim] - tr.t[ini]; if (dur >= 45 && dur <= 600) segs.push([ini, fim]); ini = null; }
  }
  // junta trechos separados por menos de 30 s
  const m = []; for (const s of segs) { const last = m[m.length - 1]; if (last && tr.t[s[0]] - tr.t[last[1]] < 30) last[1] = s[1]; else m.push([...s]); }
  if (m.length < 3) return null;
  const laps = []; let prevFim = 0;
  m.forEach(([a, b], k) => {
    if (a > prevFim) laps.push({ n: laps.length + 1, t: tr.t[a] - tr.t[prevFim], d: (tr.dist[a] ?? 0) - (tr.dist[prevFim] ?? 0), hr: null, inicio: tr.start + tr.t[prevFim], tiro: false });
    const hrs = tr.hr.slice(a, b + 1).filter((x) => x != null);
    laps.push({ n: laps.length + 1, t: tr.t[b] - tr.t[a], d: (tr.dist[b] ?? 0) - (tr.dist[a] ?? 0), hr: hrs.length ? Math.round(mean(hrs)) : null, inicio: tr.start + tr.t[a], tiro: true });
    prevFim = b; if (k === m.length - 1 && b < n - 1) laps.push({ n: laps.length + 1, t: tr.t[n - 1] - tr.t[b], d: (tr.dist[n - 1] ?? 0) - (tr.dist[b] ?? 0), hr: null, tiro: false });
  });
  return pacote('detecção automática', laps, laps.map((l) => l.tiro));
}
export function tirosDoTreino(laps, tr) {
  return (laps && laps.length ? tirosEstruturado(laps) || tirosDeVoltas(laps) : null) || tirosAuto(tr);
}

// "Trocar origem": a escolha do Lucas sobrescreve a automática.
// 'estruturado' · 'voltas' · 'auto' · 'nenhum' (não são tiros)
export const ORIGENS = { estruturado: 'treino estruturado', voltas: 'voltas', auto: 'detecção automática', nenhum: 'sem tiros' };
export function tirosPorOrigem(origem, laps, tr) {
  if (origem === 'nenhum') return null;
  if (origem === 'estruturado') return laps && laps.length ? tirosEstruturado(laps) : null;
  if (origem === 'voltas') return laps && laps.length ? tirosDeVoltas(laps) : null;
  if (origem === 'auto') return tirosAuto(tr);
  return tirosDoTreino(laps, tr);
}
