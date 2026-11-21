// Testes do plano de prova (Fase 4 · Etapa 3). Roda com: node analise/plano.test.mjs
// Percurso sintético; nenhum valor das telas de design. Critérios 7, 8, 9, 10 e 14.
import * as E from './engine.mjs';
import { correcaoHadley } from './leitura.mjs';
import { kmsDaProva, paceAlvo, montaPlano, passagens, blocos, tituloPlano, modoClima, aberturaPrevisao, correcaoDaHora, tempoRealista, metaDoPlano, percursoExtraPct, NEGATIVA_PCT } from './plano.mjs';
import { fetchPrevisao } from './previsao.mjs';

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const near = (a, b, t) => a != null && b != null && Math.abs(a - b) <= t;
const M = 42.195, ALVO = 4 * 3600 + 47 * 60; // alvo sintético

// percurso sintético: +3% do km 13 ao 15, −2% do km 31 ao 33
const kmsPerc = kmsDaProva(M).map((k) => ({ ...k, inclinacao: k.km >= 13 && k.km <= 15 ? 3 : k.km >= 31 && k.km <= 33 ? -2 : 0 }));

console.log('\n== pace por km (critérios 7 e 8) ==');
{
  const plano = montaPlano({ distKm: M, alvoSec: ALVO });
  ok('critério 7 · a soma dos km é o tempo-alvo (±1 s)', near(plano.totalS, ALVO, 1), E.hms(plano.totalS));
  ok('critério 7 · percurso plano: todos os km com o mesmo pace', plano.linhas.every((l) => near(l.paceSkm, plano.linhas[0].paceSkm, 1e-9)), E.paceStr(plano.linhas[0].paceSkm));
  ok('o último km é parcial (0,195 km)', near(plano.linhas[42].distKm, 0.195, 1e-9));
  const p2 = montaPlano({ distKm: M, kmsPercurso: kmsPerc, alvoSec: ALVO });
  ok('com percurso: a soma continua sendo o tempo-alvo', near(p2.totalS, ALVO, 1));
  ok('critério 8 · pace de cada km = P × gradeCostMult do motor', p2.linhas.every((l) => near(l.paceSkm, p2.P * E.gradeCostMult(l.inclinacao), 1e-9)));
  ok('km em subida mais lento, em descida mais rápido', p2.linhas[13].paceSkm > p2.P && p2.linhas[31].paceSkm < p2.P && p2.linhas[13].subida);
  ok('título com percurso e com o trecho mais duro', tituloPlano(p2, { de: 13, ate: 15 }).startsWith('Mire ' + E.paceStr(p2.P) + '/km no plano; do km 13 ao 15, cerca de'), tituloPlano(p2, { de: 13, ate: 15 }));
  ok('título sem percurso', tituloPlano(plano, null) === 'Mire ' + E.paceStr(plano.P) + '/km do início ao fim');
}

console.log('\n== segunda metade mais rápida (critério 9) ==');
{
  const c = montaPlano({ distKm: M, alvoSec: ALVO, strategy: 'constante' }), n = montaPlano({ distKm: M, alvoSec: ALVO, strategy: 'negativa' });
  ok('critério 9 · fecha no mesmo tempo final', near(n.totalS, ALVO, 1), E.hms(n.totalS));
  const meia = (p) => { let t = 0, d = 0; for (const l of p.linhas) { const m = d + l.distKm / 2; d += l.distKm; if (m < M / 2) t += l.paceSkm * l.distKm; } return t; };
  const t1 = meia(n), t2 = ALVO - t1;
  ok('critério 9 · a 2ª metade é mais rápida', t2 < t1, E.hms(t1) + ' + ' + E.hms(t2));
  ok('critério 9 · pelo valor aprovado (±' + NEGATIVA_PCT + '%)', near(n.linhas[0].paceSkm / c.linhas[0].paceSkm, 1 + NEGATIVA_PCT / 100, 0.001) && near(n.linhas[40].paceSkm / c.linhas[40].paceSkm, 1 - NEGATIVA_PCT / 100, 0.001));
}

console.log('\n== clima (critério 10) ==');
{
  const hoje = new Date('2026-11-21T12:00:00Z');
  const longe = modoClima('2027-03-28', hoje, null);
  ok('critério 10 · mais de 16 dias antes: clima padrão e a data em que a previsão abre', longe.modo === 'padrao' && longe.abre === '2027-03-12', longe.abre);
  ok('dentro dos 16 dias, sem previsão: clima padrão', modoClima('2026-12-01', hoje, null).modo === 'padrao' && modoClima('2026-12-01', hoje, null).motivo === 'sem-previsao');
  ok('dentro dos 16 dias, com previsão: usa a previsão', modoClima('2026-12-01', hoje, [{ hora: '06:00', tempC: 20, dewC: 15 }]).modo === 'previsao');
  ok('abertura = dia da prova − 16', aberturaPrevisao('2026-12-31') === '2026-12-15');
  ok('hora em clima padrão: correção 0', correcaoDaHora({ tempC: 15, dewC: 10 }) === 0);
  ok('hora quente e úmida: a correção de Hadley', correcaoDaHora({ tempC: 22, dewC: 18 }) === correcaoHadley(22, 18).pct, correcaoDaHora({ tempC: 22, dewC: 18 }) + '%');
  // calor que sobe ao longo da manhã
  const horas = Array.from({ length: 24 }, (_, h) => ({ hora: String(h).padStart(2, '0') + ':00', tempC: h < 7 ? 16 : 16 + (h - 6) * 2, dewC: 15 }));
  const p = montaPlano({ distKm: M, alvoSec: ALVO, startTime: '06:00', horas, clima: { modo: 'previsao' } });
  ok('critério 10 · com previsão: cada km recebe a correção da sua hora', p.linhas[0].climaPct < p.linhas[40].climaPct, p.linhas[0].climaPct + '% → ' + p.linhas[40].climaPct + '%');
  ok('com calor, o plano fecha depois do alvo (e mostra quanto)', p.totalS > ALVO && near(p.climaExtraS, p.totalS - ALVO, 1e-6), '+' + Math.round(p.climaExtraS) + ' s');
  const pPad = montaPlano({ distKm: M, alvoSec: ALVO, horas, clima: { modo: 'padrao' } });
  ok('em clima padrão, a previsão não é usada', near(pPad.totalS, ALVO, 1));
}

console.log('\n== passagens e blocos ==');
{
  const p = montaPlano({ distKm: M, alvoSec: ALVO });
  const ps = passagens(p.linhas, M);
  ok('passagens: Meia, km 30 e Chegada', ps.map((x) => x.rotulo).join(',') === 'Meia,km 30,Chegada' && near(ps[2].tS, ALVO, 1) && near(ps[0].tS, ALVO * 21.0975 / M, 1));
  const b = blocos(p.linhas);
  ok('9 blocos; o último vai do km 41 ao 42,2', b.length === 9 && b[8].rotulo === 'km 41–42,2', b[8].rotulo);
  ok('terreno do bloco pela regra de 2%', blocos(montaPlano({ distKm: M, kmsPercurso: kmsPerc, alvoSec: ALVO }).linhas)[2].terreno === 'subida');
  const p15 = montaPlano({ distKm: 15, alvoSec: 5400 });
  ok('prova de 15 km: passagens Metade e Chegada', passagens(p15.linhas, 15).map((x) => x.rotulo).join(',') === 'Metade,Chegada');
}

console.log('\n== tempo realista e "terminar bem" (itens 4 e 5; critério 14) ==');
{
  const meia = { id: 'm', date: '2026-08-29', type: 'facil', distKm: 21.21, durationSec: 9723 };
  const r = tempoRealista({ anchor: meia, distKm: M });
  ok('maratona: faixa de Riegel a Riegel + 20 min', near(r.rapidoS, E.riegel(21.21, 9723, M), 1e-6) && near(r.lentoS - r.rapidoS, 1200, 1e-6), E.hms(r.rapidoS) + ' a ' + E.hms(r.lentoS));
  ok('âncora de treino comum: confiança Baixa', r.confianca === 'Baixa' && tempoRealista({ anchor: { ...meia, type: 'prova' }, distKm: M }).confianca === 'Moderada');
  const r15 = tempoRealista({ anchor: meia, distKm: 15 });
  ok('abaixo de 30 km: ±2,5% em volta do Riegel', near(r15.rapidoS, E.riegel(21.21, 9723, 15) * 0.975, 1e-6) && near(r15.lentoS, E.riegel(21.21, 9723, 15) * 1.025, 1e-6));
  const rp = tempoRealista({ anchor: meia, distKm: M, kmsPercurso: kmsPerc, climaPct: 2.5 });
  ok('percurso e clima entram na faixa', near(rp.rapidoS, r.rapidoS * (1 + percursoExtraPct(kmsPerc) / 100) * 1.025, 1e-6) && rp.percursoPct > 0);
  const m = metaDoPlano({ goal: 'finish' }, r);
  ok('critério 14 · "Terminar bem": a meta do plano é a ponta lenta', m.alvoS === Math.round(r.lentoS) && m.origem === 'terminar-bem');
  ok('tempo-alvo: a meta é o alvo', metaDoPlano({ goal: 'time', targetSec: ALVO }, r).alvoS === ALVO);
  ok('sem âncora: sem faixa', tempoRealista({ anchor: null, distKm: M }) == null);
}

console.log('\n== previsão (Open-Meteo, simulado) ==');
{
  let url = '';
  const fake = async (u) => { url = u; return { ok: true, json: async () => ({ timezone: 'America/Sao_Paulo', hourly: { time: ['2026-12-31T05:00', '2026-12-31T06:00'], temperature_2m: [20, 21], dew_point_2m: [17, 18], precipitation_probability: [10, 60], wind_speed_10m: [8, 12], wind_direction_10m: [90, 100] } }) }; };
  const pv = await fetchPrevisao({ lat: -23.5501234, lon: -46.6339 }, '2026-12-31', fake);
  ok('busca por coordenada e data, na hora local, com os 5 campos', /timezone=auto/.test(url) && /latitude=-23.5501&/.test(url) && pv.horas[1].hora === '06:00' && pv.horas[1].chuvaPct === 60 && pv.horas[1].ventoKmh === 12);
  ok('sem local ou sem internet: nada (sem erro)', (await fetchPrevisao(null, '2026-12-31', fake)) == null && (await fetchPrevisao({ lat: 1, lon: 1 }, '2026-12-31', async () => { throw new Error('offline'); })) == null);
}

console.log('\n== desempenho (meta: 50 ms) ==');
{
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) montaPlano({ distKm: M, kmsPercurso: kmsPerc, alvoSec: ALVO + i, strategy: i % 2 ? 'negativa' : 'constante' });
  const ms = (performance.now() - t0) / 20;
  ok('recalcular o plano de 42,195 km leva até 50 ms', ms <= 50, ms.toFixed(2) + ' ms');
}
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
