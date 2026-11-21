// MAPA DE CALOR (Fase 3 · item 1 aprovado em 21/11, docs/fase3-formulas.md). Módulo puro.
// - Quadrículas de 25 m. A grade é global (nenhuma coordenada fixa no código): a latitude é
//   dividida em faixas de 1°, e dentro de cada faixa a largura da quadrícula em longitude usa o
//   cosseno do meio da faixa. O erro dentro de 1° é menor que 1%.
// - Cada treino conta UMA vez por quadrícula, mesmo que vá e volte (vaivém).
// - Faixas: 1–2, 3–5, 6–10, 11–19, 20 ou mais.
// - Corrida e pedal nunca se misturam (quem chama filtra). Esteira e treino sem trajeto ficam de fora.
// - Tudo é calculado no aparelho. Nada daqui vai para a sincronização, cards ou compartilhamento.
import { isBike } from './engine.mjs';
export const CALOR_V = 1;
export const CELULA_M = 25;
export const PASSO_M = 5; // densificação entre dois pontos do trajeto
export const FAIXAS = [[1, 2], [3, 5], [6, 10], [11, 19], [20, Infinity]];
const M_LAT = 111195; // metros por grau de latitude

export function faixaDe(n) { for (let i = 0; i < FAIXAS.length; i++) if (n <= FAIXAS[i][1]) return i; return FAIXAS.length - 1; }

const banda = (lat) => Math.floor(lat);
const mLon = (b) => M_LAT * Math.cos(((b + 0.5) * Math.PI) / 180);
// chave da quadrícula: "faixa:ix:iy"
export function celula(lat, lon) {
  const b = banda(lat);
  return b + ':' + Math.floor((lon * mLon(b)) / CELULA_M) + ':' + Math.floor((lat * M_LAT) / CELULA_M);
}
// centro da quadrícula (para desenhar)
export function centro(k) {
  const [b, ix, iy] = k.split(':').map(Number);
  return { lat: ((iy + 0.5) * CELULA_M) / M_LAT, lon: ((ix + 0.5) * CELULA_M) / mLon(b) };
}
// vizinhas (8 direções). Na fronteira de faixa de latitude, procura também na faixa ao lado.
export function vizinhas(k) {
  const [b, ix, iy] = k.split(':').map(Number);
  const out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const c = centro(b + ':' + (ix + dx) + ':' + (iy + dy));
    out.push(celula(c.lat, c.lon));
  }
  return [...new Set(out)].filter((x) => x !== k);
}

// sequência de quadrículas de um trajeto (pontos em graus; nulos são pulados), na ordem
export function sequencia(lat, lon) {
  const seq = []; let last = null, pl = null, po = null;
  for (let i = 0; i < lat.length; i++) {
    const la = lat[i], lo = lon[i];
    if (la == null || lo == null || !isFinite(la) || !isFinite(lo)) continue;
    if (pl == null) { const c = celula(la, lo); seq.push(c); last = c; pl = la; po = lo; continue; }
    const d = Math.hypot((la - pl) * M_LAT, (lo - po) * M_LAT * Math.cos((la * Math.PI) / 180));
    const n = Math.max(1, Math.ceil(d / PASSO_M));
    for (let j = 1; j <= n; j++) {
      const f = j / n; const c = celula(pl + f * (la - pl), po + f * (lo - po));
      if (c !== last) { seq.push(c); last = c; }
    }
    pl = la; po = lo;
  }
  return seq;
}
// o que fica guardado por treino: as quadrículas (sem repetição) e as ligações entre elas
export function doTreino(lat, lon) {
  const seq = sequencia(lat, lon);
  const cells = new Set(), links = new Set();
  for (let i = 0; i < seq.length; i++) {
    const c = seq[i]; cells.add(c);
    const p = seq[i - 1]; if (p != null) links.add(p < c ? p + '|' + c : c + '|' + p);
  }
  return { cells: [...cells], links: [...links] };
}

// junta os treinos: quantos treinos por quadrícula, e quais
export function agrega(porTreino) {
  const cont = new Map(), quem = new Map(), links = new Set();
  for (const { id, cells, links: ls } of porTreino) {
    for (const c of cells) { cont.set(c, (cont.get(c) || 0) + 1); (quem.get(c) || quem.set(c, []).get(c)).push(id); }
    for (const l of ls || []) links.add(l);
  }
  return { cont, quem, links, n: porTreino.length };
}
export function resumo(ag) {
  const faixas = FAIXAS.map(() => 0);
  for (const v of ag.cont.values()) faixas[faixaDe(v)]++;
  return { treinos: ag.n, celulas: ag.cont.size, km: (ag.cont.size * CELULA_M) / 1000, faixas };
}
// linhas para desenhar: cada ligação vira um traço entre os centros, na faixa da menor contagem
// das duas pontas; traços da mesma faixa que se encadeiam viram uma linha só
export function linhas(ag) {
  const porFaixa = FAIXAS.map(() => new Map()); // faixa → (quadrícula → vizinhas)
  for (const l of ag.links) {
    const [a, b] = l.split('|');
    const n = Math.min(ag.cont.get(a) || 0, ag.cont.get(b) || 0); if (!n) continue;
    const g = porFaixa[faixaDe(n)];
    (g.get(a) || g.set(a, []).get(a)).push(b); (g.get(b) || g.set(b, []).get(b)).push(a);
  }
  const out = [];
  porFaixa.forEach((g, f) => {
    const usado = new Set(); const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
    // começa pelas pontas (grau ≠ 2) e depois pelos ciclos que sobrarem
    const ordem = [...g.keys()].sort((a, b) => ((g.get(a).length === 2) - (g.get(b).length === 2)) || (a < b ? -1 : 1));
    for (const s of ordem) for (const v0 of g.get(s)) {
      if (usado.has(key(s, v0))) continue;
      const cad = [s, v0]; usado.add(key(s, v0));
      let prev = s, cur = v0;
      while (g.get(cur).length === 2) {
        const nx = g.get(cur).find((x) => x !== prev && !usado.has(key(cur, x)));
        if (!nx) break; usado.add(key(cur, nx)); cad.push(nx); prev = cur; cur = nx;
      }
      out.push({ faixa: f, cells: cad });
    }
  });
  // quadrículas isoladas (sem ligação, p. ex. um único ponto) viram um ponto
  const temLig = new Set(); for (const l of ag.links) { const [a, b] = l.split('|'); temLig.add(a); temLig.add(b); }
  for (const [c, n] of ag.cont) if (!temLig.has(c)) out.push({ faixa: faixaDe(n), cells: [c] });
  return out;
}
// tocar numa rua: as quadrículas ligadas à tocada que tiveram EXATAMENTE os mesmos treinos
export function rua(ag, k) {
  const ids = ag.quem.get(k); if (!ids) return null;
  const assin = ids.slice().sort().join(',');
  const vistos = new Set([k]), fila = [k];
  while (fila.length) {
    const c = fila.pop();
    for (const v of vizinhas(c)) {
      if (vistos.has(v) || !ag.quem.has(v)) continue;
      if (ag.quem.get(v).slice().sort().join(',') !== assin) continue;
      vistos.add(v); fila.push(v);
    }
  }
  return { cells: [...vistos], ids: ids.slice(), km: (vistos.size * CELULA_M) / 1000 };
}
// quadrícula com treino mais perto de um ponto (até maxM metros)
export function maisPerto(ag, lat, lon, maxM = 60) {
  let best = null, bd = Infinity;
  const k0 = celula(lat, lon); const cand = [k0, ...vizinhas(k0)];
  for (const c of cand) if (ag.cont.has(c)) { const p = centro(c); const d = Math.hypot((p.lat - lat) * M_LAT, (p.lon - lon) * M_LAT * Math.cos((lat * Math.PI) / 180)); if (d < bd) { bd = d; best = c; } }
  if (best) return best;
  // procura um pouco mais longe
  for (const [c] of ag.cont) { const p = centro(c); const d = Math.hypot((p.lat - lat) * M_LAT, (p.lon - lon) * M_LAT * Math.cos((lat * Math.PI) / 180)); if (d < bd) { bd = d; best = c; } }
  return bd <= maxM ? best : null;
}
// o que entra: modalidade separada; esteira e treino sem trajeto ficam de fora
export const ehPedal = (w) => isBike(w);
export const ehEsteira = (w) => !!w.indoor;
