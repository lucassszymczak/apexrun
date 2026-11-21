// Testes de Progresso › Corpo (Fase 5 · Etapa 4). Roda com: node analise/corpo.test.mjs
import { contagem, faixaCorpo } from './corpo.mjs';
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const W = (id, date, regs) => ({ id, date, modal: 'corrida', dorRegioes: regs });
const ws = [
  W('a', '2026-09-01', [{ regiao: 'canela', lado: 'e', int: 3 }]),
  W('b', '2026-10-01', [{ regiao: 'canela', lado: 'e', int: 4 }, { regiao: 'lombar', lado: null, int: 2 }]),
  W('c', '2026-10-15', []),
  W('d', '2026-11-01', [{ regiao: 'canela', lado: 'e', int: 2 }, { regiao: 'joelho', lado: 'd', int: 0 }]),
  { id: 'e', date: '2026-11-02', modal: 'corrida' }, // treino antigo, sem o campo
];
const c = contagem(ws, { de: '2026-09-15', ate: '2026-11-30' });
ok('treinos registrados no período (com o campo, mesmo vazio)', c.treinos === 3, c.treinos);
ok('vezes por região: só dor acima de 0, dentro do período', c.vezes.canela_e === 2 && c.vezes.lombar === 1 && !c.vezes.joelho_d);
ok('a região que mais doeu', c.top && c.top.k === 'canela_e' && c.top.n === 2);
ok('linha do tempo da região, em ordem de data', c.linhas.canela_e.map((x) => x.date + ':' + x.int).join() === '2026-10-01:4,2026-11-01:2');
ok('faixas 1–2, 3–5, 6 ou mais', [0, 1, 2, 3, 5, 6, 9].map(faixaCorpo).join() === '-1,0,0,1,1,2,2');
ok('sem registros: nada', contagem([], {}).top === null && contagem([], {}).treinos === 0);
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
