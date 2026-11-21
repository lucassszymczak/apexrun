// Testes do "Amanhã cedo" (Fase 4 · Etapa 5). Roda com: node analise/amanha.test.mjs
import { melhorHorario, horasDaJanela, mostraAgora, amanhaIso, pontoAutomatico } from './amanha.mjs';
import { correcaoHadley } from './leitura.mjs';

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const H = (h, t, d, chuva = 0, vento = 5) => ({ hora: String(h).padStart(2, '0') + ':00', tempC: t, dewC: d, chuvaPct: chuva, ventoKmh: vento });

console.log('\n== melhor horário (critério 15) ==');
ok('janela das 5h às 10h = 6 horas cheias', horasDaJanela({ de: '05:00', ate: '10:00' }).join(',') === '5,6,7,8,9,10');
const dia = [H(5, 16, 13), H(6, 17, 14), H(7, 20, 16), H(8, 23, 17), H(9, 25, 18), H(10, 27, 18)];
let r = melhorHorario(dia);
ok('critério 15 · hora em clima padrão tem custo 0', r.linhas[0].custo === 0 && r.linhas[0].padrao);
ok('hora quente: custo pela regra temperatura + orvalho', r.linhas[3].custo === correcaoHadley(23, 17).pct, r.linhas[3].custo + '%');
ok('critério 15 · empate (5h e 6h com 0): vence a mais cedo', r.melhor.h === 5);
r = melhorHorario([H(5, 16, 13, 60), ...dia.slice(1)]);
ok('critério 15 · chuva de 60% descarta a hora: vence 6h', r.melhor.h === 6 && r.linhas[0].chuva && r.descartada && r.descartada.h === 5);
ok('chuva de 49% não descarta', melhorHorario([H(5, 16, 13, 49), ...dia.slice(1)]).melhor.h === 5);
ok('vento de 20 km/h só avisa', melhorHorario([H(5, 16, 13, 0, 22), ...dia.slice(1)]).melhor.h === 5 && melhorHorario([H(5, 16, 13, 0, 22), ...dia.slice(1)]).linhas[0].vento);
ok('chuva em toda a janela: sem melhor horário, com aviso', (() => { const x = melhorHorario(dia.map((h) => ({ ...h, chuvaPct: 80 }))); return x.melhor == null && x.todasComChuva; })());
ok('sem previsão: sem melhor horário', melhorHorario(null).melhor == null);
ok('janela personalizada (6h às 8h)', melhorHorario(dia, { de: '06:00', ate: '08:00' }).linhas.length === 3);

console.log('\n== quando aparece e ponto automático ==');
ok('critério 15 · aparece do meio-dia à meia-noite', !mostraAgora(new Date(2026, 10, 21, 11, 59)) && mostraAgora(new Date(2026, 10, 21, 12, 0)) && mostraAgora(new Date(2026, 10, 21, 23, 59)));
ok('amanhã, na data local (virada de mês)', amanhaIso(new Date(2026, 10, 30, 18, 0)) === '2026-12-01');
const ws = [
  ...Array.from({ length: 7 }, (_, i) => ({ date: '2026-11-' + String(10 + i).padStart(2, '0'), geo: { lat: -25.391 + i * 1e-4, lon: -51.462 } })),
  ...Array.from({ length: 3 }, (_, i) => ({ date: '2026-11-' + String(20 + i), geo: { lat: -27.6, lon: -48.5 } })),
  { date: '2026-01-01', geo: { lat: 10, lon: 10 } },
];
const p = pontoAutomatico(ws);
ok('ponto automático: onde a maioria dos últimos 10 treinos começou', Math.abs(p.lat + 25.3907) < 0.001 && p.n === 7 && p.de === 10, p.lat.toFixed(4) + ', ' + p.lon.toFixed(4));
ok('sem treinos com local: sem ponto', pontoAutomatico([{ date: '2026-01-01' }]) == null);
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
