// SEGMENTOS no app (Fase 3 · Etapa 4). Catálogo em athlete.segmentos (sincroniza com os seus
// aparelhos; nunca vai para card, compartilhamento ou comunidade), meta em athlete.segmentosMeta e
// as passagens de cada treino em w.leitura.segmentos. A detecção roda num Web Worker e só refaz
// quando muda o conjunto de treinos com trajeto neste aparelho.
import { useEffect, useSyncExternalStore } from 'react';
import { getState, commit } from './store';
import { getTrack, trackIds } from './db';
import { ehPedal, ehEsteira } from '../calor.mjs';
import { calculaSegmentos, passagensDoTreino, tendencia, ranking, type Segmento, type Passagem } from '../segmentos.mjs';

export type Modal = 'corrida' | 'pedal';
export const modalDe = (w: any): Modal => (ehPedal(w) ? 'pedal' : 'corrida');

// estado da busca (para a tela mostrar "Procurando segmentos…")
type Busca = { rodando: Modal | null; erro: string | null };
let busca: Busca = { rodando: null, erro: null };
const ls = new Set<() => void>();
const set = (b: Partial<Busca>) => { busca = { ...busca, ...b }; ls.forEach((f) => f()); };
export function useBusca(): Busca { return useSyncExternalStore((cb) => { ls.add(cb); return () => ls.delete(cb); }, () => busca); }

export function catalogo(st: any, modal?: Modal): Segmento[] {
  const l: Segmento[] = (st.athlete && st.athlete.segmentos) || [];
  return modal ? l.filter((s) => s.modal === modal) : l;
}
const assinatura = (ids: string[]) => { let h = 2166136261; const s = ids.slice().sort().join(','); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + ids.length; };

function rodaNoWorker(dados: any): Promise<{ lista: Segmento[]; passagens: [string, Passagem[]][] }> {
  return new Promise((res, rej) => {
    let w: Worker;
    try { w = new Worker(new URL('./seg-worker.ts', import.meta.url), { type: 'module' }); }
    catch { const r = calculaSegmentos(dados.treinos, dados.modal, dados.anterior); res({ lista: r.lista, passagens: [...r.passagens.entries()] }); return; }
    w.onmessage = (e) => { w.terminate(); if (e.data.ok) res(e.data); else rej(new Error(e.data.erro)); };
    w.onerror = (e) => { w.terminate(); rej(new Error(e.message || 'worker')); };
    w.postMessage(dados);
  });
}

// refaz o catálogo da modalidade se o conjunto de treinos com trajeto mudou
export async function atualizarSegmentos(modal: Modal, { forcar = false } = {}): Promise<boolean> {
  if (busca.rodando) return false;
  const st = getState();
  const ids = await trackIds();
  const ws = st.workouts.filter((w: any) => modalDe(w) === modal && !ehEsteira(w) && ids.has(w.id));
  const sig = assinatura(ws.map((w: any) => w.id));
  const meta = (st.athlete.segmentosMeta || {})[modal];
  if (!forcar && meta && (meta.sig === sig || ws.length < meta.n)) return false; // nada novo, ou o outro aparelho tem mais trajetos
  if (ws.length < 3) return false;
  set({ rodando: modal, erro: null });
  try {
    const treinos = [];
    for (const w of ws) { const tr = await getTrack(w.id); if (tr && tr.hasGps) treinos.push({ w: { id: w.id, date: w.date, weather: w.weather || null }, tr: { t: tr.t, lat: tr.lat, lon: tr.lon, dist: tr.dist, hr: tr.hr, spd: tr.spd, alt: tr.alt, grade: tr.grade, leve: !!(tr as any).leve } }); }
    const anterior = catalogo(getState(), modal);
    const r = await rodaNoWorker({ treinos, modal, anterior });
    gravar(modal, r.lista, new Map(r.passagens), ws.map((w: any) => w.id), sig);
    return true;
  } catch (e: any) { set({ erro: String(e && e.message) }); return false; }
  finally { set({ rodando: null }); }
}

function gravar(modal: Modal, lista: Segmento[], pas: Map<string, Passagem[]>, ids: string[], sig: string) {
  const S = getState(); const a: any = S.athlete; const agora = new Date().toISOString();
  a.segmentos = [...catalogo(S).filter((s) => s.modal !== modal), ...lista];
  a.segmentosMeta = { ...(a.segmentosMeta || {}), [modal]: { sig, n: ids.length, em: agora, v: lista[0] ? lista[0].v : 1 } };
  a.updatedAt = agora;
  for (const w of S.workouts) {
    if (!ids.includes(w.id)) continue;
    const velho: Passagem[] = (w.leitura && w.leitura.segmentos) || [];
    // uma passagem medida com o trajeto completo (1 s) não é trocada por uma da versão leve (±5 s)
    const novo = (pas.get(w.id) || []).map((p) => { const v = velho.find((x) => x.id === p.id); return v && v.prec === 1 && p.prec === 5 ? v : p; });
    if (JSON.stringify(novo) === JSON.stringify(velho)) continue;
    w.leitura = { ...(w.leitura || {}), segmentos: novo };
    w.updatedAt = agora;
  }
  commit();
}

// um treino novo (com trajeto) contra o catálogo que já existe: conta barata, na hora
export async function passagensDeUm(w: any): Promise<void> {
  if (!w || (w.leitura && w.leitura.segmentos)) return;
  const st = getState(); const modal = modalDe(w);
  const cat = catalogo(st, modal); if (!cat.length || ehEsteira(w)) return;
  const tr = await getTrack(w.id); if (!tr || !tr.hasGps) return;
  const ps = passagensDoTreino(tr, cat, { corrida: modal === 'corrida', weather: w.weather || null });
  const x = getState().workouts.find((o: any) => o.id === w.id); if (!x) return;
  x.leitura = { ...(x.leitura || {}), segmentos: ps };
  x.updatedAt = new Date().toISOString();
  commit();
}

// passagens de um segmento, com a data e o treino
export type PassagemW = Passagem & { wid: string; date: string; w: any };
export function passagensDe(st: any, id: string): PassagemW[] {
  const out: PassagemW[] = [];
  for (const w of st.workouts) for (const p of ((w.leitura && w.leitura.segmentos) || []) as Passagem[]) if (p.id === id) out.push({ ...p, wid: w.id, date: w.date, w });
  return out;
}
export function resumoSeg(st: any, s: Segmento) {
  const ps = passagensDe(st, s.id); const corrida = s.modal === 'corrida';
  return { ps, rk: ranking(ps, corrida), td: tendencia(ps, corrida), corrida, leve: ps.some((p) => p.prec === 5) };
}
// abre a tela: tenta refazer o catálogo das duas modalidades (uma por vez)
export function useAtualizaSegmentos(modal: Modal) {
  useEffect(() => { atualizarSegmentos(modal).catch(() => {}); }, [modal]);
}
