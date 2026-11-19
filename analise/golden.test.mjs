// ============================================================================
// GOLDEN MASTER — o motor novo (analise/engine.mjs) reproduz EXATAMENTE os
// números do app antigo, capturados por scripts/golden-capture.mjs.
//
// Cenários: seed (sempre) e backup do Lucas (se fixtures/privado/golden/ existir).
// Comparação: igualdade exata de cada valor. A ÚNICA folga é ≤4 ULP entre motores JS
// diferentes (Node × Chromium) — mesmo código, libm diferente; cada caso é listado.
// A prova de identidade exata é a checagem "mesmo navegador" gravada no golden.
// ============================================================================
import { GOLDEN_NOW, freezeDate, deepDiff } from './golden/env.mjs';
import { snapshot } from './golden/snapshot.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
freezeDate(GOLDEN_NOW);

// localStorage mínimo em memória (o motor lê/grava a mesma chave do app)
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: (k) => { mem.delete(k); },
  clear: () => mem.clear(),
};

const E = await import('./engine.mjs');
const { payloadFromFile } = await import('../scripts/golden-capture.mjs');

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}` + (got !== undefined ? `  (${got})` : '')); } else { fail++; console.log(`  ✗ ${n}` + (got !== undefined ? `  ${got}` : '')); } };

// Mesma sequência de abertura do app antigo (init): load → salva o seed → vincula o sono.
function boot(payload) {
  mem.clear();
  if (payload) mem.set('apex.analise.v1', payload);
  const st = E.setState(E.load());
  if (st.seeded) { E.save(); delete st.seeded; }
  try { if (E.linkSleepToWorkouts() > 0) E.save(); } catch (e) {}
  return st;
}

function compare(name, goldenPath, payload) {
  console.log(`\n== golden: ${name} ==`);
  const g = JSON.parse(readFileSync(goldenPath, 'utf8'));
  ok('golden capturado no mesmo "hoje" do teste', g.meta.now === GOLDEN_NOW, g.meta.now);
  ok('app antigo abriu sem erros', !g.meta.pageErrors.length, g.meta.pageErrors.join(' | ') || 'sem erros');
  ok('no mesmo navegador, antigo × novo idênticos valor a valor', g.meta.sameBrowserCheck && g.meta.sameBrowserCheck.identical,
    g.meta.sameBrowserCheck ? (g.meta.sameBrowserCheck.identical ? g.meta.browser : g.meta.sameBrowserCheck.diffs.slice(0, 5).join(' | ')) : 'sem checagem');
  const ulp = { ulp: 4, hits: [] };
  const st = boot(payload);
  const got = JSON.parse(JSON.stringify(snapshot(E, st)));
  const exp = g.engine;
  ok('mesmo número de treinos', got.workouts.length === exp.workouts.length, got.workouts.length + ' / ' + exp.workouts.length);
  // por treino, KPI a KPI
  let wDiffs = 0, wKpis = 0;
  exp.workouts.forEach((ew, i) => {
    const gw = got.workouts[i] || {};
    for (const k of Object.keys(ew)) {
      wKpis++;
      const d = deepDiff(gw[k], ew[k], ew.key + '.' + k, [], 40, ulp);
      if (d.length) { wDiffs++; console.log('    ≠ ' + d.slice(0, 3).join('\n      ')); }
    }
  });
  ok(`KPIs por treino idênticos (${wKpis} comparações em ${exp.workouts.length} treinos)`, wDiffs === 0, wDiffs ? wDiffs + ' diferentes' : undefined);
  // painel e maratona, bloco a bloco
  for (const sec of ['panel', 'maratona']) {
    for (const k of Object.keys(exp[sec])) {
      const d = deepDiff(got[sec][k], exp[sec][k], sec + '.' + k, [], 40, ulp);
      ok(`${sec}.${k} idêntico`, d.length === 0, d.length ? '\n      ' + d.slice(0, 5).join('\n      ') : undefined);
    }
  }
  console.log(`  · Node × Chromium: ${ulp.hits.length} valor(es) diferem só na última casa binária (≤4 ULP, Math.pow/exp do motor JS)` + (ulp.hits.length ? ':\n      ' + ulp.hits.slice(0, 6).join('\n      ') : ''));
  const extra = Object.keys(got.panel).filter((k) => !(k in exp.panel));
  ok('nenhum bloco a mais/a menos no painel', extra.length === 0, extra.join(', ') || undefined);
}

compare('seed (dados de exemplo)', resolve(here, 'golden/seed.engine.json'), null);
compare('sintético (streams .FIT, plano, clima, hidratação, ciclos)', resolve(here, 'golden/sintetico.engine.json'), readFileSync(resolve(here, 'golden/sintetico.state.json'), 'utf8'));

const bkGolden = resolve(root, 'fixtures/privado/golden/backup.engine.json');
const bkFile = resolve(root, 'fixtures/privado/backup.json');
if (existsSync(bkGolden) && existsSync(bkFile)) compare('backup do Lucas (privado)', bkGolden, payloadFromFile(bkFile));
else console.log('\n(backup do Lucas ausente — rode `node scripts/golden-capture.mjs backup` depois de salvar fixtures/privado/backup.json)');

console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
