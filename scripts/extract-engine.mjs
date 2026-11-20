// ============================================================================
// Extrai o MOTOR que hoje só existe dentro de analise/index.html para um módulo
// ES (analise/engine.mjs), SEM alterar uma vírgula das funções.
//
// Como funciona:
//   1. Faz o parse do <script> principal da página com @babel/parser (já vem com o
//      @vitejs/plugin-react) e localiza cada declaração de topo pelo nome.
//   2. Parte de uma lista de RAÍZES (funções de cálculo usadas pelas telas) e puxa o
//      fechamento de dependências — tudo o que essas funções chamam.
//   3. Copia o texto de cada declaração byte a byte, na ordem original, e adiciona só
//      a "cola" de módulo (estado injetável, toast injetável e a lista de exports).
//
// O teste analise/engine.test.mjs garante que cada função de engine.mjs continua
// idêntica à da página de origem. Para regenerar:  node scripts/extract-engine.mjs
// ============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { parse } = require('@babel/parser');

// Página de origem: a página antiga, movida para legacy/analise-v1/ na Etapa 1 (publicada em /analise-v1/).
export const SOURCE_CANDIDATES = ['legacy/analise-v1/index.html'];

export function findSource() {
  for (const rel of SOURCE_CANDIDATES) {
    const p = resolve(root, rel);
    if (existsSync(p)) return { rel, path: p };
  }
  throw new Error('página de origem não encontrada: ' + SOURCE_CANDIDATES.join(' | '));
}

// Lê o <script> principal (o que começa com "use strict") e devolve as declarações de topo.
export function topLevelDecls(html) {
  const open = html.indexOf('<script>\n"use strict"');
  if (open < 0) throw new Error('script principal não encontrado');
  const s0 = html.indexOf('\n', open) + 1;
  const s1 = html.indexOf('</script>', s0);
  const src = html.slice(s0, s1);
  const ast = parse(src, { sourceType: 'script', attachComment: false });
  const decls = [];
  for (const n of ast.program.body) {
    let names = [];
    if (n.type === 'FunctionDeclaration') names = [n.id.name];
    else if (n.type === 'VariableDeclaration') names = n.declarations.map((d) => d.id.name);
    if (!names.length) continue;
    decls.push({ names, kind: n.type, start: n.start, end: n.end, text: src.slice(n.start, n.end), node: n });
  }
  return { src, decls };
}

// Identificadores livres usados por uma declaração (aproximação suficiente: todo Identifier).
function identifiersOf(node, out = new Set()) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) { for (const x of node) identifiersOf(x, out); return out; }
  if (node.type === 'Identifier') out.add(node.name);
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'start' || k === 'end' || k === 'extra') continue;
    const v = node[k];
    if (v && typeof v === 'object') identifiersOf(v, out);
  }
  return out;
}

// RAÍZES: funções de cálculo/regra que as telas usam. O fechamento traz o resto.
export const ROOTS = [
  // KPIs por treino e do painel (Livro de fórmulas)
  'computeGap', 'computeEF', 'computeDecoupling', 'computePacing', 'computePaceStability', 'computeTrimp',
  'computeHrCostKm', 'hrZone', 'zoneSeconds', 'polarization', 'trainingDistribution', 'hillPerformance',
  'hillAggregate', 'hrGradeCost', 'metricTrend', 'latestDaily', 'sleepEntriesAll', 'sleepLatest',
  'recoveryStatus', 'dailyLoads', 'fitnessSeries', 'acuteChronic', 'performanceTrend', 'riegel',
  'racePredictions', 'vo2Band', 'isoWeekKey', 'consistency', 'performanceScore', 'readiness',
  'hms', 'hmsShort', 'paceStr',
  // .FIT → treino e motor por amostra
  'fitMessagesToWorkout', 'computeStreamKpis', 'alignForModel', 'motorTest', 'impPhase2', 'impBaseline',
  'impIndex', 'gradeProfile', 'paceRefSuggest', 'medianLag', 'decoupleMatrix', 'effTree', 'cadenceAtPace',
  'expandStream', 'pruneStreams',
  // clima e Apple Saúde
  'weatherUrl', 'pickHour', 'climateTags', 'climateOpts', 'fetchWeather', 'extractHealthRecords',
  'aggregateDaily', 'readHealthFile',
  // estado e armazenamento (mesma chave e formato do localStorage)
  'load', 'save', 'touch', 'seedWorkouts', 'seedDaily', 'sortedWorkouts', 'sortedDaily',
  'linkSleepToWorkouts', 'workoutDayReadiness', 'nextWorkoutSuggestion', 'mergeDaily',
  // sincronização (merge puro + código)
  'syncMergeStates', 'normalizeSyncCode', 'newSyncCode', 'syncHashId',
  'currentPayload', 'applyMerged', 'getSyncCode', 'setSyncCode', 'syncEnabled', 'syncPull', 'syncPush', 'sbReady',
  // Hoje / Coach / Progresso
  'coachContext', 'progContext', 'week7Km', 'hojeVerdict', 'hojeAction', 'hojeCoachLines', 'coachInsight',
  'focusLine', 'ciArrow', 'bestAnchor', 'bikeSummary', 'kmH', 'easyRuns', 'tsbState', 'typeLabel',
  // Maratona / ciclo / plano da semana
  'cycleSummary', 'cycleSummaryText', 'runZoneHrRanges', 'mPaceByZone', 'weeklyReadiness', 'readyBand',
  'consistencyHeatmap', 'mBlock', 'mPhase', 'mWeekInfo', 'mWeekRange', 'mDaysToRace', 'mSessMinutes',
  'mSessKm', 'mZoneMix', 'mPeakZone', 'mSessSummary', 'mAnalyze', 'mSessStatus', 'mLinkWeek', 'mParseClock',
  'mWeekMonFromKey', 'M_DOW', 'M_ZDESC',
  // Hidratação
  'hydroHas', 'hydroPlan', 'hydroTotal', 'hydroRateMlH', 'hydroStatus', 'hydroPhaseAvg', 'hydroTotalAvg',
  'hydroDurStat', 'hydroPhaseStat', 'hydroNextDayRecovery',
  // entrada manual
  'parseDur', 'parseSplits', 'esc', 'fmtDate', 'fmtDateFull',
  // Livro de fórmulas e Folha do KPI (textos atuais, copiados como estão)
  'kpiDoc', 'KPI_DOCS', 'KPI_TODO', 'EXTRA_DOCS',
  // Maratona: tipos de sessão, zonas, rótulos e parsing do plano colado
  'M_TYPES', 'M_ADAPT', 'M_STATUS', 'M_MON', 'M_MONL', 'M_ZONES', 'mSessDate', 'mZoneOptsDesc', 'mSeedSteps',
  'mCloneSession', 'mParsePlan', 'mDowToday', 'archiveCycle', 'cycleRunsInRange',
  // Força e canela (conteúdo do programa)
  'FC_CIRCUITO_A', 'FC_QUADRIL', 'FC_CIRCUITO_B', 'FC_CANELA', 'FC_FASE1', 'FC_FASE2',
  // Progresso: sistemas, recordes e auxiliares de leitura
  'mean', 'ciArrow', 'pgBand',
  // Relatório semanal
  'weeklyLesson',
];

// Nomes que NÃO entram: a "cola" do módulo os substitui (estado/toast) ou são da interface.
export const GLUE = new Set(['state', 'toast']);

export function selectEngine(decls) {
  const byName = new Map();
  for (const d of decls) for (const n of d.names) byName.set(n, d);
  const top = new Set(byName.keys());
  const seen = new Set();
  const stack = [...ROOTS];
  while (stack.length) {
    const n = stack.pop();
    if (GLUE.has(n)) continue;
    const d = byName.get(n);
    if (!d) throw new Error('raiz/dependência não encontrada na página: ' + n);
    if (seen.has(d)) continue;
    seen.add(d);
    for (const id of identifiersOf(d.node)) if (top.has(id) && !d.names.includes(id)) stack.push(id);
  }
  const out = [...seen].sort((a, b) => a.start - b.start);
  // Trava: o motor não pode arrastar código de tela da página antiga.
  const ui = out.flatMap((d) => d.names).filter((n) => n !== 'progContext' && /^(render|prog[A-Z]|openModal$|lineChart$|barChart$|card$|el$|\$$)/.test(n));
  if (ui.length) throw new Error('o motor puxou código de interface: ' + ui.join(', ') + ' — tire a raiz que o chama');
  return out;
}

function build() {
  const { rel, path } = findSource();
  const html = readFileSync(path, 'utf8');
  const { decls } = topLevelDecls(html);
  const sel = selectEngine(decls);
  const names = sel.flatMap((d) => d.names);
  const out = [];
  out.push('// ============================================================================');
  out.push('// MOTOR DO APEX — extraído AUTOMATICAMENTE de ' + rel + ' (Etapa 0 da Fase 1).');
  out.push('// NÃO EDITE À MÃO. Cada declaração abaixo é cópia byte a byte da página original;');
  out.push('// analise/engine.test.mjs falha se alguma divergir. Regenere com:');
  out.push('//   node scripts/extract-engine.mjs');
  out.push('// Só a "cola" de módulo (estado e toast injetáveis + exports) é código novo.');
  out.push('// ============================================================================');
  out.push('/* eslint-disable */');
  out.push('');
  out.push('// ---- cola de módulo: o estado do app (antes uma variável global da página) ----');
  out.push('var state = null;');
  out.push('export function setState(s) { state = s; return state; }');
  out.push('export function getState() { return state; }');
  out.push('// toast usado por save() quando o armazenamento enche; a interface injeta o seu.');
  out.push('var toast = function () {};');
  out.push('export function setToast(fn) { toast = typeof fn === "function" ? fn : function () {}; }');
  out.push('');
  out.push('// ---- declarações copiadas de ' + rel + ' ----');
  for (const d of sel) out.push(d.text);
  out.push('');
  out.push('export {');
  for (let i = 0; i < names.length; i += 6) out.push('  ' + names.slice(i, i + 6).join(', ') + ',');
  out.push('};');
  out.push('');
  const dest = resolve(root, 'analise/engine.mjs');
  writeFileSync(dest, out.join('\n'));
  // Tipos para o app novo (TypeScript): o motor é JS puro, então tudo é `any`.
  const dts = [
    '// Gerado por scripts/extract-engine.mjs — tipos do motor (JS puro, sem tipagem).',
    '/* eslint-disable */',
    'export declare function setState(s: any): any;',
    'export declare function getState(): any;',
    'export declare function setToast(fn: (msg: string) => void): void;',
    ...names.map((n) => 'export declare const ' + n + ': any;'),
    '',
  ];
  writeFileSync(resolve(root, 'analise/engine.d.mts'), dts.join('\n'));
  console.log('[extract-engine] ' + sel.length + ' declarações (' + names.length + ' nomes) → analise/engine.mjs');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build();
