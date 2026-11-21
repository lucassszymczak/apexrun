// Testes do fantasma (Fase 3 · Etapa 5). Roda com: node analise/fantasma.test.mjs
// Trajetos sintéticos num lugar fictício.
import { candidatos, ordena, cobertura, diferenca, final, textoDif, distNoTempo, tempoNaDist, COBERTURA_MIN, DIF_DIST_MAX } from './fantasma.mjs';
import { doTreino } from './calor.mjs';

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const LAT = 10.5, LON = 20.5, M = 111195, MLON = M * Math.cos((LAT * Math.PI) / 180);
// trajeto a 1 Hz por vértices (m), velocidade constante ou por trecho
function trajeto(vs, v) {
  const tr = { t: [], lat: [], lon: [], dist: [] }; let t = 0, d = 0;
  for (let k = 1; k < vs.length; k++) { const [x0, y0] = vs[k - 1], [x1, y1] = vs[k]; const L = Math.hypot(x1 - x0, y1 - y0); const vel = typeof v === 'function' ? v(d) : v; const n = Math.max(1, Math.round(L / vel)); for (let j = 0; j < n; j++) { tr.t.push(t); tr.lat.push(LAT + (y0 + (y1 - y0) * j / n) / M); tr.lon.push(LON + (x0 + (x1 - x0) * j / n) / MLON); tr.dist.push(d); t++; d += L / n; } }
  tr.t.push(t); tr.lat.push(LAT + vs[vs.length - 1][1] / M); tr.lon.push(LON + vs[vs.length - 1][0] / MLON); tr.dist.push(d);
  return tr;
}
const cel = (tr) => doTreino(tr.lat, tr.lon).cells;
const W = (id, date, distKm, durationSec) => ({ id, date, distKm, durationSec });
const VOLTA = [[0, 0], [1500, 0], [1500, 1000], [0, 1000], [0, 0]]; // 5 km
const alvoTr = trajeto(VOLTA, 3);
const alvo = { w: W('alvo', '2026-11-19', 5, 1667), cells: cel(alvoTr) };

console.log('\n== quem pode ser fantasma ==');
ok('80% em comum e até 10% de distância', COBERTURA_MIN === 0.8 && DIF_DIST_MAX === 0.1);
const igual = { w: W('a', '2026-08-18', 5.02, 1600), cells: cel(trajeto(VOLTA, 3.1)) };
ok('mesmo percurso: candidato', candidatos(alvo, [igual]).length === 1);
const maior = { w: W('b', '2026-08-21', 5.0, 1700), cells: cel(trajeto([...VOLTA, [0, -2000]], 3)) };
ok('o dele cobre o seu, mas o seu não cobre o dele (percurso 40% maior): fora', candidatos(alvo, [maior]).length === 0, cobertura(maior.cells, alvo.cells).toFixed(2));
const metade = { w: W('c', '2026-08-22', 5.0, 1700), cells: cel(trajeto([[0, 0], [1500, 0], [1500, 1000], [3000, 1000], [3000, 0]], 3)) };
ok('só metade em comum: fora', candidatos(alvo, [metade]).length === 0, cobertura(alvo.cells, metade.cells).toFixed(2));
const longo = { w: W('d', '2026-08-23', 5.6, 1800), cells: cel(trajeto(VOLTA, 3)) };
ok('distância 12% maior: fora', candidatos(alvo, [longo]).length === 0);
const ao_lado = { w: W('e', '2026-08-24', 5.0, 1650), cells: cel(trajeto(VOLTA.map(([x, y]) => [x + 15, y + 15]), 3)) };
ok('o mesmo percurso 15 m ao lado (erro do GPS): candidato', candidatos(alvo, [ao_lado]).length === 1);
ok('o próprio treino não é candidato', candidatos(alvo, [alvo]).length === 0);

console.log('\n== ordem: Seu melhor, Mais recente, os outros por data ==');
const cs = [
  { w: W('x1', '2026-08-01', 5, 1700), cob: 0.9 }, { w: W('x2', '2026-11-02', 5, 1600), cob: 0.9 },
  { w: W('x3', '2026-11-12', 5, 1720), cob: 0.9 }, { w: W('x4', '2026-10-09', 5, 1710), cob: 0.9 },
];
const o = ordena(alvo.w, cs);
ok('o melhor tempo é "Seu melhor"', o[0].w.id === 'x2' && o[0].rotulo === 'Seu melhor');
ok('a data mais próxima é "Mais recente"', o[1].w.id === 'x3' && o[1].rotulo === 'Mais recente');
ok('os outros por data, do mais novo', o.slice(2).map((c) => c.w.id).join() === 'x4,x1');
ok('um candidato só: "Seu melhor"', ordena(alvo.w, cs.slice(0, 1)).length === 1);
ok('nenhum candidato: lista vazia ("Sem treinos parecidos")', ordena(alvo.w, []).length === 0);

console.log('\n== alinhamento pela distância ==');
const voce = trajeto(VOLTA, 3), fant = trajeto(VOLTA, 3.125); // 5000/3 ≈ 1667 s × 1600 s
ok('distância e tempo ida e volta', Math.abs(tempoNaDist(voce, distNoTempo(voce, 600)) - 600) < 1);
const d1 = diferenca(voce, fant, 600);
ok('no seu tempo 600 s (km 1,8), o fantasma está 24 s à frente', Math.abs(d1 - 24) <= 1, d1);
ok('na largada: empate', diferenca(voce, fant, 0) === 0);
const fim = final(voce, fant);
ok('no fim: "Você terminou 67 s atrás"', Math.abs(fim - 67) <= 1 && textoDif(fim, true).t === 'Você terminou ' + fim + ' s atrás' && textoDif(fim, true).tom === 'atencao', fim);
ok('você mais rápido: "Você X s à frente" em ok', textoDif(diferenca(fant, voce, 600)).t.startsWith('Você ') && textoDif(diferenca(fant, voce, 600)).tom === 'ok');
const lento = trajeto(VOLTA, (d) => (d < 2500 ? 2.5 : 4)); // começa mais lento e termina mais rápido
const dMeio = diferenca(lento, fant, 900), dFim = final(lento, fant);
ok('ritmo variável: atrás no meio, a diferença muda ao longo do treino', dMeio > 0 && dFim !== dMeio, dMeio + ' → ' + dFim);
ok('fantasma com percurso menor: no fim, compara na menor distância', final(voce, trajeto(VOLTA.slice(0, 4), 3.125)) != null);
ok('distância além do fim do fantasma: sem comparação ao vivo', diferenca(voce, trajeto(VOLTA.slice(0, 3), 3), 1600) === null);

console.log('\n== comparação num segmento (início da passagem) ==');
const dSeg = diferenca(voce, fant, 500 + 300, { v0: 500, f0: 480 });
ok('as duas passagens começam juntas', diferenca(voce, fant, 500, { v0: 500, f0: 480 }) === 0);
ok('300 s depois, o fantasma (mais rápido) está à frente', dSeg > 0, dSeg);

console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
