// Retrospectiva do ciclo e Stories (Fase 5 · Etapa 5) num Chromium real.
// A: ciclo em andamento ("até agora"): blocos iguais ao módulo, barras, grade, sem card no Hoje,
//    link no Ciclo de prova. B: dia 4 depois da prova: card no Hoje, capa com o tempo, plano × real,
//    tênis, 6 Stories 1080×1920 em até 3 s, sem segmento nem mapa, salvar todos de uma vez ou baixar.
// Prints em 390 e 1440 px se SHOTS apontar uma pasta. Uso: node scripts/retrospectiva-app.mjs
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_TZ, GOLDEN_NOW } from '../analise/golden/env.mjs';
import { retrospectiva, cardsStories, hms } from '../analise/retrospectiva.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const base = JSON.parse(readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8'));
const HOJE = GOLDEN_NOW.slice(0, 10);
// A: o ciclo do seed, ainda sem prova
const stA = structuredClone(base);
// B: prova em 15/11 (o longão vira a prova), tempo-alvo e um tênis usado no ciclo
const stB = structuredClone(base);
const pv = stB.workouts.find((w) => w.date === '2026-11-15' && w.modal !== 'bike'); pv.type = 'prova';
stB.race = { ...stB.race, name: 'Prova de teste', type: 'meia', date: '2026-11-15', distKm: pv.distKm, goal: 'time', targetSec: pv.durationSec + 120, strategy: 'constante', startTime: '06:00', updatedAt: '2026-11-01T00:00:00Z' };
stB.athlete.equipamentos = [{ id: 'tR', tipo: 'tenis', nome: 'Par do ciclo', kmInicial: 200, limiteKm: 600, criadoEm: '2026-09-01', v: 1 }];
stB.workouts.filter((w) => w.modal !== 'bike' && w.date >= '2026-10-01').forEach((w) => { w.gearId = 'tR'; });
// segmento sintético que melhorou: aparece na tela, nunca nos Stories
stB.athlete.segmentos = [{ id: 'sX', modal: 'corrida', nome: 'Trecho sintético', distM: 800, ganhoM: 2, forma: { lat: [0, 0], lon: [0, 0] }, v: 1 }];
stB.workouts.filter((w) => w.modal !== 'bike' && w.date >= '2026-09-07' && w.date <= '2026-11-15').sort((a, b) => a.date.localeCompare(b.date)).forEach((w, i) => { w.leitura = { ...(w.leitura || {}), segmentos: [{ id: 'sX', t: 300 - i * 3, tAj: 300 - i * 3, fc: null, prec: 1 }] }; });

const SHOTS = process.env.SHOTS || null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const PORT = 5239;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
const url = (r) => `http://localhost:${PORT}/analise/#/${r}`;
async function device(st, w, h, tema = 'dark', share = null) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: GOLDEN_TZ, locale: 'pt-BR', deviceScaleFactor: SHOTS ? 2 : 1, acceptDownloads: true });
  await ctx.addInitScript(([pl, t, sh]) => {
    if (!sessionStorage.getItem('__d')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', pl); localStorage.setItem('apex.theme', t); sessionStorage.setItem('__d', '1'); }
    if (sh === 'varios') { window.__shared = []; navigator.canShare = (d) => !!(d && d.files); navigator.share = async (d) => { window.__shared.push(d.files.map((f) => f.name + ':' + f.type)); }; }
    if (sh === 'nenhum') { navigator.canShare = undefined; navigator.share = undefined; }
  }, [JSON.stringify(st), tema, share]);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.route(/^https:\/\//, (r) => r.abort());
  return { page, errors };
}
const shot = async (page, name, full = true) => { if (SHOTS) await page.screenshot({ path: resolve(SHOTS, name), fullPage: full }); };
const titulos = (page) => page.locator('.main h1.titulo-1, .main .retro-b h2.titulo-2').allInnerTexts();

try {
  console.log('\n== A: ciclo em andamento ("até agora") ==');
  const RA = retrospectiva({ workouts: stA.workouts, athlete: stA.athlete, race: stA.race, hoje: HOJE, segmentos: [], planoPassagens: null, metaH: null });
  const A = await device(stA, 390, 844);
  await A.page.goto(url('hoje')); await A.page.waitForSelector('.ready');
  ok('Hoje: sem card de retrospectiva antes da prova', await A.page.locator('.retro-hoje').count() === 0);
  await A.page.goto(url('mais/maratona')); await A.page.waitForSelector('a[href$="#/mais/retrospectiva"]');
  ok('Ciclo de prova: link "Retrospectiva até agora"', /Retrospectiva até agora/.test(await A.page.locator('a[href$="#/mais/retrospectiva"]').innerText()));
  await A.page.locator('a[href$="#/mais/retrospectiva"]').click(); await A.page.waitForSelector('.retro-capa');
  const tA = await titulos(A.page);
  ok('blocos e títulos iguais ao módulo, na ordem', JSON.stringify(tA) === JSON.stringify(RA.blocos.map((b) => b.titulo)), tA.join(' | '));
  ok('capa: "N semanas até agora" e a nota da versão parcial', /semanas até agora\.$/.test(tA[0]) && /Versão até agora/.test(await A.page.locator('.retro-capa').innerText()));
  const vol = RA.blocos.find((b) => b.tipo === 'volume');
  ok('volume: uma barra por semana, o pico em destaque', await A.page.locator('.retro-barras span').count() === vol.barras.length && await A.page.locator('.retro-barras span.on').count() === 1);
  const cons = RA.blocos.find((b) => b.tipo === 'consistencia');
  ok('consistência: grade com as semanas do ciclo e legenda em palavras', await A.page.locator('.retro-sem .csw').count() === cons.total && /consistente · contorno âmbar: parcial/.test(await A.page.locator('.main').innerText()));
  ok('sem a prova, sem tênis e sem segmentos: esses blocos não aparecem', !/A PROVA|Tênis|Segmentos/i.test((await A.page.locator('.retro-b .cap').allInnerTexts()).join(' ')));
  ok('"Gerar Stories" é a única ação principal', await A.page.locator('.main .btn-primary').count() === 1 && await A.page.locator('.main .btn-primary').innerText() === 'Gerar Stories');
  await shot(A.page, 'retro-390.png');
  ok('sem erros', !A.errors.length, A.errors.join(' | '));

  console.log('\n== B: 4 dias depois da prova ==');
  const B = await device(stB, 390, 844, 'dark', 'varios');
  await B.page.goto(url('hoje')); await B.page.waitForSelector('.retro-hoje');
  ok('Hoje: "Sua retrospectiva do ciclo está pronta" com "Ver retrospectiva"', /Sua retrospectiva do ciclo está pronta[\s\S]*Ver retrospectiva/.test(await B.page.locator('.retro-hoje').innerText()));
  await shot(B.page, 'retro-hoje-390.png', false);
  await B.page.locator('.retro-hoje').click(); await B.page.waitForSelector('.retro-capa');
  ok('o card abre a retrospectiva', B.page.url().endsWith('#/mais/retrospectiva'));
  await B.page.waitForSelector('.retro-tbl');
  const tB = await titulos(B.page);
  ok('capa: "Você terminou a Prova de teste em …, 2 min abaixo do plano."', /^Você terminou a Prova de teste em \dh\d\d, 2 min abaixo do plano\.$/.test(tB[0]), tB[0]);
  const linhas = await B.page.locator('.retro-tbl tbody tr').allInnerTexts();
  ok('a prova: tabela Passagem · Plano · Real, com a chegada no tempo da prova', linhas.length >= 2 && new RegExp('Chegada\\s+' + hms(stB.race.targetSec) + '\\s+' + hms(pv.durationSec)).test(linhas[linhas.length - 1]), linhas.join(' | '));
  const txtB = await B.page.locator('.main').innerText();
  ok('segmentos e tênis no mesmo bloco, com o aviso de que segmentos não vão aos Stories', /SEGMENTOS E TÊNIS/i.test(txtB) && /Trecho sintético/.test(txtB) && /Par do ciclo/.test(txtB) && /não entram nos Stories/.test(txtB));
  await shot(B.page, 'retro-prova-390.png');
  await B.page.getByRole('button', { name: 'Gerar Stories' }).click();
  await B.page.waitForSelector('.retro-prev img', { timeout: 10000 });
  const ms = await B.page.evaluate(() => window.__apexRetroMs);
  const imgs = await B.page.evaluate(() => window.__apexRetroImg);
  ok('6 Stories gerados em até 3 s', imgs.length === 6 && ms <= 3000, imgs.length + ' cards em ' + ms + ' ms');
  ok('todos 1080×1920', imgs.every((x) => x.W === 1080 && x.H === 1920));
  ok('ordem dos cards: capa, volume, consistência, recordes, prova, tênis (sem segmentos)', imgs.map((x) => x.tipos.join('+')).join() === 'capa,volume,consistencia,recordes,prova,tenis');
  const alts = await B.page.locator('.retro-prev img').evaluateAll((l) => l.map((i) => i.alt));
  ok('cada card tem texto alternativo; nenhum cita o segmento', alts.length === 6 && alts.every((a) => a.length > 20) && !alts.some((a) => /Trecho sintético/.test(a)), alts[1]);
  if (SHOTS) {
    const srcs = await B.page.locator('.retro-prev img').evaluateAll((l) => l.map((i) => i.src));
    for (let i = 0; i < srcs.length; i++) { const b64 = await B.page.evaluate(async (u) => { const r = await fetch(u); const b = new Uint8Array(await r.arrayBuffer()); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); }, srcs[i]); writeFileSync(resolve(SHOTS, 'story-' + (i + 1) + '.png'), Buffer.from(b64, 'base64')); }
  }
  await B.page.getByRole('button', { name: /Salvar os 6 cards/ }).click(); await B.page.waitForTimeout(300);
  const shared = await B.page.evaluate(() => window.__shared);
  ok('salvar: os 6 de uma vez pelo menu nativo, em PNG', shared.length === 1 && shared[0].length === 6 && shared[0].every((f) => /\.png:image\/png$/.test(f)), JSON.stringify(shared));
  ok('sem erros', !B.errors.length, B.errors.join(' | '));
  const RB = retrospectiva({ workouts: stB.workouts, athlete: stB.athlete, race: stB.race, hoje: HOJE, segmentos: stB.athlete.segmentos, planoPassagens: [], metaH: null });
  ok('o módulo concorda: 7 blocos e 6 Stories', RB.blocos.length === 7 && cardsStories(RB).length === 6);

  console.log('\n== sem menu nativo: baixa os arquivos ==');
  const C = await device(stB, 390, 844, 'dark', 'nenhum');
  await C.page.goto(url('mais/retrospectiva')); await C.page.waitForSelector('.retro-capa');
  await C.page.getByRole('button', { name: 'Gerar Stories' }).click(); await C.page.waitForSelector('.retro-prev img');
  const downs = []; C.page.on('download', (d) => downs.push(d.suggestedFilename()));
  await C.page.getByRole('button', { name: /Salvar os 6 cards/ }).click(); await C.page.waitForTimeout(800);
  ok('baixa os 6 arquivos', downs.length === 6 && downs[0] === 'apex-retrospectiva-1.png', downs.join(','));

  console.log('\n== computador, tema claro e Livro ==');
  const D = await device(stB, 1440, 900);
  await D.page.goto(url('mais/retrospectiva')); await D.page.waitForSelector('.retro-tbl'); await shot(D.page, 'retro-1440.png', false);
  await D.page.goto(url('hoje')); await D.page.waitForSelector('.retro-hoje'); await shot(D.page, 'retro-hoje-1440.png', false);
  const L = await device(stB, 390, 844, 'light');
  await L.page.goto(url('mais/retrospectiva')); await L.page.waitForSelector('.retro-tbl'); await shot(L.page, 'retro-390-claro.png');
  ok('sem emoji; sem erros no computador e no claro', !/\p{Extended_Pictographic}/u.test(await L.page.locator('.main').innerText()) && !C.errors.length && !D.errors.length && !L.errors.length, [...C.errors, ...D.errors, ...L.errors].join(' | '));
  await L.page.goto(url('mais/livro')); await L.page.waitForSelector('text=Retrospectiva do ciclo');
  ok('Livro: verbete "Retrospectiva do ciclo"', await L.page.locator('details:has-text("Retrospectiva do ciclo")').count() === 1);
} catch (e) { fail++; console.log('  ✗ erro: ' + e.message); }
await browser.close(); vite.kill();
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
