// ============================================================================
// Teste de fumaça do app novo (/analise/) num Chromium real.
// Abre o app com dados no formato do app antigo (cenário sintético) e confere:
//   1. todas as rotas abrem sem erro de página/console;
//   2. nenhuma tela tem emoji;
//   3. o backup da migração está no IndexedDB e é IDÊNTICO ao que havia no aparelho;
//   4. apex.analise.v1 continua com as mesmas chaves (formato intacto) após o uso;
//   5. os treinos do aparelho aparecem sem importar nada.
// Uso: node scripts/smoke-analise.mjs
// ============================================================================
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_NOW, GOLDEN_TZ } from '../analise/golden/env.mjs';
import { withExif } from '../tests/helpers/exif.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const payload = readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8');
const P = JSON.parse(payload);
const ROUTES = ['hoje', 'coach', 'treinos', 'treino/' + P.workouts[3].id, 'treino/synBike1', 'compartilhar/' + P.workouts[3].id, 'editar/' + P.workouts[3].id, 'importar', 'progresso',
  'progresso/motor', 'progresso/resist', 'progresso/mec', 'progresso/carga', 'progresso/hidr', 'progresso/recup',
  'mais', 'mais/maratona', 'mais/relatorio', 'mais/recuperacao', 'mais/forca', 'mais/livro', 'mais/config'];

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}` + (got !== undefined ? `  (${got})` : '')); } else { fail++; console.log(`  ✗ ${n}` + (got !== undefined ? `  ${got}` : '')); } };

const PORT = 5197;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('vite')), 30000); vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) { clearTimeout(t); res(); } }); });
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: GOLDEN_TZ, locale: 'pt-BR' });
  await ctx.addInitScript((p) => { try { if (!sessionStorage.getItem('__sm')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', p); localStorage.setItem('apex.theme', 'dark'); sessionStorage.setItem('__sm', '1'); } } catch (e) {} }, payload);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.route(/^(?!http:\/\/localhost)/, (r) => r.abort()); // sem rede externa (como offline)

  console.log('\n== rotas ==');
  const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u;
  for (const r of ROUTES) {
    await page.goto(`http://localhost:${PORT}/analise/#/${r}`);
    await page.waitForSelector('.main > *', { timeout: 15000, state: 'attached' });
    await page.waitForTimeout(80);
    const txt = await page.evaluate(() => document.querySelector('.app').innerText);
    const em = txt.match(EMOJI);
    ok(`#/${r} abre sem emoji`, !em && !/Em construção/.test(txt), em ? 'emoji: ' + em[0] : /Em construção/.test(txt) ? 'tela não portada' : undefined);
  }
  ok('nenhum erro de página ou console', !errors.length, errors.slice(0, 3).join(' | ') || undefined);

  console.log('\n== dados do aparelho ==');
  await page.goto(`http://localhost:${PORT}/analise/#/treinos`);
  await page.waitForSelector('.item-row');
  const n = await page.locator('.item-row').count();
  ok('treinos do app antigo aparecem sem importar nada', n === P.workouts.length, n + ' de ' + P.workouts.length);
  const bk = await page.evaluate(() => new Promise((res) => {
    const rq = indexedDB.open('apex-performance');
    rq.onsuccess = () => { const tx = rq.result.transaction('backups'); const g = tx.objectStore('backups').getAll(); g.onsuccess = () => res(g.result.map((b) => ({ kind: b.kind, at: b.at, data: b.data, n: b.nWorkouts }))); g.onerror = () => res(null); };
    rq.onerror = () => res(null);
  }));
  const mig = (bk || []).find((b) => b.kind === 'migracao');
  ok('backup da migração existe no IndexedDB', !!mig, mig ? mig.at + ' · ' + mig.n + ' treinos' : 'ausente');
  ok('backup da migração é idêntico ao que havia no aparelho', mig && mig.data === payload, mig ? (mig.data === payload ? 'byte a byte' : 'DIFERENTE') : undefined);
  ok('cópia diária também guardada', (bk || []).some((b) => b.kind === 'diario'));
  // usa o app (salvar configuração) e confere o formato
  await page.goto(`http://localhost:${PORT}/analise/#/mais/config`);
  await page.getByRole('button', { name: 'Salvar configuração' }).click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.analise.v1')));
  const keysBefore = Object.keys(P).sort().join(','), keysAfter = Object.keys(after).sort().join(',');
  ok('apex.analise.v1 mantém as mesmas chaves depois de salvar', keysBefore === keysAfter, keysAfter);
  ok('treinos preservados depois de salvar', after.workouts.length === P.workouts.length && JSON.stringify(after.workouts.map((w) => w.id)) === JSON.stringify(P.workouts.map((w) => w.id)));
  const ath = Object.keys(P.athlete).filter((k) => k !== 'updatedAt').every((k) => JSON.stringify(after.athlete[k]) === JSON.stringify(P.athlete[k]));
  ok('configuração do atleta preservada (salvar sem mudar nada não altera valores)', ath);
  // tema: o app antigo guardava dark/light; o novo aceita também auto
  await page.getByRole('button', { name: 'Claro' }).click();
  ok('tema salvo na mesma chave apex.theme', (await page.evaluate(() => localStorage.getItem('apex.theme'))) === 'light');
  ok('tema aplicado', (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'light');

  console.log('\n== importar .FIT ==');
  // .FIT de corrida sintético (5 km, 30 min), gerado com o encoder oficial do Garmin
  const { Encoder, Profile } = await import('@garmin/fitsdk');
  const enc = new Encoder(); const start = new Date('2026-11-18T09:00:00Z');
  enc.onMesg(Profile.MesgNum.FILE_ID, { manufacturer: 'development', product: 1, timeCreated: start, type: 'activity' });
  for (let i = 0; i <= 1800; i++) enc.onMesg(Profile.MesgNum.RECORD, { timestamp: new Date(start.getTime() + i * 1000), distance: 2.778 * i, enhancedSpeed: 2.778, heartRate: Math.round(140 + i / 60), enhancedAltitude: 1100 + 10 * Math.sin(i / 200), cadence: 85 });
  enc.onMesg(Profile.MesgNum.SESSION, { timestamp: new Date(start.getTime() + 1800000), startTime: start, sport: 'running', totalDistance: 5000, totalTimerTime: 1800, totalElapsedTime: 1800, avgHeartRate: 155, maxHeartRate: 170 });
  const bytes = Buffer.from(enc.close());
  await page.goto(`http://localhost:${PORT}/analise/#/importar`);
  await page.setInputFiles('#fitFile', { name: 'corrida.fit', mimeType: 'application/octet-stream', buffer: bytes });
  await page.waitForSelector('h1:has-text("Conferência")', { timeout: 15000 });
  ok('o .FIT é lido e abre a Conferência (passo 2)', await page.locator('text=Achados').count() > 0);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForSelector('text=Arquivo lido', { timeout: 15000 });
  ok('Continuar leva ao passo 3 · completar', true);
  await page.getByRole('button', { name: '6', exact: true }).click(); // RPE
  await page.getByRole('button', { name: 'Salvar treino' }).click();
  await page.waitForFunction(() => /#\/treino\//.test(location.hash), null, { timeout: 10000 });
  const saved = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('apex.analise.v1')); return s.workouts.find((w) => w.date === '2026-11-18'); });
  ok('depois de salvar, abre o Treino', true, await page.evaluate(() => location.hash));
  ok('treino gravado com os dados do relógio + RPE', saved && saved.distKm === 5 && saved.durationSec === 1800 && saved.rpe === 6 && !!saved.hrHist && !!saved.stream, saved ? saved.distKm + ' km · RPE ' + saved.rpe : 'não salvo');

  // critério 11a: .FIT sem GPS → o gráfico assume o lugar do mapa
  await page.waitForSelector('text=Treino sem GPS', { timeout: 10000 });
  ok('treino sem GPS: mostra o estado "sem GPS" com o gráfico', await page.locator('.tv-empty [role="slider"]').count() > 0);

  console.log('\n== Treino com mapa (sem rede, como em modo avião) ==');
  // .FIT de corrida COM GPS: circuito de ~6 km, com subida e descida
  const SEMI = 2147483648 / 180, enc2 = new Encoder(), st2 = new Date('2026-11-17T09:00:00Z'), N2 = 2100;
  enc2.onMesg(Profile.MesgNum.FILE_ID, { manufacturer: 'development', product: 1, timeCreated: st2, type: 'activity' });
  for (let i = 0; i <= N2; i++) {
    const a = (i / N2) * 2 * Math.PI, lat = -25.39 + 0.0085 * Math.sin(a), lon = -51.46 + 0.0094 * Math.cos(a);
    enc2.onMesg(Profile.MesgNum.RECORD, { timestamp: new Date(st2.getTime() + i * 1000), distance: 2.86 * i, enhancedSpeed: 2.6 + 0.6 * Math.sin(a * 3), heartRate: Math.round(135 + 30 * Math.sin(a * 2) ** 2), enhancedAltitude: 1100 + 25 * Math.sin(a), cadence: 86, positionLat: Math.round(lat * SEMI), positionLong: Math.round(lon * SEMI) });
  }
  enc2.onMesg(Profile.MesgNum.SESSION, { timestamp: new Date(st2.getTime() + N2 * 1000), startTime: st2, sport: 'running', totalDistance: 2.86 * N2, totalTimerTime: N2, totalElapsedTime: N2, avgHeartRate: 150, maxHeartRate: 166 });
  // fuso do treino: relógio em −3 h (local_timestamp − timestamp), como num .FIT de verdade
  enc2.onMesg(Profile.MesgNum.ACTIVITY, { timestamp: new Date(st2.getTime() + N2 * 1000), localTimestamp: (st2.getTime() / 1000 + N2) - 631065600 - 10800, numSessions: 1, type: 'manual', event: 'activity', eventType: 'stop', totalTimerTime: N2 });
  const gpsFit = Buffer.from(enc2.close());
  await page.goto(`http://localhost:${PORT}/analise/#/importar`);
  await page.setInputFiles('#fitFile', { name: 'circuito.fit', mimeType: 'application/octet-stream', buffer: gpsFit });
  await page.waitForSelector('h1:has-text("Conferência")', { timeout: 15000 });
  ok('passo 2 · Conferência mostra o trajeto com GPS', await page.locator('text=Trajeto com GPS').count() > 0);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Salvar treino' }).click();
  await page.waitForFunction(() => /#\/treino\//.test(location.hash));
  const gpsId = await page.evaluate(() => location.hash.split('/').pop());
  // sem rede, "Ruas" falha e o app troca sozinho para "Só trajeto"
  await page.waitForSelector('.trackmap > svg', { timeout: 15000 });
  ok('critério 5 · "Só trajeto" funciona sem internet (troca sozinho quando o mapa de ruas não carrega)', await page.locator('button[aria-pressed="true"]', { hasText: 'Só trajeto' }).count() === 1);
  const nSeg = await page.locator('.trackmap > svg polyline').count();
  ok('trajeto colorido desenhado', nSeg >= 2, nSeg - 1 + ' trecho(s) de cor');
  const nKm = await page.locator('.trackmap > svg g text').count();
  ok('marcos de km desenhados', nKm >= 5, nKm + ' marcos');
  ok('largada e chegada desenhadas', await page.locator('.trackmap > svg > circle').count() >= 2);
  // critério 7: os 4 modos de cor mudam a legenda
  const legend = async () => page.locator('.tv-panel .tv-legend .sr-only').innerText();
  const L = {};
  for (const name of ['FC', 'Pace', 'Zona', 'Inclinação']) { await page.getByRole('button', { name, exact: true }).click(); L[name] = await legend(); }
  ok('critério 7 · os 4 modos de cor trocam a legenda', new Set(Object.values(L)).size === 4, Object.values(L).map((x) => x.split(':')[0]).join(' | '));
  ok('inclinação usa as 5 faixas do motor', /< −5%, −5 a −2%, ±2%, 2 a 5%, > 5%/.test(L['Inclinação']));
  // critério 6: replay ~10 s; arrastar o gráfico move o ponto; tocar no trajeto move o cursor do gráfico
  const slider = page.locator('.tv-panel input[type="range"]');
  const max = +(await slider.getAttribute('max'));
  await page.getByRole('button', { name: 'Reproduzir o trajeto' }).first().click();
  const t0 = Date.now();
  await page.waitForFunction((m) => { const el = document.querySelector('.tv-panel input[type="range"]'); return el && +el.value >= m; }, max, { timeout: 20000, polling: 100 });
  const secs = (Date.now() - t0) / 1000;
  ok('critério 6 · o play percorre o trajeto inteiro em ~10 s (1×)', secs > 8 && secs < 12.5, secs.toFixed(1) + ' s');
  const curPos = () => page.evaluate(() => { const c = [...document.querySelectorAll('.trackmap > svg > circle')].find((x) => x.getAttribute('fill') === 'var(--ciano)'); return c ? c.getAttribute('cx') + ',' + c.getAttribute('cy') : null; });
  const chart = page.locator('.tv-panel svg[role="slider"]');
  const bb = await chart.boundingBox();
  const posBefore = await curPos();
  await chart.click({ position: { x: bb.width * 0.3, y: bb.height / 2 } });
  const posAfter = await curPos();
  const v30 = +(await slider.inputValue());
  ok('arrastar/tocar no gráfico move o ponto no mapa', posBefore !== posAfter && v30 > max * 0.2 && v30 < max * 0.4, Math.round(v30 / max * 100) + '% do treino');
  // toca num ponto do trajeto (a ~70% do circuito) → o cursor do gráfico vai para lá
  const tap = await page.evaluate(() => { const svg = document.querySelector('.trackmap > svg'); const pl = svg.querySelectorAll('polyline'); const pts = [...pl].slice(1).flatMap((p) => p.getAttribute('points').trim().split(' ')); const vis = (k) => { const [x, y] = pts[k].split(',').map(Number); const pt = svg.createSVGPoint(); pt.x = x; pt.y = y; const q = pt.matrixTransform(svg.getScreenCTM()); const el = document.elementFromPoint(q.x, q.y); return el && el.closest('.trackmap') ? { x: q.x, y: q.y, k } : null; };
    for (let k = Math.floor(pts.length * 0.6); k < Math.floor(pts.length * 0.9); k++) { const r = vis(k); if (r) return { ...r, frac: k / pts.length }; } return null; });
  await page.mouse.click(tap.x, tap.y);
  const vTap = +(await slider.inputValue());
  const ro = await page.locator('.tv-panel [role="slider"]').getAttribute('aria-valuetext');
  ok('tocar no trajeto move o cursor do gráfico', Math.abs(vTap / max - tap.frac) < 0.1, 'tocou a ' + Math.round(tap.frac * 100) + '% do traçado → cursor a ' + Math.round(vTap / max * 100) + '% · ' + ro);
  // espaço = play/pausa
  await page.locator('.tv-title').click();
  await page.keyboard.press('Space'); await page.waitForTimeout(400);
  const vSpace = +(await slider.inputValue());
  await page.keyboard.press('Space');
  ok('teclado: espaço inicia/pausa o replay', vSpace > vTap);

  console.log('\n== treino antigo sem trajeto + Reimportar .FIT ==');
  const wBefore = await page.evaluate((id) => JSON.stringify(JSON.parse(localStorage.getItem('apex.analise.v1')).workouts.find((w) => w.id === id)), gpsId);
  await page.evaluate((id) => new Promise((res) => { const rq = indexedDB.open('apex-performance'); rq.onsuccess = () => { const tx = rq.result.transaction('tracks', 'readwrite'); tx.objectStore('tracks').delete(id); tx.oncomplete = res; }; }), gpsId);
  await page.goto(`http://localhost:${PORT}/analise/#/treinos`); await page.goto(`http://localhost:${PORT}/analise/#/treino/${gpsId}`);
  await page.waitForSelector('text=Reimporte o .FIT para ver o mapa; nada nas análises muda.', { timeout: 10000 });
  ok('critério 11 · treino antigo sem trajeto mostra o aviso de reimportar', true);
  await page.setInputFiles('#reimportFile', { name: 'outro.fit', mimeType: 'application/octet-stream', buffer: bytes });
  await page.waitForEvent('dialog', { timeout: 10000 }).then((d) => { ok('reimportar um .FIT de OUTRO treino é recusado', /não parece ser deste treino/.test(d.message()), d.message().slice(0, 80)); return d.dismiss(); });
  await page.setInputFiles('#reimportFile', { name: 'circuito.fit', mimeType: 'application/octet-stream', buffer: gpsFit });
  await page.waitForSelector('.trackmap > svg', { timeout: 15000 });
  const wAfter = await page.evaluate((id) => JSON.stringify(JSON.parse(localStorage.getItem('apex.analise.v1')).workouts.find((w) => w.id === id)), gpsId);
  ok('reimportar o .FIT certo traz o mapa de volta', true);
  ok('reimportar não muda nada no treino (byte a byte)', wBefore === wAfter);

  console.log('\n== fotos encaixadas pelo horário (critério 8) ==');
  // 3 fotos geradas aqui (1200×900, sem dado pessoal) com EXIF: 06:10:00 e 06:25:30 (dentro
  // do treino, que começou 06:00 no horário do relógio) e 08:00 (fora: 1h25 depois do fim)
  const jpg = Buffer.from(await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1200; c.height = 900; const g = c.getContext('2d'); g.fillStyle = '#1f5f87'; g.fillRect(0, 0, 1200, 900); g.fillStyle = '#f2a65a'; g.fillRect(0, 0, 1200, 400); return c.toDataURL('image/jpeg', 0.8).split(',')[1]; }), 'base64');
  const shots = [['foto-a.jpg', '2026:11:17 06:10:00', 600], ['foto-b.jpg', '2026:11:17 06:25:30', 1530], ['foto-fora.jpg', '2026:11:17 08:00:00', null]];
  await page.setInputFiles('#photoFiles', shots.map(([name, dt]) => ({ name, mimeType: 'image/jpeg', buffer: withExif(jpg, dt) })));
  const readPhotos = () => page.evaluate((id) => new Promise((res) => { const rq = indexedDB.open('apex-performance'); rq.onsuccess = () => { const g = rq.result.transaction('photos').objectStore('photos').index('wid').getAll(id); g.onsuccess = () => res(g.result.map((p) => ({ name: p.name, i: p.i, t: p.t, off: p.off, w: p.w, h: p.h, type: p.blob.type, size: p.blob.size }))); }; }), gpsId);
  let ph = [];
  for (let k = 0; k < 60 && ph.length < 3; k++) { await page.waitForTimeout(250); ph = await readPhotos(); }
  for (const [name, , t] of shots) {
    const p = ph.find((x) => x.name === name);
    if (t == null) ok('foto fora do horário vai para "Fora do percurso"', p && p.off === true, p ? 'off=' + p.off : 'ausente');
    else ok('critério 8 · ' + name + ' cai no ponto certo (erro ≤ 1 amostra)', p && !p.off && Math.abs(p.i - t) <= 1, p ? 'ponto ' + p.i + ' (esperado ' + t + ')' : 'ausente');
  }
  ok('só a miniatura é guardada (≤ 600 px, WebP)', ph.every((p) => Math.max(p.w, p.h) <= 600 && p.type === 'image/webp'), ph.map((p) => p.w + '×' + p.h + ' ' + p.type + ' ' + Math.round(p.size / 1024) + ' KB').join(' · '));
  await page.waitForSelector('.trackmap > svg g[role="img"] image');
  await page.waitForSelector('.tv-fotos h3');
  ok('as 2 fotos aparecem no mapa, no ponto delas', await page.locator('.trackmap > svg g[role="img"] image').count() === 2);
  ok('"Fora do percurso" lista a foto fora do horário', await page.locator('.tv-fotos h3', { hasText: 'Fora do percurso' }).count() === 1);
  // replay: a foto "salta" quando o ponto passa por ela
  await page.locator('.tv-panel input[type="range"]').fill('0');
  await page.getByRole('button', { name: 'Reproduzir o trajeto' }).first().click();
  const popped = await page.waitForSelector('.photo-pop', { timeout: 12000 }).then(() => true).catch(() => false);
  ok('no replay, a foto salta quando o ponto passa por ela', popped);
  await page.waitForFunction(() => !document.querySelector('.photo-pop') || true);
  // posicionar à mão a foto de fora
  await page.locator('.tv-fotos button[aria-label*="fora do percurso"]').click();
  await page.getByRole('button', { name: 'Posicionar no trajeto' }).click();
  await page.locator('#ph-pos').fill('1000');
  await page.getByRole('button', { name: 'Salvar posição' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.trackmap > svg g[role="img"] image').length === 3, null, { timeout: 5000 }).catch(() => {});
  const fora = (await readPhotos()).find((x) => x.name === 'foto-fora.jpg');
  ok('"Fora do percurso": dá para posicionar à mão', fora && !fora.off && fora.i === 1000, fora ? 'ponto ' + fora.i : '');

  console.log('\n== privacidade e compartilhar (critérios 9 e 10) ==');
  const shield = page.locator('.tv-top button.priv');
  ok('escudo de privacidade no topo do Treino (vem do padrão)', /Oculta início e fim \(500 m\)/.test(await shield.getAttribute('aria-label')), await shield.getAttribute('aria-label'));
  await page.locator('a.tv-share:visible').click();
  await page.waitForSelector('canvas[data-ready]', { timeout: 15000 });
  ok('Compartilhar tem uma única ação magenta', await page.locator('.btn-primary:visible').count() === 1);
  const cardCheck = () => page.evaluate(async (id) => {
    const T = await import('/analise/app/track.ts'); const D = await import('/analise/app/db.ts');
    const tr = await D.getTrack(id); const c = window.__apexCard;
    const g = tr.lat.map((x, i) => (x != null ? i : -1)).filter((i) => i >= 0), s = g[0], e = g[g.length - 1];
    const dmin = Math.min(...c.idx.map((i) => Math.min(T.haversine(tr.lat[i], tr.lon[i], tr.lat[s], tr.lon[s]), T.haversine(tr.lat[i], tr.lon[i], tr.lat[e], tr.lon[e]))));
    return { W: c.W, H: c.H, n: c.idx.length, dmin: Math.round(dmin) };
  }, gpsId);
  const pick = async (name) => { await page.getByRole('button', { name, exact: true }).click(); await page.waitForTimeout(500); };
  await pick('Mapa');
  let cc = await cardCheck();
  ok('critério 9 · Stories/Mapa: nenhum ponto desenhado a menos de 500 m da largada/chegada', cc.n > 50 && cc.dmin >= 500, cc.n + ' pontos · mais perto: ' + cc.dmin + ' m');
  ok('critério 10 · card de Stories em 1080×1920', cc.W === 1080 && cc.H === 1920, cc.W + '×' + cc.H);
  await pick('Foto');
  cc = await cardCheck();
  ok('critério 9 · modelo Foto também respeita os 500 m', cc.n > 50 && cc.dmin >= 500, cc.dmin + ' m');
  await pick('Feed 4:5');
  cc = await cardCheck();
  ok('critério 10 · card de Feed em 1080×1350', cc.W === 1080 && cc.H === 1350, cc.W + '×' + cc.H);
  // menu nativo: simula um aparelho com navigator.share de arquivos (como o iPhone)
  await page.evaluate(() => { window.__shared = null; navigator.canShare = (d) => !!(d && d.files); navigator.share = async (d) => { const f = d.files[0]; const bm = await createImageBitmap(f); window.__shared = { name: f.name, type: f.type, w: bm.width, h: bm.height }; }; });
  await page.getByRole('button', { name: 'Compartilhar imagem' }).click();
  await page.waitForFunction(() => window.__shared, null, { timeout: 10000 });
  const sh = await page.evaluate(() => window.__shared);
  ok('critério 10 · com suporte, abre o menu nativo com o PNG', sh.type === 'image/png' && sh.w === 1080 && sh.h === 1350, sh.name + ' · ' + sh.w + '×' + sh.h);
  // sem suporte: baixa o arquivo
  await page.evaluate(() => { navigator.canShare = undefined; navigator.share = undefined; });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.getByRole('button', { name: 'Compartilhar imagem' }).click()]);
  ok('critério 10 · sem suporte, o arquivo é baixado', /\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.getByRole('button', { name: 'Salvar' }).click()]);
  ok('"Salvar" baixa o PNG', /\.png$/.test(dl2.suggestedFilename()));
  // desligar "Ocultar início e fim" mostra o trajeto inteiro (escolha do dono para este card)
  await pick('Mapa');
  await page.getByRole('switch').uncheck(); await page.waitForTimeout(300);
  cc = await cardCheck();
  ok('sem ocultar, o card mostra o trajeto inteiro', cc.dmin < 50, 'mais perto: ' + cc.dmin + ' m');
  // privacidade "Sem mapa" no treino → Mapa indisponível e o card sai sem trajeto
  await page.goto(`http://localhost:${PORT}/analise/#/treino/${gpsId}`);
  await page.locator('.tv-top button.priv').click();
  await page.getByRole('button', { name: 'Sem mapa', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar privacidade' }).click();
  const pv = await page.evaluate((id) => JSON.parse(localStorage.getItem('apex.analise.v1')).workouts.find((w) => w.id === id).privacy, gpsId);
  ok('privacidade salva no treino (campo novo, opcional)', pv && pv.mapa === 'nenhum' && pv.raio === 500, JSON.stringify(pv));
  await page.goto(`http://localhost:${PORT}/analise/#/compartilhar/${gpsId}`);
  await page.waitForSelector('canvas[data-ready]');
  ok('"Sem mapa": o modelo Mapa fica indisponível', await page.getByRole('button', { name: 'Mapa', exact: true }).isDisabled());
  cc = await cardCheck();
  ok('"Sem mapa": nenhum ponto do trajeto no card', cc.n === 0);

  console.log('\n== desempenho do mapa ==');
  // trajetos do cenário sintético → IndexedDB; mede o longão de 2h (~20 km, ~7200 pontos)
  await page.evaluate(async () => {
    const E = await import('/analise/engine.mjs'); const S = await import('/analise/golden/synthetic.mjs');
    const T = await import('/analise/app/track.ts'); const D = await import('/analise/app/db.ts');
    const jobs = []; S.buildSynthetic(E, { onMessages: (id, m) => jobs.push([id, m]) });
    for (const [id, m] of jobs) await D.putTrack(id, T.buildTrack(m));
  });
  await page.reload(); await page.waitForSelector('.main > *', { state: 'attached' });
  await page.goto(`http://localhost:${PORT}/analise/#/treinos`);
  const tOpen = Date.now();
  await page.goto(`http://localhost:${PORT}/analise/#/treino/syn22`);
  await page.waitForSelector('.trackmap > svg polyline', { timeout: 10000 });
  const ms = Date.now() - tOpen;
  ok('trajeto de ~20 km (2h, ~7200 pontos) aparece em menos de 1 s ("Só trajeto")', ms < 1000, ms + ' ms');

  console.log('\n== Folha do KPI ==');
  await page.goto(`http://localhost:${PORT}/analise/#/hoje`);
  await page.locator('button.kpi').first().click();
  const sheet = page.getByRole('dialog');
  ok('tocar num número abre a Folha do KPI', await sheet.isVisible(), await sheet.locator('h2').innerText());
  await sheet.getByRole('link', { name: 'Ver no Livro de fórmulas' }).click();
  await page.waitForSelector('details[open]');
  ok('"Ver no Livro de fórmulas" abre o item certo', /livro/.test(await page.evaluate(() => location.hash)), await page.locator('details[open] summary').first().innerText());

  console.log('\n== computador: teclado e movimento reduzido ==');
  const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: GOLDEN_TZ, locale: 'pt-BR', reducedMotion: 'reduce' });
  await dctx.addInitScript((p) => { if (!sessionStorage.getItem('__k')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', p); sessionStorage.setItem('__k', '1'); } }, payload);
  const dp = await dctx.newPage();
  await dp.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
  await dp.goto(`http://localhost:${PORT}/analise/#/hoje`); await dp.waitForSelector('.main > *');
  await dp.evaluate(async () => { const E = await import('/analise/engine.mjs'); const S = await import('/analise/golden/synthetic.mjs'); const T = await import('/analise/app/track.ts'); const D = await import('/analise/app/db.ts'); const jobs = []; S.buildSynthetic(E, { onMessages: (id, m) => jobs.push([id, m]) }); for (const [id, m] of jobs) await D.putTrack(id, T.buildTrack(m)); });
  await dp.reload(); await dp.goto(`http://localhost:${PORT}/analise/#/treino/syn22`);
  await dp.waitForSelector('.trackmap > svg polyline', { timeout: 15000 });
  ok('movimento reduzido: sem play automático (replay manual pela barra)', await dp.getByRole('button', { name: 'Reproduzir o trajeto' }).count() === 0);
  const seen = new Set();
  for (let k = 0; k < 60; k++) {
    await dp.keyboard.press('Tab');
    const d = await dp.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { l: a.getAttribute('aria-label') || a.textContent.trim().slice(0, 30), role: a.getAttribute('role'), tag: a.tagName, ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 }; });
    if (d.tag !== 'BODY') seen.add((d.role || d.tag) + ':' + d.l + (d.ring ? '' : ' (sem anel)'));
  }
  const S2 = [...seen];
  ok('teclado alcança: voltar, privacidade, Compartilhar, barra do replay e o gráfico', ['Voltar aos treinos', 'Privacidade deste treino', 'Compartilhar', 'Posição do replay', 'slider:'].every((x) => S2.some((y) => y.includes(x))), S2.length + ' paradas');
  ok('anel de foco visível em todas as paradas', !S2.some((x) => x.includes('(sem anel)')), S2.filter((x) => x.includes('(sem anel)')).slice(0, 3).join(' | ') || undefined);
  const ch = dp.locator('.tv-panel svg[role="slider"]'); await ch.focus();
  const v0 = +(await ch.getAttribute('aria-valuenow')); await dp.keyboard.press('ArrowRight'); await dp.keyboard.press('ArrowRight');
  ok('setas movem o cursor do gráfico (e o ponto no mapa)', +(await ch.getAttribute('aria-valuenow')) > v0);
  const multi = [];
  for (const r of ROUTES) {
    await dp.goto(`http://localhost:${PORT}/analise/#/${r}`); await dp.waitForSelector('.main > *', { state: 'attached' }); await dp.waitForTimeout(150);
    const n = await dp.evaluate(() => { const mg = getComputedStyle(document.documentElement).getPropertyValue('--magenta').trim(); const toRgb = (h) => { const x = parseInt(h.slice(1), 16); return `rgb(${x >> 16}, ${(x >> 8) & 255}, ${x & 255})`; }; return [...document.querySelectorAll('a, button')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).backgroundColor === toRgb(mg); }).length; });
    if (n > 1) multi.push(r + ': ' + n);
  }
  ok('computador: no máximo uma ação magenta por tela (' + ROUTES.length + ' rotas)', !multi.length, multi.join(' | ') || undefined);
  await dctx.close();
} finally { await browser.close(); vite.kill(); }
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
