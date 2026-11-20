// Filtro da lista de Treinos — a MESMA lógica que estava dentro de Treinos.tsx, só
// separada para ser testada (tests/treinos-filter.test.ts). Ordem: mais recente primeiro.
import * as E from '../engine.mjs';
import { typeName, workoutTitle, dayMon } from './fmt';

export type Modal = 'todas' | 'corrida' | 'bike';
export type Tipo = 'todos' | 'facil' | 'longao' | 'qualidade' | 'prova' | 'teste';
export type Periodo = 'tudo' | '30' | '90' | '365';
export type Filtros = { q: string; modal: Modal; tipo: Tipo; per: Periodo };
export const FILTROS_PADRAO: Filtros = { q: '', modal: 'todas', tipo: 'todos', per: 'tudo' };
export const TIPO_OF: Record<string, Tipo> = { facil: 'facil', regenerativo: 'facil', 'longão': 'longao', tempo: 'qualidade', limiar: 'qualidade', intervalado: 'qualidade', bike_int: 'qualidade', prova: 'prova', teste: 'teste', teste_motor: 'teste' };

export function typeBadge(w: any): string {
  return E.isBike(w) ? (w.indoor ? 'Bike indoor' : 'Bike') : typeName(w.type);
}

export function filterWorkouts(f: Filtros, now: Date = new Date()): any[] {
  const { q, modal, tipo, per } = f;
  const today = new Date(now.getTime()); today.setHours(0, 0, 0, 0);
  const qq = q.trim().toLowerCase();
  return E.sortedWorkouts().slice().reverse().filter((w: any) => {
    if (modal === 'bike' && !E.isBike(w)) return false;
    if (modal === 'corrida' && E.isBike(w)) return false;
    if (tipo !== 'todos' && TIPO_OF[w.type] !== tipo) return false;
    if (per !== 'tudo') { const d = Math.round((today.getTime() - new Date(w.date + 'T00:00:00').getTime()) / 86400000); if (d > +per) return false; }
    if (qq) { const hay = (workoutTitle(w) + ' ' + (w.notes || '') + ' ' + typeBadge(w) + ' ' + (w.terrain || '') + ' ' + dayMon(w.date)).toLowerCase(); if (!hay.includes(qq)) return false; }
    return true;
  });
}
export function filtrosAtivos(f: Filtros): boolean {
  return !!f.q.trim() || f.modal !== 'todas' || f.tipo !== 'todos' || f.per !== 'tudo';
}
