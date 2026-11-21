// SEGMENTOS (Fase 3 · itens 2, 3 e 4 aprovados em 21/11, docs/fase3-formulas.md). Módulo puro.
// - Detecção: trechos de 500 m ou mais percorridos no MESMO sentido por pelo menos 3 treinos
//   diferentes, com corredor de 25 m (a quadrícula do mapa de calor ou a vizinha). Sem
//   sobreposição (fica o de mais passagens; no empate, o mais longo; o outro é cortado e sai se
//   ficar com menos de 500 m). Até 40 por modalidade. Corrida e pedal separados (quem chama filtra).
// - Passagem: uma por treino (se o treino passa duas vezes, fica a mais rápida). Tempo pelo
//   ponto do trajeto mais perto do início e do fim do segmento: 1 s com o trajeto completo,
//   ±5 s com a versão leve.
// - Tempo ajustado (só corrida): GAP do motor (vGap) segundo a segundo e depois o clima
//   (correcaoHadley). Pedal: só o tempo real.
// - Tendência: média das 3 passagens mais recentes × média das 3 anteriores, 2%; < 6 = poucas.
// Importa do motor e de calor.mjs/leitura.mjs; não copia nem altera fórmulas existentes.
import * as E from './engine.mjs';
import { celula, centro, CELULA_M, PASSO_M } from './calor.mjs';
import { correcaoHadley } from './leitura.mjs';

export const SEG_V = 1;
export const MIN_M = 500;
export const MIN_PASSAGENS = 3;
export const MAX_SEG = 40;
export const TENDENCIA_PCT = 2;
const MIN_CEL = Math.round(MIN_M / CELULA_M); // 20 quadrículas
const SALTO_MAX = 8; // posições que a passagem pode "pular" sem sair do corredor
const M_LAT = 111195;

// ---------------- quadrículas ----------------
const parse = (k) => k.split(':').map(Number);
export function perto(a, b) {
  if (a === b) return true;
  const A = parse(a), B = parse(b);
  if (A[0] !== B[0]) { const ca = centro(a), cb = centro(b); return distM(ca.lat, ca.lon, cb.lat, cb.lon) <= CELULA_M * 1.5; }
  return Math.abs(A[1] - B[1]) <= 1 && Math.abs(A[2] - B[2]) <= 1;
}
const viz = (k) => { const [b, x, y] = parse(k); const o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) o.push(b + ':' + (x + dx) + ':' + (y + dy)); return o; };
export function distM(la1, lo1, la2, lo2) { return Math.hypot((la2 - la1) * M_LAT, (lo2 - lo1) * M_LAT * Math.cos((la1 * Math.PI) / 180)); }

// sequência de quadrículas de um trajeto, com o índice do ponto em que entrou em cada uma
export function seqComPontos(lat, lon) {
  const cells = [], pts = []; let last = null, pl = null, po = null;
  for (let i = 0; i < lat.length; i++) {
    const la = lat[i], lo = lon[i]; if (la == null || lo == null) continue;
    if (pl == null) { const c = celula(la, lo); cells.push(c); pts.push(i); last = c; pl = la; po = lo; continue; }
    const n = Math.max(1, Math.ceil(distM(pl, po, la, lo) / PASSO_M));
    for (let j = 1; j <= n; j++) { const f = j / n; const c = celula(pl + f * (la - pl), po + f * (lo - po)); if (c !== last) { cells.push(c); pts.push(i); last = c; } }
    pl = la; po = lo;
  }
  return { cells, pts };
}

// ---------------- passagem: a sequência W percorre C na ordem, dentro do corredor ----------------
export function casaPassagens(C, W) {
  const out = [];
  let p = 0;
  while (p < W.length) {
    if (!perto(W[p], C[0])) { p++; continue; }
    // avança até a última posição ainda perto do início (sai do começo do segmento)
    let s = p; while (s + 1 < W.length && perto(W[s + 1], C[0]) && !perto(W[s + 1], C[1] || C[0])) s++;
    let q = s, ult = s, okk = true;
    for (let k = 1; k < C.length; k++) {
      let achou = false;
      for (let r = ult; r < W.length && r - ult <= SALTO_MAX; r++) { if (perto(W[r], C[k])) { ult = r; achou = true; break; } }
      if (!achou) { okk = false; break; }
      q = ult;
    }
    if (okk) { out.push({ p: s, q }); p = q + 1; } else p = s + 1;
  }
  return out;
}

// ---------------- detecção ----------------
// treinos: [{ id, lat, lon }] (mesma modalidade). Devolve candidatos com as passagens (posições).
export function detecta(treinos) {
  const T = treinos.map((t) => ({ ...t, ...seqComPontos(t.lat, t.lon) }));
  const idx = new Map(); // quadrícula → Set de treinos (índice)
  T.forEach((t, wi) => { for (const c of t.cells) (idx.get(c) || idx.set(c, new Set()).get(c)).add(wi); });
  const apoio = (c, eu) => { const s = new Set(); for (const v of viz(c)) { const x = idx.get(v); if (x) for (const w of x) if (w !== eu) s.add(w); } return s; };
  const cand = [];
  T.forEach((r, ri) => {
    const S = r.cells.map((c) => apoio(c, ri));
    let i = 0;
    while (i < S.length) {
      let A = S[i]; if (A.size < MIN_PASSAGENS - 1) { i++; continue; }
      let j = i + 1;
      while (j < S.length) { const B = new Set([...A].filter((w) => S[j].has(w))); if (B.size < MIN_PASSAGENS - 1) break; A = B; j++; }
      if (j - i >= MIN_CEL) cand.push({ ref: ri, i, j: j - 1, quem: [...A] });
      i = Math.max(i + 1, j);
    }
  });
  // confere o sentido e a ordem de cada treino; uma passagem por treino
  const verificado = [];
  for (const c of cand) {
    const C = T[c.ref].cells.slice(c.i, c.j + 1);
    const pas = [{ w: c.ref, p: c.i, q: c.j }];
    for (const w of c.quem) { const m = casaPassagens(C, T[w].cells); if (m.length) pas.push(...m.map((x) => ({ w, ...x }))); }
    const ws = new Set(pas.map((x) => x.w));
    if (ws.size >= MIN_PASSAGENS) verificado.push({ ref: c.ref, cells: C, pas, n: ws.size });
  }
  // sem sobreposição: mais passagens, depois mais longo
  verificado.sort((a, b) => b.n - a.n || b.cells.length - a.cells.length || (a.cells[0] < b.cells[0] ? -1 : 1));
  const aceitos = [];
  const ocup = new Map(); // quadrícula → [{ seg, k }] dos aceitos
  const dir = (C, k) => { const a = centro(C[Math.max(0, k - 1)]), b = centro(C[Math.min(C.length - 1, k + 1)]); return [b.lon - a.lon, b.lat - a.lat]; };
  for (const v of verificado) {
    const marca = v.cells.map((c, k) => {
      for (const n of viz(c)) for (const o of ocup.get(n) || []) { const d1 = dir(v.cells, k), d2 = dir(o.C, o.k); if (d1[0] * d2[0] + d1[1] * d2[1] > 0) return true; }
      return false;
    });
    // maior pedaço livre
    let bi = -1, bj = -1, s = -1;
    for (let k = 0; k <= marca.length; k++) { if (k < marca.length && !marca[k]) { if (s < 0) s = k; } else if (s >= 0) { if (k - s > bj - bi) { bi = s; bj = k; } s = -1; } }
    if (bi < 0 || bj - bi < MIN_CEL) continue;
    let seg = v;
    if (bi > 0 || bj < v.cells.length) {
      const C = v.cells.slice(bi, bj);
      const pas = [];
      for (const w of new Set(v.pas.map((x) => x.w))) { const m = casaPassagens(C, T[w].cells); pas.push(...m.map((x) => ({ w, ...x }))); }
      const n = new Set(pas.map((x) => x.w)).size; if (n < MIN_PASSAGENS) continue;
      const r0 = pas.find((x) => x.w === v.ref) || pas[0];
      seg = { ref: r0.w, cells: C, pas, n };
    }
    aceitos.push(seg);
    seg.cells.forEach((c, k) => (ocup.get(c) || ocup.set(c, []).get(c)).push({ C: seg.cells, k }));
  }
  aceitos.sort((a, b) => b.n - a.n || b.cells.length - a.cells.length);
  return { T, segs: aceitos.slice(0, MAX_SEG) };
}

// ---------------- geometria do segmento (o que vai para o catálogo) ----------------
function dp(lat, lon, eps) { // Douglas–Peucker simples, em metros
  const keep = new Array(lat.length).fill(false); keep[0] = keep[lat.length - 1] = true;
  const st = [[0, lat.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let mx = 0, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const x = (lon[i] - lon[a]) * M_LAT * Math.cos((lat[a] * Math.PI) / 180), y = (lat[i] - lat[a]) * M_LAT;
      const bx = (lon[b] - lon[a]) * M_LAT * Math.cos((lat[a] * Math.PI) / 180), by = (lat[b] - lat[a]) * M_LAT;
      const L = Math.hypot(bx, by) || 1; const d = Math.abs(x * by - y * bx) / L;
      if (d > mx) { mx = d; mi = i; }
    }
    if (mx > eps && mi > 0) { keep[mi] = true; st.push([a, mi], [mi, b]); }
  }
  return keep.map((k, i) => (k ? i : -1)).filter((i) => i >= 0);
}
const r5 = (x) => Math.round(x * 1e5) / 1e5;
export function compr(f) { let m = 0; for (let i = 1; i < f.lat.length; i++) m += distM(f.lat[i - 1], f.lon[i - 1], f.lat[i], f.lon[i]); return m; }
export function formaDe(lat, lon, a, b) {
  const la = [], lo = []; for (let i = a; i <= b; i++) if (lat[i] != null && lon[i] != null) { la.push(lat[i]); lo.push(lon[i]); }
  if (la.length < 2) return null;
  let eps = 4, k = dp(la, lo, eps); while (k.length > 40 && eps < 60) { eps *= 1.4; k = dp(la, lo, eps); }
  return { lat: k.map((i) => r5(la[i])), lon: k.map((i) => r5(lo[i])) };
}
// id pela geometria: modalidade + início e fim numa grade de 50 m (o mesmo trecho dá o mesmo id)
export function idDe(modal, forma) {
  const n = forma.lat.length - 1;
  const g = (la, lo) => { const k = parse(celula(la, lo)); return k[0] + '.' + (k[1] >> 1) + '.' + (k[2] >> 1); };
  const s = modal[0] + '|' + g(forma.lat[0], forma.lon[0]) + '|' + g(forma.lat[n], forma.lon[n]);
  let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (modal === 'pedal' ? 'p' : 'c') + (h >>> 0).toString(36);
}
export function terreno(distM_, ganhoM) {
  if (!(distM_ > 0) || ganhoM == null) return 'Trecho';
  const g = (ganhoM / distM_) * 100;
  return g > 2 ? 'Subida' : g < -2 ? 'Descida' : 'Plano';
}
const kmBr = (m) => (m / 1000).toFixed(1).replace('.', ',');
export function nomesAutomaticos(segs) {
  const usados = new Map();
  return segs.map((s) => {
    const base = terreno(s.distM, s.ganhoM) + ' de ' + kmBr(s.distM) + ' km';
    const n = (usados.get(base) || 0) + 1; usados.set(base, n);
    return n === 1 ? base : base + ' (' + n + ')';
  });
}

// ---------------- tempo de uma passagem ----------------
function maisPertoDe(tr, la, lo, a, b) {
  let best = -1, bd = Infinity;
  for (let i = Math.max(0, a); i <= Math.min(tr.lat.length - 1, b); i++) { if (tr.lat[i] == null) continue; const d = distM(la, lo, tr.lat[i], tr.lon[i]); if (d < bd) { bd = d; best = i; } }
  return best;
}
// tr: trajeto (t, lat, lon, dist, hr, spd, alt, grade); janela de pontos [a, b]; forma do segmento
export function medePassagem(tr, forma, a, b, { corrida = true, weather = null } = {}) {
  const n = forma.lat.length - 1;
  const folga = 60;
  const iA = maisPertoDe(tr, forma.lat[0], forma.lon[0], a - folga, a + folga);
  const iB = maisPertoDe(tr, forma.lat[n], forma.lon[n], Math.max(iA + 1, b - folga), b + folga);
  if (iA < 0 || iB <= iA) return null;
  const t = tr.t[iB] - tr.t[iA]; if (!(t > 0)) return null;
  let hrS = 0, hrN = 0, d = 0, dGap = 0;
  for (let i = iA + 1; i <= iB; i++) {
    const dt = tr.t[i] - tr.t[i - 1]; if (!(dt > 0)) continue;
    if (tr.hr && tr.hr[i] != null) { hrS += tr.hr[i] * dt; hrN += dt; }
    const v = tr.spd ? tr.spd[i] : null, g = tr.grade ? tr.grade[i] : null;
    if (corrida && v != null && g != null && dt <= 30 && v > 0) { d += v * dt; dGap += E.vGap(v, g) * dt; }
  }
  const out = { ini: Math.round(tr.t[iA]), t: Math.round(t), fc: hrN ? Math.round(hrS / hrN) : null, prec: tr.leve ? 5 : 1 };
  if (tr.dist && tr.dist[iA] != null && tr.dist[iB] != null) out.d = Math.round(tr.dist[iB] - tr.dist[iA]);
  if (tr.alt && tr.alt[iA] != null && tr.alt[iB] != null) out.dz = Math.round(tr.alt[iB] - tr.alt[iA]);
  if (corrida) {
    // 1) inclinação: tempo no plano = tempo × (distância ÷ distância GAP)
    const plano = dGap > 0 && d > 0 ? t * (d / dGap) : null;
    if (plano != null) {
      // 2) clima: × (1 − correção)
      const c = weather && weather.tempC != null ? correcaoHadley(weather.tempC, weather.dewC) : null;
      const pct = c && c.pct != null ? c.pct : null;
      out.tAj = Math.round(plano * (1 - (pct || 0) / 100));
      out.clima = pct; // null = sem clima (só a inclinação)
    }
  }
  return out;
}

// ---------------- tendência ----------------
// passagens: [{ date, t, tAj }] (qualquer ordem). Corrida usa o ajustado; pedal, o real.
export function tendencia(passagens, corrida = true) {
  const val = (p) => (corrida && p.tAj != null ? p.tAj : p.t);
  const L = passagens.filter((p) => val(p) > 0).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (L.length < 6) return { estado: 'poucas', n: L.length };
  const rec = L.slice(-3), ant = L.slice(-6, -3);
  const m = (a) => a.reduce((s, p) => s + val(p), 0) / a.length;
  const mr = m(rec), ma = m(ant);
  const pct = ((ma - mr) / ma) * 100; // positivo = mais rápido
  const estado = pct >= TENDENCIA_PCT ? 'rapido' : pct <= -TENDENCIA_PCT ? 'lento' : 'estavel';
  return { estado, pct: Math.round(pct * 10) / 10, difS: Math.round(ma - mr), desde: ant[0].date, n: L.length };
}
// ranking: o melhor primeiro (ajustado na corrida, real no pedal)
export function ranking(passagens, corrida = true) {
  const val = (p) => (corrida && p.tAj != null ? p.tAj : p.t);
  return passagens.filter((p) => val(p) > 0).slice().sort((a, b) => val(a) - val(b) || String(a.date).localeCompare(String(b.date)));
}

// ---------------- passagens de um treino pelos segmentos do catálogo ----------------
const val = (p, corrida) => (corrida && p.tAj != null ? p.tAj : p.t);
export function celulasDaForma(forma) { return seqComPontos(forma.lat, forma.lon).cells; }
// tr: trajeto do treino; segs: entradas do catálogo (com forma); devolve [{ id, ini, t, tAj, fc, prec, clima, d, dz }]
export function passagensDoTreino(tr, segs, { corrida = true, weather = null } = {}) {
  if (!tr || !tr.lat || !segs.length) return [];
  const W = seqComPontos(tr.lat, tr.lon);
  const out = [];
  for (const s of segs) {
    const C = s._C || (s._C = celulasDaForma(s.forma));
    if (C.length < 2) continue;
    let best = null;
    for (const m of casaPassagens(C, W.cells)) {
      const p = medePassagem(tr, s.forma, W.pts[m.p], W.pts[m.q], { corrida, weather });
      if (!p) continue;
      // a passagem medida precisa ter o tamanho do segmento (±25%), senão o casamento falhou
      const ref = s.distM || s.distGeo;
      if (ref && p.d != null && Math.abs(p.d - ref) > ref * 0.25) continue;
      if (!best || val(p, corrida) < val(best, corrida)) best = p;
    }
    if (best) out.push({ id: s.id, ...best });
  }
  return out;
}

// ---------------- tudo: detecta, monta o catálogo e mede as passagens ----------------
// treinos: [{ w, tr }] da mesma modalidade, com trajeto. anterior: catálogo atual (para manter os nomes).
export function calculaSegmentos(treinos, modal, anterior = []) {
  const corrida = modal !== 'pedal';
  const ok = treinos.filter((x) => x.tr && x.tr.lat && x.tr.lat.some((v) => v != null));
  const { T, segs } = detecta(ok.map((x) => ({ id: x.w.id, lat: x.tr.lat, lon: x.tr.lon })));
  const cat = [];
  for (const s of segs) {
    const r = T[s.ref]; const pr = s.pas.find((x) => x.w === s.ref) || s.pas[0];
    const forma = formaDe(r.lat, r.lon, r.pts[pr.p], r.pts[pr.q]); if (!forma) continue;
    const distGeo = compr(forma);
    if (distGeo < MIN_M) continue;
    cat.push({ id: idDe(modal, forma), modal, forma, distGeo, v: SEG_V });
  }
  // ids repetidos (dois segmentos com início e fim na mesma grade): fica o primeiro
  const vistos = new Set(); const unicos = cat.filter((s) => (vistos.has(s.id) ? false : vistos.add(s.id)));
  const passagens = new Map();
  for (const x of ok) passagens.set(x.w.id, passagensDoTreino(x.tr, unicos, { corrida, weather: x.w.weather || null }));
  // distância e ganho: medianas das passagens; segmento com menos de 3 treinos sai
  const med = (a) => { const s = a.filter((v) => v != null).sort((p, q) => p - q); return s.length ? s[s.length >> 1] : null; };
  const final = [];
  for (const s of unicos) {
    const ps = [...passagens.values()].flat().filter((p) => p.id === s.id);
    if (ps.length < MIN_PASSAGENS) continue;
    s.distM = med(ps.map((p) => p.d)) ?? Math.round(s.distGeo);
    if (s.distM < MIN_M) continue;
    s.ganhoM = med(ps.map((p) => p.dz));
    s.n = ps.length;
    final.push(s);
  }
  final.sort((a, b) => b.n - a.n || b.distM - a.distM);
  const nomes = nomesAutomaticos(final);
  const velhos = new Map((anterior || []).map((s) => [s.id, s]));
  const lista = final.slice(0, MAX_SEG).map((s, i) => {
    const v = velhos.get(s.id);
    const o = { id: s.id, modal, nome: v && v.renomeado ? v.nome : nomes[i], distM: s.distM, ganhoM: s.ganhoM, forma: s.forma, v: SEG_V };
    if (v && v.renomeado) o.renomeado = true;
    return o;
  });
  const ids = new Set(lista.map((s) => s.id));
  for (const [k, ps] of passagens) passagens.set(k, ps.filter((p) => ids.has(p.id)));
  return { lista, passagens };
}
