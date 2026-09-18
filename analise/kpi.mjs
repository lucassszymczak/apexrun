// ============================================================================
// Apex Performance — motor de KPIs (puro, sem dependências, testável em Node)
// Fórmulas fiéis ao "Livro de fórmulas" (Apex Performance).
// Unidades: distância em km, tempo em segundos, FC em bpm, elevação em metros.
// ============================================================================

export const GAP_UP = 0.035;   // +3,5% de custo por +1% de inclinação (subida)
export const GAP_DOWN = 0.015; // −1,5% de crédito por −1% de inclinação (descida)

// ---- utilidades de tempo -------------------------------------------------
export function paceStr(secPerKm) {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm - m * 60);
  const ss = s === 60 ? 0 : s;
  const mm = s === 60 ? m + 1 : m;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}
export function hms(sec) {
  if (!isFinite(sec) || sec < 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

// ---- GAP: velocidade ajustada à inclinação (Minetti assimétrico) ----------
// Regra fixa Apex, aplicada km a km. NUNCA usar elevação líquida.
// multiplicador de custo para uma inclinação g (%): >1 = mais caro (subida).
export function gradeCostMult(gradePct) {
  const k = gradePct >= 0 ? GAP_UP : GAP_DOWN;
  return 1 + k * gradePct;
}

// Tempo-GAP (equivalente no plano) a partir de splits com elevação por km.
// splits: [{ timeSec, distKm, elevDeltaM }]
export function gapTimeFromSplits(splits) {
  let gapTime = 0;
  for (const s of splits) {
    const distKm = s.distKm || 1;
    const gradePct = (s.elevDeltaM || 0) / (distKm * 10); // Δm / (metros/100)
    const mult = gradeCostMult(clamp(gradePct, -35, 35));
    gapTime += s.timeSec / mult; // no plano correria em menos (subida) / mais (descida) tempo
  }
  return gapTime;
}

// Estimativa de tempo-GAP sem splits (só ganho/perda totais). 1ª ordem.
export function gapTimeEstimate(durationSec, distKm, gainM, lossM) {
  const avgPace = durationSec / distKm; // s/km
  const penaltyUp = (GAP_UP / 10) * avgPace * (gainM || 0); // subtrai (fica mais rápido no plano)
  const creditDown = (GAP_DOWN / 10) * avgPace * (lossM || 0); // soma (fica mais lento no plano)
  return durationSec - penaltyUp + creditDown;
}

// Resolve tempo-GAP + confiança a partir do treino.
export function computeGap(w) {
  const dist = w.distKm;
  if (!dist || !w.durationSec) return { gapTimeSec: null, gapSpeed: null, gapPace: null, confidence: "sem dados" };
  if (w.splits && w.splits.length && w.splits.some((s) => s.elevDeltaM != null)) {
    const gapTime = gapTimeFromSplits(
      w.splits.map((s) => ({
        timeSec: s.timeSec,
        distKm: s.distKm || 1,
        elevDeltaM: s.elevDeltaM || 0,
      }))
    );
    return finishGap(gapTime, dist, "alta");
  }
  if ((w.gainM != null && w.gainM > 0) || (w.lossM != null && w.lossM > 0)) {
    const gapTime = gapTimeEstimate(w.durationSec, dist, w.gainM || 0, w.lossM || 0);
    return finishGap(gapTime, dist, "estimada");
  }
  // sem elevação: GAP = pace bruto
  return finishGap(w.durationSec, dist, "plano");
}
function finishGap(gapTimeSec, distKm, confidence) {
  const gapPace = gapTimeSec / distKm;
  const gapSpeed = (distKm * 1000) / gapTimeSec;
  return { gapTimeSec, gapSpeed, gapPace, confidence };
}

// ---- EF (Efficiency Factor) = velocidade_GAP (m/s) ÷ FC média -------------
export function computeEF(w) {
  const gap = computeGap(w);
  if (!gap.gapSpeed || !w.hrAvg) return null;
  return gap.gapSpeed / w.hrAvg;
}

// ---- Decoupling % = (EF_1ª − EF_2ª) / EF_1ª × 100 -------------------------
// A partir de splits (divide por distância na metade) ou de metades manuais.
export function computeDecoupling(w) {
  if (w.decouplingPct != null) return w.decouplingPct;
  if (w.half1 && w.half2 && w.half1.hrAvg && w.half2.hrAvg) {
    const ef1 = halfEF(w.half1);
    const ef2 = halfEF(w.half2);
    if (ef1 && ef2) return ((ef1 - ef2) / ef1) * 100;
  }
  if (w.splits && w.splits.length >= 4) {
    const halves = splitIntoHalves(w.splits);
    if (halves) {
      const ef1 = halfEFfromSplits(halves.first);
      const ef2 = halfEFfromSplits(halves.second);
      if (ef1 && ef2) return ((ef1 - ef2) / ef1) * 100;
    }
  }
  return null;
}
function halfEF(h) {
  // h: { distKm, timeSec, hrAvg, gainM, lossM }
  const gap = computeGap({ distKm: h.distKm, durationSec: h.timeSec, gainM: h.gainM, lossM: h.lossM });
  if (!gap.gapSpeed) return null;
  return gap.gapSpeed / h.hrAvg;
}
function halfEFfromSplits(splits) {
  const dist = splits.reduce((a, s) => a + (s.distKm || 1), 0);
  const time = splits.reduce((a, s) => a + s.timeSec, 0);
  const hr = weightedHr(splits);
  if (!hr) return null;
  const gapTime = gapTimeFromSplits(splits);
  const gapSpeed = (dist * 1000) / gapTime;
  return gapSpeed / hr;
}
function weightedHr(splits) {
  let num = 0, den = 0;
  for (const s of splits) {
    if (s.hrAvg) { num += s.hrAvg * s.timeSec; den += s.timeSec; }
  }
  return den ? num / den : null;
}
function splitIntoHalves(splits) {
  const total = splits.reduce((a, s) => a + (s.distKm || 1), 0);
  let acc = 0;
  const first = [], second = [];
  for (const s of splits) {
    if (acc + (s.distKm || 1) / 2 <= total / 2) first.push(s);
    else second.push(s);
    acc += s.distKm || 1;
  }
  if (!first.length || !second.length) return null;
  return { first, second };
}

// ---- Pacing strategy a partir de splits -----------------------------------
export function computePacing(w) {
  if (!w.splits || w.splits.length < 2) return null;
  const halves = splitIntoHalves(w.splits);
  if (!halves) return null;
  const p1 = paceOf(halves.first), p2 = paceOf(halves.second);
  const delta = (p2 - p1) / p1; // pace: menor = mais rápido
  let label;
  if (delta < -0.01) label = "negative split";
  else if (delta > 0.01) label = "positive split";
  else label = "even";
  // closer: último km bem mais rápido que a média dos anteriores
  const paces = w.splits.map((s) => s.timeSec / (s.distKm || 1));
  const last = paces[paces.length - 1];
  const prevAvg = paces.slice(0, -1).reduce((a, b) => a + b, 0) / (paces.length - 1);
  const closer = last < prevAvg * 0.95;
  return { label, deltaPct: delta * 100, closer, lastGainSec: prevAvg - last };
}
function paceOf(splits) {
  const dist = splits.reduce((a, s) => a + (s.distKm || 1), 0);
  const time = splits.reduce((a, s) => a + s.timeSec, 0);
  return time / dist;
}

// ---- Pace stability = desvio-padrão do pace-GAP entre km -------------------
export function computePaceStability(w) {
  if (!w.splits || w.splits.length < 3) return null;
  const gapPaces = w.splits.map((s) => {
    const g = computeGap({ distKm: s.distKm || 1, durationSec: s.timeSec, gainM: s.elevDeltaM > 0 ? s.elevDeltaM : 0, lossM: s.elevDeltaM < 0 ? -s.elevDeltaM : 0 });
    return g.gapPace;
  });
  return { stdSec: std(gapPaces), cvPct: (std(gapPaces) / mean(gapPaces)) * 100 };
}

// ---- TRIMP (Banister, masculino) ------------------------------------------
// FCr = (FC − FCrep) / (FCmáx − FCrep); TRIMP = min × FCr × 0,64·e^(1,92·FCr)
export function trimpSegment(minutes, hr, fcRep, fcMax) {
  if (!hr || !fcRep || !fcMax || fcMax <= fcRep) return null;
  const fcr = clamp((hr - fcRep) / (fcMax - fcRep), 0, 1);
  return minutes * fcr * 0.64 * Math.exp(1.92 * fcr);
}
export function computeTrimp(w, athlete) {
  const fcRep = athlete.fcRep, fcMax = athlete.fcMax;
  if (!fcRep || !fcMax) return null;
  if (w.splits && w.splits.length && w.splits.every((s) => s.hrAvg)) {
    let t = 0;
    for (const s of w.splits) t += trimpSegment(s.timeSec / 60, s.hrAvg, fcRep, fcMax) || 0;
    return t;
  }
  if (!w.hrAvg || !w.durationSec) return null;
  return trimpSegment(w.durationSec / 60, w.hrAvg, fcRep, fcMax);
}

// ---- Custo cardíaco do km = FC média ÷ velocidade-GAP ----------------------
export function computeHrCostPerKm(w) {
  const gap = computeGap(w);
  if (!gap.gapSpeed || !w.hrAvg) return null;
  return w.hrAvg / gap.gapSpeed; // menor = mais barato
}

// ---- Zonas de FC (%FCR, Karvonen) e classificação fácil/forte -------------
export function hrZone(hr, fcRep, fcMax) {
  if (!hr || !fcRep || !fcMax || fcMax <= fcRep) return null;
  const pct = (hr - fcRep) / (fcMax - fcRep);
  if (pct < 0.59) return 1;
  if (pct < 0.74) return 2;
  if (pct < 0.84) return 3;
  if (pct < 0.88) return 4;
  return 5;
}
// Segundos em cada zona a partir do histograma de FC (bpm -> s) do .FIT.
export function zonesFromHist(hrHist, fcRep, fcMax) {
  const z = [0, 0, 0, 0, 0];
  if (!hrHist) return null;
  for (const bpm in hrHist) {
    const zone = hrZone(+bpm, fcRep, fcMax);
    if (zone) z[zone - 1] += hrHist[bpm];
  }
  return z;
}
// Segundos por zona de UM treino: usa o histograma real do .FIT quando existe;
// senão joga a duração inteira na zona da FC média (aproximação).
export function zoneSeconds(w, athlete) {
  if (w.hrHist) {
    const z = zonesFromHist(w.hrHist, athlete.fcRep, athlete.fcMax);
    if (z && z.some((x) => x > 0)) return z;
  }
  if (w.hrAvg && w.durationSec) {
    const zone = hrZone(w.hrAvg, athlete.fcRep, athlete.fcMax);
    if (zone) { const z = [0, 0, 0, 0, 0]; z[zone - 1] = w.durationSec; return z; }
  }
  return null;
}
// 80/20: % do tempo em zona fácil (Z1–Z2), agora com tempo REAL em zona.
export function polarization(workouts, athlete) {
  const zt = [0, 0, 0, 0, 0];
  for (const w of workouts) {
    const z = zoneSeconds(w, athlete);
    if (z) for (let i = 0; i < 5; i++) zt[i] += z[i];
  }
  const total = zt.reduce((a, b) => a + b, 0);
  if (!total) return null;
  return { easyPct: ((zt[0] + zt[1]) / total) * 100, totalSec: total, zones: zt };
}
// Training Distribution: volume por intensidade (fácil / moderado / forte).
export function trainingDistribution(workouts, athlete) {
  const pol = polarization(workouts, athlete);
  if (!pol) return null;
  const z = pol.zones, total = pol.totalSec;
  return {
    zones: z,
    totalSec: total,
    bands: {
      facil: z[0] + z[1],
      moderado: z[2],
      forte: z[3] + z[4],
    },
    pct: {
      facil: ((z[0] + z[1]) / total) * 100,
      moderado: (z[2] / total) * 100,
      forte: ((z[3] + z[4]) / total) * 100,
    },
  };
}
// Hill / Climb Performance a partir dos splits com Δelevação por km.
export function hillPerformance(w) {
  if (!w.splits || w.splits.length < 3) return null;
  const km = w.splits
    .filter((s) => s.elevDeltaM != null && s.timeSec > 0)
    .map((s) => {
      const dist = (s.distKm || 1) * 1000;
      return { grade: s.elevDeltaM / ((s.distKm || 1) * 10), speed: dist / s.timeSec, hr: s.hrAvg, gain: s.elevDeltaM > 0 ? s.elevDeltaM : 0 };
    });
  if (!km.length) return null;
  const flat = km.filter((k) => Math.abs(k.grade) < 1);
  const up = km.filter((k) => k.grade >= 1.5);
  const flatSpeed = flat.length ? median(flat.map((k) => k.speed)) : null;
  const flatHr = flat.length ? mean(flat.filter((k) => k.hr).map((k) => k.hr)) : null;
  const gain = km.reduce((a, k) => a + k.gain, 0);
  if (!up.length || !flatSpeed) return { climbKm: up.length, gainM: Math.round(gain), effVsModel: null, speedLossPctPerGrade: null, hrExtra: null };
  // eficiência vs. modelo de Minetti: real ÷ (flat ÷ custo). >1 = sobe melhor que o previsto.
  const effs = up.map((k) => k.speed / (flatSpeed / gradeCostMult(k.grade)));
  const lossPer = mean(up.map((k) => ((flatSpeed - k.speed) / flatSpeed) * 100 / k.grade)); // %perda por +1% de rampa
  const hrExtra = flatHr && up.some((k) => k.hr) ? mean(up.filter((k) => k.hr).map((k) => k.hr)) - flatHr : null;
  return { climbKm: up.length, gainM: Math.round(gain), effVsModel: mean(effs), speedLossPctPerGrade: lossPer, hrExtra: hrExtra != null ? Math.round(hrExtra) : null };
}
export function hillAggregate(workouts) {
  const rows = workouts.map(hillPerformance).filter((h) => h && h.effVsModel != null);
  if (!rows.length) return null;
  return {
    sessions: rows.length,
    effVsModel: mean(rows.map((r) => r.effVsModel)),
    speedLossPctPerGrade: mean(rows.map((r) => r.speedLossPctPerGrade)),
    totalClimbM: workouts.reduce((a, w) => { const h = hillPerformance(w); return a + (h ? h.gainM : 0); }, 0),
  };
}

// ---- Carga diária + CTL/ATL/TSB (Fitness/Fatigue/Form) --------------------
// Média móvel exponencial: CTL 42d, ATL 7d, TSB = CTL_ontem − ATL_ontem.
export function dailyLoads(workouts, athlete) {
  const map = new Map();
  for (const w of workouts) {
    const t = computeTrimp(w, athlete);
    if (t == null) continue;
    const d = w.date;
    map.set(d, (map.get(d) || 0) + t);
  }
  return map; // date(ISO) -> load
}
export function fitnessSeries(workouts, athlete) {
  const loads = dailyLoads(workouts, athlete);
  if (!loads.size) return [];
  const dates = [...loads.keys()].sort();
  const start = new Date(dates[0]);
  const end = new Date(dates[dates.length - 1]);
  const out = [];
  let ctl = 0, atl = 0;
  const kC = 1 - Math.exp(-1 / 42);
  const kA = 1 - Math.exp(-1 / 7);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const load = loads.get(iso) || 0;
    const tsb = ctl - atl; // forma = fitness_ontem − fatigue_ontem
    ctl = ctl + kC * (load - ctl);
    atl = atl + kA * (load - atl);
    out.push({ date: iso, load, ctl, atl, tsb });
  }
  return out;
}

// ---- Razão aguda:crônica (A:C) --------------------------------------------
export function acuteChronic(workouts, athlete, refDate) {
  const loads = dailyLoads(workouts, athlete);
  const ref = refDate ? new Date(refDate) : latestDate(workouts);
  if (!ref) return null;
  let acute = 0, chronic = 0;
  for (const [iso, load] of loads) {
    const days = daysBetween(new Date(iso), ref);
    if (days >= 0 && days < 7) acute += load;
    if (days >= 0 && days < 28) chronic += load;
  }
  const chronicAvg7 = chronic / 4; // média semanal dos 28 dias
  if (chronicAvg7 <= 0) return null;
  const ratio = acute / chronicAvg7;
  let zone;
  if (ratio < 0.8) zone = "baixa";
  else if (ratio <= 1.3) zone = "sweet spot";
  else if (ratio <= 1.5) zone = "atenção";
  else zone = "risco";
  return { ratio, zone, acute, chronicAvg7 };
}

// ---- Performance Trend (janela atual vs anterior) -------------------------
export function performanceTrend(efSeries, windowN = 4) {
  if (efSeries.length < 2) return null;
  const cur = efSeries.slice(-windowN);
  const prev = efSeries.slice(-2 * windowN, -windowN);
  if (!prev.length) return null;
  const dc = mean(cur.map((x) => x.value));
  const dp = mean(prev.map((x) => x.value));
  const delta = (dc - dp) / dp;
  let arrow;
  if (delta > 0.02) arrow = "↗";
  else if (delta < -0.02) arrow = "↘";
  else arrow = "→";
  return { arrow, deltaPct: delta * 100, enough: cur.length >= 3 && prev.length >= 3 };
}

// ---- Race Prediction (Riegel, expoente 1,06) ------------------------------
export function riegel(anchorDistKm, anchorTimeSec, targetDistKm) {
  return anchorTimeSec * Math.pow(targetDistKm / anchorDistKm, 1.06);
}
export function racePredictions(anchorDistKm, anchorTimeSec) {
  const targets = [
    { name: "5 km", d: 5 },
    { name: "10 km", d: 10 },
    { name: "21,1 km", d: 21.0975 },
    { name: "42,2 km", d: 42.195 },
  ];
  return targets.map((t) => {
    const time = riegel(anchorDistKm, anchorTimeSec, t.d);
    return { ...t, timeSec: time, paceSec: time / t.d };
  });
}

// ---- VO2máx: banda de referência (homem 30–39) ----------------------------
export function vo2Band(v) {
  if (v == null) return null;
  if (v < 36) return "abaixo";
  if (v <= 42) return "bom";
  if (v <= 52) return "excelente";
  return "superior";
}

// ---- Consistência: streak de dias e aderência semanal ---------------------
export function consistency(workouts, weeklyTarget) {
  if (!workouts.length) return null;
  const days = new Set(workouts.map((w) => w.date));
  // maior streak de semanas atingindo o alvo
  const byWeek = new Map();
  for (const w of workouts) {
    const wk = isoWeekKey(w.date);
    byWeek.set(wk, (byWeek.get(wk) || 0) + 1);
  }
  const weeks = [...byWeek.entries()];
  const metWeeks = weeks.filter(([, n]) => n >= (weeklyTarget || 1)).length;
  const adherence = weeks.length ? (metWeeks / weeks.length) * 100 : 0;
  return { activeDays: days.size, weeks: weeks.length, adherencePct: adherence };
}

// ---- Athlete Performance Score (metodologia transparente) -----------------
// Subíndices 0–100: Eficiência, Consistência, Resistência à fadiga, Volume.
export function performanceScore(ctx) {
  // ctx: { efTrendPct, efReady, decoupling, adherencePct, weeklyKm, targetKm }
  const eff = clamp(50 + (ctx.efTrendPct || 0) * 5, 0, 100);           // +1% EF ≈ +5 pts
  const cons = clamp(ctx.adherencePct != null ? ctx.adherencePct : 60, 0, 100);
  const fat = ctx.decoupling != null
    ? clamp(100 - Math.max(0, ctx.decoupling) * 8, 0, 100)              // 0% → 100; 12,5% → 0
    : 70;
  const vol = ctx.targetKm ? clamp((ctx.weeklyKm / ctx.targetKm) * 100, 0, 100) : clamp((ctx.weeklyKm || 0) * 2, 0, 100);
  const overall = Math.round(0.30 * eff + 0.25 * cons + 0.25 * fat + 0.20 * vol);
  return {
    overall,
    parts: {
      "Eficiência": Math.round(eff),
      "Consistência": Math.round(cons),
      "Resist. fadiga": Math.round(fat),
      "Volume": Math.round(vol),
    },
  };
}

// ---- Running Readiness (0–100, com bandas) --------------------------------
export function readiness(ctx) {
  // ctx: { tsb, adherencePct, sleepH, soreness, pain, restingDelta (bpm vs base), hrvDeltaPct }
  let score = 75;
  if (ctx.tsb != null) score += clamp(ctx.tsb, -25, 15);          // forma fresca soma
  if (ctx.adherencePct != null) score += (ctx.adherencePct - 70) * 0.1;
  if (ctx.sleepH != null) score += clamp((ctx.sleepH - 7) * 4, -12, 8);
  if (ctx.soreness != null) score -= ctx.soreness * 2.5;
  if (ctx.pain) score -= 25;
  if (ctx.restingDelta != null) score -= clamp(ctx.restingDelta * 3, -6, 18); // FC repouso alta = pior
  if (ctx.hrvDeltaPct != null) score += clamp(ctx.hrvDeltaPct * 0.3, -12, 8);  // HRV alta = melhor
  score = Math.round(clamp(score, 0, 100));
  let band;
  if (score >= 90) band = "Peak Ready";
  else if (score >= 80) band = "Ready";
  else if (score >= 70) band = "Moderate";
  else if (score >= 60) band = "Caution";
  else band = "Recovery";
  return { score, band };
}

// ---- Recovery Status (proprietário) ---------------------------------------
// Olha para trás: quão recuperado, via carga recente + FC repouso + HRV + sono.
export function recoveryStatus(ctx) {
  // ctx: { tsb, restingDelta (bpm vs base), hrvDeltaPct, sleepH }
  let s = 100;
  if (ctx.restingDelta != null) s -= clamp(ctx.restingDelta * 5, -8, 30);
  if (ctx.hrvDeltaPct != null) s += clamp(ctx.hrvDeltaPct * 0.5, -25, 12);
  if (ctx.sleepH != null) s -= clamp((7.5 - ctx.sleepH) * 6, -6, 24);
  if (ctx.tsb != null && ctx.tsb < -20) s -= clamp((-ctx.tsb - 20) * 0.6, 0, 15);
  s = Math.round(clamp(s, 0, 100));
  const label = s >= 75 ? "Good" : s >= 55 ? "Moderate" : "Needs Recovery";
  return { score: s, label };
}

// ---- Tendência de uma métrica diária vs. baseline recente ------------------
// entries: [{date, <key>}], refDate ISO. baseline = mediana da janela anterior.
export function metricTrend(entries, key, refDate, baseDays = 14) {
  const rows = entries
    .filter((e) => e[key] != null && (!refDate || e.date <= refDate))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!rows.length) return null;
  const latest = rows[0];
  const ref = refDate ? new Date(refDate + "T00:00:00") : new Date(latest.date + "T00:00:00");
  const base = rows.slice(1).filter((e) => {
    const days = Math.round((ref - new Date(e.date + "T00:00:00")) / 86400000);
    return days >= 1 && days <= baseDays;
  });
  const baseline = base.length ? median(base.map((e) => e[key])) : null;
  const deltaAbs = baseline != null ? latest[key] - baseline : null;
  const deltaPct = baseline ? (deltaAbs / baseline) * 100 : null;
  return { latest: latest[key], date: latest.date, baseline, deltaAbs, deltaPct };
}

// valor diário mais recente de uma chave (em/antes de refDate)
export function latestDaily(entries, key, refDate) {
  const rows = entries
    .filter((e) => e[key] != null && (!refDate || e.date <= refDate))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return rows.length ? { value: rows[0][key], date: rows[0].date } : null;
}

// ---- helpers ---------------------------------------------------------------
export function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
export function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
export function std(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
}
export function median(a) {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function latestDate(workouts) {
  const ds = workouts.map((w) => new Date(w.date)).sort((a, b) => a - b);
  return ds.length ? ds[ds.length - 1] : null;
}
function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
function isoWeekKey(iso) {
  const d = new Date(iso + "T00:00:00");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
export { isoWeekKey };
