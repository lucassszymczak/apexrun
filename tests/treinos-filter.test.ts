import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as E from '../analise/engine.mjs';
import { filterWorkouts, type Modal, type Tipo, type Periodo } from '../analise/app/treinos-filter';
import { typeName, workoutTitle, dayMon } from '../analise/app/fmt';

// REFERÊNCIA: o filtro exatamente como estava em Treinos.tsx antes do novo layout
// (commit 39d3e4d), copiado sem mudanças. O novo bloco de filtros tem de dar o mesmo resultado.
const TIPO_OF: Record<string, string> = { facil: 'facil', regenerativo: 'facil', 'longão': 'longao', tempo: 'qualidade', limiar: 'qualidade', intervalado: 'qualidade', bike_int: 'qualidade', prova: 'prova', teste: 'teste', teste_motor: 'teste' };
const typeBadgeRef = (w: any) => (E.isBike(w) ? (w.indoor ? 'Bike indoor' : 'Bike') : typeName(w.type));
function antes(q: string, modal: string, tipo: string, per: string, now: Date) {
  const today = new Date(now.getTime()); today.setHours(0, 0, 0, 0);
  const qq = q.trim().toLowerCase();
  return E.sortedWorkouts().slice().reverse().filter((w: any) => {
    if (modal === 'bike' && !E.isBike(w)) return false;
    if (modal === 'corrida' && E.isBike(w)) return false;
    if (tipo !== 'todos' && TIPO_OF[w.type] !== tipo) return false;
    if (per !== 'tudo') { const d = Math.round((today.getTime() - new Date(w.date + 'T00:00:00').getTime()) / 86400000); if (d > +per) return false; }
    if (qq) { const hay = (workoutTitle(w) + ' ' + (w.notes || '') + ' ' + typeBadgeRef(w) + ' ' + (w.terrain || '') + ' ' + dayMon(w.date)).toLowerCase(); if (!hay.includes(qq)) return false; }
    return true;
  });
}

const MODAIS: Modal[] = ['todas', 'corrida', 'bike'];
const TIPOS: Tipo[] = ['todos', 'facil', 'longao', 'qualidade', 'prova', 'teste'];
const PERIODOS: Periodo[] = ['tudo', '30', '90', '365'];
const BUSCAS = ['', 'long', 'bike', 'nov', 'zzz'];
const NOW = new Date('2026-11-19T12:00:00-03:00');

// um treino de cada tipo (inclui os que mapeiam para o mesmo grupo) em datas espalhadas
const extras = ['facil', 'regenerativo', 'longão', 'tempo', 'limiar', 'intervalado', 'prova', 'teste', 'teste_motor', 'bike', 'bike_int', 'outro'].map((type, i) => ({
  id: 'x' + i, date: new Date(NOW.getTime() - (i * 37 + 5) * 86400000).toISOString().slice(0, 10), type,
  modal: /bike/.test(type) ? 'bike' : 'corrida', indoor: type === 'bike_int' && i % 2 === 0, distKm: 8, durationSec: 2700, hrAvg: 150, notes: i % 3 ? null : 'nota longa',
}));
const cenarios: [string, any][] = [
  ['exemplo + um de cada tipo', { athlete: { ...E.DEFAULT_ATHLETE }, workouts: [...E.seedWorkouts(), ...extras], daily: [] }],
  ['sintético', JSON.parse(readFileSync('analise/golden/sintetico.state.json', 'utf8'))],
];

describe('filtros da tela Treinos: mesmos resultados de antes (modalidade × tipo × período × busca)', () => {
  for (const [nome, state] of cenarios) {
    it(nome + ': ' + MODAIS.length * TIPOS.length * PERIODOS.length * BUSCAS.length + ' combinações idênticas (ids e ordem)', () => {
      E.setState(JSON.parse(JSON.stringify(state)));
      let n = 0, naoVazias = 0;
      for (const modal of MODAIS) for (const tipo of TIPOS) for (const per of PERIODOS) for (const q of BUSCAS) {
        const novo = filterWorkouts({ q, modal, tipo, per }, NOW).map((w) => w.id);
        const velho = antes(q, modal, tipo, per, NOW).map((w: any) => w.id);
        expect(novo, [modal, tipo, per, q].join(' · ')).toEqual(velho);
        n++; if (velho.length) naoVazias++;
      }
      expect(n).toBe(360);
      expect(naoVazias).toBeGreaterThan(40); // o teste cobre combinações com resultado, não só listas vazias
    });
  }
});
