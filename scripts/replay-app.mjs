// Replay do mapa (decisão do Lucas, 24/11/2026) num Chromium real, no "Só trajeto" (sem rede):
// 1× = 5 s por km (2× e 4× proporcionais); cada marco de km (e o início da deriva) só aparece
// depois que o cursor completa aquele km; parado no início e no fim, todos aparecem.
// Trajeto SINTÉTICO num lugar fictício. Uso: node scripts/replay-app.mjs
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_TZ, GOLDEN_NOW } from '../analise/golden/env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };

// circuito retangular de 4 km a ~3 m/s, 1 ponto por segundo
// lugar fictício; REPLAY_LUGAR=curitiba só para prints com ruas (centro de Curitiba, lugar público)
const [LAT, LON] = process.env.REPLAY_LUGAR === 'curitiba' ? [-25.4318, -49.2770] : [10.5, 20.5];
const M = 111195, MLON = M * Math.cos((LAT * Math.PI) / 180);
function track(vs, v) {
  const tr = { v: 1, start: 1760000000, tzOffsetSec: -10800, hasGps: true, t: [], lat: [], lon: [], dist: [], hr: [], spd: [], alt: [], grade: [], draw: [] };
  let t = 0, d = 0;
  for (let k = 1; k < vs.length; k++) { const [x0, y0] = vs[k - 1], [x1, y1] = vs[k]; const L = Math.hypot(x1 - x0, y1 - y0); const n = Math.max(1, Math.round(L / v)); for (let j = 0; j < n; j++) { const f = j / n; tr.t.push(t); tr.lat.push(LAT + (y0 + (y1 - y0) * f) / M); tr.lon.push(LON + (x0 + (x1 - x0) * f) / MLON); tr.dist.push(d); tr.hr.push(150); tr.spd.push(v); tr.alt.push(900); tr.grade.push(0); t++; d += L / n; } }
  tr.draw = tr.t.map((_, i) => i).filter((i) => i % 5 === 0);
  return tr;
}
const st = JSON.parse(readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8'));
const w = st.workouts.filter((x) => x.modal !== 'bike').sort((a, b) => b.date.localeCompare(a.date))[0];
const tr = track([[0, 0], [1200, 0], [1200, 800], [0, 800], [0, 0]], 3);
w.distKm = 4.0; w.durationSec = tr.t.length - 1;
const KM = 4.0, ESP = 5 * KM; // 1× → 20 s

const PORT = 5242;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
const url = (r) => `http://localhost:${PORT}/analise/#/${r}`;
async function device() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: GOLDEN_TZ, locale: 'pt-BR' });
  await ctx.addInitScript((p) => { if (!sessionStorage.getItem('__r')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', p); localStorage.setItem('apex.theme', 'dark'); sessionStorage.setItem('__r', '1'); } }, JSON.stringify(st));
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/^https:\/\//, (r) => r.abort());
  await page.goto(url('hoje')); await page.waitForSelector('.main > *');
  await page.evaluate((T) => new Promise((res, rej) => { const rq = indexedDB.open('apex-performance'); rq.onsuccess = () => { const tx = rq.result.transaction('tracks', 'readwrite'); tx.objectStore('tracks').put({ ...T, id: T.id }); tx.oncomplete = () => res(); tx.onerror = rej; }; }), { ...tr, id: w.id });
  return { page, errors };
}
// marcos de km desenhados no "Só trajeto" (círculo + número)
const marcos = (page) => page.evaluate(() => [...document.querySelectorAll('.trackmap svg g[aria-hidden="true"] > text')].map((t) => t.textContent).filter((x) => /^\d+$/.test(x)));
const valor = (page) => page.evaluate(() => { const el = document.querySelector('.tv-panel input[type="range"]'); return el ? [+el.value, +el.max] : [0, 1]; });

try {
  const { page, errors } = await device();
  await page.goto(url('treino/' + w.id)); await page.waitForSelector('.trackmap svg', { timeout: 20000 });
  await page.waitForTimeout(600);
  const todos = await marcos(page);
  ok('parado no início: todos os marcos de km aparecem', todos.length >= 3, todos.join(','));

  console.log('\n== 1× = 5 s por km ==');
  await page.getByRole('button', { name: 'Reproduzir o trajeto' }).first().click();
  const t0 = Date.now();
  await page.waitForTimeout(6000);
  const [v6, mx] = await valor(page); const s6 = (Date.now() - t0) / 1000;
  const prev = s6 / ESP;
  ok('em ~6 s, o cursor anda ~6/20 do treino (5 s por km)', Math.abs(v6 / mx - prev) < 0.08, (v6 / mx * 100).toFixed(0) + '% (esperado ' + (prev * 100).toFixed(0) + '%)');
  const m6 = await marcos(page);
  ok('no meio do replay, só os km já completados (km 1, sem o 2 e o 3)', m6.includes('1') && !m6.includes('2') && !m6.includes('3'), m6.join(',') || 'nenhum');
  await page.getByRole('button', { name: /Pausar/ }).first().click();
  await page.waitForTimeout(400);
  const mp = await marcos(page);
  ok('pausado no meio, os marcos continuam só até o cursor', JSON.stringify(mp) === JSON.stringify(m6), mp.join(','));
  await page.getByRole('button', { name: 'Reproduzir o trajeto' }).first().click();
  await page.waitForFunction((m) => { const el = document.querySelector('.tv-panel input[type="range"]'); return el && +el.value >= m; }, mx, { timeout: 40000, polling: 100 });
  const tot = (Date.now() - t0) / 1000;
  ok('o treino de 4 km leva ~20 s em 1× (com a pausa)', tot > ESP * 0.85 && tot < ESP * 1.35, tot.toFixed(1) + ' s');
  await page.waitForTimeout(400);
  const mf = await marcos(page);
  ok('no fim, todos os marcos aparecem de novo', mf.length === todos.length, mf.join(','));

  console.log('\n== 2× ==');
  await page.goto(url('treino/' + w.id)); await page.waitForSelector('.trackmap svg'); await page.waitForTimeout(400);
  await page.locator('[aria-label="Velocidade do replay"] button:visible', { hasText: '2×' }).first().click();
  await page.getByRole('button', { name: 'Reproduzir o trajeto' }).first().click();
  const t1 = Date.now(); await page.waitForTimeout(4000);
  const [v4] = await valor(page); const s4 = (Date.now() - t1) / 1000;
  ok('2× anda o dobro (10 s para os 4 km)', Math.abs(v4 / mx - s4 / (ESP / 2)) < 0.1, (v4 / mx * 100).toFixed(0) + '% em ' + s4.toFixed(1) + ' s');
  console.log('\n== cursor "corredor" no Só trajeto ==');
  await page.goto(url('treino/' + w.id)); await page.waitForSelector('.trackmap svg'); await page.waitForTimeout(400);
  const chipC = page.locator('.tv-vista:visible .chip', { hasText: 'Corredor' });
  await chipC.click();
  ok('"Corredor" troca o ponto pelo corredor', await page.locator('.trackmap svg .svg-corredor').count() === 1 && (await chipC.getAttribute('aria-pressed')) === 'true');
  ok('a escolha fica guardada no perfil', await page.evaluate(() => JSON.parse(localStorage.getItem('apex.analise.v1')).athlete.replayCorredor === true));
  await page.locator('[aria-label="Vista do replay"]:visible button', { hasText: '3ª pessoa' }).click(); await page.waitForTimeout(300);
  ok('sem o mapa de ruas (sem internet), a 3ª pessoa avisa e a vista continua de cima', /precisa do mapa de ruas/.test(await page.locator('.toasts').innerText()) && (await page.locator('[aria-label="Vista do replay"]:visible button', { hasText: 'De cima' }).getAttribute('aria-pressed')) === 'true');
  ok('sem erros', !errors.length, errors.join(' | '));

  console.log('\n== 3ª pessoa no mapa de ruas (com internet para o mapa) ==');
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: GOLDEN_TZ, locale: 'pt-BR' });
  await ctx2.addInitScript((p) => { if (!sessionStorage.getItem('__r')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', p); localStorage.setItem('apex.theme', 'dark'); sessionStorage.setItem('__r', '1'); } }, JSON.stringify(st));
  const P = await ctx2.newPage(); const err2 = [];
  P.on('pageerror', (e) => err2.push(e.message));
  await P.route(/^https:\/\/(?!tiles\.openfreemap\.org)/, (r) => r.abort());
  await P.goto(url('hoje')); await P.waitForSelector('.main > *');
  await P.evaluate((T) => new Promise((res, rej) => { const rq = indexedDB.open('apex-performance'); rq.onsuccess = () => { const tx = rq.result.transaction('tracks', 'readwrite'); tx.objectStore('tracks').put({ ...T, id: T.id }); tx.oncomplete = () => res(); tx.onerror = rej; }; }), { ...tr, id: w.id });
  await P.goto(url('treino/' + w.id));
  const temRuas = await P.waitForFunction(() => { const m = window.__apexMapa; return !!(m && m.loaded && m.loaded()); }, null, { timeout: 25000 }).then(() => true).catch(() => false);
  if (!temRuas) { ok('mapa de ruas carregou (precisa de tiles.openfreemap.org)', false); }
  else {
    await P.locator('[aria-label="Vista do replay"]:visible button', { hasText: '3ª pessoa' }).click();
    await P.locator('.tv-vista:visible .chip', { hasText: 'Corredor' }).click();
    await P.getByRole('button', { name: 'Reproduzir o trajeto' }).first().click(); await P.waitForTimeout(2500);
    await P.getByRole('button', { name: /Pausar/ }).first().click(); await P.waitForTimeout(300);
    const cam = await P.evaluate(() => { const m = window.__apexMapa; const c = m.getCenter(); return { pitch: m.getPitch(), bearing: m.getBearing(), zoom: m.getZoom(), lat: c.lat, lon: c.lng }; });
    // nos primeiros ~500 m o trajeto vai para o leste (rumo ~90°)
    const brg = ((cam.bearing % 360) + 360) % 360;
    ok('3ª pessoa: câmera inclinada (60°) e virada para onde o corredor vai (leste, ~90°)', Math.round(cam.pitch) === 60 && Math.abs(brg - 90) < 12, 'inclinação ' + cam.pitch.toFixed(0) + '°, rumo ' + brg.toFixed(0) + '°');
    ok('a câmera acompanha o cursor (centro no trajeto, zoom 17)', Math.round(cam.zoom) === 17 && Math.abs(cam.lat - LAT) < 0.003, cam.lat.toFixed(4) + ', ' + cam.lon.toFixed(4));
    ok('o corredor aparece no mapa de ruas', await P.locator('.mk.corredor').count() === 1);
    if (process.env.SHOTS) await P.screenshot({ path: resolve(process.env.SHOTS, 'replay-3a-pessoa.png') });
    await P.locator('[aria-label="Vista do replay"]:visible button', { hasText: 'De cima' }).click(); await P.waitForTimeout(400);
    const cima = await P.evaluate(() => { const m = window.__apexMapa; return { pitch: m.getPitch(), bearing: m.getBearing() }; });
    ok('"De cima" volta a câmera reta, com o norte para cima', cima.pitch === 0 && Math.abs(cima.bearing) < 0.5, JSON.stringify(cima));
    if (process.env.SHOTS) await P.screenshot({ path: resolve(process.env.SHOTS, 'replay-de-cima.png') });
  }
  ok('sem erros no mapa de ruas', !err2.length, err2.join(' | '));
} catch (e) { fail++; console.log('  ✗ erro: ' + e.message); }
await browser.close(); vite.kill();
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
