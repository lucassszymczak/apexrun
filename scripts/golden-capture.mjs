// ============================================================================
// GOLDEN MASTER — captura os números do APP ANTIGO (analise/index.html) num
// Chromium real, com fuso e "hoje" congelados (analise/golden/env.mjs).
//
// Gera, por cenário:
//   <dir>/<nome>.engine.json  snapshot do motor (analise/golden/snapshot.mjs)
//   <dir>/<nome>.views.json   texto de cada tela/aba/sistema/treino como o app
//                             antigo mostra (referência para as telas novas)
//
// Cenários:
//   seed    → app aberto sem dados (o seed de exemplo)        → analise/golden/
//   backup  → fixtures/privado/backup.json, se existir         → fixtures/privado/golden/
//             (privado: fica fora do git)
//
// Uso:  node scripts/golden-capture.mjs [seed|backup]...
// Página de origem: analise/index.html ou, depois da Etapa 1, legacy/analise-v1/index.html.
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_NOW, GOLDEN_TZ, deepDiff } from '../analise/golden/env.mjs';
import { snapshot } from '../analise/golden/snapshot.mjs';
import { findSource } from './extract-engine.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }

const LS_KEY = 'apex.analise.v1';
const ORIGIN = 'http://golden.local';

// Converte o arquivo do usuário no que estaria no localStorage.
// - Export do app (Config › Dados › Exportar): { athlete, workouts, daily } — prova,
//   plano e ciclos arquivados NÃO vão no export; o app usa os padrões.
// - Cópia crua do localStorage (opcional, mais completa): o mesmo formato do save().
export function payloadFromFile(path) {
  const p = JSON.parse(readFileSync(path, 'utf8'));
  const raw = p[LS_KEY] ? (typeof p[LS_KEY] === 'string' ? JSON.parse(p[LS_KEY]) : p[LS_KEY]) : p;
  return JSON.stringify(raw);
}

// Cenário sintético: o estado é gerado uma vez (determinístico) e salvo como fixture,
// para app antigo e motor novo partirem exatamente do mesmo dado.
const SYN_STATE = resolve(root, 'analise/golden/sintetico.state.json');
async function syntheticPayload() {
  const { buildSynthetic } = await import('../analise/golden/synthetic.mjs');
  const E = await import('../analise/engine.mjs');
  const st = buildSynthetic(E);
  const json = JSON.stringify(st);
  writeFileSync(SYN_STATE, json);
  return json;
}

export const SCENARIOS = {
  seed: { payload: () => null, outDir: resolve(root, 'analise/golden') },
  sintetico: { payload: syntheticPayload, outDir: resolve(root, 'analise/golden') },
  backup: {
    file: resolve(root, 'fixtures/privado/backup.json'),
    payload() { return payloadFromFile(this.file); },
    outDir: resolve(root, 'fixtures/privado/golden'),
  },
};

// Página mínima que roda o MOTOR NOVO com a mesma sequência de abertura do app antigo
// (load → salva o seed → vincula o sono) e tira o mesmo snapshot.
const NEW_ENGINE_PAGE = `<!doctype html><meta charset="utf-8"><script type="module">
import * as E from '/__new__/engine.mjs';
import { snapshot } from '/__new__/golden/snapshot.mjs';
try {
  const st = E.setState(E.load());
  if (st.seeded) { E.save(); delete st.seeded; }
  try { if (E.linkSleepToWorkouts() > 0) E.save(); } catch (e) {}
  window.__snap = JSON.parse(JSON.stringify(snapshot(E, st)));
} catch (e) { window.__snap = { __error: String(e && e.stack || e) }; }
</script>`;

const TABS = ['hoje', 'treinos', 'progresso', 'ciclo', 'coach', 'relatorio', 'recuperacao', 'forca', 'kpis', 'config'];
const PROG_SYS = ['motor', 'resist', 'mec', 'carga', 'hidr', 'recup'];

async function capture(name) {
  const sc = SCENARIOS[name];
  if (sc.file && !existsSync(sc.file)) { console.log(`[golden] ${name}: ${sc.file.replace(root + '/', '')} não existe — pulando`); return false; }
  const { rel, path: srcPath } = findSource();
  const srcDir = dirname(srcPath);
  const payload = await sc.payload();

  const browser = await chromium.launch();
  const context = await browser.newContext({ timezoneId: GOLDEN_TZ, locale: 'pt-BR', viewport: { width: 390, height: 844 } });
  // serve a página antiga; bloqueia toda a rede externa (CDN, clima, fontes).
  // /__new__/… serve analise/ (motor novo + snapshot) e /__new__.html roda o motor novo.
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === '/__new__.html') return route.fulfill({ status: 200, contentType: 'text/html', body: NEW_ENGINE_PAGE });
    if (url.pathname.startsWith('/__new__/')) {
      const f = resolve(root, 'analise', url.pathname.slice('/__new__/'.length));
      if (!f.startsWith(resolve(root, 'analise')) || !existsSync(f)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(f) });
    }
    const file = resolve(srcDir, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(srcDir) || !existsSync(file)) return route.fulfill({ status: 404, body: '' });
    const type = { '.html': 'text/html', '.webmanifest': 'application/manifest+json', '.png': 'image/png' }[extname(file)] || 'application/octet-stream';
    return route.fulfill({ status: 200, contentType: type, body: readFileSync(file) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.addInitScript(([key, data]) => {
    try { localStorage.clear(); if (data) localStorage.setItem(key, data); } catch (e) {}
  }, [LS_KEY, payload]);
  await page.goto(ORIGIN + '/index.html');
  await page.waitForSelector('#view');

  // 1) motor — logo após o boot (antes de qualquer tela que mude o estado, como o plano)
  const engine = await page.evaluate((src) => {
    const fn = (0, eval)('(' + src + ')');
    return fn(window, window.state);
  }, snapshot.toString());

  // 1b) MOTOR NOVO no MESMO navegador, mesmo relógio e mesmo localStorage inicial:
  //     a comparação aqui é EXATA (mesmo motor JS → mesmo ponto flutuante).
  const page2 = await context.newPage();
  page2.on('pageerror', (e) => errors.push('[novo] ' + String(e)));
  await page2.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page2.addInitScript(([key, data]) => {
    try { localStorage.clear(); if (data) localStorage.setItem(key, data); } catch (e) {}
  }, [LS_KEY, payload]);
  await page2.goto(ORIGIN + '/__new__.html');
  await page2.waitForFunction(() => window.__snap !== undefined);
  const engineNew = await page2.evaluate(() => window.__snap);
  await page2.close();
  const browserDiffs = deepDiff(engineNew, engine, '$', [], 200);

  // 2) telas — texto visível de cada aba, sistema do Progresso e detalhe de cada treino
  const viewsAll = await page.evaluate(([tabs, sys]) => {
    const out = {};
    const txt = () => document.getElementById('view').innerText.replace(/[ \t]+\n/g, '\n').trim();
    // mesmo texto sem os gráficos (eixos e rótulos de SVG), para comparar números de verdade
    const noCharts = {};
    const txtNoCharts = () => { const c = document.getElementById('view').cloneNode(true); c.querySelectorAll('svg').forEach((n) => n.remove()); document.body.appendChild(c); c.style.position = 'absolute'; c.style.left = '-99999px'; const t = c.innerText.replace(/[ \t]+\n/g, '\n').trim(); c.remove(); return t; };
    let lastKey = null;
    const go = (tab, ps, ts) => { window.currentTab = tab; window.progSys = ps || null; window.treinoSel = ts || null; window.render(); return txt(); };
    const goK = (key, tab, ps, ts) => { out[key] = go(tab, ps, ts); noCharts[key] = txtNoCharts(); };
    for (const t of tabs) goK('tab:' + t, t);
    for (const s of sys) goK('progresso:' + s, 'progresso', s);
    const ws = window.sortedWorkouts();
    ws.forEach((w, i) => { goK('treino:@w' + i + ':' + w.date, 'treinos', null, w.id); });
    go('hoje');
    return { out, noCharts };
  }, [TABS, PROG_SYS]);
  const views = viewsAll.out, viewsNoCharts = viewsAll.noCharts;

  const browserVersion = browser.version();
  await browser.close();
  mkdirSync(sc.outDir, { recursive: true });
  const meta = { source: rel, now: GOLDEN_NOW, tz: GOLDEN_TZ, pageErrors: errors, browser: chromium.name() + ' ' + browserVersion,
    sameBrowserCheck: { identical: browserDiffs.length === 0, diffs: browserDiffs } };
  writeFileSync(resolve(sc.outDir, name + '.engine.json'), JSON.stringify({ meta, engine }, null, 1));
  writeFileSync(resolve(sc.outDir, name + '.views.json'), JSON.stringify({ meta, views, viewsNoCharts }, null, 1));
  console.log(`[golden] ${name}: ${engine.workouts.length} treinos, ${Object.keys(views).length} telas → ${sc.outDir.replace(root + '/', '')}/` + (errors.length ? `  (erros na página: ${errors.length})` : ''));
  console.log(`  mesmo navegador (antigo × novo): ` + (browserDiffs.length ? `${browserDiffs.length} DIFERENÇAS\n    ` + browserDiffs.slice(0, 10).join('\n    ') : 'idêntico, valor a valor'));
  if (errors.length) console.log('  ' + errors.join('\n  '));
  if (browserDiffs.length || errors.length) process.exitCode = 1;
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENARIOS);
  for (const n of names) {
    if (!SCENARIOS[n]) { console.error('cenário desconhecido: ' + n); process.exit(1); }
    await capture(n);
  }
}
