// Testes do resumo pós-treino (Fase 5 · Etapa 4). Roda com: node analise/resumo.test.mjs
import { oQueMudou, titulo } from './resumo.mjs';

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const R = (id, date, extra = {}) => ({ id, date, modal: 'corrida', type: 'facil', distKm: 5, durationSec: 1800, hrAvg: 140, ...extra });
const esf = (m) => ({ leitura: { esforcos: Object.fromEntries(Object.entries(m).map(([k, t]) => [k, { t }])) } });

console.log('\n== 1. recorde e melhor do ciclo, numa linha ==');
const base = [R('a', '2026-10-01', esf({ 5000: 1600, 1000: 300 })), R('b', '2026-10-20', esf({ 5000: 1580, 1000: 290 }))];
const pr = R('c', '2026-11-05', esf({ 5000: 1500, 1000: 285 }));
const i1 = oQueMudou({ w: pr, workouts: [...base, pr], race: { startDate: '2026-10-15' } });
ok('dois recordes: "Recorde pessoal em 2 distâncias: 1 km e 5 km"', i1[0] && i1[0].texto === 'Recorde pessoal em 2 distâncias: 1 km e 5 km', i1[0] && i1[0].texto);
const ci = R('d', '2026-11-06', esf({ 5000: 1590 }));
const ciclo = [R('a', '2026-09-01', esf({ 5000: 1500 })), R('b', '2026-10-20', esf({ 5000: 1600 })), ci];
const i2 = oQueMudou({ w: ci, workouts: ciclo, race: { startDate: '2026-10-15' } });
ok('melhor do ciclo (não é recorde)', i2[0] && i2[0].texto === 'Melhor do ciclo nos 5 km');

console.log('\n== 2. segmento no top 3 ==');
const cat = [{ id: 's1', modal: 'corrida', nome: 'Plano de 1,0 km' }, { id: 's2', modal: 'corrida', nome: 'Subida de 0,6 km' }];
const sp = (id, t) => ({ id, t, tAj: t });
const W2 = [R('a', '2026-10-01', { leitura: { segmentos: [sp('s1', 300), sp('s2', 200)] } }), R('b', '2026-10-05', { leitura: { segmentos: [sp('s1', 310), sp('s2', 190)] } }), R('c', '2026-10-09', { leitura: { segmentos: [sp('s1', 320), sp('s2', 210)] } })];
const novo = R('n', '2026-10-12', { leitura: { segmentos: [sp('s1', 290), sp('s2', 205)] } });
const i3 = oQueMudou({ w: novo, workouts: [...W2, novo], segmentos: cat });
ok('"Seu melhor no …" e "3º de 4 no …", o melhor lugar primeiro', i3.map((x) => x.texto).join(' | ') === 'Seu melhor no Plano de 1,0 km | 3º de 4 no Subida de 0,6 km', i3.map((x) => x.texto).join(' | '));
ok('com menos de 3 passagens no segmento, não entra', oQueMudou({ w: novo, workouts: [W2[0], novo], segmentos: cat }).length === 0);
ok('passagens depois da data do treino não contam', oQueMudou({ w: W2[0], workouts: [...W2, novo], segmentos: cat }).every((x) => x.tipo !== 'seg' || !/de 4/.test(x.texto)));

console.log('\n== 3. semana consistente ==');
// meta 2 h; semana de 09/11: 1h30 antes (segunda e terça), o treino de quinta fecha 2h
const S = [R('m', '2026-11-09', { durationSec: 2700 }), R('t', '2026-11-10', { durationSec: 2700 })];
const q = R('q', '2026-11-12', { durationSec: 1800 });
const i4 = oQueMudou({ w: q, workouts: [...S, q], metaH: 2 });
ok('o treino que leva a semana a 80% (com descanso) aparece', i4.some((x) => x.tipo === 'semana' && /Semana consistente: 2h00 de 2h00 de meta/.test(x.texto)), i4.map((x) => x.texto).join(' | '));
const i5 = oQueMudou({ w: S[1], workouts: [...S, q], metaH: 4 });
ok('sem chegar a 80%, não aparece', !i5.some((x) => x.tipo === 'semana'));

console.log('\n== 5. equipamento ==');
const ath = { equipamentos: [{ id: 't1', tipo: 'tenis', nome: 'Meu par', kmInicial: 530, limiteKm: 600, criadoEm: '2026-11-01' }] };
const g = R('g', '2026-11-12', { gearId: 't1', distKm: 6 });
const i6 = oQueMudou({ w: g, workouts: [g], athlete: ath });
ok('linha do tênis com os km e o tom de atenção a partir de 90%', i6.some((x) => x.tipo === 'equip' && x.texto === 'Meu par: 536 de 600 km' && x.tom === null), i6.map((x) => x.texto + ':' + x.tom).join(' | '));
const g2 = R('g2', '2026-11-12', { gearId: 't1', distKm: 15 });
ok('545 de 600: atenção', oQueMudou({ w: g2, workouts: [g2], athlete: ath }).find((x) => x.tipo === 'equip').tom === 'atencao');

console.log('\n== sem nenhuma mudança e título ==');
const nada = R('z', '2026-11-12');
ok('treino sem nenhuma mudança: lista vazia (a tela diz isso em uma linha)', oQueMudou({ w: nada, workouts: [nada] }).length === 0);
ok('título: recorde primeiro', titulo(i1, { tipoNome: 'Rodagem' }) === 'Rodagem com recorde pessoal nos 5 km');
ok('título: seu melhor no segmento', titulo(i3, { tipoNome: 'Rodagem' }) === 'Rodagem com o seu melhor no Plano de 1,0 km');
ok('título: semana consistente', titulo([{ tipo: 'semana', seguidas: 3 }], { tipoNome: 'Longão' }) === 'Longão que fechou a semana consistente · 3 seguidas');
ok('título sem item: a frase do check da história', titulo([], { tipoNome: 'Rodagem', historiaOk: 'Ritmo de rodagem dentro do planejado.' }) === 'Ritmo de rodagem dentro do planejado');
ok('título sem item e sem história', titulo([], { tipoNome: 'Rodagem', distKm: 6.09 }) === 'Rodagem de 6,09 km registrado');
const t0 = performance.now(); for (let i = 0; i < 20; i++) oQueMudou({ w: pr, workouts: Array.from({ length: 150 }, (_, k) => R('x' + k, '2026-0' + (1 + (k % 9)) + '-1' + (k % 9))).concat([pr]), race: { startDate: '2026-10-15' } }); const ms = (performance.now() - t0) / 20;
ok('calcula em bem menos que 300 ms com 150 treinos', ms < 100, ms.toFixed(1) + ' ms');

console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
