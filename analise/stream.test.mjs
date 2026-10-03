import * as S from "./stream.mjs";
import { gradeCostMult } from "./kpi.mjs";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}` + (got !== undefined ? `  (${got})` : "")); } else { fail++; console.log(`  ✗ ${n}  GOT ${got}`); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

console.log("== helpers ==");
ok("toSpm dobra cadência por perna (84→168)", S.toSpm(84) === 168, S.toSpm(84));
ok("toSpm mantém spm já cheio (170→170)", S.toSpm(170) === 170, S.toSpm(170));
ok("toSpm null → null", S.toSpm(null) === null, String(S.toSpm(null)));
ok("v_GAP plano = velocidade", near(S.vGap(2.78, 0), 2.78), S.vGap(2.78, 0));
ok("v_GAP subida 5% = v×1.175", near(S.vGap(2.78, 5), 2.78 * gradeCostMult(5)), S.vGap(2.78, 5).toFixed(3));
ok("v_GAP descida 5% = v×0.925", near(S.vGap(2.78, -5), 2.78 * gradeCostMult(-5)), S.vGap(2.78, -5).toFixed(3));

console.log("\n== Theil-Sen (robusto) ==");
const ts = S.theilSen([0, 1, 2, 3, 4, 5], [3, 5, 7, 9, 11, 13]); // y = 2x+3
ok("inclinação ≈ 2", near(ts.b, 2, 1e-9), ts.b);
ok("intercepto ≈ 3", near(ts.a, 3, 1e-9), ts.a);
ok("R² ≈ 1", near(ts.r2, 1, 1e-9), ts.r2.toFixed(3));

console.log("\n== reamostragem 1 Hz + lacunas ==");
const recs = [
  { t: 0, dist: 0, speed: 2.5, hr: 120, alt: 1000, cad: 84 },
  { t: 2, dist: 5, speed: 2.5, hr: 122, alt: 1000, cad: 84 },   // intervalo 2 s → interpola
  { t: 4, dist: 10, speed: 2.5, hr: 124, alt: 1000, cad: 84 },
  { t: 12, dist: 30, speed: 2.5, hr: 140, alt: 1001, cad: 84 }, // lacuna 8 s → marcar
];
const rs = S.resampleHz(recs, 1, 5);
ok("reamostrou a 1 Hz (13 amostras, t 0..12)", rs.length === 13, rs.length);
ok("interpola FC no passo de 2 s (t=1 → 121)", near(rs[1].hr, 121, 1e-6), rs[1].hr);
ok("lacuna >5 s marcada (gap=true entre 4 e 12)", rs.slice(5, 12).some((x) => x.gap), rs.filter((x) => x.gap).length + " amostras gap");

console.log("\n== grade em janela de ~50 m ==");
// subida constante 5%: alt = dist × 0.05, dist cresce 2.5 m/s
const climb = [];
for (let t = 0; t <= 120; t++) climb.push({ t, dist: 2.5 * t, speed: 2.5, hr: 150, alt: 1000 + 2.5 * t * 0.05, cad: 85 });
const gr = S.gradeSeries(climb, 50);
const gMid = gr[60];
ok("grade ≈ 5% numa subida de 5%", Math.abs(gMid - 5) < 0.6, gMid.toFixed(2) + "%");

console.log("\n== pré-processamento: exclusões + qualidade ==");
// 40 min: min 0–10 fora (regra), um trecho de caminhada (spm baixo) e um parado
const run = [];
for (let t = 0; t <= 2400; t++) {
  let speed = 2.8, cad = 85, hr = 150;
  if (t >= 1200 && t < 1260) { speed = 0.5; } // parado 1 min
  if (t >= 1300 && t < 1360) { cad = 65; }     // caminhada (spm 130)
  run.push({ t, dist: 2.6 * t, speed, hr, alt: 1000 + Math.sin(t / 200) * 5, cad });
}
const pp = S.preprocess(run);
ok("qualidade: tem FC/cad/alt", pp.quality.hasHR && pp.quality.hasCad && pp.quality.hasAlt, JSON.stringify({ hr: pp.quality.hasHR, cad: pp.quality.hasCad, alt: pp.quality.hasAlt }));
ok("primeiros 10 min excluídos", pp.samples.slice(0, 600).every((s) => !s.valid), "primeiras 600 inválidas");
ok("trecho parado (<1,5 m/s) excluído", pp.samples.filter((s) => s.t >= 1200 && s.t < 1260).every((s) => !s.valid), "parado fora");
ok("caminhada (spm<140) excluída", pp.samples.filter((s) => s.t >= 1300 && s.t < 1360).every((s) => !s.valid), "caminhada fora");
ok("motivos de exclusão listados", Object.keys(pp.quality.reasons).length >= 3, Object.keys(pp.quality.reasons).join(", "));
ok("relatório de minutos válidos > 0", pp.quality.validMin > 20, pp.quality.validMin + " min");

console.log("\n== stream reduzido: round-trip ==");
const red = S.reduceStream(pp.samples, 3);
ok("reduziu para ~1 amostra/3 s", Math.abs(red.n - Math.ceil(pp.samples.length / 3)) <= 1, red.n + " amostras");
const exp = S.expandStream(red);
ok("expand recupera v_GAP", exp.length === red.n && exp[300] && exp[300].vgap != null, "n=" + exp.length);

console.log("\n== defasagem de FC (cross-correlation) ==");
// HR segue v_GAP com atraso de 20 s
const lagSamples = [];
for (let t = 0; t <= 1200; t++) {
  const vg = 2.6 + 0.6 * Math.sin(t / 40);
  lagSamples.push({ t, vgap: vg, hr: 0, valid: true });
}
for (let t = 0; t <= 1200; t++) { const src = Math.max(0, t - 20); lagSamples[t].hr = 120 + 12 * (lagSamples[src].vgap - 2.6); }
const lag = S.hrLag(lagSamples, 90);
ok("defasagem recuperada ≈ 20 s", Math.abs(lag.lagSec - 20) <= 3, lag.lagSec + " s (corr " + lag.corr + ")");

console.log("\n== Pace-GAP @ FC_REF (3.1) ==");
// Alta: ≥15 min com FC em 145±3 e v_GAP 2,78 (≈6:00/km)
function flatBandSamples() {
  const s = [];
  for (let t = 0; t <= 2000; t++) {
    const inBand = t >= 600 && t <= 1700; // ~18 min dentro da janela
    s.push({ t, vgap: inBand ? 2.78 : 3.2, hr: inBand ? 145 : 160, spm: 170, grade: 0, valid: true });
  }
  return s;
}
const pg = S.paceGapAtHR(flatBandSamples(), { fcRef: 145, band: 3, lagSec: 0, win: [10, 45] });
ok("confiança Alta (≥15 min na banda)", pg.confidence === "Alta", pg.confidence + " · " + pg.minInBand + " min");
ok("pace ≈ 6:00/km (360 s)", Math.abs(pg.paceSec - 360) < 3, pg.paceSec && pg.paceSec.toFixed(0) + " s/km");
ok("método = mediana", pg.method === "mediana", pg.method);

// Fallback: FC varre faixa ampla (só ~3–4 min caem na banda 145±3), FC_REF dentro → regressão
function fallbackSamples() {
  const s = [];
  for (let t = 0; t <= 2000; t++) {
    const vg = t >= 600 ? 2.0 + 1.4 * ((t - 600) / 1400) : 2.0;  // 2.0 → 3.4 na janela válida
    const hr = 100 + 16.2 * vg;                                   // linear (145 em vg≈2.78)
    s.push({ t, vgap: vg, hr, spm: 170, grade: 0, valid: t >= 600 });
  }
  return s;
}
const fb = S.paceGapAtHR(fallbackSamples(), { fcRef: 145, band: 3, lagSec: 0, win: [10, 45] });
ok("fallback usa regressão (interpola)", fb.method === "regressão", fb.method + " r²=" + fb.r2);
ok("fallback: confiança Moderada (R²≥0,5)", fb.confidence === "Moderada", fb.confidence);
ok("fallback pace ≈ 6:00/km", fb.paceSec && Math.abs(fb.paceSec - 360) < 6, fb.paceSec && fb.paceSec.toFixed(0));

// Dados insuficientes: FC_REF fora da faixa observada
const hi = []; for (let t = 0; t <= 1400; t++) hi.push({ t, vgap: 3.2, hr: 160, spm: 170, grade: 0, valid: t >= 600 });
const di = S.paceGapAtHR(hi, { fcRef: 145, band: 3, lagSec: 0, win: [10, 45] });
ok("FC_REF fora da faixa → Dados insuficientes", di.confidence === "Dados insuficientes", di.confidence);
ok("nunca extrapola (sem pace fora da faixa)", di.paceSec == null, String(di.paceSec));

console.log("\n== Árvore da Eficiência (3.2) ==");
function steady(vg, hr, spm, minMin) {
  const s = []; for (let t = 0; t <= minMin * 60; t++) s.push({ t, vgap: vg, hr, spm, grade: 0, valid: t >= 600 });
  return s;
}
const effA = S.sessionEff(steady(2.78, 145, 170, 30));
ok("sessionEff calcula médias", effA && near(effA.vgapMean, 2.78, 1e-6), effA && effA.vgapMean.toFixed(3));
ok("identidade fecha: m/bat = passos/bat × m/passo", effA && near(effA.mPerBeat, effA.stepsPerBeat * effA.mPerStep, 1e-9), effA && (effA.stepsPerBeat * effA.mPerStep).toFixed(6) + " vs " + effA.mPerBeat.toFixed(6));
ok("m/bat = EF×60 (v_GAP×60÷FC)", effA && near(effA.mPerBeat, 2.78 * 60 / 145, 1e-9), effA && effA.mPerBeat.toFixed(4));
// cadência sobe ~5% com EF (m/bat) estável → "passada encurtou sem custo"
const prevAvg = S.sessionEff(steady(2.78, 145, 170, 30));
const curA = S.sessionEff(steady(2.78, 145, 179, 30)); // spm +5,3%, mesma velocidade e FC → m/bat igual
const treeA = S.effTree(curA, prevAvg);
ok("Δln fecha: Δln(m/bat)=Δln(passos/bat)+Δln(m/passo)", near(treeA.dln.mPerBeat, treeA.dln.stepsPerBeat + treeA.dln.mPerStep, 1e-9), treeA.dln.mPerBeat.toFixed(5));
ok("rótulo 'passada encurtou sem custo'", treeA.label === "Passada encurtou sem custo — ganho mecânico", treeA.label);
// cadência estável, EF sobe → "motor: mais passada na mesma FC"
const curB = S.sessionEff(steady(3.0, 145, 170, 30));
ok("rótulo 'motor: mais passada na mesma FC'", S.effTree(curB, prevAvg).label === "Motor: mais passada na mesma FC", S.effTree(curB, prevAvg).label);

console.log("\n== Cadência @ PACE_REF (3.4) ==");
// pace-GAP ~6:00/km (v_GAP 2,78) com spm 174 por 20 min; paceRef 360 s/km
const cadS = steady(2.78, 145, 174, 30);
const cad = S.cadenceAtPace(cadS, { paceRef: 360, tol: 15, win: [10, 45] });
ok("spm @ pace_ref ≈ 174", cad.spm === 174, cad.spm + " (" + cad.confidence + ", " + cad.minInRange + " min)");
ok("adesão 170–176 = 100%", cad.adherencePct === 100, cad.adherencePct + "%");
const cadLow = S.cadenceAtPace(steady(2.78, 145, 160, 30), { paceRef: 360 });
ok("adesão baixa quando spm fora da faixa", cadLow.adherencePct === 0, cadLow.adherencePct + "%");
const cadFar = S.cadenceAtPace(steady(3.33, 145, 174, 30), { paceRef: 360, tol: 15 }); // pace 300 s/km, fora de 360±15
ok("pace fora da faixa → Dados insuficientes", cadFar.confidence === "Dados insuficientes", cadFar.confidence);

console.log("\n== Decoupling mecânico (3.5) ==");
// 50 min: passada cai ~6% na 2ª metade (spm sobe de 170 para 181 na mesma velocidade)
const mechS = [];
for (let t = 0; t <= 3000; t++) { const half2 = t > 1800; mechS.push({ t, vgap: 2.78, hr: 150, spm: half2 ? 181 : 170, grade: 0, valid: t >= 600 }); }
const mech = S.mechDecoupling(mechS);
ok("decoupling mecânico > 0 (passada caiu)", mech.pct != null && mech.pct > 3, mech.pct + "% (" + mech.confidence + ", " + mech.validMin + " min)");
const shortS = steady(2.78, 150, 170, 25); // 25 min < 40 → insuficiente
ok("sessão <40 min → Dados insuficientes", S.mechDecoupling(shortS).confidence === "Dados insuficientes", S.mechDecoupling(shortS).confidence);

console.log("\n== 3.3 defasagem · matriz · pace_ref · rebaixar ==");
ok("medianLag das sessões válidas", S.medianLag([{ hrLagSec: 18, quality: { needsConfirm: false } }, { hrLagSec: 22, quality: { needsConfirm: false } }, { hrLagSec: 20, quality: { needsConfirm: false } }]).lagSec === 20, JSON.stringify(S.medianLag([{ hrLagSec: 18, quality: { needsConfirm: false } }, { hrLagSec: 22, quality: { needsConfirm: false } }, { hrLagSec: 20, quality: { needsConfirm: false } }])));
ok("medianLag ignora sessões que precisam confirmação", S.medianLag([{ hrLagSec: 90, quality: { needsConfirm: true } }, { hrLagSec: 20, quality: { needsConfirm: false } }]).n === 1, S.medianLag([{ hrLagSec: 90, quality: { needsConfirm: true } }, { hrLagSec: 20, quality: { needsConfirm: false } }]).n);
ok("matriz: FC deriva + passada estável → deriva CV", S.decoupleMatrix(8, 0) === "Deriva cardiovascular (calor/hidratação/duração)", S.decoupleMatrix(8, 0));
ok("matriz: FC deriva + passada cai → fadiga global", S.decoupleMatrix(8, 5) === "Fadiga global", S.decoupleMatrix(8, 5));
ok("matriz: ambos estáveis → sob controle", S.decoupleMatrix(2, 1) === "Sessão sob controle", S.decoupleMatrix(2, 1));
ok("paceRefSuggest arredonda a 5 s/km", S.paceRefSuggest([{ paceGap: { paceSec: 357, confidence: "Alta" } }, { paceGap: { paceSec: 363, confidence: "Moderada" } }]) === 360, String(S.paceRefSuggest([{ paceGap: { paceSec: 357, confidence: "Alta" } }, { paceGap: { paceSec: 363, confidence: "Moderada" } }])));
ok("downgradeConf Alta→Moderada", S.downgradeConf("Alta") === "Moderada", S.downgradeConf("Alta"));
ok("downgradeConf não passa de Dados insuficientes", S.downgradeConf("Dados insuficientes") === "Dados insuficientes", S.downgradeConf("Dados insuficientes"));

console.log("\n== retenção de streams ==");
const ws = [];
for (let i = 0; i < 25; i++) ws.push({ id: "w" + i, date: "2026-" + String(1 + (i % 9)).padStart(2, "0") + "-" + String(1 + (i % 27)).padStart(2, "0"), stream: { s: [1] } });
const dropped = S.pruneStreams(ws, 20);
ok("mantém 20 streams recentes, descarta o resto", dropped === 5 && ws.filter((w) => w.stream).length === 20, "descartou " + dropped);

console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
