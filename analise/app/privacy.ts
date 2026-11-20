// PRIVACIDADE POR TREINO (Etapa 3). Campo opcional e aditivo no treino (`w.privacy`) e
// padrão no atleta (`athlete.privacidadePadrao`) — o formato de apex.analise.v1 não muda.
//
// - mapa: 'completo' mostra o trajeto inteiro; 'ocultar' remove TODOS os pontos a menos de
//   `raio` metros (distância geodésica) da largada E da chegada; 'nenhum' não mostra mapa.
// - quemVe: 'eu' ou 'todos' (= membros da comunidade do app, nunca a internet aberta; a
//   comunidade chega numa fase futura — por enquanto só fica guardado).
// - Vale para QUALQUER saída compartilhada (cards). O dono sempre vê o treino completo.
import { type Track, haversine } from './track';

export type Privacy = { mapa: 'completo' | 'ocultar' | 'nenhum'; raio: 200 | 500 | 1000; quemVe: 'eu' | 'todos' };
export const PRIVACY_DEFAULT: Privacy = { mapa: 'ocultar', raio: 500, quemVe: 'todos' };
const MAPAS = ['completo', 'ocultar', 'nenhum'], RAIOS = [200, 500, 1000], QUEM = ['eu', 'todos'];

export function normPrivacy(p: any, base: Privacy = PRIVACY_DEFAULT): Privacy {
  const o = p && typeof p === 'object' ? p : {};
  return {
    mapa: MAPAS.includes(o.mapa) ? o.mapa : base.mapa,
    raio: RAIOS.includes(+o.raio) ? (+o.raio as Privacy['raio']) : base.raio,
    quemVe: QUEM.includes(o.quemVe) ? o.quemVe : base.quemVe,
  };
}
export function defaultPrivacy(athlete: any): Privacy { return normPrivacy(athlete && athlete.privacidadePadrao); }
// a do treino, ou o padrão atual (treinos antigos não têm o campo)
export function privacyOf(w: any, athlete: any): Privacy { return normPrivacy(w && w.privacy, defaultPrivacy(athlete)); }

export function privacyLabel(p: Privacy): string {
  const m = p.mapa === 'completo' ? 'Mapa completo' : p.mapa === 'nenhum' ? 'Sem mapa' : 'Oculta início e fim (' + (p.raio >= 1000 ? '1 km' : p.raio + ' m') + ')';
  return m + ' · ' + (p.quemVe === 'eu' ? 'Só eu' : 'Todos');
}

// ---------------- o filtro ----------------
export type Shared = {
  show: boolean;                // há trajeto para mostrar?
  keep: (i: number) => boolean; // o ponto i pode aparecer?
  runs: number[][];             // trechos do traçado simplificado (índices), sem atravessar as zonas ocultas
  start: number | null;         // 1º e último ponto visíveis (para marcar, se não houver ocultação)
  end: number | null;
};

// Pontos usados no desenho de uma saída compartilhada. Com 'ocultar', um trecho do traçado
// só é desenhado se TODOS os pontos originais entre as duas pontas estiverem fora das
// zonas; senão, a linha é cortada ali (nunca liga dois lados passando por dentro).
export function sharedTrack(tr: Track | null, p: { mapa: Privacy['mapa']; raio: number }): Shared {
  const none: Shared = { show: false, keep: () => false, runs: [], start: null, end: null };
  if (!tr || !tr.hasGps || p.mapa === 'nenhum' || tr.draw.length < 2) return none;
  const gps: number[] = [];
  for (let i = 0; i < tr.lat.length; i++) if (tr.lat[i] != null && tr.lon[i] != null) gps.push(i);
  if (gps.length < 2) return none;
  const s = gps[0], e = gps[gps.length - 1];
  const sLat = tr.lat[s] as number, sLon = tr.lon[s] as number, eLat = tr.lat[e] as number, eLon = tr.lon[e] as number;
  const hide = p.mapa === 'ocultar';
  const ok = new Uint8Array(tr.lat.length);
  for (const i of gps) {
    const la = tr.lat[i] as number, lo = tr.lon[i] as number;
    ok[i] = !hide || (haversine(la, lo, sLat, sLon) >= p.raio && haversine(la, lo, eLat, eLon) >= p.raio) ? 1 : 0;
  }
  const keep = (i: number) => i >= 0 && i < ok.length && ok[i] === 1;
  const runs: number[][] = [];
  let cur: number[] = [];
  const d = tr.draw;
  for (let k = 0; k < d.length; k++) {
    const i = d[k];
    if (!keep(i)) { if (cur.length >= 2) runs.push(cur); cur = []; continue; }
    if (cur.length) {
      // algum ponto original (com GPS) entre o anterior e este caiu numa zona?
      let clear = true;
      for (let j = cur[cur.length - 1] + 1; j < i; j++) if (tr.lat[j] != null && !ok[j]) { clear = false; break; }
      if (!clear) { if (cur.length >= 2) runs.push(cur); cur = []; }
    }
    cur.push(i);
  }
  if (cur.length >= 2) runs.push(cur);
  if (!runs.length) return none;
  return { show: true, keep, runs, start: hide ? null : s, end: hide ? null : e };
}

// Todos os índices efetivamente desenhados (para o teste do critério 9 e para o recorte).
export function drawnPoints(sh: Shared): number[] { return sh.runs.flat(); }
