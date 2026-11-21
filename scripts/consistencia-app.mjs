// Consistência por semanas (Fase 3 · Etapa 2) num Chromium real, com os treinos sintéticos do golden.
// Confere a tela, a entrada no Progresso, a linha do Relatório, a meta em Configurações › Treino e o
// verbete do Livro. Prints em 390 e 1440 px se SHOTS apontar uma pasta.
// Uso: node scripts/consistencia-app.mjs
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_TZ, GOLDEN_NOW } from '../analise/golden/env.mjs';
import { semanas, resumo } from '../analise/consistencia.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const payload = readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8');
const SHOTS = process.env.SHOTS || null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const HOJE = GOLDEN_NOW.slice(0, 10);
const W = JSON.parse(payload).workouts;
const esperado = resumo(semanas(W, { hoje: HOJE, n: 30 }), 12);
const esperadoMeta = resumo(semanas(W, { hoje: HOJE, n: 30, metaH: 3 }), 12);

const PORT = 5224;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
async function device(w, h, { tema = 'dark' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: GOLDEN_TZ, locale: 'pt-BR', deviceScaleFactor: SHOTS ? 2 : 1 });
  await ctx.addInitScript(([p, t]) => { if (!sessionStorage.getItem('__d')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', p); localStorage.setItem('apex.theme', t); sessionStorage.setItem('__d', '1'); } }, [payload, tema]);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.route(/^https:\/\//, (r) => r.abort());
  return { page, errors };
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: resolve(SHOTS, name), fullPage: true }); };
const url = (r) => `http://localhost:${PORT}/analise/#/${r}`;
try {
  console.log('\n== Tela de Consistência (celular) ==');
  const A = await device(390, 844);
  await A.page.goto(url('progresso/consistencia'));
  await A.page.waitForSelector('.semanas');
  const titulo = await A.page.locator('h2.titulo-2').innerText();
  ok('título com a conclusão das últimas 12 semanas', titulo === `${esperado.consistentes} das últimas ${esperado.de} semanas foram consistentes.`, titulo);
  const corpo = await A.page.locator('.main').innerText();
  ok('sequência atual e maior', corpo.includes(`${esperado.atual} semanas\nsequência atual`) && corpo.includes(`${esperado.maior} semanas\nsua maior sequência`));
  ok('26 semanas no celular, botões de verdade', await A.page.locator('.semanas button.csw').count() === 26);
  ok('a última é a semana em andamento', (await A.page.locator('.semanas button.csw').last().getAttribute('aria-label')) === 'Semana de 16/11: em andamento');
  const box = await A.page.locator('.semanas button.csw').first().boundingBox();
  ok('alvo de 44 × 44 px', box.width >= 44 && box.height >= 44, `${box.width}×${box.height}`);
  ok('legenda em palavras', /consistente[\s\S]*parcial[\s\S]*sem treino[\s\S]*em andamento/.test(await A.page.locator('.legenda-sem').innerText()));
  ok('regra escrita', corpo.includes('Semana consistente: pelo menos 80% das horas da meta e pelo menos 1 dia de descanso.'));
  // toque numa semana parcial
  await A.page.locator('button[aria-label="Semana de 12/10: parcial"]').click();
  const det = await A.page.locator('.cs-detalhe').innerText();
  ok('detalhe: 7 dias', await A.page.locator('.dias li').count() === 7);
  ok('detalhe: horas × meta e a origem padrão', /1h52 de 3h30/.test(det) && /53% da meta \(padrão\)/.test(det), det.split('\n').find((l) => /de \dh/.test(l)));
  ok('detalhe: veredito com o motivo', det.includes('Parcial: 53% da meta (precisa de 80%).'));
  ok('detalhe: descanso escrito por dia', /descanso/.test(det) && /corrida|pedal/.test(det));
  await shot(A.page, 'consistencia-390.png');
  // teclado
  await A.page.locator('button[aria-label="Semana de 05/10: consistente"]').focus();
  await A.page.keyboard.press('Enter');
  ok('teclado: Enter abre a semana', (await A.page.locator('.cs-detalhe').innerText()).includes('Semana de 05/10 a 11/10'));
  // semana em andamento
  await A.page.locator('button[aria-label="Semana de 16/11: em andamento"]').click();
  const and = await A.page.locator('.cs-detalhe').innerText();
  ok('em andamento: dias futuros com traço, não contam como descanso', and.includes('não quebra a sua sequência') && await A.page.locator('.dias li.futuro').count() === 3);
  ok('sem erros', !A.errors.length, A.errors.join(' | '));

  console.log('\n== Progresso e Relatório ==');
  await A.page.goto(url('progresso')); await A.page.waitForSelector('a[href$="#/progresso/consistencia"]');
  const card = await A.page.locator('a[href$="#/progresso/consistencia"]').innerText();
  ok('Progresso: card com a conclusão', card.includes(`${esperado.atual} semanas consistentes seguidas`) && card.includes(`${esperado.consistentes} das últimas ${esperado.de} semanas`), card.replace(/\n/g, ' · '));
  await A.page.goto(url('mais/relatorio')); await A.page.waitForSelector('.cons-linha');
  const linhas = await A.page.locator('.cons-linha').allInnerTexts();
  ok('Relatório: linha "Semana consistente · N seguidas"', linhas.includes('Semana consistente · 2 seguidas'), linhas.slice(0, 3).join(' | '));
  ok('Relatório: a linha leva à Consistência', (await A.page.locator('.cons-linha').first().getAttribute('href')).endsWith('#/progresso/consistencia'));
  const lb = await A.page.locator('.cons-linha').first().boundingBox();
  ok('Relatório: alvo de 44 px', lb.height >= 44, lb.height);

  console.log('\n== Configurações › Treino: meta semanal ==');
  await A.page.goto(url('mais/treino')); await A.page.waitForSelector('#t_meta');
  ok('campo com rótulo e vazio por padrão', await A.page.locator('label[for="t_meta"]').count() === 1 && (await A.page.locator('#t_meta').inputValue()) === '');
  await A.page.fill('#t_meta', '3');
  await A.page.getByRole('button', { name: 'Salvar' }).click();
  await A.page.waitForTimeout(300);
  const st = await A.page.evaluate(() => JSON.parse(localStorage.getItem('apex.analise.v1')).athlete.treino);
  ok('grava em athlete.treino.metaSemanalH', st && st.metaSemanalH === 3, JSON.stringify(st));
  await A.page.goto(url('progresso/consistencia')); await A.page.waitForSelector('.semanas');
  const t2 = await A.page.locator('h2.titulo-2').innerText();
  ok('com a sua meta, a conta muda', t2 === `${esperadoMeta.consistentes} das últimas ${esperadoMeta.de} semanas foram consistentes.`, t2);
  await A.page.locator('button[aria-label^="Semana de 12/10"]').click();
  ok('a origem passa a ser a sua meta', /de 3h00/.test(await A.page.locator('.cs-detalhe').innerText()) && !(await A.page.locator('.cs-detalhe').innerText()).includes('(padrão)'));
  await A.page.goto(url('mais/treino')); await A.page.waitForSelector('#t_meta');
  ok('reabre com 3', (await A.page.locator('#t_meta').inputValue()) === '3');
  await A.page.fill('#t_meta', ''); await A.page.getByRole('button', { name: 'Salvar' }).click(); await A.page.waitForTimeout(300);
  const st2 = await A.page.evaluate(() => JSON.parse(localStorage.getItem('apex.analise.v1')).athlete.treino);
  ok('em branco: volta à meta automática (campo removido)', st2 && !('metaSemanalH' in st2));
  await A.page.goto(url('mais/treino')); await A.page.waitForSelector('#t_meta');
  await A.page.fill('#t_meta', '0');
  let alerta = ''; A.page.once('dialog', (d) => { alerta = d.message(); d.accept(); });
  await A.page.getByRole('button', { name: 'Salvar' }).click(); await A.page.waitForTimeout(300);
  ok('meta 0 não salva e avisa', /entre 0,5 e 40/.test(alerta));

  console.log('\n== Livro de fórmulas ==');
  await A.page.goto(url('mais/livro')); await A.page.waitForSelector('text=Semana consistente');
  ok('verbete "Semana consistente" na categoria Evolução', /evolução/i.test(await A.page.locator('.main').innerText()));

  console.log('\n== Computador e tema claro ==');
  const B = await device(1440, 900);
  await B.page.goto(url('progresso/consistencia')); await B.page.waitForSelector('.semanas');
  ok('52 semanas no computador', await B.page.locator('.semanas button.csw').count() === 52);
  await B.page.locator('button[aria-label="Semana de 02/11: consistente"]').click();
  await shot(B.page, 'consistencia-1440.png');
  const C = await device(390, 844, { tema: 'light' });
  await C.page.goto(url('progresso/consistencia')); await C.page.waitForSelector('.semanas');
  await C.page.locator('button[aria-label="Semana de 12/10: parcial"]').click();
  await shot(C.page, 'consistencia-390-claro.png');
  ok('sem emoji', !/\p{Extended_Pictographic}/u.test(await C.page.locator('.main').innerText()));
  ok('sem erros no computador e no claro', !B.errors.length && !C.errors.length);
} catch (e) { fail++; console.log('  ✗ erro: ' + e.message); }
await browser.close(); vite.kill();
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
