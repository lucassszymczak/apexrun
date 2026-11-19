// ============================================================================
// MAPA motor da página × módulos .mjs — teste DIFERENCIAL.
//
// A página (analise/index.html) tem cópias inline do que existe nos módulos
// testáveis (kpi, stream, fit-ingest, weather, health-ingest, sync). Este teste roda
// as duas versões com os MESMOS dados (seed, cenário sintético com streams .FIT,
// mensagens .FIT, XML do Saúde, estados de sync) e compara os resultados.
//
// - Equivalente → ✓.
// - Divergência CONHECIDA (documentada em KNOWN, com o motivo) → listada, não falha.
// - Divergência nova → ✗ (alguém mudou um lado sem o outro).
//
// Os números das telas vêm da PÁGINA; por isso o app novo usa analise/engine.mjs
// (cópia fiel da página) e não estes módulos onde há divergência.
// ============================================================================
import { GOLDEN_NOW, freezeDate, deepDiff, rng } from './golden/env.mjs';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
freezeDate(GOLDEN_NOW);

const E = await import('./engine.mjs');
const K = await import('./kpi.mjs');
const ST = await import('./stream.mjs');
const FI = await import('./fit-ingest.mjs');
const WE = await import('./weather.mjs');
const HI = await import('./health-ingest.mjs');
const SY = await import('./sync.mjs');
const { fitMessages } = await import('./golden/synthetic.mjs');

// Divergências conhecidas: "módulo.função" → motivo. Mantidas de propósito (não mexemos
// em nenhum dos dois lados na Fase 1); o app novo segue a PÁGINA.
const KNOWN = {
  'kpi.fitnessSeries': 'a página estende a série até HOJE com carga zero (CTL/ATL/TSB decaem nos dias de descanso); o módulo para no último treino',
  'kpi.acuteChronic': 'a página usa HOJE como referência da janela aguda (decai no descanso); o módulo usa a data do último treino',
  'kpi.consistency': 'a página dá crédito parcial por semana (min(1, sessões/alvo)) e devolve metWeeks; o módulo conta só semanas cumpridas — a adesão (e o Score/Prontidão que a usam) muda',
  'fit-ingest.messagesToWorkout': 'o módulo é um subconjunto: não gera hrHist, geo, stream, qualidade nem os KPIs por amostra (pace-GAP, eficiência, mecânica, IMP); a página gera',
};

let pass = 0, fail = 0;
const known = [];
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}` + (got !== undefined ? `  (${got})` : '')); } else { fail++; console.log(`  ✗ ${n}` + (got !== undefined ? `  ${got}` : '')); } };
const J = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x, (k, v) => (typeof v === 'number' && !isFinite(v) ? 'num:' + v : v))));

// Compara f(módulo) × f(página) sobre vários casos.
function same(label, cases, modFn, pageFn) {
  let n = 0;
  const diffs = [];
  for (const c of cases) {
    let a, b;
    try { a = J(modFn(...c)); } catch (e) { a = { __error: String(e.message) }; }
    try { b = J(pageFn(...c)); } catch (e) { b = { __error: String(e.message) }; }
    const d = deepDiff(a, b, label);
    n++;
    if (d.length) diffs.push(d[0]);
  }
  if (KNOWN[label]) {
    if (diffs.length) { known.push(label); console.log(`  ~ ${label}: DIVERGE (conhecido) em ${diffs.length}/${n} casos — ${KNOWN[label]}\n      ex.: ${diffs[0]}`); }
    else ok(`${label}: equivalente em ${n} casos — remova de KNOWN`, false);
    return;
  }
  ok(`${label} ≡ página (${n} casos)`, diffs.length === 0, diffs.length ? `${diffs.length} divergem — ex.: ${diffs[0]}` : undefined);
}

// ---------------- dados ----------------
E.setState(E.load());
const seed = E.getState();
const syn = JSON.parse(readFileSync(resolve(here, 'golden/sintetico.state.json'), 'utf8'));
const A = syn.athlete;
const athletes = [seed.athlete, A, Object.assign({}, A, { bikeZones: null, bikeFcMax: null })];
const workouts = [...seed.workouts, ...syn.workouts];
const wsSets = [seed.workouts, syn.workouts, workouts];
const dailySets = [seed.daily, syn.daily];
const W1 = workouts.map((w) => [w]);
const WA = workouts.flatMap((w) => athletes.map((a) => [w, a]));
const SA = wsSets.flatMap((ws) => athletes.map((a) => [ws, a]));
const streams = syn.workouts.filter((w) => w.stream).map((w) => E.expandStream(w.stream));

console.log('\n== kpi.mjs ==');
for (const f of ['computeGap', 'computeEF', 'computeDecoupling', 'computePacing', 'computePaceStability', 'hillPerformance', 'kmH'].filter((f) => K[f]))
  same('kpi.' + f, W1, K[f], E[f]);
same('kpi.computeHrCostPerKm', W1, K.computeHrCostPerKm, E.computeHrCostKm);
for (const f of ['computeTrimp', 'zoneSeconds']) same('kpi.' + f, WA, K[f], E[f]);
for (const f of ['polarization', 'trainingDistribution', 'fitnessSeries', 'bikeSummary']) same('kpi.' + f, SA, K[f], E[f]);
// o módulo devolve Map; a página, objeto — compara os valores
same('kpi.dailyLoads', SA, (ws, a) => Object.fromEntries(K.dailyLoads(ws, a)), E.dailyLoads);
same('kpi.acuteChronic', SA, (ws, a) => K.acuteChronic(ws, a), (ws, a) => E.acuteChronic(ws, a));
same('kpi.hillAggregate', wsSets.map((x) => [x]), K.hillAggregate, E.hillAggregate);
same('kpi.consistency', wsSets.flatMap((ws) => [[ws, 1], [ws, 3], [ws, 4]]), K.consistency, E.consistency);
same('kpi.trimpSegment', [[30, 150, 67, 198], [60, 120, 60, 186], [10, 0, 67, 198]], K.trimpSegment, E.trimpSeg);
same('kpi.hrZone', [[100, 67, 198], [150, 67, 198], [185, 67, 198], [160, 60, 190]], K.hrZone, E.hrZone);
same('kpi.racePredictions', [[5.02, 1910], [21.1, 9723], [10, 3000]], K.racePredictions, E.racePredictions);
same('kpi.vo2Band', [[30], [39.4], [45], [55], [null]], K.vo2Band, E.vo2Band);
same('kpi.isoWeekKey', ['2026-01-01', '2026-09-07', '2026-12-31', '2027-01-03'].map((d) => [d]), K.isoWeekKey, E.isoWeekKey);
const ctxs = [{}, { efTrendPct: 3, decoupling: 4, adherencePct: 80, weeklyKm: 30, targetKm: 35, recovery: 60 }, { efTrendPct: -5, decoupling: 12, adherencePct: 40, weeklyKm: 10 }];
same('kpi.performanceScore', ctxs.map((c) => [c]), K.performanceScore, E.performanceScore);
const rctx = [{ tsb: 5, adherencePct: 80, sleepH: 7 }, { tsb: -30, sleepH: 5, soreness: 4, pain: true }, { tsb: 0, restingDelta: 5, hrvDeltaPct: -15 }];
same('kpi.readiness', rctx.map((c) => [c]), K.readiness, E.readiness);
same('kpi.recoveryStatus', rctx.map((c) => [c]), K.recoveryStatus, E.recoveryStatus);
for (const f of ['metricTrend', 'latestDaily']) same('kpi.' + f, dailySets.flatMap((d) => ['restingHR', 'hrv', 'sleepH', 'vo2'].map((k) => [d, k, d[d.length - 1].date])), K[f], E[f]);
same('kpi.paceStr', [[381], [59.6], [0], [NaN]], K.paceStr, E.paceStr);
same('kpi.hms', [[3725], [59.6], [-1]], K.hms, E.hms);

console.log('\n== stream.mjs ==');
const R = rng(7);
const raw = [
  fitMessages(R, { date: '2026-10-01', min: 45, speed: 2.8, seed: 1, hrBase: 142, drift: 2 }),
  fitMessages(R, { date: '2026-10-02', min: 50, speed: 2.7, seed: 2, hilly: true, pause: true }),
  fitMessages(R, { date: '2026-10-03', min: 40, speed: 2.75, seed: 3, smart: true }),
];
const recs = raw.map((m) => E.fitNormRecords(m.recordMesgs));
const evs = raw.map((m) => (m.eventMesgs || []).map((e) => ({ t: e.timestamp.getTime() / 1000, type: /stop/.test(e.eventType) ? 'stop' : 'start' })));
same('stream.toSpm', [[84], [170], [null], [129.6]], ST.toSpm, E.strSpm);
same('stream.vGap', [[3, 2], [3, -4], [null, 1], [2.5, null]], ST.vGap, E.vGap);
same('stream.recordingMode', recs.map((r) => [r]), ST.recordingMode, E.recordingMode);
same('stream.pauseWindows', evs.map((e) => [e]), ST.pauseWindows, E.pauseWindows);
same('stream.resampleHz', recs.map((r, i) => [r, { pauses: E.pauseWindows(evs[i]) }]), ST.resampleHz, E.resampleHz);
const rs = recs.map((r) => E.resampleHz(r, {}).samples);
same('stream.gradeSeries', rs.map((s) => [s]), ST.gradeSeries, E.gradeSeries);
same('stream.preprocess', recs.map((r, i) => [r, { pauses: E.pauseWindows(evs[i]) }]), ST.preprocess, E.preprocess);
const pp = recs.map((r) => E.preprocess(r, {}).samples);
same('stream.reduceStream', pp.map((s) => [s, 3]), ST.reduceStream, E.reduceStream);
same('stream.expandStream', syn.workouts.filter((w) => w.stream).slice(0, 6).map((w) => [w.stream]), ST.expandStream, E.expandStream);
const S = [...pp, ...streams];
same('stream.hrLag', S.map((s) => [s, 90]), ST.hrLag, E.hrLag);
same('stream.paceGapAtHR', S.map((s) => [s, { fcRef: 145, band: 3, lagSec: 6, win: [10, 45] }]), ST.paceGapAtHR, E.paceGapAtHR);
same('stream.sessionEff', S.map((s) => [s]), ST.sessionEff, E.sessionEff);
same('stream.cadenceAtPace', S.flatMap((s) => [[s, { paceRef: null }], [s, { paceRef: 360 }]]), ST.cadenceAtPace, E.cadenceAtPace);
same('stream.mechDecoupling', S.map((s) => [s]), ST.mechDecoupling, E.mechDecoupling);
same('stream.impSample', S.map((s) => [s, { fcRef: 145, band: 3, lagSec: 0 }]), ST.impSample, E.impSample);
const effs = S.map((s) => E.sessionEff(s)).filter(Boolean);
same('stream.effTree', effs.slice(1).map((e, i) => [e, effs[i]]).concat([[effs[0], null]]), ST.effTree, E.effTree);
same('stream.theilSen', [[[1, 2, 3, 4, 5], [2, 4.1, 5.9, 8.2, 9.9]], [[1, 1, 1], [1, 2, 3]]], ST.theilSen, E.theilSen);
same('stream.medianLag', wsSets.map((x) => [x]), ST.medianLag, E.medianLag);
same('stream.decoupleMatrix', [[6, 1], [6, 4], [2, 1], [2, 4], [null, null]], ST.decoupleMatrix, E.decoupleMatrix);
same('stream.paceRefSuggest', wsSets.map((x) => [x]), ST.paceRefSuggest, E.paceRefSuggest);
same('stream.downgradeConf', [['Alta'], ['Moderada'], ['Baixa'], ['Dados insuficientes'], ['x']], ST.downgradeConf, E.downgradeConf);
same('stream.gradeProfile', [[S.slice(0, 6), { lagSec: 0 }], [S.slice(3, 9), { lagSec: 8 }]], ST.gradeProfile, E.gradeProfile);
same('stream.impBaseline', wsSets.map((x) => [x]), ST.impBaseline, E.impBaseline);
same('stream.impIndex', [[2.9, 2.8], [null, 2.8], [2.9, 0]], ST.impIndex, E.impIndex);
const aligned = S.slice(0, 12).map((s, i) => ({ date: '2026-10-' + (10 + i), temp: 8 + i, aligned: E.alignForModel(s, 0) }));
same('stream.impPhase2', [[aligned], [aligned.slice(0, 5)]], ST.impPhase2, E.impPhase2);
same('stream.mlrRobust', [[[[1, 1, 2], [1, 2, 1], [1, 3, 5], [1, 4, 2], [1, 5, 3]], [3, 4, 9, 6, 8]]], ST.mlrRobust, E.mlrRobust);
same('stream.motorTest', S.map((s) => [s, A.motorStages]), ST.motorTest, E.motorTest);
same('stream.pruneStreams', [[syn.workouts, 20], [syn.workouts, 5]], (ws, k) => { const c = JSON.parse(JSON.stringify(ws)); const n = ST.pruneStreams(c, k); return [n, c.map((w) => !!w.stream)]; },
  (ws, k) => { const c = JSON.parse(JSON.stringify(ws)); const n = E.pruneStreams(c, k); return [n, c.map((w) => !!w.stream)]; });

console.log('\n== fit-ingest.mjs ==');
E.setState({ athlete: A, workouts: [], daily: [] });
same('fit-ingest.modalFromSport', [['running'], ['cycling'], ['training'], [null]], FI.modalFromSport, E.modalFromSport);
same('fit-ingest.messagesToWorkout', raw.map((m) => [m]), FI.messagesToWorkout, E.fitMessagesToWorkout);
// o que o módulo devolve é igual ao da página nos campos que ele tem?
same('fit-ingest.messagesToWorkout (campos em comum)', raw.map((m) => [m]),
  (m) => { const r = FI.messagesToWorkout(m); delete r._records; return r; },
  (m) => { const p = E.fitMessagesToWorkout(m), r = FI.messagesToWorkout(m), o = {}; for (const k of Object.keys(r)) if (k !== '_records') o[k] = p[k]; return o; });

console.log('\n== weather.mjs ==');
const geo = { lat: -25.39123, lon: -51.46234, alt: 1120 };
same('weather.weatherUrl', [[geo, new Date('2026-10-01T10:00:00Z'), false], [geo, '2026-06-01T09:00:00Z', true]], (g, w, ar) => WE.weatherUrl(g, w, { archive: ar }), E.weatherUrl);
const hourly = { time: ['2026-10-01T09:00', '2026-10-01T10:00', '2026-10-01T11:00'], temperature_2m: [12, 13, 14], dew_point_2m: [8, 9, 9], relative_humidity_2m: [70, 72, 68], wind_speed_10m: [10, 12, 25] };
same('weather.pickHour', [[hourly, new Date('2026-10-01T10:20:00Z')], [hourly, new Date('2026-10-02T10:00:00Z')], [null, new Date()]], WE.pickHour, E.pickHour);
const wx = [{ tempC: 12, dewC: 8, windKmh: 10 }, { tempC: 22, dewC: 16, windKmh: 25 }, { tempC: 5 }];
same('weather.climateTags', wx.flatMap((w) => [[w, E.climateOpts(A, geo)], [w, {}]]), WE.climateTags, E.climateTags);

console.log('\n== health-ingest.mjs ==');
const xml = [
  '<Record type="HKQuantityTypeIdentifierRestingHeartRate" value="62" startDate="2026-09-14 06:40:00 -0300" endDate="2026-09-14 06:40:00 -0300"/>',
  '<Record type="HKQuantityTypeIdentifierRestingHeartRate" value="64" startDate="2026-09-14 20:00:00 -0300" endDate="2026-09-14 20:00:00 -0300"/>',
  '<Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" value="51.2" startDate="2026-09-14 03:00:00 -0300" endDate="2026-09-14 03:01:00 -0300"/>',
  '<Record type="HKQuantityTypeIdentifierVO2Max" value="39.44" startDate="2026-09-13 18:00:00 -0300" endDate="2026-09-13 18:00:00 -0300"/>',
  '<Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepCore" startDate="2026-09-13 23:10:00 -0300" endDate="2026-09-14 05:40:00 -0300"/>',
  '<Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisInBed" startDate="2026-09-13 23:00:00 -0300" endDate="2026-09-14 06:00:00 -0300"/>',
  '<Record type="HKQuantityTypeIdentifierStepCount" value="900" startDate="2026-09-14 10:00:00 -0300" endDate="2026-09-14 10:10:00 -0300"/>',
].join('\n');
same('health-ingest.extractHealthRecords', [[xml]], HI.extractHealthRecords, E.extractHealthRecords);
same('health-ingest.aggregateDaily', [[E.extractHealthRecords(xml)]], HI.aggregateDaily, E.aggregateDaily);

console.log('\n== sync.mjs ==');
const st1 = JSON.parse(JSON.stringify(syn)), st2 = JSON.parse(JSON.stringify(syn));
st2.workouts = st2.workouts.slice(3).map((w, i) => (i % 4 === 0 ? Object.assign(w, { notes: 'editado', updatedAt: '2026-11-18T10:00:00Z' }) : w));
st2.deleted = [{ id: st1.workouts[1].id, at: '2026-11-18T11:00:00Z' }];
st2.daily = st2.daily.slice(10).map((d, i) => (i % 5 === 0 ? Object.assign({}, d, { sleepH: 8.1, updatedAt: '2026-11-18T09:00:00Z' }) : d));
st2.athlete = Object.assign({}, st2.athlete, { fcMax: 197, updatedAt: '2026-11-18T12:00:00Z' });
st2.race = Object.assign({}, st2.race, { objective: 'sub 4h', updatedAt: '2026-11-18T13:00:00Z' });
same('sync.mergeStates', [[st1, st2], [st2, st1], [st1, {}], [{}, {}]], SY.mergeStates, E.syncMergeStates);
same('sync.normalizeSyncCode', [[' APEX-abcd-EFGH-2345 '], [null]], SY.normalizeSyncCode, E.normalizeSyncCode);

console.log(`\n== resumo: ${known.length} divergência(s) conhecida(s) entre página e módulos ==`);
for (const k of known) console.log('  · ' + k);
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
