// VERSÃO LEVE DO TRAJETO (Fase 2 · Etapa 3) — o que sobe para o Supabase (analise_tracks)
// para o mapa, o replay e o gráfico aparecerem no outro aparelho.
// - trajeto simplificado (100 a 400 pontos, Douglas–Peucker do próprio track.ts), com o
//   tempo de cada ponto; latitude/longitude em inteiros ×10⁵ (~1 m), em diferenças;
// - séries a cada 10 s: tempo, distância (m), FC, velocidade (×100), altitude (m) e
//   inclinação (×10), em inteiros. Se passar de 64 KB (limite do servidor), o intervalo
//   cresce (15 s, 20 s…) até caber.
// O trajeto completo (1 Hz) continua só no aparelho que importou. Nada aqui muda um número
// das análises: é só o desenho.
import { type Track, simplify } from './track';

export type Light = {
  v: 1; leve: true; start: number; tz: number | null; hasGps: boolean; passo: number;
  route: { lat: number[]; lon: number[]; t: number[] } | null;
  s: { t: number[]; dist: (number | null)[]; hr: (number | null)[]; spd: (number | null)[]; alt: (number | null)[]; grade: (number | null)[] };
};
export const LIMITE_AVISO = 30 * 1024;
export const LIMITE_SERVIDOR = 64 * 1024;

const delta = (a: number[]) => a.map((v, i) => (i ? v - a[i - 1] : v));
const undelta = (a: number[]) => { const o: number[] = []; a.forEach((v, i) => o.push(i ? o[i - 1] + v : v)); return o; };
const q = (x: number | null | undefined, k: number) => (x == null || !isFinite(x) ? null : Math.round(x * k));

function routeIdx(tr: Track, alvo = 400): number[] {
  if (!tr.hasGps) return [];
  const gps: number[] = []; for (let i = 0; i < tr.lat.length; i++) if (tr.lat[i] != null) gps.push(i);
  let eps = 3, r = tr.draw.length ? tr.draw : simplify(gps, tr.lat, tr.lon, eps);
  while (r.length > alvo && eps < 500) { eps *= 1.5; r = simplify(gps, tr.lat, tr.lon, eps); }
  return r;
}

export function toLight(tr: Track): { light: Light; bytes: number } {
  const ri = routeIdx(tr);
  const route = ri.length >= 2 ? {
    lat: delta(ri.map((i) => q(tr.lat[i], 1e5) as number)), lon: delta(ri.map((i) => q(tr.lon[i], 1e5) as number)),
    t: delta(ri.map((i) => Math.round(tr.t[i]))),
  } : null;
  for (let passo = 10; ; passo += 5) {
    const idx: number[] = []; let next = 0;
    for (let i = 0; i < tr.t.length; i++) if (tr.t[i] >= next || i === tr.t.length - 1) { idx.push(i); next = tr.t[i] + passo; }
    const S = (f: (i: number) => number | null) => idx.map(f);
    const light: Light = {
      v: 1, leve: true, start: tr.start, tz: tr.tzOffsetSec, hasGps: !!route, passo, route,
      s: { t: delta(idx.map((i) => Math.round(tr.t[i]))), dist: S((i) => q(tr.dist[i], 1)), hr: S((i) => tr.hr[i]), spd: S((i) => q(tr.spd[i], 100)), alt: S((i) => q(tr.alt[i], 1)), grade: S((i) => q(tr.grade[i], 10)) },
    };
    const bytes = new TextEncoder().encode(JSON.stringify(light)).length;
    if (bytes <= LIMITE_SERVIDOR || passo >= 120) return { light, bytes };
  }
}

// Monta um Track a partir da versão leve: a linha do tempo junta os pontos do trajeto e as
// amostras das séries; o que falta em cada um é interpolado no tempo.
export function fromLight(L: Light): Track {
  const st = undelta(L.s.t);
  const rt = L.route ? undelta(L.route.t) : [];
  const rlat = L.route ? undelta(L.route.lat).map((v) => v / 1e5) : [];
  const rlon = L.route ? undelta(L.route.lon).map((v) => v / 1e5) : [];
  const times = [...new Set([...st, ...rt])].sort((a, b) => a - b);
  const interp = (xs: number[], ys: (number | null)[], x: number, k = 1): number | null => {
    if (!xs.length) return null;
    let lo = 0, hi = xs.length - 1;
    if (x <= xs[0]) return ys[0] == null ? null : (ys[0] as number) / k;
    if (x >= xs[hi]) return ys[hi] == null ? null : (ys[hi] as number) / k;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
    const a = ys[lo], b = ys[hi];
    if (a == null || b == null) return (a ?? b) == null ? null : ((a ?? b) as number) / k;
    const u = (x - xs[lo]) / (xs[hi] - xs[lo] || 1);
    return (a + (b - a) * u) / k;
  };
  const rset = new Map(rt.map((t, i) => [t, i]));
  const tr: Track = { v: 1, start: L.start, tzOffsetSec: L.tz, hasGps: !!L.route, t: [], lat: [], lon: [], dist: [], hr: [], spd: [], alt: [], grade: [], draw: [] };
  times.forEach((t, i) => {
    tr.t.push(t);
    const ri = rset.get(t);
    if (L.route) {
      tr.lat.push(ri != null ? rlat[ri] : interp(rt, rlat, t));
      tr.lon.push(ri != null ? rlon[ri] : interp(rt, rlon, t));
      if (ri != null) tr.draw.push(i);
    } else { tr.lat.push(null); tr.lon.push(null); }
    tr.dist.push(interp(st, L.s.dist, t));
    const h = interp(st, L.s.hr, t); tr.hr.push(h == null ? null : Math.round(h));
    tr.spd.push(interp(st, L.s.spd, t, 100));
    tr.alt.push(interp(st, L.s.alt, t));
    tr.grade.push(interp(st, L.s.grade, t, 10));
  });
  (tr as any).leve = true;
  return tr;
}
