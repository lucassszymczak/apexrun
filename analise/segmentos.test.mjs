// Testes dos segmentos (Fase 3 · Etapa 4). Roda com: node analise/segmentos.test.mjs
// Trajetos sintéticos num lugar fictício (nenhuma coordenada real).
import * as E from './engine.mjs';
import { calculaSegmentos, passagensDoTreino, tendencia, ranking, terreno, nomesAutomaticos, idDe, compr, MIN_M, MAX_SEG } from './segmentos.mjs';
import { correcaoHadley } from './leitura.mjs';

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const LAT = 10.5, LON = 20.5, M = 111195, MLON = M * Math.cos((LAT * Math.PI) / 180);
// trajeto a 1 Hz por uma lista de vértices (x, y em metros), velocidade v (m/s), ruído lateral (m)
function trajeto(vs, { v = 3, ruido = 0, subida = 0, semente = 1, parada = null } = {}) {
  let s = semente; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
  const tr = { t: [], lat: [], lon: [], dist: [], hr: [], spd: [], alt: [], grade: [] };
  let t = 0, d = 0;
  for (let k = 1; k < vs.length; k++) {
    const [x0, y0] = vs[k - 1], [x1, y1] = vs[k]; const L = Math.hypot(x1 - x0, y1 - y0); const n = Math.round(L / v);
    for (let j = 0; j < n; j++) {
      const f = j / n; const x = x0 + (x1 - x0) * f + rnd() * ruido, y = y0 + (y1 - y0) * f + rnd() * ruido;
      if (parada && Math.abs(d - parada.em) < v / 2) for (let p = 0; p < parada.s; p++) { push(x, y, 0); t++; }
      push(x, y, v); t++; d += L / n;
    }
  }
  function push(x, y, sp) { tr.t.push(t); tr.lat.push(LAT + y / M); tr.lon.push(LON + x / MLON); tr.dist.push(d); tr.hr.push(150); tr.spd.push(sp); tr.alt.push(900 + d * subida); tr.grade.push(subida * 100); }
  return tr;
}
const w = (id, date, extra = {}) => ({ id, date, ...extra });

console.log('\n== detecção: 500 m, 3 treinos, mesmo sentido ==');
const reta = [[0, 0], [1500, 0]];
const ida = [[0, 0], [1500, 0]], volta = [[1500, 0], [0, 0]];
const T3 = [1, 2, 3].map((i) => ({ w: w('a' + i, '2026-10-0' + i), tr: trajeto(ida, { ruido: 6, semente: i }) }));
const r3 = calculaSegmentos(T3, 'corrida');
ok('3 treinos no mesmo trecho de 1,5 km: 1 segmento', r3.lista.length === 1, r3.lista.map((s) => s.distM + ' m').join());
ok('distância medida ≈ 1,5 km', r3.lista[0] && Math.abs(r3.lista[0].distM - 1500) < 100, r3.lista[0] && r3.lista[0].distM);
ok('cada treino tem 1 passagem', [...r3.passagens.values()].every((l) => l.length === 1));
const r2 = calculaSegmentos(T3.slice(0, 2), 'corrida');
ok('só 2 treinos: nenhum segmento', r2.lista.length === 0);
const curto = [1, 2, 3].map((i) => ({ w: w('c' + i, '2026-10-0' + i), tr: trajeto([[0, 0], [400, 0]], { semente: i }) }));
ok('trecho de 400 m: nenhum segmento', calculaSegmentos(curto, 'corrida').lista.length === 0);
const sentidos = [...[1, 2].map((i) => ({ w: w('i' + i, '2026-10-0' + i), tr: trajeto(ida, { semente: i }) })), ...[3, 4].map((i) => ({ w: w('v' + i, '2026-10-0' + i), tr: trajeto(volta, { semente: i }) }))];
ok('2 de ida e 2 de volta: nenhum segmento (sentidos separados)', calculaSegmentos(sentidos, 'corrida').lista.length === 0);
const seis = [...[1, 2, 3].map((i) => ({ w: w('i' + i, '2026-10-0' + i), tr: trajeto(ida, { semente: i }) })), ...[4, 5, 6].map((i) => ({ w: w('v' + i, '2026-10-0' + i), tr: trajeto(volta, { semente: i }) }))];
const r6 = calculaSegmentos(seis, 'corrida');
ok('3 de ida e 3 de volta: 2 segmentos, um em cada sentido', r6.lista.length === 2 && r6.lista[0].id !== r6.lista[1].id);
const desvio = [1, 2, 3].map((i) => ({ w: w('d' + i, '2026-10-0' + i), tr: trajeto(i === 3 ? [[0, 20], [1500, 20]] : ida, { ruido: 4, semente: i }) }));
ok('corredor de 25 m: um treino 20 m ao lado ainda conta', calculaSegmentos(desvio, 'corrida').lista.length === 1);
const longe = [1, 2, 3].map((i) => ({ w: w('l' + i, '2026-10-0' + i), tr: trajeto(i === 3 ? [[0, 80], [1500, 80]] : ida, { semente: i }) }));
ok('um treino 80 m ao lado não conta', calculaSegmentos(longe, 'corrida').lista.length === 0);

console.log('\n== sobreposição ==');
// 3 treinos fazem 0–2000 m; 2 desses + 2 outros fazem 1000–2000 m (5 passagens no pedaço comum)
const L1 = [1, 2, 3].map((i) => ({ w: w('x' + i, '2026-09-0' + i), tr: trajeto([[0, 0], [2000, 0]], { semente: i }) }));
const L2 = [4, 5].map((i) => ({ w: w('y' + i, '2026-09-0' + i), tr: trajeto([[1000, 0], [2000, 0]], { semente: i }) }));
const rs = calculaSegmentos([...L1, ...L2], 'corrida');
const d = rs.lista.map((s) => s.distM).sort((a, b) => a - b);
ok('nenhum trecho conta duas vezes: o de mais passagens fica, o outro é cortado', rs.lista.length === 2 && Math.abs(d[0] - 1000) < 120 && Math.abs(d[1] - 1000) < 120, d.join(' e ') + ' m');
const nMax = Math.max(...rs.lista.map((s) => [...rs.passagens.values()].flat().filter((p) => p.id === s.id).length));
ok('o pedaço comum tem as 5 passagens', nMax === 5, nMax);

console.log('\n== tempo da passagem ==');
const v3 = T3[0].tr; const s0 = r3.lista[0];
const p0 = r3.passagens.get('a1')[0];
ok('1 Hz: tempo ≈ distância ÷ velocidade (1 s)', Math.abs(p0.t - p0.d / 3) <= 2, p0.t + ' s para ' + p0.d + ' m');
ok('precisão de 1 s com o trajeto completo', p0.prec === 1);
const leve = { ...v3, leve: true };
ok('versão leve: precisão ±5 s', passagensDoTreino(leve, r3.lista)[0].prec === 5);
const comParada = trajeto(ida, { semente: 9, parada: { em: 700, s: 30 } });
const pp = passagensDoTreino(comParada, r3.lista)[0];
ok('parada no meio entra no tempo (tempo decorrido)', pp && pp.t >= p0.t + 25, pp && pp.t);
ok('FC média da passagem', p0.fc === 150);

console.log('\n== tempo ajustado (só corrida) ==');
const sub = [1, 2, 3].map((i) => ({ w: w('s' + i, '2026-10-0' + i), tr: trajeto(ida, { subida: 0.03, semente: i }) }));
const rsub = calculaSegmentos(sub, 'corrida'); const ps = rsub.passagens.get('s1')[0];
const esperado = ps.t / E.gradeCostMult(3);
ok('subida de 3%: ajustado = tempo ÷ custo do GAP do motor', Math.abs(ps.tAj - esperado) <= 1.5, ps.t + ' → ' + ps.tAj + ' (esperado ' + esperado.toFixed(0) + ')');
ok('sem clima: só a inclinação (clima = null)', ps.clima === null);
const wx = { tempC: 22, dewC: 18 }; const pct = correcaoHadley(22, 18).pct;
const pc = passagensDoTreino(sub[0].tr, rsub.lista, { corrida: true, weather: wx })[0];
ok('com clima: × (1 − correção da regra temperatura + orvalho)', Math.abs(pc.tAj - Math.round((ps.t / E.gradeCostMult(3)) * (1 - pct / 100))) <= 1.5 && pc.clima === pct, pc.tAj + ' (' + pct + '%)');
const pedal = calculaSegmentos(sub.map((x) => ({ ...x, w: { ...x.w, modal: 'bike' } })), 'pedal');
ok('pedal: sem tempo ajustado', [...pedal.passagens.values()].flat().every((p) => p.tAj == null));

console.log('\n== tendência e ranking ==');
const P = (date, tAj, t = tAj) => ({ date, t, tAj });
const ant = [P('2026-08-01', 230), P('2026-08-10', 228), P('2026-08-20', 232)];
const rec = [P('2026-10-01', 221), P('2026-10-10', 224), P('2026-10-20', 220)];
const td = tendencia([...rec, ...ant]);
ok('3,5% mais rápido: "Mais rápido", 8 s, desde agosto', td.estado === 'rapido' && td.difS === 8 && td.desde === '2026-08-01', JSON.stringify(td));
ok('2% mais lento: "Mais lento"', tendencia([...ant, P('2026-10-01', 235), P('2026-10-02', 235), P('2026-10-03', 235)]).estado === 'lento');
ok('1% de diferença: "Estável"', tendencia([...ant, P('2026-10-01', 228), P('2026-10-02', 228), P('2026-10-03', 227)]).estado === 'estavel');
ok('5 passagens: "Poucas passagens"', tendencia([...ant, ...rec.slice(0, 2)]).estado === 'poucas');
ok('pedal: usa o tempo real', tendencia([...ant, ...rec].map((p) => ({ ...p, tAj: null, t: p.t })), false).estado === 'rapido');
const rk = ranking([...ant, ...rec]);
ok('ranking: o melhor ajustado primeiro', rk[0].tAj === 220 && rk[rk.length - 1].tAj === 232);

console.log('\n== nomes, ids e limites ==');
ok('terreno: subida > 2%, descida < −2%, plano', terreno(1000, 30) === 'Subida' && terreno(1000, -30) === 'Descida' && terreno(1000, 10) === 'Plano');
ok('nome automático sem endereço, numerado se repetir', nomesAutomaticos([{ distM: 600, ganhoM: 20 }, { distM: 1200, ganhoM: 0 }, { distM: 1230, ganhoM: 5 }]).join('|') === 'Subida de 0,6 km|Plano de 1,2 km|Plano de 1,2 km (2)');
const f = r3.lista[0].forma;
ok('id sai da geometria: o mesmo trecho dá o mesmo id', idDe('corrida', f) === r3.lista[0].id && calculaSegmentos(T3.slice().reverse(), 'corrida').lista[0].id === r3.lista[0].id);
ok('forma com no máximo 40 pontos', f.lat.length <= 40 && f.lat.length >= 2, f.lat.length);
ok('limites: 500 m e 40 por modalidade', MIN_M === 500 && MAX_SEG === 40 && compr(f) >= 500);
const ren = calculaSegmentos(T3, 'corrida', [{ id: r3.lista[0].id, nome: 'Meu trecho', renomeado: true }]);
ok('nome renomeado continua ao recalcular', ren.lista[0].nome === 'Meu trecho' && ren.lista[0].renomeado);

console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
