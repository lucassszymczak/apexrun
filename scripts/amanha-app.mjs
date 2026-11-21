// "Amanhã cedo" e Configurações › Treino (Fase 4 · Etapa 5) num Chromium real, com o Open-Meteo
// SIMULADO. Critérios 15 e 16. Prints em 390 e 1440 px se SHOTS apontar uma pasta.
// Uso: node scripts/amanha-app.mjs
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_TZ } from '../analise/golden/env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const payload = readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8');
const SHOTS = process.env.SHOTS || null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
// previsão de teste: 5h e 6h em clima padrão (5h com chuva de 60%), depois esquenta
function meteo(url) {
  const d = new URL(url).searchParams.get('start_date');
  const time = Array.from({ length: 24 }, (_, h) => d + 'T' + String(h).padStart(2, '0') + ':00');
  return { timezone: 'America/Sao_Paulo', hourly: { time, temperature_2m: time.map((_, h) => (h <= 6 ? 16 : 16 + (h - 6) * 2)), dew_point_2m: time.map(() => 13), precipitation_probability: time.map((_, h) => (h === 5 ? 60 : 10)), wind_speed_10m: time.map(() => 8), wind_direction_10m: time.map(() => 90) } };
}
const PORT = 5220;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
let chamadas = 0, ultimaUrl = '';
async function device(w, h, quando, { meteoOk = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: GOLDEN_TZ, locale: 'pt-BR', deviceScaleFactor: SHOTS ? 2 : 1, geolocation: { latitude: -22.9068, longitude: -43.1729 }, permissions: ['geolocation'] });
  await ctx.addInitScript((p) => { if (!sessionStorage.getItem('__d')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', p); sessionStorage.setItem('__d', '1'); } }, payload);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(quando));
  await page.route(/open-meteo\.com/, (r) => { chamadas++; ultimaUrl = r.request().url(); return meteoOk ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(meteo(r.request().url())) }) : r.abort(); });
  await page.route(/^https:\/\/(?!.*open-meteo\.com)/, (r) => r.abort());
  return { page, errors };
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: resolve(SHOTS, name), fullPage: true }); };
const url = (r) => `http://localhost:${PORT}/analise/#/${r}`;
try {
  console.log('\n== Hoje · Amanhã cedo (critério 15) ==');
  const A = await device(390, 844, '2026-11-19T18:40:00-03:00');
  await A.page.goto(url('hoje'));
  await A.page.waitForSelector('text=Melhor horário amanhã: 6h', { timeout: 15000 });
  ok('critério 15 · 5h tem chuva de 60%: descartada; vence 6h (empate pelo mais cedo)', await A.page.locator('text=/5h também tem clima padrão, mas com chuva provável \\(60%\\)/').count() === 1);
  ok('critério 15 · hora em clima padrão tem custo 0', /16 °C, orvalho 13 °C: clima padrão, sem custo no ritmo/.test(await A.page.locator('.amanha').innerText()));
  ok('barras começam no zero, a melhor com contorno, a chuva escrita', await A.page.locator('.bh.best').count() === 1 && await A.page.locator('.bh .chuva').count() === 1 && (await A.page.locator('.barras-h').getAttribute('aria-label')).includes('5h 0%, chuva 60%'));
  ok('uma busca por abertura', chamadas === 1, chamadas + ' chamada');
  await A.page.reload(); await A.page.waitForSelector('text=Melhor horário amanhã: 6h');
  ok('reabrir antes de 3 h: usa a guardada', chamadas === 1, chamadas + ' chamada');
  await A.page.locator('.amanha').scrollIntoViewIfNeeded(); await shot(A.page, 'hoje-amanha-390.png');
  const B = await device(390, 844, '2026-11-19T10:00:00-03:00');
  await B.page.goto(url('hoje')); await B.page.waitForSelector('.main > *'); await B.page.waitForTimeout(1500);
  ok('critério 15 · antes do meio-dia: o card não aparece', await B.page.locator('.amanha').count() === 0);
  const C = await device(390, 844, '2026-11-19T19:00:00-03:00', { meteoOk: false });
  await C.page.goto(url('hoje')); await C.page.waitForSelector('.main > *'); await C.page.waitForTimeout(1500);
  ok('critério 15 · sem internet: o card some, sem erro', await C.page.locator('.amanha').count() === 0 && !C.errors.length);

  console.log('\n== Configurações › Treino (critério 16) ==');
  await A.page.goto(url('mais/config'));
  await A.page.getByRole('link', { name: /Treino/ }).first().click();
  await A.page.waitForSelector('text=Janela de horário');
  await A.page.fill('#t_de', '06:00'); await A.page.fill('#t_ate', '09:00');
  await A.page.getByRole('radio', { name: 'Escolher no mapa' }).click();
  await A.page.getByRole('button', { name: 'Usar minha localização' }).click();
  await A.page.waitForSelector('text=ponto escolhido');
  await shot(A.page, 'config-treino-390.png');
  await A.page.getByRole('button', { name: 'Salvar' }).click();
  await A.page.waitForSelector('h1:has-text("Configurações")');
  const st = await A.page.evaluate(() => ({ sync: localStorage.getItem('apex.analise.v1'), ponto: localStorage.getItem('apex.previsao.ponto') }));
  const ath = JSON.parse(st.sync).athlete;
  ok('janela e modo salvos no atleta (sincronizam)', ath.treino && ath.treino.janela.de === '06:00' && ath.treino.janela.ate === '09:00' && ath.treino.local === 'mapa');
  ok('critério 16 · o ponto manual fica só no aparelho', !!st.ponto && /-22\.9068/.test(st.ponto), st.ponto);
  ok('critério 16 · o payload da sincronização não tem a latitude nem a longitude do ponto', !st.sync.includes('-22.9068') && !st.sync.includes('-43.1729'));
  await A.page.goto(url('hoje')); await A.page.waitForSelector('text=/Amanhã cedo · janela das 6h às 9h/');
  ok('o card usa a janela nova e o ponto escolhido', /latitude=-22\.9068&longitude=-43\.1729/.test(ultimaUrl) && await A.page.locator('.bh').count() === 4, ultimaUrl.split('?')[1].slice(0, 40));
  ok('sem erro de página', !A.errors.length && !B.errors.length, A.errors[0] || B.errors[0]);
  if (SHOTS) { const D = await device(1440, 900, '2026-11-19T18:40:00-03:00'); await D.page.goto(url('hoje')); await D.page.waitForSelector('text=Melhor horário amanhã'); await shot(D.page, 'hoje-amanha-1440.png'); }
} catch (e) { ok('execução sem exceção', false, e && e.message); }
finally { await browser.close(); vite.kill(); }
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
