// ============================================================================
// Mapeia mensagens decodicadas de um .FIT (formato do @garmin/fitsdk Decoder)
// para o modelo de treino do Apex. Puro e testável; a mesma lógica é embutida
// na página (analise/index.html).
// ============================================================================

function num(x) { return typeof x === "number" && isFinite(x) ? x : null; }
function toLocalISODate(d) {
  if (!(d instanceof Date) || isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// cadência de corrida: o Garmin grava RPM de um pé; dobramos se parecer meia-cadência
function normalizeCadence(rpm) {
  if (rpm == null) return null;
  return rpm < 130 ? Math.round(rpm * 2) : Math.round(rpm);
}

// Extrai os campos usados de cada record message, tolerando variações de nome.
function normRecords(recordMesgs) {
  return (recordMesgs || [])
    .map((r) => ({
      t: r.timestamp instanceof Date ? r.timestamp.getTime() / 1000 : num(r.timestamp),
      dist: num(r.distance),
      speed: num(r.enhancedSpeed) != null ? num(r.enhancedSpeed) : num(r.speed),
      hr: num(r.heartRate),
      alt: num(r.enhancedAltitude) != null ? num(r.enhancedAltitude) : num(r.altitude),
      cad: num(r.cadence) != null ? num(r.cadence) + (num(r.fractionalCadence) || 0) : null,
      temp: num(r.temperature),
    }))
    .filter((r) => r.t != null)
    .sort((a, b) => a.t - b.t);
}

// interpola linearmente um campo no ponto onde a distância cumulativa = target
function interpAt(records, field, targetDist) {
  for (let i = 1; i < records.length; i++) {
    const a = records[i - 1], b = records[i];
    if (a.dist == null || b.dist == null) continue;
    if (b.dist >= targetDist && a.dist <= targetDist) {
      const span = b.dist - a.dist;
      const f = span > 0 ? (targetDist - a.dist) / span : 0;
      const va = a[field], vb = b[field];
      if (va == null || vb == null) return vb != null ? vb : va;
      return va + (vb - va) * f;
    }
  }
  return null;
}

// splits por km a partir do stream de records (tempo interpolado no limite,
// FC média do trecho, variação de elevação do trecho).
function buildSplits(records) {
  if (records.length < 8) return null;
  const totalDist = records[records.length - 1].dist;
  if (!totalDist || totalDist < 1200) return null;
  const t0 = records[0].t;
  const nKm = Math.floor(totalDist / 1000);
  const splits = [];
  let prevT = t0;
  let prevAlt = interpAt(records, "alt", 0) ?? records[0].alt;
  for (let k = 1; k <= nKm; k++) {
    const target = k * 1000;
    const tAt = interpAtDistTime(records, target);
    const altAt = interpAt(records, "alt", target);
    if (tAt == null) break;
    // FC média dos records dentro do km [ (k-1)*1000, k*1000 )
    const seg = records.filter((r) => r.dist != null && r.dist >= (k - 1) * 1000 && r.dist < target && r.hr != null);
    const hrAvg = seg.length ? Math.round(seg.reduce((s, r) => s + r.hr, 0) / seg.length) : null;
    const elevDelta = altAt != null && prevAlt != null ? Math.round((altAt - prevAlt) * 10) / 10 : null;
    splits.push({ distKm: 1, timeSec: Math.round(tAt - prevT), hrAvg, elevDeltaM: elevDelta });
    prevT = tAt;
    prevAlt = altAt;
  }
  // resto (fração de km final) — só se relevante (>150m)
  const rest = totalDist - nKm * 1000;
  if (rest > 150) {
    const tEnd = records[records.length - 1].t;
    const seg = records.filter((r) => r.dist != null && r.dist >= nKm * 1000 && r.hr != null);
    const hrAvg = seg.length ? Math.round(seg.reduce((s, r) => s + r.hr, 0) / seg.length) : null;
    const altEnd = records[records.length - 1].alt;
    const elevDelta = altEnd != null && prevAlt != null ? Math.round((altEnd - prevAlt) * 10) / 10 : null;
    splits.push({ distKm: Math.round((rest / 1000) * 100) / 100, timeSec: Math.round(tEnd - prevT), hrAvg, elevDeltaM: elevDelta });
  }
  return splits.length ? splits : null;
}
// tempo interpolado no ponto de distância `target`
function interpAtDistTime(records, target) {
  for (let i = 1; i < records.length; i++) {
    const a = records[i - 1], b = records[i];
    if (a.dist == null || b.dist == null) continue;
    if (b.dist >= target && a.dist <= target) {
      const span = b.dist - a.dist;
      const f = span > 0 ? (target - a.dist) / span : 0;
      return a.t + (b.t - a.t) * f;
    }
  }
  return null;
}

function ascentDescentFromStream(records) {
  let up = 0, down = 0, last = null;
  for (const r of records) {
    if (r.alt == null) continue;
    if (last != null) {
      const d = r.alt - last;
      if (d > 0.2) up += d;      // filtro leve de ruído
      else if (d < -0.2) down += -d;
    }
    last = r.alt;
  }
  return { up: Math.round(up), down: Math.round(down) };
}

// principal: messages = { recordMesgs, sessionMesgs, ... } do Decoder.read()
export function messagesToWorkout(messages) {
  const records = normRecords(messages.recordMesgs);
  if (!records.length) throw new Error("Arquivo .FIT sem registros de trajeto (record messages).");
  const session = (messages.sessionMesgs && messages.sessionMesgs[0]) || {};
  const sport = (session.sport || "").toString().toLowerCase();

  const startDate =
    session.startTime instanceof Date ? session.startTime :
    (typeof records[0].t === "number" ? new Date(records[0].t * 1000) : null);

  const lastDist = records[records.length - 1].dist;
  const distKm = (num(session.totalDistance) != null ? session.totalDistance : lastDist) / 1000;

  const durationSec = Math.round(
    num(session.totalTimerTime) != null ? session.totalTimerTime :
    num(session.totalElapsedTime) != null ? session.totalElapsedTime :
    (records[records.length - 1].t - records[0].t)
  );

  const hrs = records.map((r) => r.hr).filter((x) => x != null);
  const hrAvg = num(session.avgHeartRate) != null ? session.avgHeartRate : (hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null);
  const hrMax = num(session.maxHeartRate) != null ? session.maxHeartRate : (hrs.length ? Math.max.apply(null, hrs) : null);

  const cads = records.map((r) => r.cad).filter((x) => x != null);
  const rawCad = num(session.avgCadence) != null ? session.avgCadence : (cads.length ? cads.reduce((a, b) => a + b, 0) / cads.length : null);
  const cadence = normalizeCadence(rawCad);

  const stream = ascentDescentFromStream(records);
  const gainM = num(session.totalAscent) != null ? Math.round(session.totalAscent) : stream.up || null;
  const lossM = num(session.totalDescent) != null ? Math.round(session.totalDescent) : stream.down || null;

  const temps = records.map((r) => r.temp).filter((x) => x != null);
  const temp = temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null;

  const splits = buildSplits(records);

  const type = sport.includes("run") ? "facil" : "facil";

  return {
    date: toLocalISODate(startDate) || new Date().toISOString().slice(0, 10),
    type,
    distKm: Math.round(distKm * 100) / 100,
    durationSec,
    hrAvg: hrAvg || null,
    hrMax: hrMax || null,
    cadence: cadence || null,
    gainM: gainM,
    lossM: lossM,
    temp: temp,
    splits: splits,
    sport: session.sport || null,
    _records: records.length,
  };
}
