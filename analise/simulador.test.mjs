// Testes do simulador de meta (Fase 4 · Etapa 4). Roda com: node analise/simulador.test.mjs
import * as E from './engine.mjs';
import { passos, veredito, arredonda5, climaQuentePct, QUENTE } from './simulador.mjs';
import { tempoRealista, kmsDaProva } from './plano.mjs';
import { correcaoHadley } from './leitura.mjs';

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const near = (a, b, t) => Math.abs(a - b) <= t;
const meia = { id: 'm', date: '2026-08-29', type: 'facil', distKm: 21.21, durationSec: 9723 };
const M = 42.195;
const perc = kmsDaProva(M).map((k) => ({ ...k, inclinacao: k.km >= 13 && k.km <= 15 ? 3 : 0 }));

console.log('\n== passos somam a faixa (critério 13) ==');
for (const [nome, o] of [['maratona plana', { distKm: M }], ['maratona com percurso e calor', { distKm: M, kmsPercurso: perc, climaPct: 2.5 }], ['15 km', { distKm: 15 }], ['15 km com calor', { distKm: 15, climaPct: 1.5 }]]) {
  const s = passos({ anchor: meia, ...o });
  const somaR = s.passos.reduce((a, p) => a + p.rapido, 0), somaL = s.passos.reduce((a, p) => a + p.lento, 0);
  ok('critério 13 · ' + nome + ': os passos somam a faixa (exato)', somaR === s.rapidoS && somaL === s.lentoS, E.hms(s.rapidoS) + ' a ' + E.hms(s.lentoS));
  const r = tempoRealista({ anchor: meia, ...o });
  ok(nome + ': a faixa é a mesma do plano (±1 s)', near(s.rapidoS, r.rapidoS, 1) && near(s.lentoS, r.lentoS, 1));
}
const s = passos({ anchor: meia, distKm: M });
ok('maratona: passo "correção para maratona" de 0 a +20 min', s.passos[1].id === 'maratona' && s.passos[1].rapido === 0 && s.passos[1].lento === 1200);
ok('o 1º passo é o Riegel do motor pela âncora', s.passos[0].rapido === Math.round(E.riegel(21.21, 9723, M)));
ok('abaixo de 30 km: passo "margem" de ±2,5%', passos({ anchor: meia, distKm: 15 }).passos[1].id === 'margem');

console.log('\n== veredito, metas e clima ==');
const f = { rapidoS: 20000, lentoS: 21200 };
ok('abaixo da faixa: atenção', veredito(19000, f).id === 'abaixo' && veredito(19000, f).tom === 'atencao');
ok('dentro da faixa: ok', veredito(20500, f).id === 'dentro' && veredito(20000, f).id === 'dentro' && veredito(21200, f).id === 'dentro');
ok('acima da faixa: ok', veredito(22000, f).id === 'acima' && veredito(22000, f).tom === 'ok');
ok('tempo-alvo de 5 em 5 min', arredonda5(5 * 3600 + 32 * 60) === 5 * 3600 + 30 * 60 && arredonda5(5 * 3600 + 33 * 60) === 5 * 3600 + 35 * 60);
ok('"Quente e úmido" usa a regra temperatura + orvalho já aprovada', climaQuentePct() === correcaoHadley(QUENTE.tempC, QUENTE.dewC).pct, climaQuentePct() + '%');
ok('sem âncora: sem simulador', passos({ anchor: null, distKm: M }) == null);
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
