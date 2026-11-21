// "Diga como foi" e mapa do corpo (Fase 5 · Etapa 3) num Chromium real, no formulário do treino.
// Confere: a frase preenche e marca "· pela fala"; nada é salvo antes de "Salvar treino"; a dor
// articular nunca liga sozinha; o mapa por toque, teclado e lista; a região pendente; a dor
// muscular vinda do mapa (regra a); dorRegioes salvo; treinos antigos abrem normalmente.
// Uso: node scripts/fala-app.mjs   (prints em 390 e 1440 px se SHOTS apontar uma pasta)
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_TZ, GOLDEN_NOW } from '../analise/golden/env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const st0 = JSON.parse(readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8'));
st0.athlete.equipamentos = [{ id: 'tA', tipo: 'tenis', nome: 'Azulão', kmInicial: 100, limiteKm: 600, criadoEm: '2026-11-01', v: 1 }, { id: 'tB', tipo: 'tenis', nome: 'Reserva', kmInicial: 0, limiteKm: 600, criadoEm: '2026-11-02', v: 1 }];
const payload = JSON.stringify(st0);
const SHOTS = process.env.SHOTS || null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const PORT = 5236;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
const url = (r) => `http://localhost:${PORT}/analise/#/${r}`;
async function device(w, h, tema = 'dark') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: GOLDEN_TZ, locale: 'pt-BR', deviceScaleFactor: SHOTS ? 2 : 1 });
  await ctx.addInitScript(([pl, t]) => { if (!sessionStorage.getItem('__d')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', pl); localStorage.setItem('apex.theme', t); sessionStorage.setItem('__d', '1'); } }, [payload, tema]);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.route(/^https:\/\//, (r) => r.abort());
  return { page, errors };
}
const shot = async (page, name, full = true) => { if (SHOTS) await page.screenshot({ path: resolve(SHOTS, name), fullPage: full }); };
const est = (page) => page.evaluate(() => localStorage.getItem('apex.analise.v1'));
const regiao = (page, nome) => page.locator('.corpo-r[aria-label^="' + nome + ',"]');

try {
  console.log('\n== A frase preenche, nada é salvo ==');
  const A = await device(390, 844);
  await A.page.goto(url('editar')); await A.page.waitForSelector('#diga-frase');
  const antes = await est(A.page);
  await A.page.fill('#f_date', '2026-11-20'); await A.page.fill('#f_dist', '6'); await A.page.fill('#f_dur', '33:00');
  await A.page.fill('#diga-frase', 'RPE 7, dormi 7 e meia, canela esquerda 3, com o Reserva');
  await A.page.getByRole('button', { name: 'Preencher pela frase' }).click();
  const ent = await A.page.locator('.diga-res').innerText();
  ok('"Entendi: …" em aria-live', /Entendi: RPE 7, sono 7,5 h, canela esquerda 3, tênis Reserva\./.test(ent) && (await A.page.locator('.diga-res').getAttribute('aria-live')) === 'polite', ent);
  ok('RPE 7 marcado, com "· pela fala"', (await A.page.locator('[aria-labelledby="rpe-l"] button', { hasText: /^7$/ }).getAttribute('aria-pressed')) === 'true' && /pela fala/.test(await A.page.locator('#rpe-l').innerText()));
  ok('sono 7,5 com "· pela fala" e contorno', (await A.page.locator('#f_sleep').inputValue()) === '7.5' && /pela fala/.test(await A.page.locator('label[for="f_sleep"]').innerText()) && (await A.page.locator('#f_sleep').getAttribute('class')).includes('pela-fala'));
  ok('canela esquerda 3 no mapa (aria-label)', await regiao(A.page, 'Canela esquerda').count() === 1 && (await regiao(A.page, 'Canela esquerda').getAttribute('aria-label')) === 'Canela esquerda, dor 3');
  ok('o tênis citado é escolhido', (await A.page.getByRole('button', { name: 'Reserva' }).getAttribute('aria-pressed')) === 'true');
  ok('dor muscular = 3, "· do mapa do corpo" (regra a)', (await A.page.locator('#f_sore').inputValue()) === '3' && /do mapa do corpo/.test(await A.page.locator('label[for="f_sore"]').innerText()));
  ok('nada foi salvo antes de "Salvar treino"', antes === await est(A.page));
  await shot(A.page, 'fala-390.png');

  console.log('\n== Mapa do corpo: toque, teclado, lista ==');
  await regiao(A.page, 'Joelho direito').click();
  await A.page.getByRole('button', { name: 'Aumentar a dor' }).click(); await A.page.getByRole('button', { name: 'Aumentar a dor' }).click();
  ok('toque + "+": joelho direito 2', (await regiao(A.page, 'Joelho direito').getAttribute('aria-label')) === 'Joelho direito, dor 2' && /Joelho direito 2/.test(await A.page.locator('.corpo p[aria-live]').innerText()));
  await A.page.getByRole('button', { name: 'Diminuir a dor' }).click(); await A.page.getByRole('button', { name: 'Diminuir a dor' }).click();
  ok('"−" até 0 desmarca', (await regiao(A.page, 'Joelho direito').getAttribute('aria-label')) === 'Joelho direito, sem dor' && !/Joelho direito/.test(await A.page.locator('.corpo p[aria-live]').innerText()));
  await regiao(A.page, 'Lombar').focus(); await A.page.keyboard.press('Enter');
  await A.page.getByRole('button', { name: 'Aumentar a dor' }).focus(); for (let i = 0; i < 7; i++) await A.page.keyboard.press('Enter');
  ok('teclado: Enter na região e no "+": lombar 7', (await regiao(A.page, 'Lombar').getAttribute('aria-label')) === 'Lombar, dor 7');
  await A.page.waitForTimeout(200);
  ok('a dor muscular acompanha a maior dor do mapa (7)', (await A.page.locator('#f_sore').inputValue()) === '7');
  await A.page.selectOption('#corpo-sel', 'aquiles_d'); await A.page.getByRole('button', { name: 'Aumentar a dor' }).click();
  ok('lista: escolher "Tendão de Aquiles direito" e marcar 1', (await regiao(A.page, 'Tendão de Aquiles direito').getAttribute('aria-label')) === 'Tendão de Aquiles direito, dor 1');
  ok('cores pela intensidade: 3 em atenção a 50%, 7 em alerta', /color-mix/.test(await regiao(A.page, 'Canela esquerda').evaluate((e) => e.style.background)) && /alerta/.test(await regiao(A.page, 'Lombar').evaluate((e) => e.style.background)));
  const alvo = await regiao(A.page, 'Coxa direita (frente)').boundingBox();
  ok('regiões sem sobreposição (coxa e joelho direitos)', (await regiao(A.page, 'Joelho direito').boundingBox()).y >= alvo.y + alvo.height - 0.5);

  console.log('\n== Pendências e dor articular ==');
  await A.page.fill('#diga-frase', 'canela 3, dor articular no joelho direito');
  await A.page.getByRole('button', { name: 'Preencher pela frase' }).click();
  const res = await A.page.locator('.diga-res').innerText();
  ok('região sem lado fica pendente (não chuta) e a dor articular só avisa', /Falta o lado: canela 3/.test(res) && /interruptor/.test(res), res.replace(/\n/g, ' · '));
  ok('o interruptor "Dor articular" continua desligado', !(await A.page.locator('input[role="switch"]').last().isChecked()));
  await A.page.locator('.diga-pends').getByRole('button', { name: 'Direita' }).click();
  ok('"Direita" resolve a pendência: canela direita 3', (await regiao(A.page, 'Canela direita').getAttribute('aria-label')) === 'Canela direita, dor 3');

  console.log('\n== Salvar ==');
  await A.page.getByRole('button', { name: 'Salvar treino' }).click(); await A.page.waitForTimeout(600);
  const S = JSON.parse(await est(A.page));
  const novo = S.workouts.find((w) => w.date === '2026-11-20');
  const regs = (novo && novo.dorRegioes || []).map((r) => r.regiao + (r.lado ? '_' + r.lado : '') + ' ' + r.int).sort().join(', ');
  ok('dorRegioes salvo (região, lado, intensidade)', regs === 'aquiles_d 1, canela_d 3, canela_e 3, lombar 7', regs);
  ok('RPE, sono, dor muscular e tênis salvos; dor articular desligada', novo.rpe === 7 && novo.sleepH === 7.5 && novo.soreness === 7 && novo.gearId === 'tB' && novo.pain === false);
  ok('treinos antigos continuam sem o campo', S.workouts.filter((w) => w.date !== '2026-11-20').every((w) => !('dorRegioes' in w)));
  const velho = S.workouts.find((w) => w.date !== '2026-11-20' && w.soreness != null) || S.workouts[0];
  await A.page.goto(url('editar/' + velho.id)); await A.page.waitForSelector('.corpo-box');
  ok('treino antigo abre normalmente, sem regiões, e a dor muscular não muda', /Nenhuma região marcada/.test(await A.page.locator('.corpo p[aria-live]').innerText()) && (await A.page.locator('#f_sore').inputValue()) === (velho.soreness != null ? String(velho.soreness) : ''));
  ok('sem erros no celular', !A.errors.length, A.errors.join(' | '));

  console.log('\n== computador: duas colunas ==');
  const B = await device(1440, 1000);
  await B.page.goto(url('editar')); await B.page.waitForSelector('.form-2col');
  await B.page.fill('#diga-frase', 'RPE 6, dormi 8, panturrilha direita 4'); await B.page.getByRole('button', { name: 'Preencher pela frase' }).click();
  const c1 = await B.page.locator('.diga').boundingBox(), c2 = await B.page.locator('.corpo').boundingBox();
  ok('voz e campos à esquerda, mapa do corpo à direita', c2.x > c1.x + c1.width - 1 && Math.abs(c2.y - c1.y) < 40, Math.round(c1.x) + ' × ' + Math.round(c2.x));
  await B.page.locator('.form-2col').scrollIntoViewIfNeeded(); await shot(B.page, 'fala-1440.png', false);
  const C = await device(390, 844, 'light');
  await C.page.goto(url('editar')); await C.page.waitForSelector('#diga-frase');
  await C.page.fill('#diga-frase', 'RPE 7, dormi 7 e meia, canela esquerda 3'); await C.page.getByRole('button', { name: 'Preencher pela frase' }).click();
  await C.page.locator('.corpo').scrollIntoViewIfNeeded(); await shot(C.page, 'fala-390-claro.png', false);
  ok('sem emoji; sem erros no computador e no claro', !/\p{Extended_Pictographic}/u.test(await C.page.locator('.main').innerText()) && !B.errors.length && !C.errors.length, [...B.errors, ...C.errors].join(' | '));
} catch (e) { fail++; console.log('  ✗ erro: ' + e.message); }
await browser.close(); vite.kill();
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
