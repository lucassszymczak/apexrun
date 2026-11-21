// Testes da consistência por semanas (Fase 3 · Etapa 2). Roda com: node analise/consistencia.test.mjs
import { semanas, sequencias, resumo, segundaDe, hojeEm, tipoDoTreino, addDias } from './consistencia.mjs';

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const W = (date, min, modal = 'corrida') => ({ date, durationSec: min * 60, modal, type: modal === 'bike' ? 'bike' : 'facil' });

console.log('\n== semana de segunda a domingo, no horário de Brasília (critério 7) ==');
ok('segunda da semana de um sábado', segundaDe('2026-11-21') === '2026-11-16');
ok('domingo fica na semana que começou na segunda anterior', segundaDe('2026-11-22') === '2026-11-16' && segundaDe('2026-11-23') === '2026-11-23');
ok('"hoje" no fuso de Brasília: 21/11 às 23h30 em Brasília já é 22/11 em UTC', hojeEm(new Date('2026-11-22T02:30:00Z')) === '2026-11-21');
ok('o que conta: corrida, pedal e força', tipoDoTreino({ modal: 'corrida' }) === 'corrida' && tipoDoTreino({ modal: 'bike' }) === 'pedal' && tipoDoTreino({ modal: 'forca' }) === 'forca');

console.log('\n== a regra (80% e 1 descanso) ==');
const hoje = '2026-11-21';
// meta de 2 h (a sua): semana de 09/11
const caso = (min, diasTreino) => semanas(Array.from({ length: diasTreino }, (_, i) => W(addDias('2026-11-09', i), min / diasTreino)), { hoje, n: 2, metaH: 2 })[0];
ok('80% da meta e descanso: consistente', caso(96, 3).estado === 'consistente', Math.round(caso(96, 3).pct * 100) + '%');
ok('79% da meta: parcial', caso(94.8, 3).estado === 'parcial', Math.round(caso(94.8, 3).pct * 1000) / 10 + '%');
ok('treinou os 7 dias (sem descanso), mesmo com 150%: parcial', caso(180, 7).estado === 'parcial' && caso(180, 7).descansos === 0);
ok('6 dias de treino e 1 descanso, com 100%: consistente', caso(120, 6).estado === 'consistente');
ok('sem treino: "sem treino"', semanas([], { hoje, n: 2, metaH: 2 })[0].estado === 'sem');
ok('semana atual: "em andamento"', semanas([W('2026-11-17', 30)], { hoje, n: 2, metaH: 2 })[1].estado === 'andamento');
ok('na semana atual, os dias que ainda não chegaram não contam como descanso', semanas([], { hoje, n: 1 })[0].dias.filter((d) => d.futuro).length === 1);

console.log('\n== meta padrão móvel (4 semanas anteriores com treino, 0,5 h, mínimo 1 h) ==');
const hist = [W('2026-10-12', 60), W('2026-10-19', 120), W('2026-10-26', 180), W('2026-11-02', 90), W('2026-11-09', 150)];
const ss = semanas(hist, { hoje, n: 3 });
ok('meta da semana de 09/11 = média de 12/10 a 02/11 (1, 2, 3 e 1,5 h) = 2 h (1,875 arredondado)', ss[1].meta === 2 && ss[1].metaOrigem === 'padrao', ss[1].meta + ' h');
ok('semanas sem treino ficam fora da média', semanas([W('2026-10-12', 120), W('2026-11-09', 120)], { hoje, n: 3 })[1].meta === 2);
ok('sem histórico: mínimo de 1 h', semanas([W('2026-11-09', 30)], { hoje, n: 2 })[0].meta === 1);
ok('com a sua meta, ela vale', semanas(hist, { hoje, n: 3, metaH: 4 })[1].meta === 4 && semanas(hist, { hoje, n: 3, metaH: 4 })[1].metaOrigem === 'sua');

console.log('\n== sequência (a semana em andamento não quebra) ==');
const lista = [{ estado: 'consistente' }, { estado: 'parcial' }, { estado: 'consistente' }, { estado: 'consistente' }, { estado: 'consistente' }, { estado: 'andamento' }];
ok('sequência atual = 3 e maior = 3, mesmo com a atual em andamento', sequencias(lista).atual === 3 && sequencias(lista).maior === 3);
ok('uma semana parcial zera a sequência', sequencias([{ estado: 'consistente' }, { estado: 'parcial' }, { estado: 'andamento' }]).atual === 0);
const r = resumo([...Array.from({ length: 10 }, () => ({ estado: 'consistente' })), { estado: 'parcial' }, ...Array.from({ length: 5 }, () => ({ estado: 'consistente' })), { estado: 'andamento' }]);
ok('resumo das últimas 12 encerradas', r.consistentes === 11 && r.de === 12 && r.atual === 5 && r.maior === 10, JSON.stringify(r));
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
