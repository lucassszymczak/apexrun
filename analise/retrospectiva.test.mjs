// Testes da retrospectiva do ciclo (Fase 5 · Etapa 5). Roda com: node analise/retrospectiva.test.mjs
import { retrospectiva, cardsStories, mostraCardHoje, tempoNoKm, provaDoCiclo } from './retrospectiva.mjs';
import { semanas } from './consistencia.mjs';

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const R = (id, date, distKm, durationSec, extra = {}) => ({ id, date, modal: 'corrida', type: 'facil', distKm, durationSec, ...extra });
const sp = (n, t) => Array.from({ length: n }, () => ({ distKm: 1, timeSec: t }));
// ciclo de 4 semanas (02/11 a 29/11), prova em 29/11 (10 km)
const race = { name: 'Prova de teste', startDate: '2026-11-02', date: '2026-11-29', goal: 'time', targetSec: 3600, distKm: 10 };
const W = [
  R('a', '2026-11-03', 8, 2880), R('b', '2026-11-05', 10, 3600, { leitura: { esforcos: { 5000: { t: 1500 } } } }),
  R('c', '2026-11-10', 12, 4320, { type: 'longão' }), R('d', '2026-11-17', 6, 2160, { gearId: 't1' }),
  R('e', '2026-11-24', 5, 1800, { gearId: 't1' }), R('p', '2026-11-29', 10, 3540, { type: 'prova', gearId: 't1', splits: sp(10, 354) }),
  R('velho', '2026-10-01', 5, 1500, { leitura: { esforcos: { 5000: { t: 1600 } } } }),
];
const ath = { equipamentos: [{ id: 't1', tipo: 'tenis', nome: 'Par de prova', kmInicial: 100, limiteKm: 600, criadoEm: '2026-11-01' }] };
const plano = [{ rotulo: 'Metade', km: 5, tS: 1800 }, { rotulo: 'Chegada', km: 10, tS: 3600 }];

console.log('\n== ciclo completo ==');
const Rt = retrospectiva({ workouts: W, athlete: ath, race, hoje: '2026-11-30', planoPassagens: plano });
ok('7 blocos possíveis; sem segmentos, ficam 6, na ordem', Rt.blocos.map((b) => b.tipo).join() === 'capa,volume,consistencia,recordes,prova,tenis', Rt.blocos.map((b) => b.tipo).join());
ok('capa: "Você terminou a Prova de teste em 0h59, 1 min abaixo do plano."', Rt.blocos[0].titulo === 'Você terminou a Prova de teste em 0h59, 1 min abaixo do plano.', Rt.blocos[0].titulo);
const vol = Rt.blocos[1];
ok('volume: km de corrida do ciclo (soma igual aos treinos)', vol.km === 8 + 10 + 12 + 6 + 5 + 10 && vol.barras.length === 4, vol.km);
ok('volume: barras por semana desde o zero e o pico', vol.barras.map((b) => b.km).join() === '18,12,6,15' && vol.pico === 1 && /pico de 18 km na semana 1/.test(vol.titulo), vol.titulo);
const cons = Rt.blocos[2];
const esp = semanas(W, { hoje: '2026-11-30', n: 120 }).filter((s) => s.dom >= race.startDate && s.seg <= race.date && s.estado !== 'andamento');
ok('consistência igual ao módulo da Fase 3', cons.total === esp.length && cons.consistentes === esp.filter((s) => s.estado === 'consistente').length, cons.titulo);
const rec = Rt.blocos[3];
ok('recordes: os do ciclo (5 km em 05/11) e o longão de 12 km', rec.recordes.length === 1 && rec.recordes[0].dist === '5 km' && rec.longao.km === 12, rec.titulo);
const pv = Rt.blocos[4];
ok('prova: plano × real nas passagens (real pelos splits)', pv.linhas.length === 2 && pv.linhas[0].real === 1770 && pv.linhas[1].real === 3540 && pv.titulo === 'Você ficou dentro do plano em todas as passagens.', JSON.stringify(pv.linhas));
ok('tênis: km do ciclo', Rt.blocos[5].lista[0].km === 21 && Rt.blocos[5].titulo === 'Par de prova: 21 km no ciclo.');

console.log('\n== blocos sem dado não aparecem ==');
const sem = retrospectiva({ workouts: W.filter((w) => w.id !== 'p'), athlete: {}, race, hoje: '2026-11-30' });
ok('sem a prova e sem tênis: só capa, volume, consistência, recordes', sem.blocos.map((b) => b.tipo).join() === 'capa,volume,consistencia,recordes');
const parcial = retrospectiva({ workouts: W, athlete: ath, race, hoje: '2026-11-18' });
ok('versão "até agora": fim hoje, sem a prova, capa "N semanas até agora"', parcial.parcial && parcial.fim === '2026-11-18' && !parcial.blocos.some((b) => b.tipo === 'prova') && /semanas até agora/.test(parcial.blocos[0].titulo), parcial.blocos[0].titulo);
const semPlano = retrospectiva({ workouts: W, athlete: {}, race: { ...race, goal: 'finish', targetSec: null }, hoje: '2026-11-30' });
ok('sem plano: só o tempo final da prova', semPlano.blocos.find((b) => b.tipo === 'prova').titulo === 'Você terminou em 59:00.');
ok('sem início do ciclo: nada', retrospectiva({ workouts: W, race: { name: 'x' }, hoje: '2026-11-30' }) === null);

console.log('\n== segmentos que mais melhoraram ==');
const seg = [{ id: 's1', modal: 'corrida', nome: 'Plano de 1,0 km' }];
const Ws = W.map((w, i) => (i < 6 ? { ...w, leitura: { ...(w.leitura || {}), segmentos: [{ id: 's1', t: 330 - i * 6, tAj: 330 - i * 6 }] } } : w));
const Rs = retrospectiva({ workouts: Ws, athlete: ath, race, hoje: '2026-11-30', segmentos: seg, planoPassagens: plano });
const bs = Rs.blocos.find((b) => b.tipo === 'segmentos');
ok('o segmento que melhorou (tendência "mais rápido" da Fase 3)', bs && bs.lista[0].difS === 18 && bs.titulo === 'No Plano de 1,0 km, 18 s mais rápido.', bs && bs.titulo);

console.log('\n== Stories e card no Hoje ==');
ok('um card por bloco, no máximo 6; os segmentos nunca entram nos Stories', cardsStories(Rs).length === 6 && cardsStories(Rs).flat().map((b) => b.tipo).join() === 'capa,volume,consistencia,recordes,prova,tenis' && cardsStories(sem).length === 4);
ok('card no Hoje do dia seguinte à prova até 14 dias depois', !mostraCardHoje(race, '2026-11-29') && mostraCardHoje(race, '2026-11-30') && mostraCardHoje(race, '2026-12-14') && !mostraCardHoje(race, '2026-12-15'));
ok('tempo no km pelos splits', tempoNoKm(W[5], 2.5) === 885 && tempoNoKm(W[5], 10) === 3540);
ok('a prova do ciclo: tipo Prova na data, com 1 dia de folga', provaDoCiclo(race, W).id === 'p' && provaDoCiclo({ date: '2026-11-27' }, W) === null);
ok('nenhum card recebe trajeto, coordenada nem nome de segmento', JSON.stringify(cardsStories(Rs)).search(/"lat"|"lon"|"forma"|"route"|Plano de 1,0 km/) < 0);
const Rr = retrospectiva({ workouts: W, athlete: ath, race, hoje: '2026-11-30', planoPassagens: plano, realNoKm: (km) => (km === 5 ? 1760 : null) });
ok('real pelo trajeto da prova quando há trajeto', Rr.blocos.find((b) => b.tipo === 'prova').linhas[0].real === 1760);
const athL = { equipamentos: [{ ...ath.equipamentos[0], kmInicial: 590 }] };
ok('tênis no limite: "Hora de trocar o par."', /Hora de trocar o par\.$/.test(retrospectiva({ workouts: W, athlete: athL, race, hoje: '2026-11-30' }).blocos.find((b) => b.tipo === 'tenis').unidade));

console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
