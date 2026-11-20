// TRAJETO do treino — extraído do .FIT na importação e guardado no IndexedDB por id.
import { rumo, componente, classe } from '../wind.mjs';
// - Pontos: posição em graus (o motor já converte semicírculos: fitNormRecords),
//   tempo, FC, velocidade, altitude, distância e a INCLINAÇÃO SUAVIZADA do próprio
//   motor (gradeSeries, a mesma usada nos KPIs por amostra).
// - Desenho: Douglas–Peucker (~3 m) sobre os pontos com GPS, guardando só os índices —
//   cada ponto mantém o seu tempo, então o replay segue o relógio real do treino.
// - Nada daqui altera um número das análises; é um dado novo e separado.
import * as E from '../engine.mjs';

export type Track = {
  id?: string;
  v: 1;
  start: number;          // epoch (s) do 1º registro
  tzOffsetSec: number | null; // fuso do treino (local_timestamp − timestamp do .FIT)
  hasGps: boolean;
  t: number[];            // s desde o início (tempo real, inclui pausas)
  lat: (number | null)[];
  lon: (number | null)[];
  dist: (number | null)[]; // m
  hr: (number | null)[];
  spd: (number | null)[];  // m/s
  alt: (number | null)[];  // m
  grade: (number | null)[]; // % (gradeSeries do motor, janela 50 m)
  draw: number[];          // índices do traçado simplificado (com GPS)
};

const R = 6371000;
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(lat2 - lat1), dLon = r(lon2 - lon1);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Douglas–Peucker iterativo em metros (projeção equiretangular local). Devolve índices.
export function simplify(idx: number[], lat: (number | null)[], lon: (number | null)[], epsM = 3): number[] {
  if (idx.length <= 2) return idx.slice();
  const lat0 = (lat[idx[0]] as number) * Math.PI / 180;
  const X = (i: number) => ((lon[i] as number) * Math.PI / 180) * Math.cos(lat0) * R;
  const Y = (i: number) => ((lat[i] as number) * Math.PI / 180) * R;
  const keep = new Uint8Array(idx.length); keep[0] = 1; keep[idx.length - 1] = 1;
  const stack: [number, number][] = [[0, idx.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (b - a < 2) continue;
    const ax = X(idx[a]), ay = Y(idx[a]), bx = X(idx[b]), by = Y(idx[b]);
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let best = -1, bd = -1;
    for (let k = a + 1; k < b; k++) {
      const px = X(idx[k]), py = Y(idx[k]);
      let d: number;
      if (L2 === 0) d = Math.hypot(px - ax, py - ay);
      else { const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)); d = Math.hypot(px - (ax + u * dx), py - (ay + u * dy)); }
      if (d > bd) { bd = d; best = k; }
    }
    if (bd > epsM) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  const out: number[] = []; for (let k = 0; k < idx.length; k++) if (keep[k]) out.push(idx[k]);
  return out;
}

// FIT local_timestamp (s desde 31/12/1989 no horário local) − timestamp UTC
const FIT_EPOCH = 631065600;
function tzFrom(messages: any): number | null {
  const act = messages && messages.activityMesgs && messages.activityMesgs[0];
  if (!act || act.localTimestamp == null || !(act.timestamp instanceof Date)) return null;
  const utc = act.timestamp.getTime() / 1000 - FIT_EPOCH;
  const off = Math.round((act.localTimestamp - utc) / 900) * 900; // fusos em múltiplos de 15 min
  return Math.abs(off) <= 14 * 3600 ? off : null;
}

const r1 = (x: number | null | undefined, k = 1) => (x == null || !isFinite(x) ? null : Math.round(x * k) / k);

// Monta o trajeto a partir das mensagens do .FIT (as mesmas que viram o treino).
export function buildTrack(messages: any): Track | null {
  const recs: any[] = E.fitNormRecords(messages && messages.recordMesgs);
  if (!recs.length) return null;
  const grade: (number | null)[] = recs[0].dist != null ? E.gradeSeries(recs, 50) : recs.map(() => null);
  const start = recs[0].t;
  const tr: Track = { v: 1, start, tzOffsetSec: tzFrom(messages), hasGps: false, t: [], lat: [], lon: [], dist: [], hr: [], spd: [], alt: [], grade: [], draw: [] };
  const gpsIdx: number[] = [];
  recs.forEach((r, i) => {
    tr.t.push(Math.round((r.t - start) * 10) / 10);
    const ok = r.lat != null && r.lon != null && isFinite(r.lat) && isFinite(r.lon) && !(r.lat === 0 && r.lon === 0);
    tr.lat.push(ok ? r1(r.lat, 1e6) : null); tr.lon.push(ok ? r1(r.lon, 1e6) : null);
    if (ok) gpsIdx.push(i);
    tr.dist.push(r1(r.dist, 10)); tr.hr.push(r.hr != null ? Math.round(r.hr) : null);
    tr.spd.push(r1(r.speed, 1000)); tr.alt.push(r1(r.alt, 10)); tr.grade.push(grade[i] != null ? r1(grade[i], 10) : null);
  });
  tr.hasGps = gpsIdx.length >= 2;
  tr.draw = tr.hasGps ? simplify(gpsIdx, tr.lat, tr.lon, 3) : [];
  return tr;
}

// ---------------- leitura ----------------
export function duration(tr: Track): number { return tr.t.length ? tr.t[tr.t.length - 1] : 0; }
export function totalDist(tr: Track): number { for (let i = tr.dist.length - 1; i >= 0; i--) if (tr.dist[i] != null) return tr.dist[i] as number; return 0; }
// índice do ponto mais próximo de um tempo (busca binária)
export function idxAtTime(tr: Track, t: number): number {
  let lo = 0, hi = tr.t.length - 1;
  if (hi < 0) return 0;
  while (lo < hi) { const m = (lo + hi) >> 1; if (tr.t[m] < t) lo = m + 1; else hi = m; }
  return lo > 0 && Math.abs(tr.t[lo - 1] - t) < Math.abs(tr.t[lo] - t) ? lo - 1 : lo;
}
export function idxAtDist(tr: Track, d: number): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < tr.dist.length; i++) { const x = tr.dist[i]; if (x == null) continue; const e = Math.abs(x - d); if (e < bd) { bd = e; best = i; } if (x > d && e > bd) break; }
  return best;
}
// posição (com GPS) mais próxima do índice i
export function posAt(tr: Track, i: number): [number, number] | null {
  for (let k = 0; k < tr.lat.length; k++) {
    for (const j of [i - k, i + k]) if (j >= 0 && j < tr.lat.length && tr.lat[j] != null) return [tr.lat[j] as number, tr.lon[j] as number];
    if (i - k < 0 && i + k >= tr.lat.length) break;
  }
  return null;
}
// índices dos marcos de km (cada `every` km)
export function kmMarks(tr: Track, every = 1): { km: number; i: number }[] {
  const out: { km: number; i: number }[] = [];
  let next = every * 1000;
  for (let i = 0; i < tr.dist.length; i++) { const d = tr.dist[i]; if (d == null) continue; while (d >= next) { out.push({ km: Math.round(next / 1000), i }); next += every * 1000; } }
  return out;
}

// ---------------- cores ----------------
export type ColorMode = 'fc' | 'pace' | 'zona' | 'grade' | 'vento';
export const PALETTE = ['var(--zona-1)', 'var(--zona-2)', 'var(--zona-3)', 'var(--zona-4)', 'var(--zona-5)'];

// Banda 0..4 de cada ponto (FC contínua usa frac 0..1 dentro da faixa das zonas).
export const PALETTE_VENTO = ['var(--ciano)', 'var(--texto-3)', 'var(--magenta)'];
export type Colorer = { band: (i: number) => number | null; legend: string[]; title: string; palette?: string[] };
export function colorer(tr: Track, mode: ColorMode, w: any, a: any): Colorer {
  if (mode === 'vento') {
    // vento (Fase 2 · item 2): classe por trecho do traçado (a favor 0 · lateral 1 · contra 2)
    const v = w && w.leitura && w.leitura.vento;
    const cls = new Array(tr.t.length).fill(null) as (number | null)[];
    if (v && !v.fraco) {
      const d = tr.draw;
      for (let k = 1; k < d.length; k++) {
        const p = d[k - 1], q = d[k];
        if (tr.lat[p] == null || tr.lat[q] == null) continue;
        const c = classe(componente(v.kmh, v.de, rumo(tr.lat[p]!, tr.lon[p]!, tr.lat[q]!, tr.lon[q]!)), v.kmh);
        for (let i = p; i < q; i++) cls[i] = c > 0 ? 0 : c < 0 ? 2 : 1;
      }
    }
    return { band: (i) => cls[i], legend: ['a favor', 'lateral', 'contra'], title: 'Vento · a favor, lateral ou contra', palette: PALETTE_VENTO };
  }
  if (mode === 'zona' || mode === 'fc') {
    const b = E.zoneBoundsFor(w, a), mx = E.maxFor(w, a);
    const zoneOf = (hr: number) => (b ? E.hrZoneBounds(hr, b) : E.hrZone(hr, a.fcRep, mx));
    // limites em bpm (início de Z2..Z5) para a legenda e para a FC contínua
    const bounds: number[] = b ? b.slice() : [0.59, 0.74, 0.84, 0.88].map((p) => Math.round(a.fcRep + p * (mx - a.fcRep)));
    if (mode === 'zona') return { band: (i) => { const h = tr.hr[i]; if (h == null) return null; const z = zoneOf(h); return z ? z - 1 : null; }, legend: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'], title: 'Zona de FC' };
    // FC: mesma régua das zonas do atleta, mas o tom acompanha a FC (desenho mais fino)
    return { band: (i) => { const h = tr.hr[i]; if (h == null) return null; const z = zoneOf(h); return z ? z - 1 : null; },
      legend: ['< ' + bounds[0], bounds[0] + '–' + (bounds[1] - 1), bounds[1] + '–' + (bounds[2] - 1), bounds[2] + '–' + (bounds[3] - 1), '≥ ' + bounds[3]], title: 'FC (bpm) · zonas ' + (b ? 'da bike' : 'da corrida') };
  }
  if (mode === 'pace') {
    // 5 faixas pelos quintis do próprio treino (só em movimento)
    const v = tr.spd.filter((s): s is number => s != null && s > 0.5).sort((x, y) => x - y);
    const q = [0.2, 0.4, 0.6, 0.8].map((p) => v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : 0);
    const isBk = E.isBike(w);
    const lab = (s: number) => (isBk ? (s * 3.6).toFixed(1).replace('.', ',') : E.paceStr(1000 / s));
    return { band: (i) => { const s = tr.spd[i]; if (s == null || s <= 0.5) return null; return s < q[0] ? 0 : s < q[1] ? 1 : s < q[2] ? 2 : s < q[3] ? 3 : 4; },
      legend: v.length ? [(isBk ? '< ' : '> ') + lab(q[0]), '', '', '', (isBk ? '> ' : '< ') + lab(q[3])] : ['lento', '', '', '', 'rápido'], title: isBk ? 'Velocidade (km/h) · lento → rápido' : 'Pace (/km) · lento → rápido' };
  }
  // inclinação: as 5 faixas do motor (gradeBandIdx: ≤−5 · −5 a −2 · ±2 · 2 a 5 · >5)
  return { band: (i) => { const g = tr.grade[i]; return g == null ? null : E.gradeBandIdx(g); }, legend: ['< −5%', '−5 a −2%', '±2%', '2 a 5%', '> 5%'], title: 'Inclinação · descida → subida' };
}

// Segmentos do traçado simplificado agrupados por cor (poucos caminhos = desenho rápido).
export function coloredRuns(tr: Track, band: (i: number) => number | null): { band: number | null; idx: number[] }[] {
  const out: { band: number | null; idx: number[] }[] = [];
  const d = tr.draw;
  for (let k = 0; k < d.length - 1; k++) {
    // cor do trecho = a mais frequente entre os pontos originais do trecho
    const a = d[k], b = d[k + 1]; const cnt = [0, 0, 0, 0, 0]; let any = false;
    for (let i = a; i < b; i++) { const z = band(i); if (z != null) { cnt[z]++; any = true; } }
    const z = any ? cnt.indexOf(Math.max(...cnt)) : null;
    const last = out[out.length - 1];
    if (last && last.band === z) last.idx.push(b);
    else out.push({ band: z, idx: [a, b] });
  }
  return out;
}
