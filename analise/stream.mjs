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

// --- 8) retenção: mantém o stream só nas sessões mais recentes ------------
// Remove w.stream (mantém agregados/resumo) das sessões além de keepRecent com stream.
export function pruneStreams(workouts, keepRecent = 20) {
  const withStream = (workouts || []).filter((w) => w && w.stream).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  let dropped = 0;
  withStream.forEach((w, i) => { if (i >= keepRecent) { delete w.stream; w.streamPruned = true; dropped++; } });
  return dropped;
}
