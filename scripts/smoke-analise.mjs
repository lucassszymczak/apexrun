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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const payload = readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8');
const P = JSON.parse(payload);
const ROUTES = ['hoje', 'coach', 'treinos', 'treino/' + P.workouts[3].id, 'treino/synBike1', 'editar/' + P.workouts[3].id, 'importar', 'progresso',
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
    await page.waitForSelector('.main > *', { timeout: 15000 });
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
  await page.waitForSelector('text=Arquivo lido', { timeout: 15000 });
  ok('o .FIT é lido e abre o passo de completar', true);
  await page.getByRole('button', { name: '6', exact: true }).click(); // RPE
  await page.getByRole('button', { name: 'Salvar treino' }).click();
  await page.waitForFunction(() => /#\/treino\//.test(location.hash), null, { timeout: 10000 });
  const saved = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('apex.analise.v1')); return s.workouts.find((w) => w.date === '2026-11-18'); });
  ok('depois de salvar, abre o Treino', true, await page.evaluate(() => location.hash));
  ok('treino gravado com os dados do relógio + RPE', saved && saved.distKm === 5 && saved.durationSec === 1800 && saved.rpe === 6 && !!saved.hrHist && !!saved.stream, saved ? saved.distKm + ' km · RPE ' + saved.rpe : 'não salvo');

  console.log('\n== Folha do KPI ==');
  await page.goto(`http://localhost:${PORT}/analise/#/hoje`);
  await page.locator('button.kpi').first().click();
  const sheet = page.getByRole('dialog');
  ok('tocar num número abre a Folha do KPI', await sheet.isVisible(), await sheet.locator('h2').innerText());
  await sheet.getByRole('link', { name: 'Ver no Livro de fórmulas' }).click();
  await page.waitForSelector('details[open]');
  ok('"Ver no Livro de fórmulas" abre o item certo', /livro/.test(await page.evaluate(() => location.hash)), await page.locator('details[open] summary').first().innerText());
} finally { await browser.close(); vite.kill(); }
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
