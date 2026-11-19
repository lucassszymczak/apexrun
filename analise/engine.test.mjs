// ============================================================================
// PARIDADE — analise/engine.mjs é cópia FIEL do motor da página antiga.
//   1. Cada declaração do módulo é byte a byte igual à da página de origem.
//   2. O módulo tem exatamente as declarações que o extrator selecionaria hoje
//      (nada faltando, nada sobrando) — se a página mudar, regenere o módulo.
//   3. Só a "cola" de módulo é código novo.
// ============================================================================
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { findSource, topLevelDecls, selectEngine } from '../scripts/extract-engine.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../package.json'));
const { parse } = require('@babel/parser');

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}` + (got !== undefined ? `  (${got})` : '')); } else { fail++; console.log(`  ✗ ${n}` + (got !== undefined ? `  ${got}` : '')); } };

const { rel, path } = findSource();
const page = topLevelDecls(readFileSync(path, 'utf8'));
const expected = selectEngine(page.decls);
const pageByName = new Map();
for (const d of page.decls) for (const n of d.names) pageByName.set(n, d);

const modSrc = readFileSync(resolve(here, 'engine.mjs'), 'utf8');
const mod = parse(modSrc, { sourceType: 'module' });
const GLUE_FUNCS = new Set(['setState', 'getState', 'setToast']);
const GLUE_VARS = new Set(['state', 'toast']);
const modDecls = [];
let exported = [];
for (const n of mod.program.body) {
  if (n.type === 'ExportNamedDeclaration' && !n.declaration) { exported = n.specifiers.map((s) => s.exported.name); continue; }
  const node = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
  let names = [];
  if (node.type === 'FunctionDeclaration') names = [node.id.name];
  else if (node.type === 'VariableDeclaration') names = node.declarations.map((d) => d.id.name);
  modDecls.push({ names, text: modSrc.slice(node.start, node.end), glue: names.every((x) => GLUE_FUNCS.has(x) || GLUE_VARS.has(x)) });
}

console.log(`\n== engine.mjs × ${rel} ==`);
const copied = modDecls.filter((d) => !d.glue);
let same = 0;
const diffs = [];
for (const d of copied) {
  const p = pageByName.get(d.names[0]);
  if (p && p.text === d.text) same++;
  else diffs.push(d.names.join(','));
}
ok(`declarações copiadas byte a byte (${copied.length})`, diffs.length === 0 && same === copied.length, diffs.length ? 'divergem: ' + diffs.slice(0, 10).join(' ') : same + ' idênticas');

const expNames = expected.flatMap((d) => d.names).sort();
const gotNames = copied.flatMap((d) => d.names).sort();
const missing = expNames.filter((n) => !gotNames.includes(n));
const extra = gotNames.filter((n) => !expNames.includes(n));
ok('seleção atual do extrator = conteúdo do módulo', !missing.length && !extra.length,
  (missing.length ? 'faltam: ' + missing.join(' ') + ' ' : '') + (extra.length ? 'sobram: ' + extra.join(' ') : '') || expNames.length + ' nomes');

const order = copied.map((d) => d.names[0]);
const pageOrder = expected.map((d) => d.names[0]);
ok('mesma ordem da página', JSON.stringify(order) === JSON.stringify(pageOrder));

const glue = modDecls.filter((d) => d.glue).flatMap((d) => d.names).sort();
ok('código novo é só a cola de módulo', JSON.stringify(glue) === JSON.stringify(['getState', 'setState', 'setToast', 'state', 'toast']), glue.join(' '));
ok('todo nome copiado é exportado', gotNames.every((n) => exported.includes(n)), exported.length + ' exports');

console.log('\n== o módulo carrega e calcula sem DOM ==');
const E = await import('./engine.mjs');
const st = E.setState(E.load()); // sem localStorage no Node → seed, como num aparelho novo
ok('load() sem localStorage devolve o seed', st.seeded === true && st.workouts.length === 9, st.workouts.length + ' treinos');
const g = E.computeGap(st.workouts.find((w) => w.type === 'teste'));
ok('computeGap do baseline 5K', g.confidence === 'alta' && g.gapPace > 355 && g.gapPace < 385, E.paceStr(g.gapPace) + '/km');
ok('coachContext roda', typeof E.coachContext().rd.score === 'number');
let saved = null;
globalThis.localStorage = { setItem: (k, v) => { saved = [k, v]; }, getItem: () => null };
E.save();
ok('save() grava na MESMA chave do app antigo', saved && saved[0] === 'apex.analise.v1', saved && saved[0]);
delete globalThis.localStorage;

console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
