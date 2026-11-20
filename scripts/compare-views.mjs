// ============================================================================
// Confere se os NÚMEROS de cada tela do app antigo (golden de telas,
// analise/golden/<cenário>.views.json) aparecem na tela correspondente do app novo.
// Mesma data/fuso congelados e mesmos dados. Normaliza vírgula/ponto e sinais.
//
// Uso: node scripts/compare-views.mjs [seed|sintetico] [--json saida.json]
// Saída: cobertura por tela e a lista de números que não apareceram (para revisão:
// eixos de gráfico, faixa rolante removida etc. são esperados).
// ============================================================================
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_NOW, GOLDEN_TZ } from '../analise/golden/env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const scen = args.find((x) => !x.startsWith('--')) || 'sintetico';
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const { payloadFromFile } = await import('./golden-capture.mjs');
const gdir = scen === 'backup' ? resolve(root, 'fixtures/privado/golden') : resolve(root, 'analise/golden');
const gv = JSON.parse(readFileSync(resolve(gdir, scen + '.views.json'), 'utf8'));
// texto sem gráficos (eixos de SVG mudam com o desenho); cai no texto completo se o golden for antigo
const golden = gv.viewsNoCharts || gv.views;
const payload = scen === 'sintetico' ? readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8')
  : scen === 'backup' ? payloadFromFile(resolve(root, 'fixtures/privado/backup.json')) : null;

// tela antiga → rotas novas onde o conteúdo foi parar
const MAP = {
  'tab:hoje': ['hoje', 'coach'],
  'tab:treinos': ['treinos'],
  'tab:progresso': ['progresso'],
  'tab:ciclo': ['mais/maratona'],
  'tab:coach': ['coach'],
  'tab:relatorio': ['mais/relatorio'],
  'tab:recuperacao': ['mais/recuperacao'],
  'tab:forca': ['mais/forca'],
  'tab:kpis': ['mais/livro'],
  'tab:config': ['mais/config'],
  'progresso:motor': ['progresso/motor'], 'progresso:resist': ['progresso/resist'], 'progresso:mec': ['progresso/mec'],
  'progresso:carga': ['progresso/carga'], 'progresso:hidr': ['progresso/hidr'], 'progresso:recup': ['progresso/recup'],
};

// números "de verdade": 6:05, 1:53:40, 20,1, 0.0201, 145, -5,5 … (normaliza , → . e tira sinal +)
// datas não são KPIs e mudaram de formato ("08/11" → "8 nov"): saem da conta
const MESES = 'jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez';
function stripDates(t) {
  return t.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, ' ')
    .replace(new RegExp('\\b\\d{1,2}( de)? (' + MESES + ')[a-zç]*\\.?( (de )?\\d{4})?', 'gi'), ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ').replace(/\bW\d{2}\b/g, ' ').replace(/semana \d{1,2}\b(?! de)/gi, ' ');
}
function numbers(text) {
  text = stripDates(text);
  const out = new Map();
  const re = /[-−+]?\d+(?:[:.,]\d+)*/g;
  for (const m of text.matchAll(re)) {
    let t = m[0].replace('−', '-').replace(/^\+/, '').replace(/,/g, '.');
    if (/^-?0+$/.test(t)) continue;
    out.set(t, (out.get(t) || 0) + 1);
  }
  return out;
}
const PORT = 5198;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((ok, fail) => { const t = setTimeout(() => fail(new Error('vite')), 30000); vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) { clearTimeout(t); ok(); } }); });
const browser = await chromium.launch();
const report = {};
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: GOLDEN_TZ, locale: 'pt-BR' });
  await ctx.addInitScript((p) => { try { if (!sessionStorage.getItem('__cv')) { localStorage.clear(); if (p) localStorage.setItem('apex.analise.v1', p); sessionStorage.setItem('__cv', '1'); } } catch (e) {} }, payload);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.goto(`http://localhost:${PORT}/analise/#/hoje`);
  await page.waitForSelector('.main > *');
  // ids na mesma ordem de sortedWorkouts (data crescente, estável)
  const ids = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('apex.analise.v1')); return s.workouts.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).map((w) => w.id); });
  const textOf = async (route) => {
    await page.goto(`http://localhost:${PORT}/analise/#/${route}`);
    await page.waitForSelector('.main > *'); await page.waitForTimeout(120);
    // abre os detalhes recolhidos (auditoria, Livro…) para o texto entrar
    await page.evaluate(() => document.querySelectorAll('.main details').forEach((d) => { d.open = true; }));
    return page.evaluate(() => { const c = document.querySelector('.main').cloneNode(true); c.querySelectorAll('svg').forEach((n) => n.remove()); c.style.position = 'absolute'; c.style.left = '-99999px'; document.body.appendChild(c); const t = c.innerText; c.remove(); return t; });
  };
  let totalOld = 0, totalFound = 0;
  for (const [key, oldText] of Object.entries(golden)) {
    let routes = MAP[key];
    if (!routes && key.startsWith('treino:')) { const i = +/@w(\d+):/.exec(key)[1]; routes = ['treino/' + ids[i]]; }
    if (!routes) continue;
    let newText = '';
    for (const r of routes) newText += '\n' + (await textOf(r));
    const o = numbers(oldText), n = numbers(newText);
    const missing = [...o.keys()].filter((k) => !n.has(k) && !n.has(k.replace(/\.0+$/, '')) && !n.has(k + '.0') && !n.has(k.replace(/^0\./, '.')));
    totalOld += o.size; totalFound += o.size - missing.length;
    report[key] = { routes, nOld: o.size, missing };
  }
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  for (const [k, r] of Object.entries(report)) {
    const pct = r.nOld ? Math.round((1 - r.missing.length / r.nOld) * 100) : 100;
    console.log(pad(k, 26) + pad(pct + '%', 6) + (r.missing.length ? ' faltam: ' + r.missing.slice(0, 30).join('  ') : ''));
  }
  console.log(`\nTOTAL: ${totalFound}/${totalOld} números distintos das telas antigas aparecem no app novo (${Math.round(totalFound / totalOld * 100)}%)`);
  if (jsonOut) writeFileSync(resolve(root, jsonOut), JSON.stringify(report, null, 1));
} finally { await browser.close(); vite.kill(); }
