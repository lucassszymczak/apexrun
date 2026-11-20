// ============================================================================
// GOLDEN MASTER — snapshot de TODOS os números do motor, por treino e do painel.
//
// A mesma função roda em dois lugares:
//   - no app ANTIGO (analise/index.html no Chromium): E = window, S = state global;
//   - no motor NOVO (analise/engine.mjs no Node):      E = módulo, S = getState().
// Por isso ela é autocontida (não usa nada de fora) — é serializada para a página
// com Function.prototype.toString. Mantenha-a em ES5-ish simples.
//
// Cada chamada espelha como as telas da página chamam o motor (mesmos argumentos).
// Treinos são citados como "@w<índice>:<data>" (os ids do seed são aleatórios).
// ============================================================================
export function snapshot(E, S) {
  var a = S.athlete;
  var ws = E.sortedWorkouts();
  var ref = new Map();
  ws.forEach(function (w, i) { ref.set(w, '@w' + i + ':' + w.date); });
  function J(x) {
    var s = JSON.stringify(x, function (k, v) {
      if (v && typeof v === 'object' && ref.has(v)) return ref.get(v);
      if (typeof v === 'function') return '[fn]';
      if (typeof v === 'number' && !isFinite(v)) return 'num:' + String(v);
      return v;
    });
    return s === undefined ? null : JSON.parse(s);
  }
  // executa e congela o resultado (ou o erro) em JSON
  function T(fn) { try { return J(fn()); } catch (e) { return { __error: String(e && e.message || e) }; } }

  var out = { meta: { nWorkouts: ws.length, nDaily: (S.daily || []).length, hasRace: !!S.race } };

  // ---------------- por treino ----------------
  out.workouts = ws.map(function (w, i) {
    var r = { key: '@w' + i + ':' + w.date, type: w.type, modal: w.modal || null };
    r.gap = T(function () { return E.computeGap(w); });
    r.ef = T(function () { return E.computeEF(w); });
    r.decoupling = T(function () { return E.computeDecoupling(w); });
    r.pacing = T(function () { return E.computePacing(w); });
    r.paceStability = T(function () { return E.computePaceStability(w); });
    r.trimp = T(function () { return E.computeTrimp(w, a); });
    r.hrCostKm = T(function () { return E.computeHrCostKm(w); });
    r.zoneSeconds = T(function () { return E.zoneSeconds(w, a); });
    r.hill = T(function () { return E.hillPerformance(w); });
    r.kmH = T(function () { return E.kmH(w); });
    r.dayReadiness = T(function () { return E.workoutDayReadiness(w); });
    r.typeLabel = T(function () { return E.typeLabel(w.type); });
    r.hydro = T(function () {
      var rate = E.hydroRateMlH(w), plan = E.hydroPlan(w, a);
      return {
        has: E.hydroHas(w), total: E.hydroTotal(w), rate: rate, status: E.hydroStatus(rate), plan: plan,
        durStat: E.hydroDurStat(rate, plan ? plan.durFloor : 400),
        antesStat: plan ? E.hydroPhaseStat(w.waterBefore, plan.antesTarget) : null,
        depoisStat: plan ? E.hydroPhaseStat(w.waterAfter, plan.depoisTarget) : null,
        nextDay: E.hydroNextDayRecovery(w),
      };
    });
    if (w.weather && w.weather.tempC != null) r.climate = T(function () { return E.climateTags(w.weather, E.climateOpts(a, w.geo)); });
    if (w.stream) {
      r.stream = T(function () {
        var smp = E.expandStream(w.stream), lag = w.hrLagSec != null ? w.hrLagSec : 0, fcRef = a.fcRef || 145, band = a.bandFc || 3;
        return {
          n: smp.length,
          paceGap: E.paceGapAtHR(smp, { fcRef: fcRef, band: band, lagSec: lag, win: [10, 45] }),
          eff: E.sessionEff(smp),
          mech: E.mechDecoupling(smp),
          imp: E.impSample(smp, { fcRef: fcRef, band: band, lagSec: lag }),
          cad: E.cadenceAtPace(smp, { paceRef: null }),
          hrLag: E.hrLag(smp, 90),
          motor: E.motorTest(smp, (a.motorStages || []).filter(function (s) { return s; })),
        };
      });
    }
    return r;
  });

  // ---------------- painel ----------------
  var runs = E.runsOnly(ws);
  var p = {};
  var cx = null; try { cx = E.coachContext(); } catch (e) { cx = null; }
  p.coachContext = T(function () { return E.coachContext(); });
  if (ws.length) p.progContext = T(function () { return E.progContext(); });
  if (cx) {
    p.hojeVerdict = T(function () { return E.hojeVerdict(cx); });
    p.hojeAction = T(function () { return E.hojeAction(cx); });
    p.hojeCoachLines = T(function () { return E.hojeCoachLines(cx); });
    p.coachInsight = T(function () { return E.coachInsight(ws, a, cx); });
    p.focusLine = T(function () { return E.focusLine(cx, a); });
  }
  if (ws.length) {
    p.nextWorkout = T(function () {
      var c = E.progContext(), last = c.last;
      var shin = !!(a.alert && /canela|t[íi]bia|protetora|suspensa/i.test(a.alert)) || !!(last && last.pain);
      return E.nextWorkoutSuggestion(c.rd, c.tsb, c.ac, shin);
    });
    // Motor: árvore da eficiência (como em progMotor)
    p.effTree = T(function () {
      var c = E.progContext(), h = c.effHist;
      if (!h.length) return null;
      var cur = h[h.length - 1].eff, prevE = h.slice(-4, -1).map(function (w) { return w.eff; });
      function m(k) { return E.mean(prevE.map(function (e) { return e[k]; })); }
      var prevAvg = prevE.length ? { mPerBeat: m('mPerBeat'), stepsPerBeat: m('stepsPerBeat'), mPerStep: m('mPerStep'), spmMean: m('spmMean'), hrMean: m('hrMean'), vgapMean: m('vgapMean') } : null;
      return E.effTree(cur, prevAvg);
    });
    // Resistência: decoupling cardíaco × mecânico (como em progResist)
    p.decoupleMatrix = T(function () {
      var c = E.progContext(), h = c.mechHist;
      if (!h.length) return null;
      var last = h[h.length - 1], cardiac = E.computeDecoupling(last), mechPct = last.mech.pct;
      return { cardiac: cardiac, mechPct: mechPct, conf: c.lagLow ? E.downgradeConf(last.mech.confidence) : last.mech.confidence, matrix: cardiac != null ? E.decoupleMatrix(cardiac, mechPct) : null };
    });
    p.racePredictions = T(function () { var an = E.bestAnchor(runs); return an ? { anchor: an, preds: E.racePredictions(an.distKm, an.durationSec) } : null; });
    // Mecânica: perfil de inclinação e custo de FC do morro (como em progMec)
    p.gradeProfile = T(function () {
      var c = E.progContext();
      var es = E.easyRuns(runs).filter(function (w) { return w.stream; }).sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
      if (es.length < 2) return null;
      return E.gradeProfile(es.slice(-6).map(function (w) { return E.expandStream(w.stream); }), { lagSec: c.ml.lagSec });
    });
  }
  p.hrGradeCost = T(function () { return E.hrGradeCost(runs); });
  p.fitnessSeries = T(function () { return E.fitnessSeries(ws, a); });
  p.acuteChronic = T(function () { return E.acuteChronic(ws, a); });
  p.polarization = T(function () { return E.polarization(ws, a); });
  p.trainingDistribution = T(function () { return E.trainingDistribution(ws, a); });
  p.consistency = T(function () { return E.consistency(ws, a.sessionsTarget); });
  p.hillAggregate = T(function () { return E.hillAggregate(runs); });
  p.bikeSummary = T(function () { return E.bikeSummary(ws, a); });
  p.week7Km = T(function () { return E.week7Km(runs); });
  p.weeklyReadiness = T(function () { return E.weeklyReadiness(ws, a); });
  p.heatmap = T(function () { return E.consistencyHeatmap(ws, a, 18); });
  p.paceRefSuggest = T(function () { return E.paceRefSuggest(S.workouts); });
  p.medianLag = T(function () { return E.medianLag(E.easyRuns(runs)); });
  p.sleepEntries = T(function () { return E.sleepEntriesAll(); });
  p.vo2Band = T(function () { var c = cx; return c ? E.vo2Band(c.vo2Eff) : null; });
  p.hydro = T(function () {
    var hr = runs.filter(E.hydroHas);
    return { n: hr.length, before: E.hydroPhaseAvg(hr, 'waterBefore'), during: E.hydroPhaseAvg(hr, 'waterDuring'), after: E.hydroPhaseAvg(hr, 'waterAfter'), total: E.hydroTotalAvg(hr) };
  });
  out.panel = p;

  // ---------------- Maratona / ciclo / plano ----------------
  var m = {};
  var race = S.race;
  m.zones = T(function () { return E.runZoneHrRanges(a); });
  m.paceByZone = T(function () { return E.mPaceByZone(runs, a); });
  m.week0 = T(function () { var i = E.mWeekInfo(0); return { key: i.key, monIso: i.monIso, sunIso: i.sunIso, range: E.mWeekRange(i) }; });
  if (race) {
    m.days = T(function () { return E.mDaysToRace(race); });
    m.block = T(function () { return E.mBlock(race); });
    m.phase = T(function () { return E.mPhase(E.mBlock(race), race); });
    m.cycleSummary = T(function () { return E.cycleSummary(race); });
    m.cycleText = T(function () { return E.cycleSummaryText(race); });
    m.paceByZoneCycle = T(function () {
      var s = race.startDate, e = race.date;
      var cr = runs.filter(function (w) { return (!s || w.date >= s) && (!e || w.date <= e); });
      return E.mPaceByZone(cr, a);
    });
  }
  m.archived = T(function () { return (S.races || []).map(function (it) { return E.cycleSummaryText(it.race, it.summary); }); });
  m.plan = T(function () {
    var o = {};
    Object.keys(S.planWeeks || {}).sort().forEach(function (k) {
      var wk = S.planWeeks[k], mon = E.mWeekMonFromKey(k);
      if (!wk || !mon) { o[k] = null; return; }
      var info = { monday: mon, sunday: E.mAddDays(mon, 6), key: k, monIso: E.mIsoLocal(mon), sunIso: E.mIsoLocal(E.mAddDays(mon, 6)) };
      var ss = wk.sessions || [];
      o[k] = {
        monIso: info.monIso,
        mix: E.mZoneMix(ss),
        sessions: ss.map(function (s) {
          return { min: E.mSessMinutes(s), km: E.mSessKm(s), peak: E.mPeakZone(s), summary: E.mSessSummary(s), status: E.mSessStatus(s, info), analyze: E.mAnalyze(s, info) };
        }),
      };
    });
    return o;
  });
  out.maratona = m;
  return out;
}
