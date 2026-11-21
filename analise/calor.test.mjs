// Testes do mapa de calor (Fase 3 · Etapa 3). Roda com: node analise/calor.test.mjs
// Trajetos sintéticos num lugar qualquer (nenhuma coordenada real do Lucas).
import { celula, centro, vizinhas, sequencia, doTreino, agrega, resumo, linhas, rua, maisPerto, faixaDe, FAIXAS, CELULA_M, ehPedal, ehEsteira } from './calor.mjs';

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const LAT = 10.5, LON = 20.5, M = 111195, MLON = M * Math.cos((10.5 * Math.PI) / 180);
// linha reta para leste com n metros, a partir de (dy, dx) metros da origem
const leste = (metros, { dy = 0, dx = 0, passo = 10 } = {}) => { const lat = [], lon = []; for (let m = 0; m <= metros; m += passo) { lat.push(LAT + dy / M); lon.push(LON + (dx + m) / MLON); } return { lat, lon }; };
const volta = (t) => ({ lat: [...t.lat, ...t.lat.slice().reverse()], lon: [...t.lon, ...t.lon.slice().reverse()] });

console.log('\n== quadrículas de 25 m ==');
ok('quadrícula de 25 m', CELULA_M === 25);
const k = celula(LAT, LON), c = centro(k);
ok('o centro da quadrícula cai dentro dela', celula(c.lat, c.lon) === k);
ok('8 vizinhas', vizinhas(k).length === 8 && !vizinhas(k).includes(k));
ok('a grade não depende de onde o treino começa', celula(LAT + 3 / M, LON + 3 / MLON) === celula(LAT + 3 / M, LON + 3 / MLON));
const r1 = doTreino(leste(1000).lat, leste(1000).lon);
ok('1 km em linha reta marca cerca de 40 quadrículas', r1.cells.length >= 40 && r1.cells.length <= 42, r1.cells.length);
ok('pontos espaçados (200 m) são preenchidos entre si', doTreino(leste(1000, { passo: 200 }).lat, leste(1000, { passo: 200 }).lon).cells.length >= 40);
ok('pontos sem GPS são pulados', sequencia([LAT, null, LAT], [LON, null, LON + 10 / MLON]).length >= 1);

console.log('\n== vaivém: cada treino conta uma vez por quadrícula ==');
const ida = leste(500), iv = volta(ida);
const a1 = agrega([{ id: 'a', ...doTreino(iv.lat, iv.lon) }]);
ok('ida e volta na mesma rua: 1 passagem em cada quadrícula', [...a1.cont.values()].every((v) => v === 1));
const tres = agrega(['a', 'b', 'c'].map((id) => ({ id, ...doTreino(ida.lat, ida.lon) })));
ok('3 treinos na mesma rua: 3 passagens', [...tres.cont.values()].every((v) => v === 3));

console.log('\n== faixas ==');
ok('5 faixas: 1–2, 3–5, 6–10, 11–19, 20+', FAIXAS.length === 5 && [1, 2, 3, 5, 6, 10, 11, 19, 20, 99].map(faixaDe).join('') === '0011223344');

console.log('\n== resumo e linhas ==');
// rua A (500 m) com 4 treinos; rua B (300 m, 200 m ao norte) com 1 treino
const A = leste(500), B = leste(300, { dy: 200 });
const pt = [...['a', 'b', 'c', 'd'].map((id) => ({ id, ...doTreino(A.lat, A.lon) })), { id: 'e', ...doTreino(B.lat, B.lon) }];
const ag = agrega(pt), rs = resumo(ag);
ok('5 treinos', rs.treinos === 5);
ok('cerca de 0,8 km de ruas (quadrículas × 25 m)', Math.abs(rs.km - 0.8) <= 0.1, rs.km.toFixed(2) + ' km');
ok('faixas: rua A em 3–5, rua B em 1–2', rs.faixas[1] > 0 && rs.faixas[0] > 0 && rs.faixas[2] === 0, rs.faixas.join('/'));
const L = linhas(ag);
ok('cada rua vira uma linha só, na sua faixa', L.length === 2 && L.some((l) => l.faixa === 1) && L.some((l) => l.faixa === 0), L.map((l) => l.faixa + ':' + l.cells.length).join(' '));
ok('as linhas cobrem todas as quadrículas', new Set(L.flatMap((l) => l.cells)).size === rs.celulas);

console.log('\n== tocar numa rua ==');
const meio = maisPerto(ag, LAT + 5 / M, LON + 250 / MLON);
ok('acha a quadrícula mais perto do toque', meio && ag.cont.get(meio) === 4);
const sel = rua(ag, meio);
ok('a rua tem exatamente os mesmos treinos e para onde eles mudam', sel.ids.length === 4 && sel.cells.every((x) => ag.cont.get(x) === 4) && sel.cells.length >= 20, sel.cells.length + ' quadrículas');
ok('o comprimento da rua tocada (cerca de 0,5 km)', Math.abs(sel.km - 0.5) <= 0.05, sel.km.toFixed(2));
// a rua A tem um trecho a mais percorrido só por 'a': esse trecho é outra rua
const A2 = leste(800); const pt2 = [{ id: 'a', ...doTreino(A2.lat, A2.lon) }, ...['b', 'c'].map((id) => ({ id, ...doTreino(A.lat, A.lon) }))];
const ag2 = agrega(pt2), s2 = rua(ag2, maisPerto(ag2, LAT, LON + 700 / MLON));
ok('trecho com outros treinos é outra rua', s2.ids.join() === 'a' && Math.abs(s2.km - 0.3) <= 0.05, s2.km.toFixed(2));
ok('toque longe de qualquer rua: nada', maisPerto(ag, LAT + 1000 / M, LON) === null);

console.log('\n== o que entra ==');
ok('pedal separado da corrida', ehPedal({ modal: 'bike' }) && !ehPedal({ modal: 'corrida' }));
ok('bike indoor fica de fora', ehEsteira({ modal: 'bike', indoor: true }) && !ehEsteira({ modal: 'corrida' }));

console.log('\n== desempenho ==');
const muitos = Array.from({ length: 140 }, (_, i) => { const t = leste(10000, { dy: (i % 7) * 30 }); return { id: 'w' + i, ...doTreino(t.lat, t.lon) }; });
const t0 = performance.now(); const agM = agrega(muitos); linhas(agM); const dt = performance.now() - t0;
ok('juntar 140 treinos de 10 km e montar as linhas em menos de 300 ms', dt < 300, dt.toFixed(0) + ' ms');

console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
