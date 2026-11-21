// Fantasma no replay (Fase 3 · Etapa 5) num Chromium real, com trajetos SINTÉTICOS a 1 Hz (lugar
// fictício) no IndexedDB. Confere candidatos, ordem, a diferença ao vivo e no fim, o marcador no
// mapa, o padrão "Sem fantasma" e o "Comparar no replay" do segmento. Prints se SHOTS apontar uma pasta.
// Uso: node scripts/fantasma-app.mjs
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_TZ, GOLDEN_NOW } from '../analise/golden/env.mjs';
import { final } from '../analise/fantasma.mjs';
import { ehPedal } from '../analise/calor.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const st = JSON.parse(readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8'));
const SHOTS = process.env.SHOTS || null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };

const LAT = 10.5, LON = 20.5, M = 111195, MLON = M * Math.cos((LAT * Math.PI) / 180);
function track(vs, v, semente) {
  let s = semente; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
  const tr = { v: 1, start: 1760000000, tzOffsetSec: -10800, hasGps: true, t: [], lat: [], lon: [], dist: [], hr: [], spd: [], alt: [], grade: [], draw: [] };
  let t = 0, d = 0;
  for (let k = 1; k < vs.length; k++) { const [x0, y0] = vs[k - 1], [x1, y1] = vs[k]; const L = Math.hypot(x1 - x0, y1 - y0); const n = Math.max(1, Math.round(L / v)); for (let j = 0; j < n; j++) { const f = j / n; tr.t.push(t); tr.lat.push(LAT + (y0 + (y1 - y0) * f + rnd() * 5) / M); tr.lon.push(LON + (x0 + (x1 - x0) * f + rnd() * 5) / MLON); tr.dist.push(d); tr.hr.push(150); tr.spd.push(v); tr.alt.push(900); tr.grade.push(0); t++; d += L / n; } }
  tr.draw = tr.t.map((_, i) => i).filter((i) => i % 5 === 0);
  return tr;
}
const VOLTA = [[0, 0], [1200, 0], [1200, 800], [0, 800], [0, 0]]; // 4 km
const OUTRO = [[0, 0], [0, -2000], [0, 0]];
const corridas = st.workouts.filter((w) => !ehPedal(w) && !w.indoor).sort((a, b) => a.date.localeCompare(b.date));
const tracks = {}; const vel = [2.9, 3.2, 3.0, 3.05]; // o 2º é o mais rápido
corridas.slice(0, 4).forEach((w, i) => { tracks[w.id] = track(VOLTA, vel[i], i + 1); w.distKm = 4.0; w.durationSec = tracks[w.id].t.length - 1; });
const outro = corridas[4]; tracks[outro.id] = track(OUTRO, 3, 9); outro.distKm = 4.0; outro.durationSec = tracks[outro.id].t.length - 1; // mesma distância, outro percurso
const alvo = corridas[3], melhor = corridas[1], recente = corridas[2];
const payload = JSON.stringify(st);
const fimEsp = final(tracks[alvo.id], tracks[melhor.id]);

const PORT = 5230;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
const url = (r) => `http://localhost:${PORT}/analise/#/${r}`;
async function device(w, h, { tema = 'dark', reduz = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: GOLDEN_TZ, locale: 'pt-BR', deviceScaleFactor: SHOTS ? 2 : 1, reducedMotion: reduz ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(([pl, t]) => { if (!sessionStorage.getItem('__d')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', pl); localStorage.setItem('apex.theme', t); sessionStorage.setItem('__d', '1'); } }, [payload, tema]);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.route(/^https:\/\//, (r) => r.abort());
  await page.goto(url('hoje')); await page.waitForSelector('.main > *');
  await page.evaluate((T) => new Promise((res, rej) => { const rq = indexedDB.open('apex-performance'); rq.onsuccess = () => { const tx = rq.result.transaction('tracks', 'readwrite'); for (const [id, tr] of Object.entries(T)) tx.objectStore('tracks').put({ ...tr, id }); tx.oncomplete = () => res(); tx.onerror = rej; }; }), tracks);
  return { page, errors };
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: resolve(SHOTS, name) }); };
const dm = (iso) => { const M3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']; return +iso.slice(8) + ' ' + M3[+iso.slice(5, 7) - 1]; };

try {
  console.log('\n== Escolha do fantasma (celular) ==');
  const A = await device(390, 844);
  const antes = await A.page.evaluate(() => localStorage.getItem('apex.analise.v1'));
  await A.page.goto(url('treino/' + alvo.id));
  await A.page.waitForSelector('.only-mob .fant-btn:not([disabled])', { timeout: 20000 });
  ok('padrão: "Sem fantasma"', (await A.page.locator('.only-mob .fant-btn').first().innerText()).includes('Sem fantasma'));
  ok('sem fantasma, nenhum marcador no mapa', await A.page.locator('.trackmap [aria-label^="Fantasma"]').count() === 0);
  await A.page.locator('.only-mob .fant-btn').first().click();
  await A.page.waitForSelector('.fant-lista');
  const op = await A.page.locator('.fant-lista button').allInnerTexts();
  ok('lista: Sem fantasma, Seu melhor, Mais recente, os outros por data', op.length === 4 && /^Sem fantasma/.test(op[0]) && op[1].startsWith('Seu melhor') && op[1].includes(dm(melhor.date)) && op[2].startsWith('Mais recente') && op[2].includes(dm(recente.date)), op.map((x) => x.split('\n')[0]).join(' | '));
  ok('percurso diferente (mesma distância) fica de fora', !op.some((x) => x.includes(dm(outro.date))) || dm(outro.date) === dm(alvo.date));
  await A.page.locator('.fant-lista button', { hasText: 'Seu melhor' }).click();
  await A.page.waitForSelector('.only-mob .fant-dif');
  ok('botão mostra "Fantasma: Seu melhor"', (await A.page.locator('.only-mob .fant-btn').first().innerText()).includes('Fantasma: Seu melhor'));
  ok('legenda: você e fantasma com as datas', (await A.page.locator('.only-mob .fant-leg').first().innerText()).includes('fantasma (' + dm(melhor.date) + ')'));
  await A.page.waitForSelector('.trackmap [aria-label^="Fantasma"]', { timeout: 10000 });
  ok('marcador do fantasma no mapa (círculo tracejado)', await A.page.locator('.trackmap [aria-label^="Fantasma"] circle[stroke-dasharray]').count() === 1);
  // meio do replay: arrasta a barra
  const meio = Math.round((tracks[alvo.id].t.length - 1) / 2);
  await A.page.locator('.tv-panel-in input[aria-label="Posição do replay"]').fill(String(meio));
  await A.page.waitForTimeout(200);
  const dif = await A.page.locator('.only-mob .fant-dif').first().innerText();
  ok('no meio: "Fantasma X s à frente" em atenção (ele é mais rápido)', /^Fantasma \d+ s à frente$/.test(dif) && (await A.page.locator('.only-mob .fant-dif').first().getAttribute('class')).includes('atencao'), dif);
  await shot(A.page, 'fant-390.png');
  await A.page.locator('.tv-panel-in input[aria-label="Posição do replay"]').fill(String(tracks[alvo.id].t.length - 1));
  await A.page.waitForTimeout(200);
  const fimTxt = await A.page.locator('.only-mob .fant-dif').first().innerText();
  ok('no fim: "Você terminou X s atrás", igual ao módulo', fimTxt === 'Você terminou ' + fimEsp + ' s atrás', fimTxt);
  await A.page.locator('.only-mob .fant-btn').first().click(); await A.page.locator('.fant-lista button', { hasText: 'Sem fantasma' }).click();
  await A.page.waitForTimeout(300);
  ok('voltar para "Sem fantasma" tira o marcador', await A.page.locator('.trackmap [aria-label^="Fantasma"]').count() === 0);
  ok('a escolha não é gravada (estado salvo igual)', antes === await A.page.evaluate(() => localStorage.getItem('apex.analise.v1')));
  await A.page.goto(url('treino/' + outro.id)); await A.page.waitForSelector('.only-mob .fant-btn', { timeout: 20000 });
  await A.page.waitForFunction(() => !/Procurando/.test(document.querySelector('.only-mob .fant-btn')?.textContent || ''));
  ok('sem candidatos: "Sem treinos parecidos", desativado', (await A.page.locator('.only-mob .fant-btn').first().innerText()).includes('Sem treinos parecidos') && await A.page.locator('.only-mob .fant-btn').first().isDisabled());
  ok('sem erros no celular', !A.errors.length, A.errors.join(' | '));

  console.log('\n== Comparar no replay (segmento) e computador ==');
  const B = await device(1440, 900);
  await B.page.goto(url('progresso/segmentos')); await B.page.waitForSelector('.seg-tbl', { timeout: 30000 });
  const lnk = B.page.getByRole('link', { name: 'Comparar no replay' });
  ok('detalhe do segmento: "Comparar no replay"', await lnk.count() === 1);
  await lnk.click();
  await B.page.waitForSelector('.tv-replaybar .fant-dif', { timeout: 20000 });
  ok('abre o treino mais recente com o fantasma já escolhido', (await B.page.locator('.tv-replaybar .fant-btn').innerText()).startsWith('Fantasma:') && B.page.url().includes('fantasma='));
  ok('os dois começam juntos no início da passagem: empatados', (await B.page.locator('.tv-replaybar .fant-dif').innerText()) === 'Empatados');
  await B.page.waitForSelector('.trackmap svg polyline[stroke-opacity="0.45"]', { timeout: 15000 }).catch(() => {});
  ok('a passagem fica destacada no mapa', await B.page.locator('.trackmap polyline[stroke-opacity="0.45"]').count() >= 1);
  await shot(B.page, 'fant-1440.png');
  const C = await device(390, 844, { reduz: true });
  await C.page.goto(url('treino/' + alvo.id)); await C.page.waitForSelector('.only-mob .fant-btn:not([disabled])', { timeout: 20000 });
  ok('movimento reduzido: o fantasma continua disponível, replay manual', await C.page.locator('.tv-play').count() === 0 && await C.page.locator('.fant-btn').count() >= 1);
  ok('sem erros no computador e com movimento reduzido', !B.errors.length && !C.errors.length, [...B.errors, ...C.errors].join(' | '));
  await A.page.goto(url('mais/livro')); await A.page.waitForSelector('details:has-text("Fantasma")');
  ok('Livro: verbete "Fantasma"', await A.page.locator('details:has-text("Fantasma")').count() >= 1);
} catch (e) { fail++; console.log('  ✗ erro: ' + e.message); }
await browser.close(); vite.kill();
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
