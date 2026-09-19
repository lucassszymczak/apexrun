import * as K from "./kpi.mjs";

const athlete = { fcRep: 67, fcMax: 198 };
let pass = 0, fail = 0;
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ✓ ${name}` + (got !== undefined ? `  (${got})` : "")); }
  else { fail++; console.log(`  ✗ ${name}  GOT ${got}`); }
}

console.log("\n== GAP: baseline 5K (splits 6:36·6:31·6:33·6:35·5:35, +35m total) ==");
// Splits em segundos por km; distribuir +35m de ganho ao longo dos km (exemplo ondulado)
const baselineSplits = [
  { distKm: 1, timeSec: 396, hrAvg: 168, elevDeltaM: 12 },
  { distKm: 1, timeSec: 391, hrAvg: 172, elevDeltaM: -8 },
  { distKm: 1, timeSec: 393, hrAvg: 175, elevDeltaM: 10 },
  { distKm: 1, timeSec: 395, hrAvg: 178, elevDeltaM: 6 },
  { distKm: 1.02, timeSec: 338, hrAvg: 190, elevDeltaM: 5 },
];
const baseline = {
  date: "2026-09-07", type: "teste", distKm: 5.02, durationSec: 396 + 391 + 393 + 395 + 338,
  hrAvg: 174, hrMax: 192, cadence: 174, splits: baselineSplits,
};
const gap = K.computeGap(baseline);
console.log("  pace bruto:", K.paceStr(baseline.durationSec / baseline.distKm), "| GAP:", K.paceStr(gap.gapPace), "| conf:", gap.confidence);
ok("pace bruto ~6:21", Math.abs(baseline.durationSec / baseline.distKm - 381) < 4, K.paceStr(baseline.durationSec / baseline.distKm));
ok("GAP plausível 5:55–6:25", gap.gapPace > 355 && gap.gapPace < 385, K.paceStr(gap.gapPace));

console.log("\n== GAP estimado sem splits (só ganho/perda) ==");
const est = K.computeGap({ distKm: 5.02, durationSec: 1913, hrAvg: 174, gainM: 35, lossM: 30 });
ok("estimativa retorna valor", est.gapPace > 0, K.paceStr(est.gapPace));
ok("confiança = estimada", est.confidence === "estimada", est.confidence);

console.log("\n== EF ==");
// EF "fácil" alvo do ciclo ~0,0139. Rodagem fácil exemplo: 7:35/km, FC 150, plano.
const easy = { date: "2026-08-12", type: "facil", distKm: 8, durationSec: 8 * 455, hrAvg: 150 };
const efEasy = K.computeEF(easy);
ok("EF rodagem fácil na ordem de 0,014–0,016", efEasy > 0.012 && efEasy < 0.020, efEasy.toFixed(4));
const efBase = K.computeEF(baseline);
ok("EF baseline > EF fácil (teste máx é mais alto)", efBase > efEasy, efBase.toFixed(4));

console.log("\n== Decoupling ==");
// splits: 2ª metade mais rápida e FC alta → closer; sinal do desacoplamento
const dec = K.computeDecoupling(baseline);
ok("decoupling calculado a partir de splits", dec !== null, dec == null ? "null" : dec.toFixed(2) + "%");
const decManual = K.computeDecoupling({ half1: { distKm: 8.5, timeSec: 8.5 * 465, hrAvg: 165 }, half2: { distKm: 8.5, timeSec: 8.5 * 460, hrAvg: 170 } });
ok("decoupling por metades manuais", decManual !== null, decManual == null ? "null" : decManual.toFixed(2) + "%");

console.log("\n== Pacing strategy ==");
const pac = K.computePacing(baseline);
ok("closer detectado (km5 disparou)", pac && pac.closer === true, pac ? `${pac.label}, closer=${pac.closer}` : "null");

console.log("\n== TRIMP + carga ==");
const t = K.computeTrimp(baseline, athlete);
ok("TRIMP baseline > 0", t > 0, t.toFixed(1));
const easyT = K.computeTrimp(easy, athlete);
ok("TRIMP fácil (longo) plausível", easyT > 0 && easyT < 300, easyT.toFixed(1));

console.log("\n== Zonas / 80-20 ==");
ok("FC 150 → Z2 (fácil)", K.hrZone(150, 67, 198) === 2, K.hrZone(150, 67, 198));
ok("FC 190 → Z5", K.hrZone(190, 67, 198) === 5, K.hrZone(190, 67, 198));
const pol = K.polarization([easy, baseline], athlete);
ok("polarização retorna easyPct", pol && pol.easyPct >= 0, pol ? pol.easyPct.toFixed(0) + "%" : "null");

console.log("\n== CTL/ATL/TSB ==");
const many = [];
for (let i = 0; i < 30; i++) {
  const d = new Date("2026-08-01"); d.setDate(d.getDate() + i);
  many.push({ date: d.toISOString().slice(0, 10), type: "facil", distKm: 8, durationSec: 8 * 450, hrAvg: 148 });
}
const fs = K.fitnessSeries(many, athlete);
ok("série de forma preenchida por dia", fs.length >= 28, fs.length);
ok("CTL sobe ao longo do tempo", fs[fs.length - 1].ctl > fs[3].ctl, `${fs[3].ctl.toFixed(1)}→${fs[fs.length-1].ctl.toFixed(1)}`);
ok("ATL responde mais rápido que CTL", fs[6].atl > fs[6].ctl, `atl ${fs[6].atl.toFixed(1)} vs ctl ${fs[6].ctl.toFixed(1)}`);

console.log("\n== A:C ==");
const ac = K.acuteChronic(many, athlete, "2026-08-30");
ok("A:C em zona plausível 0,8–1,3 (carga estável)", ac && ac.ratio > 0.7 && ac.ratio < 1.4, ac ? ac.ratio.toFixed(2) + " (" + ac.zone + ")" : "null");

console.log("\n== Riegel ==");
// baseline 5K em 31:53 → prever 10K, 21,1K
const preds = K.racePredictions(5.02, 1913);
const p10 = preds.find((p) => p.name === "10 km");
console.log("  10K:", K.hms(p10.timeSec), "| 21,1K:", K.hms(preds.find(p=>p.name==="21,1 km").timeSec));
ok("10K ~ 2×5K ligeiramente acima", p10.timeSec > 1913 * 2 && p10.timeSec < 1913 * 2.2, K.hms(p10.timeSec));

console.log("\n== VO2 band ==");
ok("39,4 → bom", K.vo2Band(39.4) === "bom", K.vo2Band(39.4));
ok("48 → excelente", K.vo2Band(48) === "excelente", K.vo2Band(48));

console.log("\n== Score + Readiness ==");
const score = K.performanceScore({ efTrendPct: 3, decoupling: 5, adherencePct: 70, weeklyKm: 30, targetKm: 50 });
ok("score 0–100", score.overall >= 0 && score.overall <= 100, JSON.stringify(score.parts) + " → " + score.overall);
const rd = K.readiness({ tsb: 5, adherencePct: 80, sleepH: 7.5, soreness: 1, pain: false });
ok("readiness banda coerente", rd.score >= 70, rd.score + " " + rd.band);
const rdPain = K.readiness({ tsb: -5, adherencePct: 60, sleepH: 6, soreness: 5, pain: true });
ok("dor derruba readiness", rdPain.score < rd.score, rdPain.score + " " + rdPain.band);

console.log("\n== paceStr / hms ==");
ok("paceStr 381 → 6:21", K.paceStr(381) === "6:21", K.paceStr(381));
ok("hms 1913 → 31:53", K.hms(1913) === "31:53", K.hms(1913));

console.log("\n== Bike (cross-training): modalidade e carga ==");
const runW = { date: "2026-09-14", modal: "corrida", type: "facil", distKm: 8, durationSec: 2880, hrAvg: 150 };
const bikeIndoor = { date: "2026-09-15", modal: "bike", indoor: true, type: "bike", distKm: 0, durationSec: 3600, hrAvg: 124, kcal: 316 };
const bikeOutdoor = { date: "2026-09-16", modal: "bike", indoor: false, type: "bike", distKm: 32.5, durationSec: 4200, hrAvg: 138, gainM: 420 };
const mix = [runW, bikeIndoor, bikeOutdoor];
ok("isBike distingue bike de corrida", K.isBike(bikeIndoor) && !K.isBike(runW), true);
ok("isBike detecta por sport quando falta modal", K.isBike({ sport: "cycling" }), true);
ok("runsOnly deixa só a corrida", K.runsOnly(mix).length === 1 && K.runsOnly(mix)[0].modal === "corrida", K.runsOnly(mix).length);
ok("bikesOnly pega as duas bikes", K.bikesOnly(mix).length === 2, K.bikesOnly(mix).length);
const bs = K.bikeSummary(mix, athlete);
ok("bikeSummary: 2 sessões", bs.sessions === 2, bs.sessions);
ok("bikeSummary: indoor/outdoor separados", bs.indoor === 1 && bs.outdoor === 1, bs.indoor + "/" + bs.outdoor);
ok("bikeSummary: TRIMP da bike > 0 (entra na carga)", bs.totalTrimp > 0, bs.totalTrimp);
ok("bikeSummary: km só das outdoor", Math.abs(bs.totalKm - 32.5) < 0.01, bs.totalKm);
ok("bikeSummary: calorias somadas", bs.totalKcal === 316, bs.totalKcal);
// A bike entra no CTL/ATL/TSB e no A:C, mas fica fora do EF/GAP
const fitAll = K.fitnessSeries(mix, athlete);
const fitRunOnly = K.fitnessSeries(K.runsOnly(mix), athlete);
ok("bike aumenta a carga crônica (CTL) vs só corrida", fitAll[fitAll.length - 1].ctl > fitRunOnly[fitRunOnly.length - 1].ctl, fitAll[fitAll.length - 1].ctl.toFixed(1) + " > " + fitRunOnly[fitRunOnly.length - 1].ctl.toFixed(1));
ok("EF não computa para bike indoor (sem distância)", K.computeEF(bikeIndoor) == null, String(K.computeEF(bikeIndoor)));

console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
