// Fase 4 · Etapa 6: checagem das telas novas (Editar ciclo, Percurso, Plano, Simulador,
// Configurações › Treino e o Hoje com "Amanhã cedo") em 390 e 1440 px:
// sem emoji, no máximo uma ação magenta, alvos de toque ≥ 44 px, botões só de ícone com nome,
// tabelas com <th scope>, foco visível no teclado, sanfona do plano pelo teclado e o tema claro.
// Uso: node scripts/fase4-telas.mjs
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_TZ } from '../analise/golden/env.mjs';
import { parseGpx, juntaPartes, reamostra, montaCourse } from '../analise/percurso.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
// estado de teste: ciclo com tempo-alvo e um percurso sintético (subida do km 13 ao 15)
let gpx = '<gpx><trk><trkseg>';
for (let x = 0; x <= 42195; x += 25) { const a = (x / 42195) * 2 * Math.PI, r = 42195 / (2 * Math.PI), k = x / 1000; gpx += `<trkpt lat="${(-25.43 + (r * Math.sin(a)) / 111195).toFixed(7)}" lon="${(-49.27 + (r * (1 - Math.cos(a))) / 100000).toFixed(7)}"><ele>${900 + Math.min(Math.max(k - 12, 0), 3) * 35}</ele></trkpt>`; }
const g = parseGpx(gpx + '</trkseg></trk></gpx>');
const { course } = montaCourse({ fonte: 'gpx', perfilBruto: reamostra(juntaPartes([{ ...g, d: null }])), kmOficiais: 42.195 });
const base = JSON.parse(readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8'));
const estado = JSON.stringify({ ...base, race: { ...base.race, goal: 'time', targetSec: 4 * 3600 + 50 * 60, strategy: 'negativa', startTime: '06:30', course } });
const ROTAS = ['hoje', 'mais/maratona', 'mais/ciclo', 'mais/percurso', 'mais/plano', 'mais/simulador', 'mais/treino', 'mais/config', 'mais/livro'];
const meteo = (url) => { const d = new URL(url).searchParams.get('start_date'); const time = Array.from({ length: 24 }, (_, h) => d + 'T' + String(h).padStart(2, '0') + ':00'); return { hourly: { time, temperature_2m: time.map((_, h) => 15 + Math.max(0, h - 6) * 2), dew_point_2m: time.map(() => 13), precipitation_probability: time.map(() => 10), wind_speed_10m: time.map(() => 8), wind_direction_10m: time.map(() => 90) } }; };

const PORT = 5221;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
async function device(w, h, tema = 'dark') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: GOLDEN_TZ, locale: 'pt-BR' });
  await ctx.addInitScript(([p, t]) => { if (!sessionStorage.getItem('__d')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', p); localStorage.setItem('apex.theme', t); sessionStorage.setItem('__d', '1'); } }, [estado, tema]);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  await page.clock.setFixedTime(new Date('2026-11-19T18:40:00-03:00'));
  await page.route(/open-meteo\.com/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(meteo(r.request().url())) }));
  await page.route(/^https:\/\/(?!.*open-meteo\.com)/, (r) => r.abort());
  return { page, errors };
}
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u;
async function checa(page) {
  return page.evaluate(() => {
    const mg = getComputedStyle(document.documentElement).getPropertyValue('--magenta').trim();
    const hex = (h) => { const x = parseInt(h.replace('#', ''), 16); return `rgb(${x >> 16}, ${(x >> 8) & 255}, ${x & 255})`; };
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const main = document.querySelector('.main') || document.body;
    const ctrls = [...main.querySelectorAll('a, button, [role="radio"], input, select, summary')].filter(vis);
    const magenta = [...document.querySelectorAll('a, button')].filter((el) => vis(el) && !el.closest('nav, .tabbar, .bottom-nav') && getComputedStyle(el).backgroundColor === hex(mg)).length; // o "+" da barra é magenta por desenho
    const pequenos = ctrls.filter((el) => { const r = el.getBoundingClientRect(); const hit = el.closest('.seg') ? r.height + 2 * (parseFloat(getComputedStyle(el, '::after').top) < 0 ? -parseFloat(getComputedStyle(el, '::after').top) : 0) : r.height; return el.tagName !== 'INPUT' && hit < 43.5 && !el.closest('.legend, .hint, p, td, .s, figcaption, .bl-head, nav') && !el.classList.contains('kpi') && !el.classList.contains('chip'); })
      .map((el) => (el.getAttribute('aria-label') || el.innerText || el.tagName).trim().slice(0, 30) + ' ' + Math.round(el.getBoundingClientRect().height) + 'px');
    const semNome = [...main.querySelectorAll('button, a')].filter((el) => vis(el) && !(el.innerText || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')).length;
    const thSemScope = [...main.querySelectorAll('th')].filter((th) => !th.getAttribute('scope')).length;
    const campoSemRotulo = [...main.querySelectorAll('input:not([type=hidden]):not(.sr-only)')].filter((i) => vis(i) && !(i.id && document.querySelector('label[for="' + i.id + '"]')) && !i.closest('label') && !i.getAttribute('aria-label')).length;
    return { magenta, pequenos, semNome, thSemScope, campoSemRotulo, texto: document.querySelector('.app').innerText };
  });
}
try {
  for (const [w, h, nome, tema] of [[390, 844, 'celular', 'dark'], [1440, 900, 'computador', 'dark'], [390, 844, 'celular claro', 'light']]) {
    console.log(`\n== ${nome} (${w} px) ==`);
    const { page, errors } = await device(w, h, tema);
    const prob = [];
    for (const r of ROTAS) {
      await page.goto(`http://localhost:${PORT}/analise/#/${r}`); await page.waitForSelector('.main > *', { state: 'attached', timeout: 15000 }); await page.waitForTimeout(400);
      const c = await checa(page);
      if (EMOJI.test(c.texto)) prob.push(r + ': emoji');
      if (c.magenta > 1) prob.push(r + ': ' + c.magenta + ' ações magenta');
      if (c.semNome) prob.push(r + ': ' + c.semNome + ' botão sem nome');
      if (c.thSemScope) prob.push(r + ': ' + c.thSemScope + ' th sem scope');
      if (c.campoSemRotulo) prob.push(r + ': ' + c.campoSemRotulo + ' campo sem rótulo');
      if (w === 390 && c.pequenos.length) prob.push(r + ': alvo < 44 px → ' + c.pequenos.slice(0, 3).join(', '));
    }
    ok(nome + ': ' + ROTAS.length + ' telas sem emoji, ≤ 1 ação magenta, nomes, rótulos, th scope' + (w === 390 ? ' e alvos de 44 px' : ''), !prob.length, prob.slice(0, 6).join(' | ') || undefined);
    ok(nome + ': sem erro de página ou console', !errors.length, errors.slice(0, 2).join(' | ') || undefined);
    if (w === 1440 && tema === 'dark') {
      // teclado: a sanfona do plano abre pelo Enter e o foco tem anel visível
      await page.goto(`http://localhost:${PORT}/analise/#/mais/plano`); await page.waitForSelector('.bl-row');
      const b = page.locator('.bl-row').first(); await b.focus(); await page.keyboard.press('Enter');
      ok('teclado: a sanfona do plano abre com Enter (aria-expanded)', (await b.getAttribute('aria-expanded')) === 'true');
      const anel = await b.evaluate((el) => { const cs = getComputedStyle(el); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; });
      ok('teclado: o foco tem anel visível', anel);
      await page.goto(`http://localhost:${PORT}/analise/#/mais/simulador`); await page.waitForSelector('.stepper');
      const mais = page.getByRole('button', { name: 'Mais 5 minutos' }); await mais.focus(); const antes = await page.locator('.stepper output').innerText(); await page.keyboard.press('Enter');
      ok('teclado: o tempo-alvo do simulador muda pelo teclado', (await page.locator('.stepper output').innerText()) !== antes);
    }
  }
  // movimento reduzido: nada de animação decorativa nas telas novas
  const { page } = await device(390, 844);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`http://localhost:${PORT}/analise/#/mais/plano`); await page.waitForSelector('.bl-row');
  const anim = await page.evaluate(() => [...document.querySelectorAll('.main *')].filter((el) => { const cs = getComputedStyle(el); return cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0.01; }).length);
  ok('movimento reduzido: sem animação no plano', anim === 0, anim + ' animações');
} catch (e) { ok('execução sem exceção', false, e && e.message); }
finally { await browser.close(); vite.kill(); }
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
