// Resumo pós-treino e Progresso › Corpo (Fase 5 · Etapa 4) num Chromium real.
// Resumo: abre ao salvar (e ao completar do Garmin), mostra só as mudanças reais, "Ver o treino"
// e "Compartilhar" funcionam, fechar volta ao Hoje; tempo até abrir. Corpo: contagem por região,
// linha do tempo, sem alerta. Prints em 390 e 1440 px se SHOTS apontar uma pasta.
// Uso: node scripts/resumo-app.mjs
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_TZ, GOLDEN_NOW } from '../analise/golden/env.mjs';
import { contagem } from '../analise/corpo.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const st0 = JSON.parse(readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8'));
st0.athlete.equipamentos = [{ id: 'tA', tipo: 'tenis', nome: 'Par de teste', kmInicial: 530, limiteKm: 600, criadoEm: '2026-11-01', v: 1 }];
st0.athlete.treino = { ...(st0.athlete.treino || {}), metaSemanalH: 0.5 };
// registros do mapa do corpo em alguns treinos recentes (sintéticos)
const runs = st0.workouts.filter((w) => w.modal !== 'bike').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
const REG = [[{ regiao: 'canela', lado: 'e', int: 3 }], [{ regiao: 'canela', lado: 'e', int: 4 }, { regiao: 'lombar', lado: null, int: 2 }], [], [{ regiao: 'canela', lado: 'e', int: 2 }], [{ regiao: 'joelho', lado: 'd', int: 1 }], []];
runs.forEach((w, i) => { w.dorRegioes = REG[i]; });
const payload = JSON.stringify(st0);
const SHOTS = process.env.SHOTS || null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const PORT = 5238;
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
async function salvaNovo(page, { date, dist, dur, semTenis = false }) {
  await page.goto(url('editar')); await page.waitForSelector('#f_dist');
  await page.fill('#f_date', date); await page.fill('#f_dist', String(dist)); await page.fill('#f_dur', dur);
  if (semTenis) await page.getByRole('button', { name: 'Sem tênis' }).click();
  const t0 = Date.now();
  await page.getByRole('button', { name: 'Salvar treino' }).click();
  await page.waitForSelector('.res-tit', { timeout: 10000 });
  return Date.now() - t0;
}

try {
  console.log('\n== Resumo: abre ao salvar ==');
  const A = await device(390, 844);
  // semana de 16/11 sem treino até 19/11; meta 0,5 h: este treino deixa a semana consistente
  const ms = await salvaNovo(A.page, { date: '2026-11-19', dist: 6, dur: '33:00' });
  ok('salvar um treino novo abre o resumo (#/treino/<id>/resumo)', /#\/treino\/[^/]+\/resumo$/.test(A.page.url()), A.page.url().split('#')[1]);
  ok('abre em até 300 ms depois de salvar', ms <= 300, ms + ' ms');
  const tit = await A.page.locator('.res-tit').innerText();
  const lista = await A.page.locator('.res-lista').innerText();
  ok('"O que mudou": semana consistente e o tênis, nesta ordem', /Semana consistente: 0h33 de 0h30 de meta/.test(lista) && /Par de teste: 536 de 600 km/.test(lista) && lista.indexOf('Semana') < lista.indexOf('Par de teste'), lista.replace(/\n/g, ' · '));
  ok('título-conclusão pela regra (semana consistente)', /^Fácil \/ rodagem que fechou a semana consistente/.test(tit) || /que fechou a semana consistente/.test(tit), tit);
  ok('cada item leva ao lugar certo', await A.page.locator('.res-lista a[href$="#/progresso/consistencia"]').count() === 1 && await A.page.locator('.res-lista a[href$="#/mais/equipamentos"]').count() === 1);
  ok('"Ver o treino" é a ação principal; "Compartilhar" a secundária', await A.page.locator('.res-acoes a.btn-primary', { hasText: 'Ver o treino' }).count() === 1 && await A.page.locator('.res-acoes a.btn.quiet', { hasText: 'Compartilhar' }).count() === 1);
  await shot(A.page, 'resumo-390.png');
  const wid = A.page.url().split('/').slice(-2)[0];
  await A.page.getByRole('link', { name: 'Ver o treino' }).click();
  await A.page.waitForSelector('.tv-top');
  ok('"Ver o treino" abre o treino', A.page.url().endsWith('#/treino/' + wid));
  await A.page.goto(url('treino/' + wid + '/resumo')); await A.page.waitForSelector('.res-tit');
  await A.page.getByRole('link', { name: 'Compartilhar' }).click(); await A.page.waitForSelector('.share', { timeout: 15000 });
  ok('"Compartilhar" abre o compartilhamento', A.page.url().endsWith('#/compartilhar/' + wid));
  await A.page.goto(url('treino/' + wid + '/resumo')); await A.page.waitForSelector('.res-tit');
  await A.page.getByRole('link', { name: 'Fechar e voltar ao Hoje' }).click();
  ok('fechar volta ao Hoje', /#\/hoje$/.test(A.page.url()));

  console.log('\n== Resumo sem nenhuma mudança ==');
  await salvaNovo(A.page, { date: '2026-11-20', dist: 3, dur: '20:00', semTenis: true });
  const sem = await A.page.locator('.main').innerText();
  ok('sem mudanças: a seção diz isso em uma linha', /Nada mudou nos seus números com este treino\./.test(sem) && await A.page.locator('.res-lista').count() === 0);
  ok('editar um treino salvo volta ao treino (não abre o resumo)', await (async () => { await A.page.goto(url('editar/' + wid)); await A.page.waitForSelector('#f_dist'); await A.page.getByRole('button', { name: 'Salvar treino' }).click(); await A.page.waitForTimeout(400); return A.page.url().endsWith('#/treino/' + wid); })());
  ok('sem erros', !A.errors.length, A.errors.join(' | '));

  console.log('\n== Progresso › Corpo ==');
  const B = await device(390, 844);
  await B.page.goto(url('progresso/corpo')); await B.page.waitForSelector('.corpo-box');
  const hoje = GOLDEN_NOW.slice(0, 10); const d90 = new Date(hoje + 'T12:00:00'); d90.setDate(d90.getDate() - 90);
  const esp = contagem(st0.workouts, { de: d90.toISOString().slice(0, 10), ate: hoje });
  const t2 = await B.page.locator('h2.titulo-2').innerText();
  ok('título: a região que mais doeu, "N de M treinos"', t2 === 'Canela esquerda foi a que mais doeu: ' + esp.top.n + ' de ' + esp.treinos + ' treinos.', t2);
  ok('contagem por região igual ao módulo (aria-label)', (await B.page.locator('.corpo-r[aria-label^="Canela esquerda:"]').getAttribute('aria-label')) === 'Canela esquerda: ' + esp.vezes.canela_e + ' vezes' && (await B.page.locator('.corpo-r[aria-label^="Lombar:"]').getAttribute('aria-label')) === 'Lombar: 1 vez');
  ok('legenda em palavras: 1–2 vezes, 3–5, 6 ou mais', /1–2 vezes\s*3–5\s*6 ou mais/.test(await B.page.locator('.legenda-corpo').innerText()));
  await B.page.locator('.corpo-r[aria-label^="Canela esquerda:"]').click();
  const lin = await B.page.locator('.corpo-linha').getAttribute('aria-label');
  ok('tocar na região: linha do tempo com data e intensidade, em ordem', lin === 'Intensidade ao longo do tempo: ' + esp.linhas.canela_e.map((x) => +x.date.slice(8) + ' ' + ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+x.date.slice(5, 7) - 1] + ' dor ' + x.int).join(', '), lin);
  const txt = await B.page.locator('.main').innerText();
  ok('rodapé fixo e nenhum alerta nem diagnóstico', /Registros só dos dias de treino\. O app mostra o padrão; não faz diagnóstico\./.test(txt) && !/procure|lesão provável|risco de lesão|alerta/i.test(txt) && await B.page.locator('.main [role="alert"]').count() === 0);
  await shot(B.page, 'corpo-390.png');
  await B.page.getByRole('radio', { name: '30 dias' }).click();
  ok('o período filtra (30 dias)', /Últimos 30 dias · \d+ treinos? registrados?/.test(await B.page.locator('.main').innerText()));
  await B.page.goto(url('progresso')); await B.page.waitForSelector('a[href$="#/progresso/corpo"]');
  ok('Progresso: card "Corpo"', await B.page.locator('a[href$="#/progresso/corpo"]').count() === 1);
  await B.page.goto(url('mais/livro')); await B.page.waitForSelector('text=O que mudou');
  ok('Livro: "O que mudou" e "Corpo (frequência de dor)"', await B.page.locator('details:has-text("O que mudou")').count() >= 1 && await B.page.locator('details:has-text("Corpo (frequência de dor)")').count() === 1);
  const C = await device(1440, 900);
  await salvaNovo(C.page, { date: '2026-11-19', dist: 6, dur: '33:00' }); await shot(C.page, 'resumo-1440.png', false);
  await C.page.goto(url('progresso/corpo')); await C.page.waitForSelector('.corpo-box'); await C.page.locator('.corpo-r[aria-label^="Canela esquerda:"]').click(); await shot(C.page, 'corpo-1440.png', false);
  const D = await device(390, 844, 'light');
  await D.page.goto(url('progresso/corpo')); await D.page.waitForSelector('.corpo-box'); await shot(D.page, 'corpo-390-claro.png');
  ok('sem emoji; sem erros no computador e no claro', !/\p{Extended_Pictographic}/u.test(await D.page.locator('.main').innerText()) && !B.errors.length && !C.errors.length && !D.errors.length, [...B.errors, ...C.errors, ...D.errors].join(' | '));
} catch (e) { fail++; console.log('  ✗ erro: ' + e.message); }
await browser.close(); vite.kill();
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
