import * as K from "./kpi.mjs";
import { parseHealthText, extractHealthRecords } from "./health-ingest.mjs";

const athlete = { fcRep: 67, fcMax: 198 };
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}` + (got !== undefined ? `  (${got})` : "")); } else { fail++; console.log(`  ✗ ${n}  GOT ${got}`); } };

console.log("== zonas reais a partir do histograma de FC ==");
// FCR: 67..198 (131). Z1<0.59→<144.3 ; Z2<0.74→<163.9 ; Z3<0.84→<177 ; Z4<0.88→<182.2 ; Z5≥182.2
const hist = { 120: 300, 150: 600, 170: 400, 185: 120 }; // s em cada bpm
const z = K.zonesFromHist(hist, athlete.fcRep, athlete.fcMax);
console.log("  zonas(s):", z.join(","));
ok("120 bpm → Z1", z[0] === 300, z[0]);
ok("150 bpm → Z2", z[1] === 600, z[1]);
ok("170 bpm → Z3", z[2] === 400, z[2]);
ok("185 bpm → Z5", z[4] === 120, z[4]);

const wHist = { durationSec: 1420, hrAvg: 150, hrHist: hist };
const pol = K.polarization([wHist], athlete);
ok("80/20 usa tempo real (fácil = Z1+Z2)", Math.abs(pol.easyPct - (900 / 1420) * 100) < 0.5, pol.easyPct.toFixed(1) + "%");
const wAvgOnly = { durationSec: 1000, hrAvg: 150 }; // sem histograma → cai na FC média (Z2)
const pol2 = K.polarization([wAvgOnly], athlete);
ok("fallback sem histograma (100% na zona da FC média)", pol2.easyPct === 100, pol2.easyPct);

console.log("\n== Training Distribution ==");
const td = K.trainingDistribution([wHist], athlete);
ok("distribui em fácil/moderado/forte", td && td.bands.facil === 900 && td.bands.moderado === 400 && td.bands.forte === 120, JSON.stringify(td.bands));

console.log("\n== Hill / Climb Performance ==");
const hilly = { distKm: 5, durationSec: 5 * 360, splits: [
  { distKm: 1, timeSec: 340, hrAvg: 150, elevDeltaM: 2 },   // plano
  { distKm: 1, timeSec: 400, hrAvg: 165, elevDeltaM: 30 },  // subida +3%
  { distKm: 1, timeSec: 330, hrAvg: 158, elevDeltaM: -28 }, // descida
  { distKm: 1, timeSec: 345, hrAvg: 151, elevDeltaM: 1 },   // plano
  { distKm: 1, timeSec: 395, hrAvg: 168, elevDeltaM: 25 },  // subida +2.5%
] };
const hill = K.hillPerformance(hilly);
console.log("  hill:", JSON.stringify({ climbKm: hill.climbKm, gainM: hill.gainM, eff: +hill.effVsModel.toFixed(3), loss: +hill.speedLossPctPerGrade.toFixed(2), hrExtra: hill.hrExtra }));
ok("detecta 2 km de subida", hill.climbKm === 2, hill.climbKm);
ok("ganho total somado", hill.gainM >= 55, hill.gainM);
ok("eficiência vs modelo calculada", hill.effVsModel > 0.5 && hill.effVsModel < 1.5, hill.effVsModel.toFixed(3));
ok("FC extra em subida (>0)", hill.hrExtra > 0, hill.hrExtra);
const agg = K.hillAggregate([hilly]);
ok("agregado de subida", agg && agg.sessions === 1, agg ? agg.sessions : "null");

console.log("\n== Diário: tendências de recuperação ==");
const daily = [
  { date: "2026-09-08", restingHR: 54, hrv: 62, sleepH: 7.2, vo2: 41 },
  { date: "2026-09-09", restingHR: 53, hrv: 66, sleepH: 7.6 },
  { date: "2026-09-10", restingHR: 55, hrv: 60, sleepH: 6.5 },
  { date: "2026-09-11", restingHR: 52, hrv: 68, sleepH: 8.0, vo2: 42 },
  { date: "2026-09-12", restingHR: 58, hrv: 48, sleepH: 5.5 }, // dia ruim
];
const rt = K.metricTrend(daily, "restingHR", "2026-09-12");
ok("FC repouso hoje acima do baseline", rt.latest === 58 && rt.deltaAbs > 0, `hoje ${rt.latest} vs base ${rt.baseline}`);
const ht = K.metricTrend(daily, "hrv", "2026-09-12");
ok("HRV hoje abaixo do baseline", ht.latest === 48 && ht.deltaPct < 0, `hoje ${ht.latest} vs base ${ht.baseline}`);
const v = K.latestDaily(daily, "vo2");
ok("VO₂ mais recente do diário", v.value === 42, v.value);

console.log("\n== Recovery Status + Readiness com sono/HRV/FC repouso ==");
const rec = K.recoveryStatus({ tsb: -5, restingDelta: rt.deltaAbs, hrvDeltaPct: ht.deltaPct, sleepH: 5.5 });
ok("dia ruim → Needs Recovery/Moderate baixo", rec.score < 70, rec.score + " " + rec.label);
const recGood = K.recoveryStatus({ tsb: 5, restingDelta: -2, hrvDeltaPct: 10, sleepH: 8 });
ok("dia bom → Good", recGood.label === "Good", recGood.score + " " + recGood.label);
const rdBad = K.readiness({ tsb: -5, adherencePct: 70, sleepH: 5.5, restingDelta: rt.deltaAbs, hrvDeltaPct: ht.deltaPct });
const rdGood = K.readiness({ tsb: 3, adherencePct: 80, sleepH: 8, restingDelta: -2, hrvDeltaPct: 12 });
ok("readiness pior no dia ruim que no bom", rdBad.score < rdGood.score, `${rdBad.score} < ${rdGood.score}`);

console.log("\n== Apple Health export.xml ==");
const xml = `<?xml version="1.0"?>
<HealthData>
 <Record type="HKQuantityTypeIdentifierRestingHeartRate" unit="count/min" startDate="2026-09-14 08:00:00 -0300" endDate="2026-09-14 08:00:00 -0300" value="52"/>
 <Record type="HKQuantityTypeIdentifierRestingHeartRate" unit="count/min" startDate="2026-09-14 09:00:00 -0300" endDate="2026-09-14 09:00:00 -0300" value="54"/>
 <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" unit="ms" startDate="2026-09-14 07:30:00 -0300" endDate="2026-09-14 07:30:00 -0300" value="61"/>
 <Record type="HKQuantityTypeIdentifierVO2Max" unit="mL/min·kg" startDate="2026-09-13 10:00:00 -0300" endDate="2026-09-13 10:00:00 -0300" value="41.7"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisInBed" startDate="2026-09-13 22:50:00 -0300" endDate="2026-09-14 06:40:00 -0300"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepCore" startDate="2026-09-13 23:10:00 -0300" endDate="2026-09-14 03:00:00 -0300"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepREM" startDate="2026-09-14 03:00:00 -0300" endDate="2026-09-14 06:20:00 -0300"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAwake" startDate="2026-09-14 06:20:00 -0300" endDate="2026-09-14 06:40:00 -0300"/>
</HealthData>`;
const recs = extractHealthRecords(xml);
ok("extraiu 8 registros das 4 métricas", recs.length === 8, recs.length);
const days = parseHealthText(xml);
const d14 = days.find((x) => x.date === "2026-09-14");
console.log("  14/09:", JSON.stringify(d14));
ok("FC repouso do dia = mediana(52,54)=53", d14.restingHR === 53, d14.restingHR);
ok("HRV do dia = 61", d14.hrv === 61, d14.hrv);
ok("sono do dia ≈ 7,2 h (core 3:50 + REM 3:20, sem InBed/Awake)", Math.abs(d14.sleepH - 7.17) < 0.15, d14.sleepH);
const d13 = days.find((x) => x.date === "2026-09-13");
ok("VO₂ atribuído a 13/09 = 41,7", d13 && d13.vo2 === 41.7, d13 ? d13.vo2 : "null");

console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
