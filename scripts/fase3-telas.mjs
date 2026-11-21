// Fase 3 · Etapa 6: acabamento das telas novas (Progresso, Consistência, Mapa de calor, Segmentos,
// detalhe do segmento, Treino com fantasma, Relatório, Configurações › Treino, Livro) em 390 px
// escuro, 1440 px e 390 px claro: sem emoji, ≤ 1 ação magenta, nomes e rótulos, th scope, alvos de
// 44 px, teclado, movimento reduzido, modo avião (fantasma), privacidade (cards e compartilhamento)
// e desempenho (mapa de calor com 200 treinos, treino novo contra os segmentos, replay com fantasma).
// Trajetos SINTÉTICOS num lugar fictício. Uso: node scripts/fase3-telas.mjs
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_TZ, GOLDEN_NOW } from '../analise/golden/env.mjs';
import { ehPedal } from '../analise/calor.mjs';
import { calculaSegmentos, passagensDoTreino } from '../analise/segmentos.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const st = JSON.parse(readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8'));

const LAT = 10.5, LON = 20.5, M = 111195, MLON = M * Math.cos((LAT * Math.PI) / 180);
function track(vs, v, semente, passoDraw = 5) {
  let s = semente; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
  const tr = { v: 1, start: 1760000000, tzOffsetSec: -10800, hasGps: true, t: [], lat: [], lon: [], dist: [], hr: [], spd: [], alt: [], grade: [], draw: [] };
  let t = 0, d = 0;
  for (let k = 1; k < vs.length; k++) { const [x0, y0] = vs[k - 1], [x1, y1] = vs[k]; const L = Math.hypot(x1 - x0, y1 - y0); const n = Math.max(1, Math.round(L / v)); for (let j = 0; j < n; j++) { const f = j / n; tr.t.push(t); tr.lat.push(LAT + (y0 + (y1 - y0) * f + rnd() * 5) / M); tr.lon.push(LON + (x0 + (x1 - x0) * f + rnd() * 5) / MLON); tr.dist.push(d); tr.hr.push(150); tr.spd.push(v); tr.alt.push(900); tr.grade.push(0); t++; d += L / n; } }
  tr.draw = tr.t.map((_, i) => i).filter((i) => i % passoDraw === 0);
  return tr;
}
const VOLTA = [[0, 0], [1200, 0], [1200, 800], [0, 800], [0, 0]];
const corridas = st.workouts.filter((w) => !ehPedal(w) && !w.indoor).sort((a, b) => a.date.localeCompare(b.date));
const tracks = {}; const vel = [2.9, 3.2, 3.0, 3.05, 3.1, 2.95];
corridas.slice(0, 6).forEach((w, i) => { tracks[w.id] = track(VOLTA, vel[i], i + 1); w.distKm = 4.0; w.durationSec = tracks[w.id].t.length - 1; });
const alvo = corridas[5];
const payload = JSON.stringify(st);
const ROTAS = ['progresso', 'progresso/consistencia', 'progresso/calor', 'progresso/segmentos', 'SEG', 'treino/' + alvo.id, 'mais/relatorio', 'mais/treino', 'mais/livro'];

const PORT = 5232;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
const url = (r) => `http://localhost:${PORT}/analise/#/${r}`;
async function seedTracks(page, T) {
  await page.evaluate((T) => new Promise((res, rej) => { const rq = indexedDB.open('apex-performance'); rq.onsuccess = () => { const tx = rq.result.transaction('tracks', 'readwrite'); for (const [id, tr] of Object.entries(T)) tx.objectStore('tracks').put({ ...tr, id }); tx.oncomplete = () => res(); tx.onerror = rej; }; }), T);
}
async function device(w, h, { tema = 'dark', estado = payload, T = tracks } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: GOLDEN_TZ, locale: 'pt-BR' });
  await ctx.addInitScript(([p, t]) => { if (!sessionStorage.getItem('__d')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', p); localStorage.setItem('apex.theme', t); sessionStorage.setItem('__d', '1'); } }, [estado, tema]);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|AJAXError|mapa/i.test(m.text())) errors.push(m.text()); });
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.route(/^https:\/\//, (r) => r.abort());
  await page.goto(url('hoje')); await page.waitForSelector('.main > *');
  await seedTracks(page, T);
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
    const pequenos = ctrls.filter((el) => { const r = el.getBoundingClientRect(); const af = getComputedStyle(el, '::after'); const extra = el.closest('.seg') && parseFloat(af.top) < 0 ? -2 * parseFloat(af.top) : 0; return el.tagName !== 'INPUT' && r.height + extra < 43.5 && !el.closest('.legend, .hint, p, td, .s, figcaption, .bl-head, nav, .maplibregl-ctrl, .tv-legend') && !el.classList.contains('kpi') && !el.classList.contains('chip'); })
      .map((el) => (el.getAttribute('aria-label') || el.innerText || el.tagName).trim().slice(0, 30) + ' ' + Math.round(el.getBoundingClientRect().height) + 'px');
    const semNome = [...main.querySelectorAll('button, a')].filter((el) => vis(el) && !(el.innerText || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')).length;
    const thSemScope = [...main.querySelectorAll('th')].filter((th) => !th.getAttribute('scope')).length;
    const campoSemRotulo = [...main.querySelectorAll('input:not([type=hidden]):not(.sr-only)')].filter((i) => vis(i) && !(i.id && document.querySelector('label[for="' + i.id + '"]')) && !i.closest('label') && !i.getAttribute('aria-label')).length;
    return { magenta, pequenos, semNome, thSemScope, campoSemRotulo, texto: document.querySelector('.app').innerText };
  });
}
try {
  // segmentos esperados (para a rota do detalhe)
  const segEsp = calculaSegmentos(corridas.filter((w) => tracks[w.id]).map((w) => ({ w, tr: tracks[w.id] })), 'corrida');
  const segId = segEsp.lista[0].id;
  for (const [w, h, nome, tema] of [[390, 844, 'celular', 'dark'], [1440, 900, 'computador', 'dark'], [390, 844, 'celular claro', 'light']]) {
    console.log(`\n== ${nome} (${w} px) ==`);
    const { page, errors } = await device(w, h, { tema });
    await page.goto(url('progresso/segmentos')); await page.waitForSelector('.seg-item', { timeout: 30000 });
    const prob = [];
    for (const r0 of ROTAS) {
      const r = r0 === 'SEG' ? 'progresso/segmentos/' + segId : r0;
      await page.goto(url(r)); await page.waitForSelector('.main > *', { state: 'attached', timeout: 15000 }); await page.waitForTimeout(r.startsWith('treino') || r.endsWith('calor') ? 1200 : 400);
      const c = await checa(page);
      if (EMOJI.test(c.texto)) prob.push(r + ': emoji');
      if (c.magenta > 1) prob.push(r + ': ' + c.magenta + ' ações magenta');
      if (c.semNome) prob.push(r + ': ' + c.semNome + ' botão sem nome');
      if (c.thSemScope) prob.push(r + ': ' + c.thSemScope + ' th sem scope');
      if (c.campoSemRotulo) prob.push(r + ': ' + c.campoSemRotulo + ' campo sem rótulo');
      if (w === 390 && c.pequenos.length) prob.push(r + ': alvo < 44 px → ' + c.pequenos.slice(0, 4).join(', '));
    }
    ok(nome + ': ' + ROTAS.length + ' telas sem emoji, ≤ 1 ação magenta, nomes, rótulos, th scope' + (w === 390 ? ' e alvos de 44 px' : ''), !prob.length, prob.slice(0, 6).join(' | ') || undefined);
    ok(nome + ': sem erro de página ou console', !errors.length, errors.slice(0, 2).join(' | ') || undefined);
    if (w === 1440 && tema === 'dark') {
      console.log('\n== teclado (computador) ==');
      await page.goto(url('progresso/consistencia')); await page.waitForSelector('.csw');
      const b = page.locator('.csw').nth(20); await b.focus(); await page.keyboard.press('Enter');
      ok('Consistência: Enter abre a semana; anel de foco visível', await page.locator('.cs-detalhe').count() === 1 && await b.evaluate((el) => { const cs = getComputedStyle(el); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; }));
      await page.goto(url('progresso/calor')); await page.waitForSelector('.mc-teclado', { timeout: 15000 });
      const desc = await page.locator('.trackmap.calor > svg, .trackmap.calor canvas').first().getAttribute('aria-label').catch(() => null);
      ok('Mapa de calor: descrição em texto com km e a região mais frequente, sem endereço', /cerca de [\d,]+ km de ruas diferentes\. As ruas mais frequentes.* ficam (no centro|ao |a )/.test(desc || ''), desc);
      await page.getByRole('button', { name: 'Próxima rua' }).focus(); await page.keyboard.press('Enter');
      ok('Mapa de calor: "Próxima rua" pelo teclado escolhe a rua mais frequente', /Rua selecionada/.test(await page.locator('.tv-panel').innerText()) && /Rua 1 de \d+/.test(await page.locator('.mc-teclado').innerText()));
      await page.goto(url('treino/' + alvo.id)); await page.waitForSelector('.tv-replaybar .fant-btn:not([disabled])', { timeout: 20000 });
      await page.locator('.tv-replaybar .fant-btn').focus(); await page.keyboard.press('Enter');
      await page.waitForSelector('.fant-lista'); await page.locator('.fant-lista button').nth(1).focus(); await page.keyboard.press('Enter');
      ok('Fantasma: escolher pelo teclado', (await page.locator('.tv-replaybar .fant-btn').innerText()).startsWith('Fantasma:'));
      // replay a 60 quadros por segundo com o fantasma
      await page.locator('.tv-replaybar .tv-play').click();
      const fps = await page.evaluate(() => new Promise((res) => { const ts = []; const f = (t) => { ts.push(t); if (ts.length < 120) requestAnimationFrame(f); else { const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b); res({ med: d[d.length >> 1], p95: d[Math.floor(d.length * 0.95)] }); } }; requestAnimationFrame(f); }));
      ok('replay com fantasma: quadros de ~16,7 ms (60 qps)', fps.med <= 17.5, 'mediana ' + fps.med.toFixed(1) + ' ms, p95 ' + fps.p95.toFixed(1) + ' ms');
    }
  }

  console.log('\n== modo avião, movimento reduzido e privacidade ==');
  const A = await device(390, 844);
  await A.page.goto(url('treino/' + alvo.id)); await A.page.waitForSelector('.only-mob .fant-btn:not([disabled])', { timeout: 20000 });
  await A.ctx.setOffline(true);
  await A.page.locator('.only-mob .fant-btn').click(); await A.page.locator('.fant-lista button', { hasText: 'Seu melhor' }).click();
  await A.page.waitForSelector('.only-mob .fant-dif');
  ok('fantasma em modo avião: escolhe, desenha e mede com os dados do aparelho', await A.page.locator('.trackmap [aria-label^="Fantasma"]').count() === 1 && /Empatados|à frente/.test(await A.page.locator('.only-mob .fant-dif').innerText()));
  await A.ctx.setOffline(false);
  await A.page.emulateMedia({ reducedMotion: 'reduce' });
  await A.page.goto(url('treino/' + alvo.id)); await A.page.reload(); await A.page.waitForSelector('.only-mob .fant-btn');
  ok('movimento reduzido: sem play, o fantasma não anda sozinho', await A.page.locator('.tv-play').count() === 0);
  for (const r of ['progresso/consistencia', 'progresso/calor', 'progresso/segmentos']) { await A.page.goto(url(r)); await A.page.waitForTimeout(500); }
  const anim = await A.page.evaluate(() => [...document.querySelectorAll('.main *')].filter((el) => { const cs = getComputedStyle(el); return cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0.01; }).length);
  ok('movimento reduzido: sem animação nas telas novas', anim === 0, anim);
  await A.page.goto(url('compartilhar/' + alvo.id)); await A.page.waitForSelector('.share', { timeout: 15000 });
  const S = await A.page.evaluate(() => JSON.parse(localStorage.getItem('apex.analise.v1')));
  const nomes = (S.athlete.segmentos || []).map((s) => s.nome);
  const txtShare = await A.page.locator('.main').innerText();
  ok('compartilhar: nenhum segmento nem mapa de calor na tela de compartilhamento', !nomes.some((n) => txtShare.includes(n)) && !/mapa de calor|segmento/i.test(txtShare));
  const shareSrc = readdirSync(resolve(root, 'analise/app/share')).map((f) => readFileSync(resolve(root, 'analise/app/share', f), 'utf8')).join('\n') + readFileSync(resolve(root, 'analise/app/screens/Compartilhar.tsx'), 'utf8');
  ok('compartilhar: o gerador de cards não importa o mapa de calor nem os segmentos', !/calor|segmento|fantasma/i.test(shareSrc));

  console.log('\n== desempenho ==');
  // mapa de calor com 200 treinos de ~1 h (1 Hz) num processador 4× mais lento
  const T200 = {}, W200 = [];
  for (let i = 0; i < 200; i++) { const id = 'cal' + i; const dx = (i % 10) * 300, dy = Math.floor(i / 10) * 200; T200[id] = track([[dx, dy], [dx + 3000, dy], [dx + 3000, dy + 2000], [dx, dy + 2000], [dx, dy]], 2.8, i + 7, 5); W200.push({ id, date: '2026-0' + (1 + (i % 9)) + '-1' + (i % 9), modal: 'corrida', type: 'facil', distKm: 10, durationSec: 3571 }); }
  const st200 = { ...st, workouts: [...st.workouts, ...W200] };
  const mede = async (rate) => {
    const P = await device(390, 844, { estado: JSON.stringify(st200), T: T200 });
    const cdp = await P.ctx.newCDPSession(P.page); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const t0 = Date.now();
    await P.page.goto(url('progresso/calor'));
    await P.page.waitForFunction(() => /\d+ corridas · cerca de/.test(document.querySelector('.tv-panel h2')?.textContent || ''), null, { timeout: 60000 });
    const r = { ms: Date.now() - t0, h2: await P.page.locator('.tv-panel h2').innerText() };
    await P.ctx.close(); return r;
  };
  const m1 = await mede(1), m4 = await mede(4);
  ok('mapa de calor com 200 treinos de 1 h, aberto do zero: até 1 s sem desacelerar (iPhone recente); informado a 4× mais lento', m1.ms <= 1000 && /^200 corridas/.test(m1.h2), m1.ms + ' ms · 4× mais lento: ' + m4.ms + ' ms · ' + m1.h2);
  // treino novo de 1 h a 1 Hz contra 40 segmentos
  const segs40 = Array.from({ length: 40 }, (_, k) => ({ ...segEsp.lista[0], id: 's' + k, forma: { lat: segEsp.lista[0].forma.lat.map((x) => x + k * 0.002), lon: segEsp.lista[0].forma.lon } }));
  const novo = track([[0, 0], [1200, 0], [1200, 800], [0, 800], [0, 0], [1200, 0], [1200, 800], [0, 800], [0, 0], [1200, 0], [1200, 800]], 2.8, 99, 1);
  const n0 = performance.now(); const ps = passagensDoTreino(novo, segs40); const dn = performance.now() - n0;
  ok('treino novo (1 h, 1 Hz) contra 40 segmentos: até 300 ms', dn <= 300 && ps.length >= 1, dn.toFixed(0) + ' ms · ' + ps.length + ' passagem');
} catch (e) { ok('execução sem exceção', false, e && e.message); }
finally { await browser.close(); vite.kill(); }
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
