import { Encoder, Decoder, Stream, Profile } from "@garmin/fitsdk";
import { messagesToWorkout } from "./fit-ingest.mjs";
import * as K from "./kpi.mjs";

// ---- 1) sintetiza um .FIT de corrida realista (5,00 km, ~30 min, ondulado) ----
function buildSyntheticFit() {
  const enc = new Encoder();
  const start = new Date("2026-09-14T09:00:00Z");
  enc.onMesg(Profile.MesgNum.FILE_ID, { manufacturer: "development", product: 1, timeCreated: start, type: "activity" });

  const N = 1800;            // 1800 s = 30 min, 1 record/s
  const speed = 5000 / 1800; // ~2.778 m/s (5:60/km ~ 6:00/km)
  let dist = 0;
  let up = 0, down = 0, lastAlt = 1100;
  for (let i = 0; i <= N; i++) {
    const ts = new Date(start.getTime() + i * 1000);
    dist = speed * i;
    // elevação ondulada (senoide) em torno de 1100 m, ±12 m
    const alt = 1100 + 12 * Math.sin((i / N) * Math.PI * 4);
    if (i > 0) { const d = alt - lastAlt; if (d > 0) up += d; else down += -d; }
    lastAlt = alt;
    // FC sobe de 140 a 172 ao longo do treino
    const hr = Math.round(140 + (i / N) * 32);
    enc.onMesg(Profile.MesgNum.RECORD, {
      timestamp: ts,
      distance: dist,
      enhancedSpeed: speed,
      heartRate: hr,
      enhancedAltitude: alt,
      cadence: 84,            // um pé → 168 spm
      temperature: 18,
    });
  }
  enc.onMesg(Profile.MesgNum.SESSION, {
    timestamp: new Date(start.getTime() + N * 1000),
    startTime: start,
    sport: "running",
    totalDistance: dist,
    totalTimerTime: N,
    totalElapsedTime: N,
    totalAscent: Math.round(up),
    totalDescent: Math.round(down),
    avgHeartRate: 156,
    maxHeartRate: 172,
    avgSpeed: speed,
    avgCadence: 84,
  });
  enc.onMesg(Profile.MesgNum.ACTIVITY, { timestamp: new Date(start.getTime() + N * 1000), totalTimerTime: N, numSessions: 1, type: "manual" });
  return enc.close();
}

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}` + (got !== undefined ? `  (${got})` : "")); } else { fail++; console.log(`  ✗ ${n}  GOT ${got}`); } };

console.log("== encode → decode → map ==");
const bytes = buildSyntheticFit();
ok("arquivo .FIT gerado (>0 bytes)", bytes.length > 100, bytes.length + " bytes");

const stream = Stream.fromByteArray(bytes);
ok("Decoder.isFIT", Decoder.isFIT(stream), true);
const decoder = new Decoder(stream);
const { messages, errors } = decoder.read();
ok("sem erros de decode", (errors || []).length === 0, (errors || []).length);
ok("record messages presentes", messages.recordMesgs && messages.recordMesgs.length > 100, messages.recordMesgs?.length);

const w = messagesToWorkout(messages);
console.log("  workout:", JSON.stringify({ date: w.date, distKm: w.distKm, dur: K.hms(w.durationSec), hrAvg: w.hrAvg, hrMax: w.hrMax, cad: w.cadence, gain: w.gainM, loss: w.lossM, temp: w.temp, splits: w.splits?.length }));

ok("distância ~5,00 km", Math.abs(w.distKm - 5.0) < 0.05, w.distKm);
ok("duração 30:00", w.durationSec === 1800, K.hms(w.durationSec));
ok("data local do treino", /^2026-09-1[45]$/.test(w.date), w.date);
ok("FC média 156", w.hrAvg === 156, w.hrAvg);
ok("FC máxima 172", w.hrMax === 172, w.hrMax);
ok("cadência dobrada → 168 spm", w.cadence === 168, w.cadence);
ok("ganho de elevação > 0", w.gainM > 0, w.gainM);
ok("perda de elevação > 0", w.lossM > 0, w.lossM);
ok("temperatura 18", w.temp === 18, w.temp);
ok("splits por km gerados (~5)", w.splits && w.splits.length >= 5, w.splits?.length);
ok("cada split tem tempo e FC", w.splits.every((s) => s.timeSec > 0 && s.hrAvg > 0), JSON.stringify(w.splits[0]));
ok("splits têm Δelevação", w.splits.some((s) => s.elevDeltaM != null && s.elevDeltaM !== 0), w.splits.map((s) => s.elevDeltaM).join(","));
const sumSplitTime = w.splits.reduce((a, s) => a + s.timeSec, 0);
ok("soma dos splits ≈ duração total", Math.abs(sumSplitTime - w.durationSec) <= 2, sumSplitTime + " vs " + w.durationSec);

console.log("\n== KPIs derivados do treino lido ==");
const gap = K.computeGap(w);
ok("GAP calculado com alta confiança (Δelev por km)", gap.confidence === "alta", gap.confidence + " · " + K.paceStr(gap.gapPace));
const ef = K.computeEF(w);
ok("EF calculado", ef > 0, ef.toFixed(4));
const dec = K.computeDecoupling(w);
ok("decoupling calculado dos splits (FC sobe → positivo)", dec != null && dec > 0, dec == null ? "null" : dec.toFixed(2) + "%");
const athlete = { fcRep: 67, fcMax: 198 };
const trimp = K.computeTrimp(w, athlete);
ok("TRIMP calculado", trimp > 0, trimp.toFixed(1));
const pace = K.computePacing(w);
ok("pacing classificado", pace != null, pace ? pace.label : "null");

console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
