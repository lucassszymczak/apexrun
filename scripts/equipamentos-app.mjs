// Equipamentos (Fase 5 · Etapa 2) num Chromium real: cadastro do tênis (nome, km atuais, limite),
// escolha no formulário do treino, linha de 90%, card no Hoje no limite, aposentar, bike com
// "Troquei" e treinos antigos sem equipamento. Prints em 390 e 1440 px se SHOTS apontar uma pasta.
// Uso: node scripts/equipamentos-app.mjs
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_TZ, GOLDEN_NOW } from '../analise/golden/env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const payload = readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8');
const SHOTS = process.env.SHOTS || null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const PORT = 5234;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
const url = (r) => `http://localhost:${PORT}/analise/#/${r}`;
async function device(w, h, { tema = 'dark', estado = payload } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: GOLDEN_TZ, locale: 'pt-BR', deviceScaleFactor: SHOTS ? 2 : 1 });
  await ctx.addInitScript(([pl, t]) => { if (!sessionStorage.getItem('__d')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', pl); localStorage.setItem('apex.theme', t); sessionStorage.setItem('__d', '1'); } }, [estado, tema]);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.route(/^https:\/\//, (r) => r.abort());
  page.on('dialog', (d) => d.accept());
  return { page, errors };
}
const shot = async (page, name, full = true) => { if (SHOTS) await page.screenshot({ path: resolve(SHOTS, name), fullPage: full }); };
const est = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('apex.analise.v1')));
async function novoTreino(page, { dist, dur, bike = false, date }) {
  await page.goto(url('editar')); await page.waitForSelector('#f_dist');
  if (date) await page.fill('#f_date', date);
  if (bike) await page.getByRole('button', { name: 'Bike', exact: true }).click();
  await page.fill('#f_dist', String(dist)); await page.fill('#f_dur', dur);
  if (bike) await page.fill('#f_hr', '130');
}

try {
  console.log('\n== Mais › Equipamentos: cadastro do tênis ==');
  const A = await device(390, 844);
  await A.page.goto(url('mais/equipamentos')); await A.page.waitForSelector('h1');
  const antes = await est(A.page);
  const idsAntigos = antes.workouts.map((w) => w.id);
  ok('sem tênis: a tela explica e oferece "Novo par"', /Nenhum tênis cadastrado/.test(await A.page.locator('.main').innerText()));
  await A.page.getByRole('button', { name: 'Novo par' }).click();
  ok('formulário: nome, km atuais e km limite (600 por padrão)', (await A.page.locator('#eq_lim').inputValue()) === '600' && await A.page.locator('label[for="eq_nome"]').count() === 1 && await A.page.locator('label[for="eq_km"]').count() === 1);
  await A.page.fill('#eq_nome', 'Par de teste'); await A.page.fill('#eq_km', '545');
  await A.page.getByRole('button', { name: 'Salvar' }).click();
  await A.page.waitForSelector('.eq-card');
  let S = await est(A.page); const t = S.athlete.equipamentos[0];
  ok('grava em athlete.equipamentos: nome, km atuais, limite, data', t && t.tipo === 'tenis' && t.nome === 'Par de teste' && t.kmInicial === 545 && t.limiteKm === 600 && t.criadoEm === GOLDEN_NOW.slice(0, 10), JSON.stringify(t));
  ok('card: 545 de 600 km, barra âmbar (≥ 90%) e o aviso', /545\s*de 600 km/.test(await A.page.locator('.eq-card').innerText()) && await A.page.locator('.eq-barra i.atencao').count() === 1 && /Perto do limite: faltam 55 km/.test(await A.page.locator('.eq-card').innerText()));
  await shot(A.page, 'eq-390.png');

  console.log('\n== Formulário do treino ==');
  await novoTreino(A.page, { dist: 6, dur: '33:00', date: '2026-11-20' });
  const campo = await A.page.locator('.eq-campo').innerText();
  ok('com um tênis só, ele já vem escolhido', (await A.page.getByRole('button', { name: 'Par de teste' }).getAttribute('aria-pressed')) === 'true');
  ok('a barra mostra os km com este treino e a linha de 90%', /551 de 600 km com este treino/.test(campo) && await A.page.locator('.eq-campo .eq-est').count() === 1, campo.replace(/\n/g, ' · '));
  await A.page.getByRole('button', { name: 'Salvar treino' }).click();
  await A.page.waitForTimeout(500);
  S = await est(A.page);
  const novo = S.workouts.find((w) => !idsAntigos.includes(w.id));
  ok('o treino salvo guarda o gearId', novo && novo.gearId === t.id);
  ok('treinos antigos continuam sem o campo', S.workouts.filter((w) => idsAntigos.includes(w.id)).every((w) => !('gearId' in w)));
  await novoTreino(A.page, { dist: 5, dur: '28:00', date: '2026-11-21' });
  await A.page.getByRole('button', { name: 'Sem tênis' }).click();
  await A.page.getByRole('button', { name: 'Salvar treino' }).click(); await A.page.waitForTimeout(500);
  S = await est(A.page);
  const semT = S.workouts.find((w) => !idsAntigos.includes(w.id) && w.id !== novo.id);
  ok('"Sem tênis" salva sem equipamento', semT && !('gearId' in semT));
  // editar um treino antigo abre normalmente e não ganha equipamento
  const velho = antes.workouts.find((w) => w.modal !== 'bike');
  await A.page.goto(url('editar/' + velho.id)); await A.page.waitForSelector('.eq-campo');
  ok('editar um treino antigo: "Sem tênis" marcado (nada é atribuído sozinho)', (await A.page.getByRole('button', { name: 'Sem tênis' }).getAttribute('aria-pressed')) === 'true');

  console.log('\n== Hoje: card no limite, aposentar ==');
  await A.page.goto(url('hoje')); await A.page.waitForSelector('.main > *'); await A.page.waitForTimeout(300);
  ok('abaixo do limite (551): sem card no Hoje', await A.page.locator('.eq-aviso').count() === 0);
  await A.page.goto(url('mais/equipamentos')); await A.page.getByRole('button', { name: 'Editar' }).click();
  await A.page.fill('#eq_km', '600'); await A.page.getByRole('button', { name: 'Salvar' }).click();
  await A.page.goto(url('hoje')); await A.page.waitForSelector('.eq-aviso');
  const card = await A.page.locator('.eq-aviso').innerText();
  ok('no limite: card "Par de teste passou dos 600 km" com "Ver equipamentos"', /Par de teste passou dos 600 km/.test(card) && /606 km\. Hora de trocar o par\./.test(card) && await A.page.locator('.eq-aviso a[href$="#/mais/equipamentos"]').count() === 1, card.replace(/\n/g, ' · '));
  await shot(A.page, 'eq-hoje-390.png', false);
  await A.page.goto(url('mais/equipamentos'));
  ok('card do tênis: "Chegou ao limite"', /Chegou ao limite: hora de trocar o par\./.test(await A.page.locator('.eq-card').innerText()));
  await A.page.getByRole('button', { name: 'Aposentar' }).click(); await A.page.waitForTimeout(300);
  S = await est(A.page);
  ok('aposentar: sai da escolha e vai para "Aposentados", com a data', S.athlete.equipamentos[0].aposentado === true && /Aposentados e trocas anteriores/.test(await A.page.locator('.main').innerText()));
  await A.page.goto(url('hoje')); await A.page.waitForSelector('.main > *'); await A.page.waitForTimeout(300);
  ok('aposentado: o card some do Hoje', await A.page.locator('.eq-aviso').count() === 0);

  console.log('\n== Bike: pneus e corrente ==');
  await A.page.goto(url('mais/equipamentos')); await A.page.getByRole('button', { name: 'Cadastrar a bike' }).click();
  await A.page.waitForSelector('.eq-peca');
  ok('bike cadastrada: pneus e corrente com km desde o cadastro, sem limite nem aviso', await A.page.locator('.eq-peca').count() === 2 && await A.page.locator('.eq-bike .eq-barra').count() === 0);
  await novoTreino(A.page, { dist: 30, dur: '1:10:00', bike: true, date: '2026-11-19' });
  ok('pedal: a bike vem escolhida, com os km das peças', (await A.page.getByRole('button', { name: 'Bike', exact: true }).last().getAttribute('aria-pressed')) === 'true' && /Pneus 30 km · Corrente 30 km desde a troca/.test(await A.page.locator('.eq-campo').innerText()));
  await A.page.getByRole('button', { name: 'Salvar bike' }).click(); await A.page.waitForTimeout(500);
  await A.page.goto(url('mais/equipamentos')); await A.page.waitForSelector('.eq-peca');
  ok('os 30 km do pedal entram nos pneus e na corrente', (await A.page.locator('.eq-peca').allInnerTexts()).every((x) => /\n30\n?\s*km desde o cadastro/.test(x)));
  await A.page.locator('.eq-peca', { hasText: 'Corrente' }).getByRole('button', { name: 'Troquei' }).click(); await A.page.waitForTimeout(300);
  S = await est(A.page);
  const bike = S.athlete.equipamentos.find((e) => e.tipo === 'bike');
  ok('"Troquei" guarda a troca e zera a corrente (os pneus seguem)', bike.pecas.corrente.trocas.length === 1 && /^0\s*km desde a troca/.test((await A.page.locator('.eq-peca', { hasText: 'Corrente' }).innerText()).split('\n')[1] + ' ' + (await A.page.locator('.eq-peca', { hasText: 'Corrente' }).innerText()).split('\n')[2]) || /\n0\n/.test(await A.page.locator('.eq-peca', { hasText: 'Corrente' }).innerText()));
  await shot(A.page, 'eq-bike-390.png');
  await A.page.goto(url('mais/livro')); await A.page.waitForSelector('text=Km do equipamento');
  ok('Livro: verbete "Km do equipamento"', await A.page.locator('details:has-text("Km do equipamento")').count() === 1);
  ok('Mais: item "Equipamentos"', await (async () => { await A.page.goto(url('mais')); return (await A.page.locator('a[href$="#/mais/equipamentos"]').count()) >= 1; })());
  ok('sem erros no celular', !A.errors.length, A.errors.join(' | '));

  console.log('\n== computador e tema claro ==');
  const st2 = JSON.parse(payload); st2.athlete.equipamentos = [{ id: 'tx', tipo: 'tenis', nome: 'Par de teste', kmInicial: 300, limiteKm: 600, criadoEm: '2026-11-01', v: 1 }, { id: 'bx', tipo: 'bike', nome: 'Bike', criadoEm: '2026-06-01', pecas: { pneus: { trocas: [] }, corrente: { trocas: ['2026-07-12'] } }, v: 1 }];
  const B = await device(1440, 900, { estado: JSON.stringify(st2) });
  await B.page.goto(url('mais/equipamentos')); await B.page.waitForSelector('.eq-card');
  ok('computador: abre com o catálogo e o trilho tem "Equipamentos"', await B.page.locator('.rail a[href$="#/mais/equipamentos"]').count() === 1 && /300\s*de 600 km/.test(await B.page.locator('.eq-card').innerText()));
  await shot(B.page, 'eq-1440.png');
  const C = await device(390, 844, { tema: 'light', estado: JSON.stringify(st2) });
  await C.page.goto(url('mais/equipamentos')); await C.page.waitForSelector('.eq-card');
  await shot(C.page, 'eq-390-claro.png');
  ok('sem emoji; sem erros no computador e no claro', !/\p{Extended_Pictographic}/u.test(await C.page.locator('.main').innerText()) && !B.errors.length && !C.errors.length, [...B.errors, ...C.errors].join(' | '));
} catch (e) { fail++; console.log('  ✗ erro: ' + e.message); }
await browser.close(); vite.kill();
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
