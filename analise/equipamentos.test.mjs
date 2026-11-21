// Testes dos equipamentos (Fase 5 · Etapa 2). Roda com: node analise/equipamentos.test.mjs
import { kmTenis, kmPeca, estado, padraoPara, avisosHoje, comEsteTreino, novoTenis, novaBike, aposentar, troquei, editar, ativos, LIMITE_PADRAO, PCT_AVISO } from './equipamentos.mjs';

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const R = (id, date, distKm, gearId, extra = {}) => ({ id, date, modal: 'corrida', type: 'facil', distKm, durationSec: 1800, gearId, ...extra });
const B = (id, date, distKm, gearId, extra = {}) => ({ id, date, modal: 'bike', type: 'bike', distKm, durationSec: 3600, gearId, ...extra });

console.log('\n== tênis: km atuais + corridas depois do cadastro ==');
let L = novoTenis([], { nome: 'Meu tênis', kmInicial: 412, limiteKm: 600, hoje: '2026-11-01' });
const t = L[0];
ok('cadastro com nome, km atuais e limite', t.tipo === 'tenis' && t.nome === 'Meu tênis' && t.kmInicial === 412 && t.limiteKm === 600 && t.criadoEm === '2026-11-01');
ok('limite padrão de 600 km', LIMITE_PADRAO === 600 && novoTenis([], { nome: 'x', hoje: '2026-11-01' })[0].limiteKm === 600);
const W = [R('a', '2026-11-02', 6, t.id), R('b', '2026-11-04', 6, t.id), R('c', '2026-11-05', 10, null), R('d', '2026-10-20', 8, t.id), B('e', '2026-11-03', 30, t.id), R('f', '2026-11-06', 5, t.id, { type: 'esteira' })];
const k = kmTenis(t, W);
ok('soma só as corridas com o tênis, depois do cadastro (esteira conta; pedal e sem tênis não)', k.km === 412 + 6 + 6 + 5 && k.corridas === 3, k.km + ' km · ' + k.corridas + ' corridas');
ok('treino sem distância soma 0', kmTenis(t, [R('z', '2026-11-08', 0, t.id)]).km === 412);
ok('editar a distância de um treino corrige os km (nada guardado à parte)', kmTenis(t, W.map((w) => (w.id === 'a' ? { ...w, distKm: 10 } : w))).km === k.km + 4);
ok('excluir um treino corrige os km', kmTenis(t, W.filter((w) => w.id !== 'b')).km === k.km - 6);

console.log('\n== aviso a partir de 90% e card no limite ==');
ok('90% do limite', PCT_AVISO === 0.9);
ok('539 de 600: ok · 540: atenção · 600: limite · 601: limite', estado(539, 600) === 'ok' && estado(540, 600) === 'atencao' && estado(600, 600) === 'limite' && estado(601, 600) === 'limite');
ok('sem limite: sem aviso', estado(5000, null) === null && estado(5000, 0) === null);
const quase = novoTenis([], { nome: 'Q', kmInicial: 595, limiteKm: 600, hoje: '2026-11-01' });
ok('com este treino: a linha do Completar já soma a corrida que está sendo completada', comEsteTreino(quase[0], [], 6).estado === 'limite' && comEsteTreino(quase[0], [], 6).km === 601);
ok('card no Hoje só no limite', avisosHoje(quase, []).length === 0 && avisosHoje(quase, [R('x', '2026-11-02', 6, quase[0].id)]).length === 1);
ok('tênis aposentado não gera card', avisosHoje(aposentar(quase, quase[0].id, '2026-11-03'), [R('x', '2026-11-02', 6, quase[0].id)]).length === 0);
ok('aumentar o limite tira o card', avisosHoje(editar(quase, quase[0].id, { limiteKm: 800 }), [R('x', '2026-11-02', 6, quase[0].id)]).length === 0);

console.log('\n== escolha no Completar ==');
ok('com um tênis ativo, ele vem escolhido', padraoPara('corrida', L, []) === t.id);
let L2 = novoTenis(L, { nome: 'Novo par', kmInicial: 0, hoje: '2026-11-10' });
const t2 = L2[1];
ok('com dois, vem o último usado', padraoPara('corrida', L2, [R('a', '2026-11-12', 5, t.id)]) === t.id);
ok('com dois e nenhum usado, vem o novo par', padraoPara('corrida', L2, []) === t2.id);
ok('aposentado não vem escolhido', padraoPara('corrida', aposentar(L2, t2.id, '2026-11-13'), []) === t.id && ativos(aposentar(L2, t2.id, '2026-11-13'), 'tenis').length === 1);
ok('sem tênis: nada', padraoPara('corrida', [], []) === null);

console.log('\n== bike: pneus e corrente desde a troca, sem aviso ==');
let LB = novaBike([], { hoje: '2026-06-01' });
const bk = LB[0];
const WB = [B('p1', '2026-06-10', 40, bk.id), B('p2', '2026-07-20', 50, bk.id), B('p3', '2026-08-01', 30, null), R('r1', '2026-07-21', 10, bk.id), B('p4', '2026-08-05', 0, bk.id, { indoor: true })];
ok('sem troca: desde o cadastro da bike, só os pedais', kmPeca(bk, 'pneus', WB).km === 90 && kmPeca(bk, 'corrente', WB).km === 90);
LB = troquei(LB, bk.id, 'corrente', '2026-07-15');
ok('"Troquei" zera a contagem da peça e guarda a data', kmPeca(LB[0], 'corrente', WB).km === 50 && kmPeca(LB[0], 'corrente', WB).desde === '2026-07-15' && kmPeca(LB[0], 'pneus', WB).km === 90);
LB = troquei(LB, bk.id, 'corrente', '2026-08-01');
ok('o histórico guarda todas as trocas', LB[0].pecas.corrente.trocas.join() === '2026-07-15,2026-08-01' && kmPeca(LB[0], 'corrente', WB).km === 0);
ok('o pedal do dia da troca fica com a peça antiga', kmPeca(LB[0], 'corrente', [B('d', '2026-08-01', 20, bk.id)]).km === 0 && kmPeca(LB[0], 'corrente', [B('d', '2026-08-02', 20, bk.id)]).km === 20);
ok('bike indoor (sem distância) soma 0', kmPeca(LB[0], 'pneus', [B('i', '2026-09-01', 0, bk.id, { indoor: true })]).km === 0);
ok('pedal: a bike vem escolhida', padraoPara('bike', LB, []) === bk.id && padraoPara('corrida', LB, []) === null);
ok('bike nunca gera card no Hoje', avisosHoje(LB, WB).length === 0);

console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
