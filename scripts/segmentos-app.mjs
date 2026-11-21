// Segmentos (Fase 3 · Etapa 4) num Chromium real, com trajetos SINTÉTICOS a 1 Hz (lugar fictício)
// gravados no IndexedDB. A detecção roda no Web Worker do app; o resultado é comparado com o do
// módulo puro. Prints em 390 e 1440 px se SHOTS apontar uma pasta.
// Uso: node scripts/segmentos-app.mjs
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_TZ, GOLDEN_NOW } from '../analise/golden/env.mjs';
import { calculaSegmentos, tendencia } from '../analise/segmentos.mjs';
import { ehPedal } from '../analise/calor.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const payload = readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8');
const SHOTS = process.env.SHOTS || null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };

// ---- trajetos a 1 Hz numa malha fictícia ----
const LAT = 10.5, LON = 20.5, M = 111195, MLON = M * Math.cos((LAT * Math.PI) / 180);
function track(vs, v, semente) {
  let s = semente; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
  const tr = { v: 1, start: 1760000000, tzOffsetSec: -10800, hasGps: true, t: [], lat: [], lon: [], dist: [], hr: [], spd: [], alt: [], grade: [], draw: [] };
  let t = 0, d = 0;
  for (let k = 1; k < vs.length; k++) {
    const [x0, y0, z0] = vs[k - 1], [x1, y1, z1] = vs[k]; const L = Math.hypot(x1 - x0, y1 - y0); const n = Math.max(1, Math.round(L / v)); const g = ((z1 - z0) / L) * 100;
    for (let j = 0; j < n; j++) { const f = j / n; tr.t.push(t); tr.lat.push(LAT + (y0 + (y1 - y0) * f + rnd() * 5) / M); tr.lon.push(LON + (x0 + (x1 - x0) * f + rnd() * 5) / MLON); tr.dist.push(d); tr.hr.push(140 + Math.round(v * 3)); tr.spd.push(v); tr.alt.push(z0 + (z1 - z0) * f); tr.grade.push(g); t++; d += L / n; }
  }
  tr.draw = tr.t.map((_, i) => i).filter((i) => i % 5 === 0);
  return tr;
}
const VOLTA = [[0, 0, 900], [1200, 0, 900], [1200, 800, 930], [0, 800, 930], [0, 0, 900]];
const IDA = [[0, 0, 900], [0, -1500, 900], [0, 0, 900]];
const st = JSON.parse(payload);
const corridas = st.workouts.filter((w) => !ehPedal(w) && !w.indoor).sort((a, b) => a.date.localeCompare(b.date));
const tracks = {};
// 8 corridas na volta do quarteirão, cada vez um pouco mais rápidas; 3 no vai-e-volta
corridas.slice(0, 8).forEach((w, i) => { tracks[w.id] = track(VOLTA, 2.8 + i * 0.06, i + 1); });
corridas.slice(8, 11).forEach((w, i) => { tracks[w.id] = track(IDA, 3, 20 + i); });
const comTr = corridas.filter((w) => tracks[w.id]);
const esperado = calculaSegmentos(comTr.map((w) => ({ w, tr: tracks[w.id] })), 'corrida');
const passEsp = (id) => [...esperado.passagens].flatMap(([wid, l]) => l.filter((p) => p.id === id).map((p) => ({ ...p, date: st.workouts.find((w) => w.id === wid).date })));

const PORT = 5228;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
const url = (r) => `http://localhost:${PORT}/analise/#/${r}`;
async function device(w, h, { tema = 'dark', semTrajetos = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: GOLDEN_TZ, locale: 'pt-BR', deviceScaleFactor: SHOTS ? 2 : 1 });
  await ctx.addInitScript(([pl, t]) => { if (!sessionStorage.getItem('__d')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', pl); localStorage.setItem('apex.theme', t); sessionStorage.setItem('__d', '1'); } }, [payload, tema]);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.route(/^https:\/\//, (r) => r.abort());
  await page.goto(url('hoje')); await page.waitForSelector('.main > *');
  if (!semTrajetos) await page.evaluate((T) => new Promise((res, rej) => { const rq = indexedDB.open('apex-performance'); rq.onsuccess = () => { const tx = rq.result.transaction('tracks', 'readwrite'); for (const [id, tr] of Object.entries(T)) tx.objectStore('tracks').put({ ...tr, id }); tx.oncomplete = () => res(); tx.onerror = rej; }; }), tracks);
  return { page, errors };
}
const shot = async (page, name, full = true) => { if (SHOTS) await page.screenshot({ path: resolve(SHOTS, name), fullPage: full }); };
const estado = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('apex.analise.v1')));

try {
  console.log('\n== Detecção no app (Web Worker) ==');
  const A = await device(390, 844);
  const t0 = Date.now();
  await A.page.goto(url('progresso/segmentos'));
  await A.page.waitForSelector('.seg-item', { timeout: 30000 });
  ok('a busca termina e lista os segmentos', true, (Date.now() - t0) + ' ms');
  const S = await estado(A.page);
  const cat = S.athlete.segmentos || [];
  ok('catálogo igual ao do módulo puro (ids e nomes)', JSON.stringify(cat.map((s) => s.id + s.nome)) === JSON.stringify(esperado.lista.map((s) => s.id + s.nome)), cat.map((s) => s.nome).join(' | '));
  ok('catálogo em athlete.segmentos, com a forma e sem campos internos', cat.length && cat.every((s) => s.forma && s.forma.lat.length <= 40 && !('_C' in s) && !('distGeo' in s)));
  const comPas = S.workouts.filter((w) => w.leitura && w.leitura.segmentos && w.leitura.segmentos.length);
  ok('passagens em leitura.segmentos dos treinos', comPas.length === [...esperado.passagens.values()].filter((l) => l.length).length, comPas.length + ' treinos');
  ok('treinos com leitura antiga não perdem nada (leitura.v intacta)', S.workouts.filter((w) => w.leitura && w.leitura.segmentos && !w.leitura.v).every((w) => Object.keys(w.leitura).join() === 'segmentos'));
  ok('meta da busca guardada (não refaz à toa)', S.athlete.segmentosMeta && S.athlete.segmentosMeta.corrida && S.athlete.segmentosMeta.corrida.n === comTr.length);
  const itens = await A.page.locator('.seg-item').count();
  ok('lista: um card por segmento', itens === cat.length, itens);
  const primeiro = await A.page.locator('.seg-item').first().innerText();
  const s0 = esperado.lista[0]; const td0 = tendencia(passEsp(s0.id));
  ok('card: nome, distância, passagens, melhor e tendência', primeiro.includes(s0.nome) && /passagens/.test(primeiro) && /Melhor \d+:\d\d · ajustado \d+:\d\d/.test(primeiro) && (td0.estado !== 'rapido' || /mais rápido desde/.test(primeiro)), primeiro.replace(/\n/g, ' · '));
  await shot(A.page, 'seg-lista-390.png');

  console.log('\n== Detalhe ==');
  await A.page.locator('.seg-item').first().click();
  await A.page.waitForSelector('.seg-tbl');
  const det = await A.page.locator('.main').innerText();
  ok('título-conclusão da tendência', td0.estado === 'rapido' ? det.includes('Você está ' + td0.difS + ' s mais rápido que em') : /Tempo estável|Ainda são|mais lento/.test(det), det.split('\n').find((l) => /Você está|estável|Ainda são/.test(l)));
  ok('ranking: o melhor primeiro, com o selo "Seu melhor"', (await A.page.locator('.seg-tbl tbody tr').first().innerText()).includes('Seu melhor'));
  ok('ranking: 5 linhas e "Ver as N passagens"', await A.page.locator('.seg-tbl tbody tr').count() === Math.min(5, passEsp(s0.id).length) && (passEsp(s0.id).length <= 5 || det.includes('Ver as ' + passEsp(s0.id).length + ' passagens')));
  ok('evolução: mais alto = mais rápido, losango no melhor', /Mais alto = mais rápido/.test(det) && await A.page.locator('.seg-evo path').count() === 1);
  ok('desenho do trecho sem internet', await A.page.locator('.seg-mapa svg polyline').count() >= 1);
  await shot(A.page, 'seg-detalhe-390.png');
  await A.page.getByRole('button', { name: 'Renomear' }).click();
  await A.page.fill('#seg-nome', 'Volta do lago');
  await A.page.getByRole('button', { name: 'Salvar' }).click();
  await A.page.waitForTimeout(200);
  const S2 = await estado(A.page);
  ok('renomear grava o nome e marca "renomeado"', S2.athlete.segmentos.find((s) => s.id === s0.id).nome === 'Volta do lago' && S2.athlete.segmentos.find((s) => s.id === s0.id).renomeado === true);
  ok('título da página com o nome novo', (await A.page.locator('h1').first().innerText()).includes('Volta do lago'));

  console.log('\n== Treino › Segmentos deste treino ==');
  const ultima = corridas.slice(0, 8).pop();
  await A.page.goto(url('treino/' + ultima.id));
  await A.page.waitForSelector('.seg-treino', { timeout: 15000 });
  const sec = await A.page.locator('.seg-treino').innerText();
  ok('lista os segmentos do treino com a posição', /Volta do lago/.test(sec) && /(Seu melhor|\dº de \d+)/.test(sec), sec.replace(/\n/g, ' · ').slice(0, 120));
  await A.page.locator('.seg-treino button').first().click();
  await A.page.waitForTimeout(400);
  ok('tocar destaca o trecho no mapa', await A.page.locator('.trackmap polyline[stroke="var(--ciano)"][stroke-opacity="0.45"]').count() >= 1);
  await A.page.locator('.seg-treino').scrollIntoViewIfNeeded();
  await shot(A.page, 'seg-treino-390.png', false);

  console.log('\n== Pedal, Progresso e Livro ==');
  await A.page.goto(url('progresso/segmentos')); await A.page.waitForSelector('.seg-item');
  await A.page.getByRole('radio', { name: 'Pedal' }).click();
  ok('pedal: aviso "só pelo tempo real" e lista separada', /só pelo tempo real/.test(await A.page.locator('.main').innerText()) && await A.page.locator('.seg-item').count() === 0);
  await A.page.goto(url('progresso')); await A.page.waitForSelector('a[href$="#/progresso/segmentos"]');
  ok('Progresso: card "Segmentos" com a contagem', /Segmentos[\s\S]*\d+ trechos? que você repete/.test(await A.page.locator('a[href$="#/progresso/segmentos"]').innerText()));
  await A.page.goto(url('mais/livro')); await A.page.waitForSelector('text=Tempo ajustado');
  ok('Livro: Segmento, Tempo ajustado e Tendência no segmento', await A.page.locator('details:has-text("Segmento")').count() >= 1 && await A.page.locator('details:has-text("Tempo ajustado")').count() === 1 && await A.page.locator('details:has-text("Tendência no segmento")').count() === 1);
  ok('sem erros no celular', !A.errors.length, A.errors.join(' | '));

  console.log('\n== Computador, tema claro, outro aparelho ==');
  const B = await device(1440, 900);
  await B.page.goto(url('progresso/segmentos')); await B.page.waitForSelector('.seg-tbl', { timeout: 30000 });
  ok('computador: lista e detalhe lado a lado, com a coluna Clima', await B.page.locator('.seg-cols .seg-item').count() >= 1 && (await B.page.locator('.seg-tbl thead').innerText()).includes('Clima'));
  await shot(B.page, 'seg-1440.png', false);
  const C = await device(390, 844, { tema: 'light' });
  await C.page.goto(url('progresso/segmentos')); await C.page.waitForSelector('.seg-item', { timeout: 30000 });
  await C.page.locator('.seg-item').first().click(); await C.page.waitForSelector('.seg-tbl');
  await shot(C.page, 'seg-detalhe-390-claro.png');
  // aparelho sem os trajetos, recebendo o estado sincronizado: só exibe, não refaz
  const D = await device(390, 844, { semTrajetos: true });
  await D.page.evaluate((s) => { localStorage.setItem('apex.analise.v1', JSON.stringify(s)); }, S2);
  await D.page.goto(url('progresso/segmentos')); await D.page.reload(); await D.page.waitForSelector('.seg-item', { timeout: 15000 });
  await D.page.waitForTimeout(800);
  const S3 = await estado(D.page);
  ok('outro aparelho sem trajetos: mostra o catálogo sincronizado e não apaga nada', S3.athlete.segmentos.length === S2.athlete.segmentos.length && S3.athlete.segmentos.find((s) => s.id === s0.id).nome === 'Volta do lago');
  ok('sem emoji', !/\p{Extended_Pictographic}/u.test(await C.page.locator('.main').innerText()));
  ok('sem erros no computador, no claro e no outro aparelho', !B.errors.length && !C.errors.length && !D.errors.length, [...B.errors, ...C.errors, ...D.errors].join(' | '));
} catch (e) { fail++; console.log('  ✗ erro: ' + e.message); }
await browser.close(); vite.kill();
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
