// Simulador de meta (Fase 4 · Etapa 4) num Chromium real. Critério 13: os passos somam a faixa,
// a âncora é a mesma do card do ciclo e "Usar como meta" grava goal e targetSec.
// Prints em 390 e 1440 px se SHOTS apontar uma pasta.  Uso: node scripts/simulador-app.mjs
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_NOW, GOLDEN_TZ } from '../analise/golden/env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const payload = readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8');
const SHOTS = process.env.SHOTS || null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const PORT = 5219;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
async function device(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: GOLDEN_TZ, locale: 'pt-BR', deviceScaleFactor: SHOTS ? 2 : 1 });
  await ctx.addInitScript((p) => { if (!sessionStorage.getItem('__d')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', p); sessionStorage.setItem('__d', '1'); } }, payload);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(GOLDEN_NOW)); await page.route(/^https:\/\//, (r) => r.abort());
  return { page, errors };
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: resolve(SHOTS, name), fullPage: true }); };
const url = (r) => `http://localhost:${PORT}/analise/#/${r}`;
const toS = (t) => { const m = /(\d+)h(\d\d)/.exec(t); return m ? (+m[1] * 60 + +m[2]) * 60 : null; };
try {
  const A = await device(390, 844);
  await A.page.goto(url('mais/maratona'));
  await A.page.waitForSelector('text=Hoje, seu tempo realista é de');
  const card = await A.page.locator('a:has-text("Hoje, seu tempo realista é de") b').innerText();
  const hint = await A.page.locator('text=/Projeção de Riegel a partir do seu melhor esforço/').innerText();
  ok('card do ciclo: "Hoje, seu tempo realista é de X a Y"', /^\dh\d\d a \dh\d\d$/.test(card), card);
  await A.page.locator('a:has-text("Simular meta")').click();
  await A.page.waitForSelector('h1:has-text("Simulador de meta")');
  const topo = await A.page.locator('.big.tn').innerText();
  ok('o simulador abre com a mesma faixa do card', topo === card, topo);
  const ancora = await A.page.locator('ol.passos li').first().locator('.s').innerText();
  const tituloAncora = ancora.split(' · ')[0];
  ok('critério 13 · a âncora é a mesma do card ("Estimativa de prova")', hint.includes(tituloAncora), ancora);
  const total = await A.page.locator('ol.passos li.total b.tn').innerText();
  ok('critério 13 · o total dos passos é a faixa mostrada', total === topo, total);
  const ver0 = await A.page.locator('.veredito').innerText();
  ok('meta inicial dentro da faixa, com ícone e palavra', /Dentro da faixa realista/.test(ver0) && await A.page.locator('.veredito svg').count() === 1);
  await shot(A.page, 'simulador-390.png');
  for (let i = 0; i < 12; i++) await A.page.getByRole('button', { name: 'Menos 5 minutos' }).click();
  ok('meta 1 h mais rápida: "arriscada", em atenção (aria-live)', /arriscada/.test(await A.page.locator('.veredito').innerText()) && (await A.page.locator('.veredito').getAttribute('aria-live')) === 'polite');
  await shot(A.page, 'simulador-390-abaixo.png');
  for (let i = 0; i < 12; i++) await A.page.getByRole('button', { name: 'Mais 5 minutos' }).click();
  ok('"Previsão" desligada fora dos 16 dias, com o motivo', await A.page.getByRole('radio', { name: 'Previsão' }).isDisabled() && await A.page.locator('text=/A previsão abre 16 dias antes da prova/').count() === 1);
  await A.page.getByRole('radio', { name: 'Quente e úmido' }).click();
  const quente = await A.page.locator('.big.tn').innerText();
  ok('"Quente e úmido" deixa a faixa mais lenta', toS(quente.split(' a ')[0]) > toS(topo.split(' a ')[0]), quente);
  ok('o passo do clima mostra a condição usada', await A.page.locator('text=/24 °C, orvalho 20 °C/').count() === 1);
  ok('"Percurso" só aparece com percurso', await A.page.locator('legend:has-text("Percurso")').count() === 0);
  const meta = await A.page.locator('.stepper output').innerText();
  await A.page.getByRole('button', { name: /^Usar .* como meta$/ }).click();
  await A.page.waitForSelector('text=Resumo do ciclo');
  const race = await A.page.evaluate(() => JSON.parse(localStorage.getItem('apex.analise.v1')).race);
  ok('critério 13 · "Usar como meta" grava goal "time" e targetSec', race.goal === 'time' && race.targetSec === toS(meta), meta + ' → ' + race.targetSec);
  await A.page.goto(url('mais/ciclo'));
  ok('Editar ciclo: "realista hoje" e "Testar metas no simulador"', await A.page.locator('text=/realista hoje: \\dh\\d\\d a \\dh\\d\\d/').count() === 1 && await A.page.getByRole('link', { name: 'Testar metas no simulador' }).count() === 1);
  await shot(A.page, 'editar-390-realista.png');
  ok('sem erro de página', !A.errors.length, A.errors[0]);
  if (SHOTS) { const D = await device(1440, 900); await D.page.goto(url('mais/simulador')); await D.page.waitForSelector('h1:has-text("Simulador de meta")'); await shot(D.page, 'simulador-1440.png'); }
} catch (e) { ok('execução sem exceção', false, e && e.message); }
finally { await browser.close(); vite.kill(); }
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
