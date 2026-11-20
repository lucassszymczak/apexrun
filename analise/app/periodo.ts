// PERÍODO DE ANÁLISE (pedido do Lucas, 20/11): com o histórico do Garmin desde 2018, os
// treinos antigos pesavam nas telas de hoje. O período escolhe QUAIS treinos entram nas
// contas — as fórmulas são as mesmas do motor; nada é apagado nem muda em apex.analise.v1.
// - Fica guardado só neste aparelho (preferência de tela, como o tema).
// - Vale para Hoje, Coach, Progresso (com os sistemas e os recordes) e Relatório.
// - Hoje e Coach olham para AGORA: com um período que já terminou (um ano passado ou o ciclo
//   anterior), eles usam os últimos 12 meses e avisam.
import { useSyncExternalStore } from 'react';
import * as E from '../engine.mjs';

export type Periodo = string; // 'tudo' | 'ciclo' | 'anterior' | '12m' | '90d' | 'aAAAA'
const KEY = 'apex.periodo';
export const PADRAO: Periodo = '12m';

let cur: Periodo = (() => { try { return localStorage.getItem(KEY) || PADRAO; } catch { return PADRAO; } })();
const ls = new Set<() => void>();
export function setPeriodo(p: Periodo) { cur = p; try { localStorage.setItem(KEY, p); } catch { /* sem storage */ } ls.forEach((l) => l()); }
export function usePeriodo(): Periodo { return useSyncExternalStore((cb) => { ls.add(cb); return () => ls.delete(cb); }, () => cur); }
export function periodoAtual(): Periodo { return cur; }

const iso = (d: Date) => d.toISOString().slice(0, 10);
function anterior(st: any) { return (st.races || []).slice().sort((a: any, b: any) => String(b.race && b.race.date).localeCompare(String(a.race && a.race.date)))[0]; }

export function opcoes(all: any[], st: any): [Periodo, string][] {
  const anos = [...new Set(all.map((w: any) => String(w.date).slice(0, 4)))].filter(Boolean).sort().reverse();
  const o: [Periodo, string][] = [['tudo', 'Desde o início']];
  if (st.race && st.race.startDate) o.push(['ciclo', 'Ciclo atual']);
  const pv = anterior(st); if (pv && pv.race && pv.race.startDate) o.push(['anterior', 'Ciclo anterior']);
  o.push(['12m', 'Últimos 12 meses'], ['90d', 'Últimos 90 dias']);
  anos.forEach((y) => o.push(['a' + y, y]));
  return o;
}
export function intervalo(p: Periodo, st: any, hoje = new Date()): [string, string] | null {
  if (p === 'ciclo' && st.race && st.race.startDate) return [String(st.race.startDate).slice(0, 10), '9999-12-31'];
  if (p === 'anterior') { const pv = anterior(st); if (pv && pv.race && pv.race.startDate) return [String(pv.race.startDate).slice(0, 10), String(pv.race.date).slice(0, 10)]; return null; }
  if (p === '12m') return [iso(new Date(hoje.getTime() - 365 * 86400000)), '9999-12-31'];
  if (p === '90d') return [iso(new Date(hoje.getTime() - 90 * 86400000)), '9999-12-31'];
  if (/^a\d{4}$/.test(p)) return [p.slice(1) + '-01-01', p.slice(1) + '-12-31'];
  return null;
}
// O período chega até hoje? (Hoje/Coach só aceitam esses)
export function ehAtual(p: Periodo, st: any): boolean {
  const r = intervalo(p, st); return !r || r[1] >= iso(new Date());
}
export function filtra(ws: any[], p: Periodo, st: any): any[] {
  const r = intervalo(p, st); return r ? ws.filter((w: any) => w.date >= r[0] && w.date <= r[1]) : ws;
}
export function rotulo(p: Periodo, all: any[], st: any): string {
  const o = opcoes(all, st).find(([k]) => k === p); return o ? o[1] : 'Desde o início';
}

// Para as funções do motor que leem a lista de treinos do estado por dentro (ex.: progContext):
// troca a lista SÓ durante a chamada (síncrona) e devolve na hora. Nada é gravado.
export function comTreinos<T>(ws: any[], fn: () => T): T {
  const st = E.getState(); const orig = st.workouts;
  st.workouts = ws;
  try { return fn(); } finally { st.workouts = orig; }
}
