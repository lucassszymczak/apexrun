// ============================================================================
// STREAM 1 Hz — pré-processamento por amostra para os KPIs de FC × inclinação.
// Reusa o GAP (Minetti assimétrico) já existente: v_GAP = velocidade × custo(grade).
// Não altera as fórmulas de EF/decoupling/TRIMP. Puro e testável (sem DOM/rede).
// ============================================================================
import { gradeCostMult } from "./kpi.mjs";

// --- helpers ---------------------------------------------------------------
function num(x) { return typeof x === "number" && isFinite(x) ? x : null; }
function median(a) {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

// spm "cheio": o .FIT de corrida grava cadência por perna (~84). Valores <130 dobram.
export function toSpm(cad) {
  if (cad == null) return null;
  return cad < 130 ? Math.round(cad * 2) : Math.round(cad);
}

// v_GAP por amostra (m/s): velocidade equivalente no plano. Subida (custo>1) → v_GAP>v.
export function vGap(speed, gradePct) {
  if (speed == null || gradePct == null) return null;
  return speed * gradeCostMult(gradePct);
}

// --- 1) reamostragem para 1 Hz --------------------------------------------
// records: [{t(s), dist(m), speed(m/s), hr, alt(m), cad}]. Interpola lacunas ≤maxGap;
// lacunas maiores marcam o trecho como inválido (campo gap=true nas amostras criadas).
export function resampleHz(records, hz = 1, maxGapS = 5) {
  const recs = (records || []).filter((r) => r && num(r.t) != null).sort((a, b) => a.t - b.t);
  if (recs.length < 2) return [];
  const step = 1 / hz, t0 = recs[0].t, tN = recs[recs.length - 1].t;
  const out = [];
  let j = 0;
  const fields = ["dist", "speed", "hr", "alt", "cad"];
  for (let t = t0; t <= tN + 1e-6; t += step) {
    while (j < recs.length - 1 && recs[j + 1].t <= t) j++;
    const a = recs[j], b = recs[Math.min(j + 1, recs.length - 1)];
    const span = b.t - a.t;
    const bigGap = span > maxGapS && t > a.t + 1e-6 && t < b.t - 1e-6;
    const f = span > 0 ? clamp((t - a.t) / span, 0, 1) : 0;
    const s = { t: Math.round((t - t0) * 1000) / 1000, gap: bigGap };
    for (const k of fields) {
      const va = num(a[k]), vb = num(b[k]);
      s[k] = va == null ? vb : vb == null ? va : va + (vb - va) * f;
    }
    out.push(s);
  }
  return out;
}

// --- 2) altitude suavizada + grade em janela de ~winM metros --------------
export function gradeSeries(samples, winM = 50, clipPct = 25) {
  const n = samples.length;
  const grade = new Array(n).fill(null);
  if (!n || samples[0].dist == null) return grade;
  const half = winM / 2;
  // média móvel da altitude por distância (suaviza ruído do barômetro)
  const altSm = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const d = samples[i].dist; if (d == null) continue;
    let sum = 0, cnt = 0;
    for (let k = i; k >= 0 && d - samples[k].dist <= half; k--) { if (samples[k].alt != null) { sum += samples[k].alt; cnt++; } }
    for (let k = i + 1; k < n && samples[k].dist - d <= half; k++) { if (samples[k].alt != null) { sum += samples[k].alt; cnt++; } }
    altSm[i] = cnt ? sum / cnt : samples[i].alt;
  }
  // grade = Δalt suavizada ÷ Δdist nos extremos da janela (central), em %
  for (let i = 0; i < n; i++) {
    const d = samples[i].dist; if (d == null) continue;
    let lo = i, hi = i;
    while (lo > 0 && d - samples[lo].dist < half) lo--;
    while (hi < n - 1 && samples[hi].dist - d < half) hi++;
    const dd = samples[hi].dist - samples[lo].dist;
    if (dd > 1 && altSm[lo] != null && altSm[hi] != null) grade[i] = clamp(((altSm[hi] - altSm[lo]) / dd) * 100, -clipPct, clipPct);
    else grade[i] = 0;
  }
  return grade;
}

// --- 3) pré-processamento: exclusões (§2) + relatório de qualidade --------
// opts: {firstMin=10, minSpeed=1.5, walkSpm=140, hrJump=15, gradeRegLimit=15}
export function preprocess(records, opts = {}) {
  const o = Object.assign({ hz: 1, maxGapS: 5, winM: 50, firstMin: 10, minSpeed: 1.5, walkSpm: 140, hrJump: 15, gradeRegLimit: 15 }, opts);
  const rs = resampleHz(records, o.hz, o.maxGapS);
  const grade = gradeSeries(rs, o.winM);
  const hasHR = rs.some((s) => s.hr != null);
  const hasCad = rs.some((s) => s.cad != null);
  const hasAlt = rs.some((s) => s.alt != null);
  const reasons = {};
  const bump = (k) => { reasons[k] = (reasons[k] || 0) + 1; };
  const samples = [];
  let prevHr = null, prevT = null;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i], spm = toSpm(r.cad), g = grade[i];
    const s = { t: r.t, spd: r.speed != null ? Math.round(r.speed * 1000) / 1000 : null, grade: g != null ? Math.round(g * 10) / 10 : null, hr: r.hr != null ? Math.round(r.hr) : null, spm: spm, vgap: vGap(r.speed, g), valid: true, inReg: true };
    // artefato de FC: salto > hrJump bpm/s
    let hrArt = false;
    if (s.hr != null && prevHr != null && prevT != null) {
      const dt = r.t - prevT;
      if (dt > 0 && Math.abs(s.hr - prevHr) / dt > o.hrJump) hrArt = true;
    }
    if (s.hr != null) { prevHr = s.hr; prevT = r.t; }
    if (r.gap) { s.valid = false; bump("lacuna>5s"); }
    if (r.t < o.firstMin * 60) { s.valid = false; bump("primeiros " + o.firstMin + " min"); }
    if (s.spd != null && s.spd < o.minSpeed) { s.valid = false; bump("parado/<" + o.minSpeed + " m/s"); }
    if (spm != null && spm < o.walkSpm) { s.valid = false; bump("caminhada (spm<" + o.walkSpm + ")"); }
    if (hrArt) { s.valid = false; bump("artefato de FC"); }
    if (s.hr == null) { s.valid = false; bump("sem FC"); }
    // |grade|>limite: fora só das regressões (continua nos cálculos gerais)
    if (g != null && Math.abs(g) > o.gradeRegLimit) s.inReg = false;
    samples.push(s);
  }
  const total = samples.length;
  const validN = samples.filter((s) => s.valid).length;
  const excludedPct = total ? Math.round((1 - validN / total) * 1000) / 10 : 100;
  const quality = {
    totalSec: total, validSec: validN, validMin: Math.round(validN / 60 * 10) / 10,
    excludedPct, reasons, hasHR, hasCad, hasAlt,
    // §8: dado fraco → não persistir calado
    needsConfirm: !hasHR || !hasCad || !hasAlt || excludedPct > 20,
  };
  return { samples, grade, quality };
}

// --- 4) stream reduzido para armazenamento (~1 amostra/everyS s) ----------
export function reduceStream(samples, everyS = 3) {
  const s = [];
  let next = 0;
  for (const x of samples) {
    if (x.t + 1e-9 >= next) {
      s.push({ t: Math.round(x.t), spd: x.spd, grade: x.grade, hr: x.hr, spm: x.spm, v: x.valid ? 1 : 0 });
      next = x.t + everyS;
    }
  }
  return { everyS, n: s.length, s };
}
// reidrata o stream reduzido para o formato de amostras (com vgap recomputado)
export function expandStream(stream) {
  if (!stream || !stream.s) return [];
  return stream.s.map((x) => ({ t: x.t, spd: x.spd, grade: x.grade, hr: x.hr, spm: x.spm, vgap: vGap(x.spd, x.grade), valid: x.v !== 0, inReg: true }));
}

// --- 5) Theil-Sen (regressão robusta univariada) --------------------------
export function theilSen(xs, ys) {
  const n = xs.length, slopes = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const dx = xs[j] - xs[i]; if (Math.abs(dx) < 1e-9) continue;
    slopes.push((ys[j] - ys[i]) / dx);
  }
  if (!slopes.length) return null;
  const b = median(slopes);
  const a = median(xs.map((x, i) => ys[i] - b * x));
  // R² do ajuste robusto
  const yb = ys.reduce((s, y) => s + y, 0) / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) { const pred = a + b * xs[i]; ssRes += (ys[i] - pred) ** 2; ssTot += (ys[i] - yb) ** 2; }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { a, b, r2, n };
}

// espaçamento típico entre amostras (s) — robusto a 1 Hz ou stream reduzido
function sampleDt(samples) {
  const d = [];
  for (let i = 1; i < samples.length; i++) { const x = samples[i].t - samples[i - 1].t; if (x > 0) d.push(x); }
  return median(d) || 1;
}

// --- 6) defasagem da FC (correlação cruzada v_GAP × FC, 0–90 s) -----------
export function hrLag(samples, maxLagS = 90) {
  const dt = sampleDt(samples);
  const v = samples.map((s) => (s.valid ? s.vgap : null));
  const hr = samples.map((s) => (s.valid ? s.hr : null));
  function corrAt(lagIdx) {
    const xs = [], ys = [];
    for (let i = 0; i + lagIdx < samples.length; i++) if (v[i] != null && hr[i + lagIdx] != null) { xs.push(v[i]); ys.push(hr[i + lagIdx]); }
    if (xs.length < 30) return -2;
    const mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, y) => s + y, 0) / ys.length;
    let num2 = 0, dx = 0, dy = 0;
    for (let i = 0; i < xs.length; i++) { const a = xs[i] - mx, b = ys[i] - my; num2 += a * b; dx += a * a; dy += b * b; }
    return dx > 0 && dy > 0 ? num2 / Math.sqrt(dx * dy) : -2;
  }
  let best = 0, bestC = -2;
  for (let lag = 0; lag <= maxLagS; lag += dt) { const c = corrAt(Math.round(lag / dt)); if (c > bestC) { bestC = c; best = Math.round(lag); } }
  return { lagSec: best, corr: bestC >= -1 ? Math.round(bestC * 1000) / 1000 : null };
}

// --- 7) Pace-GAP @ FC_REF (KPI 3.1) ---------------------------------------
// Mediana do v_GAP nas amostras válidas da JANELA com FC (defasada) em FC_REF±band.
// Fallback: <8 min na banda mas faixa observada cobre FC_REF → Theil-Sen FC~v_GAP (só interpola).
// Confiança: Alta ≥15 min · Moderada 8–15 min ou fallback R²≥0,5 · Baixa demais ·
//            "Dados insuficientes" se FC_REF fora da faixa de FC observada.
export function paceGapAtHR(samples, opts = {}) {
  const o = Object.assign({ fcRef: 145, band: 3, lagSec: 0, win: [10, 45] }, opts);
  const w0 = o.win[0] * 60, w1 = o.win[1] * 60;
  const dt = sampleDt(samples), lagIdx = Math.round(o.lagSec / dt);
  const inWin = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i], j = i + lagIdx;
    if (!s.valid || s.vgap == null || s.t < w0 || s.t > w1) continue;
    const hrL = (j < samples.length && samples[j] && samples[j].hr != null && samples[j].valid) ? samples[j].hr : null;
    if (hrL == null) continue;
    inWin.push({ vgap: s.vgap, hr: hrL });
  }
  const toPace = (v) => (v > 0 ? 1000 / v : null);
  if (!inWin.length) return { paceSec: null, vGap: null, confidence: "Dados insuficientes", minInBand: 0, method: null };
  const hrs = inWin.map((p) => p.hr), hrMin = Math.min(...hrs), hrMax = Math.max(...hrs);
  const band = inWin.filter((p) => Math.abs(p.hr - o.fcRef) <= o.band);
  const minInBand = Math.round((band.length * dt) / 60 * 10) / 10;
  // caminho principal: mediana na banda (≥8 min)
  if (minInBand >= 8) {
    const v = median(band.map((p) => p.vgap));
    return { paceSec: toPace(v), vGap: v, confidence: minInBand >= 15 ? "Alta" : "Moderada", minInBand, method: "mediana" };
  }
  // fallback: regressão robusta — só se FC_REF está DENTRO da faixa observada (interpola, nunca extrapola)
  if (o.fcRef >= hrMin && o.fcRef <= hrMax) {
    const fit = theilSen(inWin.map((p) => p.vgap), inWin.map((p) => p.hr)); // hr ≈ a + b·vgap
    if (fit && Math.abs(fit.b) > 1e-6) {
      const v = (o.fcRef - fit.a) / fit.b;
      if (v > 0) return { paceSec: toPace(v), vGap: v, confidence: fit.r2 >= 0.5 ? "Moderada" : "Baixa", minInBand, method: "regressão", r2: Math.round(fit.r2 * 100) / 100 };
    }
    if (band.length) { const v = median(band.map((p) => p.vgap)); return { paceSec: toPace(v), vGap: v, confidence: "Baixa", minInBand, method: "mediana" }; }
  }
  // FC_REF fora da faixa de FC observada
  return { paceSec: null, vGap: null, confidence: "Dados insuficientes", minInBand: 0, method: null, hrRange: [hrMin, hrMax] };
}

// --- 9) médias da sessão para a Árvore da Eficiência (3.2) ----------------
// Médias das amostras VÁLIDAS (do min firstMin ao fim). A identidade
// m/bat = passos/bat × m/passo fecha exatamente porque as três usam as mesmas médias.
export function sessionEff(samples, win = [10, 1e9]) {
  const w0 = win[0] * 60, w1 = win[1] * 60, dt = sampleDt(samples);
  const vg = [], hr = [], spm = [];
  for (const s of samples) {
    if (!s.valid || s.t < w0 || s.t > w1) continue;
    if (s.vgap == null || s.hr == null || s.spm == null) continue;
    vg.push(s.vgap); hr.push(s.hr); spm.push(s.spm);
  }
  const validMin = Math.round((vg.length * dt) / 60 * 10) / 10;
  if (vg.length < 30) return null;
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const vgapMean = mean(vg), hrMean = mean(hr), spmMean = mean(spm);
  return {
    vgapMean, hrMean, spmMean,
    mPerBeat: vgapMean * 60 / hrMean,     // = EF × 60
    stepsPerBeat: spmMean / hrMean,
    mPerStep: vgapMean * 60 / spmMean,    // passada-GAP (m/passo)
    validMin, n: vg.length,
  };
}

// Decomposição Δln(m/bat) = Δln(passos/bat) + Δln(m/passo) vs. referência (média das 3 anteriores).
export function effTree(cur, prevAvg, neutralPct = 2) {
  if (!cur) return null;
  const out = { cur, prevAvg: prevAvg || null };
  if (!prevAvg) { out.label = "Primeira sessão com stream — sem comparação ainda"; return out; }
  const ln = (a, b) => (a > 0 && b > 0 ? Math.log(a / b) : 0);
  const dSb = ln(cur.stepsPerBeat, prevAvg.stepsPerBeat);
  const dMs = ln(cur.mPerStep, prevAvg.mPerStep);
  out.dln = { mPerBeat: dSb + dMs, stepsPerBeat: dSb, mPerStep: dMs };
  const denom = Math.abs(dSb) + Math.abs(dMs);
  out.contribPct = denom > 1e-9
    ? { stepsPerBeat: dSb / denom * 100, mPerStep: dMs / denom * 100 }
    : { stepsPerBeat: 0, mPerStep: 0 };
  const cadDeltaPct = (cur.spmMean / prevAvg.spmMean - 1) * 100;
  const efDeltaPct = (cur.mPerBeat / prevAvg.mPerBeat - 1) * 100;
  out.cadDeltaPct = cadDeltaPct; out.efDeltaPct = efDeltaPct;
  const cadUp = cadDeltaPct > neutralPct, cadStable = Math.abs(cadDeltaPct) <= neutralPct;
  const efUp = efDeltaPct > neutralPct, efDown = efDeltaPct < -neutralPct, efNeutral = Math.abs(efDeltaPct) <= neutralPct;
  let label = "Variação dentro do normal";
  if (cadUp && efNeutral) label = "Passada encurtou sem custo — ganho mecânico";
  else if (cadUp && efUp) label = "Economia";
  else if (cadUp && efDown) label = "Cadência com custo — revisar";
  else if (cadStable && efUp) label = "Motor: mais passada na mesma FC";
  out.label = label;
  return out;
}

// --- 10) Cadência @ PACE_REF (3.4) ----------------------------------------
// Mediana do spm nas amostras válidas da JANELA com pace-GAP em paceRef ± tol (s/km).
// Junto: % do tempo em movimento com spm na faixa de adesão [170,176].
export function cadenceAtPace(samples, opts = {}) {
  const o = Object.assign({ paceRef: null, tol: 15, win: [10, 45], adher: [170, 176], minMin: 5 }, opts);
  const w0 = o.win[0] * 60, w1 = o.win[1] * 60, dt = sampleDt(samples);
  const inRange = []; let moving = 0, adhN = 0;
  for (const s of samples) {
    if (!s.valid || s.t < w0 || s.t > w1 || s.spm == null) continue;
    moving++;
    if (s.spm >= o.adher[0] && s.spm <= o.adher[1]) adhN++;
    if (o.paceRef != null && s.vgap != null && s.vgap > 0 && Math.abs(1000 / s.vgap - o.paceRef) <= o.tol) inRange.push(s.spm);
  }
  const adherencePct = moving ? Math.round(adhN / moving * 1000) / 10 : null;
  const minInRange = Math.round((inRange.length * dt) / 60 * 10) / 10;
  if (o.paceRef == null || minInRange < o.minMin) return { spm: null, confidence: "Dados insuficientes", minInRange, adherencePct };
  return { spm: Math.round(median(inRange)), confidence: minInRange >= 10 ? "Alta" : "Moderada", minInRange, adherencePct };
}

// --- 11) Decoupling mecânico (3.5): passada-GAP 2ª vs 1ª metade -----------
// Δ% = (m/passo_1ª − m/passo_2ª) ÷ 1ª × 100 (positivo = passada caiu no fim).
// Só sessões com ≥minMin de tempo válido (como o decoupling cardíaco).
export function mechDecoupling(samples, win = [10, 1e9], minMin = 40) {
  const w0 = win[0] * 60, w1 = win[1] * 60, dt = sampleDt(samples);
  const pts = [];
  for (const s of samples) {
    if (!s.valid || s.t < w0 || s.t > w1 || s.vgap == null || s.spm == null || s.spm <= 0) continue;
    pts.push(s.vgap * 60 / s.spm);
  }
  const validMin = Math.round((pts.length * dt) / 60 * 10) / 10;
  if (validMin < minMin || pts.length < 4) return { pct: null, confidence: "Dados insuficientes", validMin };
  const mid = Math.floor(pts.length / 2), mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const h1 = mean(pts.slice(0, mid)), h2 = mean(pts.slice(mid));
  const pct = h1 > 0 ? (h1 - h2) / h1 * 100 : null;
  return { pct: pct != null ? Math.round(pct * 10) / 10 : null, confidence: "Moderada", half1: h1, half2: h2, validMin };
}

// --- 12) parâmetros de ciclo e utilidades dos KPIs ------------------------
// 3.3 defasagem: mediana do hrLag das sessões fáceis válidas (persistir no app).
export function medianLag(workouts) {
  const vals = (workouts || []).filter((w) => w && w.hrLagSec != null && !(w.quality && w.quality.needsConfirm)).map((w) => w.hrLagSec);
  if (!vals.length) return { lagSec: 0, n: 0 };
  return { lagSec: Math.round(median(vals)), n: vals.length };
}
// Matriz FC × mecânica (usa o limiar do decoupling cardíaco + zona neutra).
export function decoupleMatrix(cardiacPct, mechPct, opts = {}) {
  const o = Object.assign({ neutralPct: 2, cardiacThresh: 5 }, opts);
  if (cardiacPct == null && mechPct == null) return "Sem dados";
  const drift = cardiacPct != null && cardiacPct > o.cardiacThresh;
  const strideFell = mechPct != null && mechPct > o.neutralPct;
  if (drift && !strideFell) return "Deriva cardiovascular (calor/hidratação/duração)";
  if (drift && strideFell) return "Fadiga global";
  if (!drift && !strideFell) return "Sessão sob controle";
  return "Passada cedeu sem custo cardíaco — forma/força";
}
// PACE_REF_CAD sugerido: mediana do pace-GAP das sessões fáceis, arredondada a 5 s/km.
export function paceRefSuggest(workouts) {
  const vals = (workouts || []).filter((w) => w && w.paceGap && w.paceGap.paceSec != null && w.paceGap.confidence !== "Dados insuficientes").map((w) => w.paceGap.paceSec);
  if (vals.length < 2) return null;
  return Math.round(median(vals) / 5) * 5;
}
// Rebaixa a confiança um nível (para 3.3 com <3 sessões válidas).
export function downgradeConf(conf) {
  const order = ["Alta", "Moderada", "Baixa", "Dados insuficientes"];
  const i = order.indexOf(conf);
  return i < 0 || i >= order.length - 1 ? conf : order[i + 1];
}

// --- 13) Perfil de inclinação (3.6) — INDICADOR EXPLORATÓRIO --------------
// Modelo individual FC ~ v_GAP com amostras planas (|grade|≤flatGrade) de várias
// sessões fáceis; resíduo por amostra = FC real (defasada) − FC prevista, agregado
// por faixa de grade. NUNCA altera os coeficientes do GAP — apenas reporta.
function _bandIdx(g) { if (g <= -5) return 0; if (g < -2) return 1; if (g <= 2) return 2; if (g <= 5) return 3; return 4; }
function _cap(arr, max) { if (arr.length <= max) return arr; const step = arr.length / max, out = []; for (let i = 0; i < arr.length; i += step) out.push(arr[Math.floor(i)]); return out; }
export function gradeProfile(sessions, opts = {}) {
  const o = Object.assign({ lagSec: 0, flatGrade: 2, minMinPerBand: 3, maxFit: 500 }, opts);
  const BANDS = ["<−5%", "−5 a −2%", "±2%", "2 a 5%", ">5%"];
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const perSession = [], pool = [];
  for (const s of sessions) {
    if (!s || !s.length) continue;
    const dt = sampleDt(s), lagIdx = Math.round(o.lagSec / dt), al = [];
    for (let i = 0; i < s.length; i++) {
      const a = s[i], j = i + lagIdx;
      if (!a.valid || a.vgap == null || a.grade == null) continue;
      const hr = (j < s.length && s[j] && s[j].valid && s[j].hr != null) ? s[j].hr : null;
      if (hr == null) continue;
      const smp = { vgap: a.vgap, hr, spm: a.spm, grade: a.grade, dt };
      al.push(smp); pool.push(smp);
    }
    if (al.length) perSession.push(al);
  }
  const flat = pool.filter((p) => Math.abs(p.grade) <= o.flatGrade);
  if (flat.length < 20) return { ok: false, reason: "poucas amostras planas", nSessions: perSession.length };
  const flatCap = _cap(flat, o.maxFit);
  const fit = theilSen(flatCap.map((p) => p.vgap), flatCap.map((p) => p.hr));
  if (!fit) return { ok: false, reason: "regressão falhou", nSessions: perSession.length };
  const predict = (vg) => fit.a + fit.b * vg;
  const agg = BANDS.map(() => ({ res: [], spm: [], mps: [], sec: 0 }));
  for (const p of pool) {
    const A = agg[_bandIdx(p.grade)];
    A.res.push(p.hr - predict(p.vgap));
    if (p.spm != null && p.spm > 0) { A.spm.push(p.spm); A.mps.push(p.vgap * 60 / p.spm); }
    A.sec += p.dt;
  }
  const rows = BANDS.map((b, i) => {
    const A = agg[i], min = Math.round(A.sec / 60 * 10) / 10;
    return { band: b, residual: A.res.length ? Math.round(mean(A.res) * 10) / 10 : null, spm: A.spm.length ? Math.round(mean(A.spm)) : null, mPerStep: A.mps.length ? Math.round(mean(A.mps) * 1000) / 1000 : null, minutes: min, show: min >= o.minMinPerBand };
  });
  // rótulo: resíduo médio em subida (faixas >2%) e nº de sessões com subida positiva
  const upPool = pool.filter((p) => p.grade > 2), upResidual = upPool.length ? mean(upPool.map((p) => p.hr - predict(p.vgap))) : null;
  let upPosSessions = 0;
  for (const al of perSession) { const up = al.filter((p) => p.grade > 2); if (up.length) { const r = mean(up.map((p) => p.hr - predict(p.vgap))); if (r != null && r > 0) upPosSessions++; } }
  const upShown = rows[3].show || rows[4].show;
  let label = "Sem subida suficiente para avaliar";
  if (upShown && upResidual != null) {
    if (upResidual > 1 && upPosSessions >= 3) label = "Subida custa mais que o modelo GAP prevê";
    else if (Math.abs(upResidual) <= 1) label = "GAP calibrado para o atleta";
    else label = "Subida: resíduo " + (upResidual >= 0 ? "+" : "") + upResidual.toFixed(1) + " bpm";
  }
  return { ok: true, rows, fit: { a: fit.a, b: fit.b, r2: Math.round(fit.r2 * 100) / 100, n: fit.n }, nSessions: perSession.length, upPosSessions, upResidual: upResidual != null ? Math.round(upResidual * 10) / 10 : null, label };
}

// --- 14) IMP — Índice do Motor Padronizado, Fase 1 (estratificação) -------
// v_padrao = mediana da velocidade-GAP nas amostras PLANAS (|grade|≤plano) da
// JANELA_IMP, com FC (defasada) em fcRef±band. A gating por clima (PADRAO_CLIMA)
// é feita fora daqui; esta função só mede v_padrao da sessão. Confiança máx = Moderada.
export function impSample(samples, opts = {}) {
  const o = Object.assign({ fcRef: 145, band: 3, lagSec: 0, plano: 2, win: [10, 30] }, opts);
  const w0 = o.win[0] * 60, w1 = o.win[1] * 60, dt = sampleDt(samples), lagIdx = Math.round(o.lagSec / dt);
  const vg = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i], j = i + lagIdx;
    if (!s.valid || s.vgap == null || s.grade == null || Math.abs(s.grade) > o.plano || s.t < w0 || s.t > w1) continue;
    const hr = (j < samples.length && samples[j] && samples[j].valid && samples[j].hr != null) ? samples[j].hr : null;
    if (hr == null || Math.abs(hr - o.fcRef) > o.band) continue;
    vg.push(s.vgap);
  }
  const minInBand = Math.round((vg.length * dt) / 60 * 10) / 10;
  if (minInBand < 5) return { vPadrao: null, minInBand, confidence: "Dados insuficientes" };
  return { vPadrao: median(vg), minInBand, confidence: minInBand >= 8 ? "Moderada" : "Baixa" };
}
// BASELINE_IMP: média de v_padrao das 3 primeiras sessões qualificadas (conf≥Moderada,
// dentro do padrão de clima) → índice 100 (congelado). qualifies(w) decide a elegibilidade.
export function impBaseline(workouts, qualifies) {
  const q = (workouts || []).filter((w) => w && w.imp && w.imp.vPadrao != null && (qualifies ? qualifies(w) : true))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const first3 = q.slice(0, 3);
  if (first3.length < 3) return { vBaseline: null, n: first3.length };
  const vBaseline = first3.reduce((s, w) => s + w.imp.vPadrao, 0) / first3.length;
  return { vBaseline, n: first3.length, dates: first3.map((w) => w.date) };
}
export function impIndex(vPadrao, vBaseline) {
  if (vPadrao == null || !vBaseline) return null;
  return Math.round((100 * vPadrao / vBaseline) * 10) / 10;
}

// --- 15) IMP Fase 2 — modelo individual FC = a + b·v_GAP + c·temp + d·min --
// Regressão múltipla robusta (Huber-IRLS), validação leave-one-session-out e
// projeção de cada sessão ao PONTO_PADRÃO. NUNCA usa coeficientes da literatura.
function matInv(A) {
  const n = A.length, M = A.map((row, i) => row.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    const tmp = M[col]; M[col] = M[piv]; M[piv] = tmp;
    const d = M[col][col];
    for (let j = 0; j < 2 * n; j++) M[col][j] /= d;
    for (let r = 0; r < n; r++) { if (r === col) continue; const f = M[r][col]; for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[col][j]; }
  }
  return M.map((row) => row.slice(n));
}
export function mlr(X, y, weights) {
  const n = X.length, p = X[0].length, w = weights || X.map(() => 1);
  const XtX = Array.from({ length: p }, () => new Array(p).fill(0)), Xty = new Array(p).fill(0);
  for (let i = 0; i < n; i++) { const wi = w[i]; for (let a = 0; a < p; a++) { Xty[a] += wi * X[i][a] * y[i]; for (let b = 0; b < p; b++) XtX[a][b] += wi * X[i][a] * X[i][b]; } }
  const inv = matInv(XtX); if (!inv) return null;
  const beta = new Array(p).fill(0);
  for (let a = 0; a < p; a++) { let s = 0; for (let b = 0; b < p; b++) s += inv[a][b] * Xty[b]; beta[a] = s; }
  let ssr = 0; const res = new Array(n);
  for (let i = 0; i < n; i++) { let pred = 0; for (let a = 0; a < p; a++) pred += beta[a] * X[i][a]; res[i] = y[i] - pred; ssr += w[i] * res[i] * res[i]; }
  const sigma2 = ssr / Math.max(1, n - p), se = new Array(p);
  for (let a = 0; a < p; a++) se[a] = Math.sqrt(Math.max(0, sigma2 * inv[a][a]));
  return { beta, se, n, res };
}
export function mlrRobust(X, y, iters = 2) {
  let fit = mlr(X, y); if (!fit) return null;
  for (let it = 0; it < iters; it++) {
    const mad = median(fit.res.map(Math.abs)) || 1, scale = 1.4826 * mad || 1, k = 1.345 * scale;
    const w = fit.res.map((r) => { const a = Math.abs(r); return a <= k ? 1 : k / a; });
    const f2 = mlr(X, y, w); if (!f2) break; fit = f2;
  }
  return fit;
}
export function impPhase2(sessions, opts = {}) {
  const o = Object.assign({ fcRef: 145, tRef: 13, minRef: 20, minSessions: 10, tempAmp: 8, maxLosoBpm: 4 }, opts);
  const valid = (sessions || []).filter((s) => s && s.temp != null && s.aligned && s.aligned.length > 30);
  const temps = valid.map((s) => s.temp), amp = temps.length ? Math.max.apply(null, temps) - Math.min.apply(null, temps) : 0;
  if (valid.length < o.minSessions || amp < o.tempAmp) return { ok: false, reason: "gatilho não atingido", nSessions: valid.length, tempAmp: Math.round(amp * 10) / 10 };
  const rows = (sess) => { const X = [], y = []; for (const s of sess) for (const a of s.aligned) { X.push([1, a.vgap, s.temp, a.minute]); y.push(a.hr); } return { X, y }; };
  const all = rows(valid), fit = mlrRobust(all.X, all.y);
  if (!fit) return { ok: false, reason: "regressão falhou", nSessions: valid.length };
  const a = fit.beta[0], b = fit.beta[1], c = fit.beta[2], d = fit.beta[3];
  if (Math.abs(b) < 1e-6) return { ok: false, reason: "b≈0", nSessions: valid.length };
  const cLo = c - 1.96 * fit.se[2], cHi = c + 1.96 * fit.se[2], cZero = cLo <= 0 && cHi >= 0, cEff = cZero ? 0 : c;
  // LOSO: erro mediano de previsão de FC na sessão deixada de fora
  const errs = [];
  for (let k = 0; k < valid.length; k++) {
    const train = valid.filter((_, i) => i !== k), tr = rows(train), f = mlrRobust(tr.X, tr.y); if (!f) continue;
    for (const al of valid[k].aligned) { const pred = f.beta[0] + f.beta[1] * al.vgap + f.beta[2] * valid[k].temp + f.beta[3] * al.minute; errs.push(Math.abs(al.hr - pred)); }
  }
  const losoMedAbs = errs.length ? Math.round(median(errs) * 10) / 10 : Infinity, usable = losoMedAbs <= o.maxLosoBpm;
  // projeção por sessão: intercepto efetivo = a + resíduo médio da sessão (efeito do dia)
  const mean = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);
  const perSession = valid.map((s) => {
    const rs = mean(s.aligned.map((al) => al.hr - (a + b * al.vgap + c * s.temp + d * al.minute)));
    const vPad = (o.fcRef - (a + rs) - cEff * o.tRef - d * o.minRef) / b;
    return { date: s.date, vPadrao: vPad > 0 ? Math.round(vPad * 1000) / 1000 : null, temp: s.temp };
  });
  return {
    ok: true, usable, nSessions: valid.length, tempAmp: Math.round(amp * 10) / 10,
    coef: { a, b, c, d }, heatSens: Math.round(c * 100) / 100, heatCI: [Math.round(cLo * 100) / 100, Math.round(cHi * 100) / 100], cZero,
    losoMedAbs, perSession,
  };
}

// --- 16) Teste do Motor — velocidade por estágio (circuito plano fixo) -----
// Métrica por estágio: mediana da velocidade bruta nos últimos 3 min; marca se a
// FC média sair de ±tol do alvo. Usa velocidade BRUTA (circuito plano, não GAP).
export function motorTest(samples, stages, opts = {}) {
  const o = Object.assign({ tol: 3, lastMin: 3 }, opts);
  let t0 = 0; const out = [];
  for (const st of (stages || [])) {
    const start = t0, end = t0 + st.min * 60; t0 = end;
    const w0 = Math.max(start, end - o.lastMin * 60);
    const seg = samples.filter((s) => s.t >= w0 && s.t < end && s.spd != null);
    if (seg.length < 10) { out.push({ name: st.name, targetHr: st.targetHr, speed: null, pace: null, hrMean: null, min: st.min, flagged: st.targetHr != null, reason: "sem dados" }); continue; }
    const speed = median(seg.map((s) => s.spd));
    const hrs = seg.filter((s) => s.hr != null).map((s) => s.hr), hrMean = hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length : null;
    const flagged = st.targetHr != null && hrMean != null && Math.abs(hrMean - st.targetHr) > o.tol;
    out.push({ name: st.name, targetHr: st.targetHr, speed: Math.round(speed * 1000) / 1000, pace: speed > 0 ? Math.round(1000 / speed) : null, hrMean: hrMean != null ? Math.round(hrMean) : null, min: st.min, flagged: flagged });
  }
  return out;
}

// --- 17) retenção: mantém o stream só nas sessões mais recentes -----------
// Remove w.stream (mantém agregados/resumo) das sessões além de keepRecent com stream.
export function pruneStreams(workouts, keepRecent = 20) {
  const withStream = (workouts || []).filter((w) => w && w.stream).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  let dropped = 0;
  withStream.forEach((w, i) => { if (i >= keepRecent) { delete w.stream; w.streamPruned = true; dropped++; } });
  return dropped;
}
