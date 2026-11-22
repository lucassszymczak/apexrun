// Fase 5 · Etapa 6: acabamento das telas da fase (Hoje com os avisos, Completar, Equipamentos,
// Resumo, Progresso › Corpo, Retrospectiva, Livro) em 390 px escuro, 1440 px e 390 px claro:
// sem emoji, ≤ 1 ação magenta, nomes e rótulos, th scope, alvos de 44 px; teclado no mapa do
// corpo; movimento reduzido; desempenho (frase ≤ 20 ms, Resumo ≤ 300 ms, 6 Stories ≤ 3 s com o
// processador 4× mais lento); privacidade dos Stories. Uso: node scripts/fase5-telas.mjs
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { GOLDEN_TZ, GOLDEN_NOW } from '../analise/golden/env.mjs';
import { lerFrase } from '../analise/fala.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };

// estado sintético: prova em 15/11 (4 dias antes de "hoje"), tênis perto do limite, bike, regiões de dor e um segmento
const st = JSON.parse(readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8'));
const runs = st.workouts.filter((w) => w.modal !== 'bike').sort((a, b) => a.date.localeCompare(b.date));
const pv = runs.find((w) => w.date === '2026-11-15'); pv.type = 'prova';
st.race = { ...st.race, name: 'Prova de teste', type: 'meia', date: '2026-11-15', distKm: pv.distKm, goal: 'time', targetSec: pv.durationSec + 120, strategy: 'constante', startTime: '06:00', updatedAt: '2026-11-01T00:00:00Z' };
st.athlete.equipamentos = [
  { id: 'tA', tipo: 'tenis', nome: 'Par de teste', kmInicial: 300, limiteKm: 600, criadoEm: '2026-09-01', v: 1 },
  { id: 'bA', tipo: 'bike', nome: 'Bike', criadoEm: '2026-09-01', pecas: { pneus: { trocas: [] }, corrente: { trocas: [], limiteKm: 3000 } }, v: 1 },
];
runs.filter((w) => w.date >= '2026-10-01').forEach((w) => { w.gearId = 'tA'; });
const REG = [[{ regiao: 'canela', lado: 'e', int: 3 }], [{ regiao: 'canela', lado: 'e', int: 5 }, { regiao: 'lombar', lado: null, int: 2 }], [], [{ regiao: 'joelho', lado: 'd', int: 8 }]];
runs.slice(-4).forEach((w, i) => { w.dorRegioes = REG[i]; });
st.athlete.segmentos = [{ id: 'sX', modal: 'corrida', nome: 'Trecho sintético', distM: 800, ganhoM: 2, forma: { lat: [0, 0], lon: [0, 0] }, v: 1 }];
runs.filter((w) => w.date >= '2026-09-07' && w.date <= '2026-11-15').forEach((w, i) => { w.leitura = { ...(w.leitura || {}), segmentos: [{ id: 'sX', t: 300 - i * 3, tAj: 300 - i * 3, fc: null, prec: 1 }] }; });
const ult = runs[runs.length - 1], antigo = runs[0];
const payload = JSON.stringify(st);
const ROTAS = ['hoje', 'editar', 'editar/' + antigo.id, 'mais/equipamentos', 'treino/' + ult.id + '/resumo', 'progresso/corpo', 'mais/retrospectiva', 'mais/maratona', 'mais/livro'];

const PORT = 5240;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
const url = (r) => `http://localhost:${PORT}/analise/#/${r}`;
async function device(w, h, { tema = 'dark', share = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: GOLDEN_TZ, locale: 'pt-BR' });
  await ctx.addInitScript(([p, t, sh]) => {
    if (!sessionStorage.getItem('__d')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', p); localStorage.setItem('apex.theme', t); sessionStorage.setItem('__d', '1'); }
    if (sh) { navigator.canShare = () => true; navigator.share = async () => {}; }
  }, [payload, tema, share]);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|AJAXError|mapa/i.test(m.text())) errors.push(m.text()); });
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.route(/^https:\/\//, (r) => r.abort());
  return { ctx, page, errors };
}
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u;
async function checa(page) {
  return page.evaluate(() => {
    const mg = getComputedStyle(document.documentElement).getPropertyValue('--magenta').trim();
    const hex = (h) => { const x = parseInt(h.replace('#', ''), 16); return `rgb(${x >> 16}, ${(x >> 8) & 255}, ${x & 255})`; };
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const main = document.querySelector('.main') || document.body;
    const ctrls = [...main.querySelectorAll('a, button, [role="radio"], input, select, summary')].filter(vis);
    const magenta = [...document.querySelectorAll('a, button')].filter((el) => vis(el) && !el.closest('nav, .bottomnav') && getComputedStyle(el).backgroundColor === hex(mg)).length;
    const pequenos = ctrls.filter((el) => { const r = el.getBoundingClientRect(); const af = getComputedStyle(el, '::after'); const extra = parseFloat(af.top) < 0 ? -2 * parseFloat(af.top) : 0; return el.tagName !== 'INPUT' && r.height + extra < 43.5 && !el.closest('.legend, .hint, p, td, .s, figcaption, .bl-head, nav, .maplibregl-ctrl, .tv-legend') && !el.classList.contains('kpi') && !el.classList.contains('chip') && !el.classList.contains('corpo-r'); })
      .map((el) => (el.getAttribute('aria-label') || el.innerText || el.tagName).trim().slice(0, 30) + ' ' + Math.round(el.getBoundingClientRect().height) + 'px');
    const semNome = [...main.querySelectorAll('button, a')].filter((el) => vis(el) && !(el.innerText || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')).length;
    const thSemScope = [...main.querySelectorAll('th')].filter((th) => !th.getAttribute('scope')).length;
    const campoSemRotulo = [...main.querySelectorAll('input:not([type=hidden]):not(.sr-only), textarea')].filter((i) => vis(i) && !(i.id && document.querySelector('label[for="' + i.id + '"]')) && !i.closest('label') && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby')).length;
    const imgSemAlt = [...main.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length;
    return { magenta, pequenos, semNome, thSemScope, campoSemRotulo, imgSemAlt, texto: document.querySelector('.app').innerText };
  });
}

try {
  console.log('\n== desempenho (Node) ==');
  const eq = st.athlete.equipamentos; const fr = 'RPE 7, dormi 7 e meia, canela esquerda 3 e lombar 2, com o Par de teste';
  for (let i = 0; i < 20; i++) lerFrase(fr, { equipamentos: eq });
  const ts = []; for (let i = 0; i < 200; i++) { const t0 = performance.now(); lerFrase(fr, { equipamentos: eq }); ts.push(performance.now() - t0); }
  ts.sort((a, b) => a - b);
  ok('entender a frase em até 20 ms (p95 de 200 leituras)', ts[190] <= 20, 'p95 ' + ts[190].toFixed(2) + ' ms, máx ' + ts[199].toFixed(2) + ' ms');

  for (const [w, h, nome, tema] of [[390, 844, 'celular', 'dark'], [1440, 900, 'computador', 'dark'], [390, 844, 'celular claro', 'light']]) {
    console.log(`\n== ${nome} (${w} px) ==`);
    const { page, errors } = await device(w, h, { tema });
    const prob = [];
    for (const r of ROTAS) {
      await page.goto(url(r)); await page.waitForSelector('.main > *', { state: 'attached', timeout: 15000 }); await page.waitForTimeout(r === 'mais/retrospectiva' ? 800 : 400);
      const c = await checa(page);
      { const m = c.texto.match(new RegExp('.{0,20}' + EMOJI.source + '.{0,10}', 'u')); if (m) prob.push(r + ': emoji em "' + m[0].replace(/\n/g, ' ') + '"'); }
      if (c.magenta > 1) prob.push(r + ': ' + c.magenta + ' ações magenta');
      if (c.semNome) prob.push(r + ': ' + c.semNome + ' botão sem nome');
      if (c.thSemScope) prob.push(r + ': ' + c.thSemScope + ' th sem scope');
      if (c.campoSemRotulo) prob.push(r + ': ' + c.campoSemRotulo + ' campo sem rótulo');
      if (c.imgSemAlt) prob.push(r + ': ' + c.imgSemAlt + ' imagem sem alt');
      if (w === 390 && c.pequenos.length) prob.push(r + ': alvo < 44 px → ' + c.pequenos.slice(0, 4).join(', '));
    }
    ok(nome + ': ' + ROTAS.length + ' telas sem emoji, ≤ 1 ação magenta, nomes, rótulos, th scope' + (w === 390 ? ' e alvos de 44 px' : ''), !prob.length, prob.slice(0, 6).join(' | ') || undefined);
    if (w === 390) {
      // regiões do mapa do corpo: o desenho aprovado tem regiões menores que 44 px (joelho, pé, Aquiles).
      // O caminho equivalente de 44 px existe: a lista de regiões e os botões − e +.
      await page.goto(url('editar')); await page.waitForSelector('.corpo-r'); await page.selectOption('#corpo-sel', 'joelho_d');
      const eqv = await page.evaluate(() => { const h = (s) => [...document.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.getBoundingClientRect()); const sel = h('.corpo-lista-sel select'), pm = h('.corpo-pm'), rs = h('.corpo-r'); return { sel: sel.length && sel[0].height >= 44, pm: pm.length === 2 && pm.every((r) => r.height >= 44 && r.width >= 44), menor: Math.min(...rs.map((r) => Math.min(r.width, r.height))) }; });
      ok(nome + ': mapa do corpo com caminho equivalente de 44 px (lista e − / +)', eqv.sel && eqv.pm, 'menor região: ' + Math.round(eqv.menor) + ' px');
    }
    ok(nome + ': sem erro de página ou console', !errors.length, errors.slice(0, 2).join(' | ') || undefined);
    if (w === 1440) {
      console.log('\n== teclado (computador) ==');
      await page.goto(url('editar')); await page.waitForSelector('.corpo-r');
      const reg = page.locator('.corpo button.corpo-r[aria-label^="Panturrilha esquerda"]').first();
      await reg.focus(); await page.keyboard.press('Enter');
      const mais = page.getByRole('button', { name: /^Aumentar/ }); await mais.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
      const lab1 = await reg.getAttribute('aria-label');
      const menos = page.getByRole('button', { name: /^Diminuir/ }); await menos.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
      const lab2 = await reg.getAttribute('aria-label');
      ok('mapa do corpo só pelo teclado: marcar 2, ajustar e desmarcar', lab1 === 'Panturrilha esquerda, dor 2' && lab2 === 'Panturrilha esquerda, sem dor', lab1 + ' → ' + lab2);
      ok('anel de foco visível (2 px)', await menos.evaluate((el) => { const cs = getComputedStyle(el); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; }));
      await page.goto(url('mais/retrospectiva')); await page.waitForSelector('.retro-gerar');
      await page.getByRole('button', { name: 'Gerar Stories' }).focus(); await page.keyboard.press('Enter');
      await page.waitForSelector('.retro-prev img');
      ok('Retrospectiva: "Gerar Stories" pelo teclado leva o foco à prévia', await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('retro-prev')));
    }
  }

  console.log('\n== movimento reduzido ==');
  const A = await device(390, 844);
  await A.page.emulateMedia({ reducedMotion: 'reduce' });
  let anim = 0;
  for (const r of ROTAS) { await A.page.goto(url(r)); await A.page.waitForTimeout(300); anim += await A.page.evaluate(() => [...document.querySelectorAll('.main *')].filter((el) => { const cs = getComputedStyle(el); return cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0.01; }).length); }
  ok('nenhuma animação nas telas da fase', anim === 0, anim);

  console.log('\n== desempenho no navegador ==');
  const B = await device(390, 844, { share: true });
  await B.page.goto(url('editar')); await B.page.waitForSelector('#f_dist');
  await B.page.fill('#f_date', '2026-11-19'); await B.page.fill('#f_dist', '6'); await B.page.fill('#f_dur', '33:00');
  const t0 = Date.now(); await B.page.getByRole('button', { name: 'Salvar treino' }).click(); await B.page.waitForSelector('.res-tit'); const msRes = Date.now() - t0;
  ok('Resumo abre em até 300 ms depois de salvar', msRes <= 300, msRes + ' ms');
  const cdp = await B.ctx.newCDPSession(B.page);
  await B.page.goto(url('mais/retrospectiva')); await B.page.waitForSelector('.retro-gerar');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await B.page.getByRole('button', { name: 'Gerar Stories' }).click(); await B.page.waitForSelector('.retro-prev img', { timeout: 20000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const ms4 = await B.page.evaluate(() => window.__apexRetroMs); const imgs = await B.page.evaluate(() => window.__apexRetroImg);
  ok('6 Stories em até 3 s com o processador 4× mais lento (iPhone)', imgs.length === 6 && ms4 <= 3000, ms4 + ' ms');
  ok('Stories: 1080×1920, sem segmento, com texto alternativo', imgs.every((x) => x.W === 1080 && x.H === 1920 && !x.tipos.includes('segmentos')) && (await B.page.locator('.retro-prev img').evaluateAll((l) => l.every((i) => i.alt.length > 20 && !/Trecho sintético/.test(i.alt)))));
  const src = readFileSync(resolve(root, 'analise/app/share/retro-img.ts'), 'utf8');
  ok('o gerador dos Stories não importa trajeto, mapa nem segmentos', !/from '[^']*(track|map|db|calor|segment|fantasma)[^']*'/i.test(src) && !/getTrack|lat\b|lon\b/.test(src));
  ok('sem erros', !A.errors.length && !B.errors.length, [...A.errors, ...B.errors].join(' | '));

  console.log('\n== valores de exemplo do design ==');
  const { execSync } = await import('node:child_process');
  const achados = ['625 km', '5:27:12', 'Tênis de treino', '518 de 600'].filter((s) => { try { return execSync(`grep -rlF "${s}" analise/app analise/*.mjs src 2>/dev/null | grep -v "\\.test\\." || true`, { cwd: root }).toString().trim(); } catch { return false; } });
  ok('"625 km", "5:27:12", "Tênis de treino" e "518 de 600" não estão no código', !achados.length, achados.join(', ') || undefined);
} catch (e) { fail++; console.log('  ✗ erro: ' + e.message); }
await browser.close(); vite.kill();
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
