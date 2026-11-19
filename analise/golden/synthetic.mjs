// ============================================================================
// Cenário SINTÉTICO do golden master — determinístico (RNG com semente fixa).
// Exercita o que o seed não tem: streams de .FIT (motor por amostra), Teste do
// Motor, clima, hidratação, sono/dor, diário longo, plano da semana estruturado,
// prova com início de ciclo e ciclo arquivado.
//
// As corridas passam pelo MESMO leitor de .FIT do motor (fitMessagesToWorkout) a
// partir de mensagens no formato do @garmin/fitsdk — o resultado vira o dado
// salvo. Depois, app antigo e motor novo calculam a partir desse mesmo dado.
// ============================================================================
import { rng } from './env.mjs';

const SEMI = 2147483648 / 180;

// Mensagens no formato decodificado do @garmin/fitsdk (records 1 Hz).
export function fitMessages(R, opt) {
  const start = new Date(opt.date + 'T' + (opt.time || '07:00') + ':00-03:00');
  const N = opt.min * 60;
  const recs = [], events = [];
  let dist = 0, alt = opt.alt0 || 1120, lat = -25.39, lon = -51.46;
  let hr = 118;
  const pauseAt = opt.pause ? Math.floor(N * 0.55) : -1;
  for (let i = 0, t = 0; i <= N; i++, t++) {
    if (i === pauseAt) { // pausa de 90 s (semáforo) com evento timer stop/start
      events.push({ event: 'timer', eventType: 'stop', timestamp: new Date(start.getTime() + t * 1000) });
      t += 90;
      events.push({ event: 'timer', eventType: 'start', timestamp: new Date(start.getTime() + t * 1000) });
    }
    const ph = i / N;
    const grade = opt.hilly ? 4.5 * Math.sin(ph * Math.PI * 6 + opt.seed) : 0.8 * Math.sin(ph * Math.PI * 2);
    const target = opt.stages ? opt.stages(i) : opt.speed * (1 - grade * 0.012) * (1 + 0.03 * Math.sin(i / 47));
    const speed = Math.max(0.5, target + (R() - 0.5) * 0.12);
    dist += speed;
    alt += speed * grade / 100;
    lat += (speed / 111000) * Math.cos(ph * 6.28);
    lon += (speed / 101000) * Math.sin(ph * 6.28);
    const hrTarget = (opt.hrBase || 132) + (speed - 2.6) * 14 + grade * 1.6 + ph * (opt.drift || 6);
    hr += (hrTarget - hr) * 0.04 + (R() - 0.5) * 0.8;
    const smart = opt.smart && i % 3 !== 0; // gravação inteligente: só 1 a cada 3 s
    if (smart) continue;
    recs.push({
      timestamp: new Date(start.getTime() + t * 1000), distance: Math.round(dist * 100) / 100,
      enhancedSpeed: Math.round(speed * 1000) / 1000, heartRate: Math.round(hr),
      enhancedAltitude: Math.round(alt * 10) / 10, cadence: Math.round(84 + speed * 1.5 + (R() - 0.5) * 2),
      positionLat: Math.round(lat * SEMI), positionLong: Math.round(lon * SEMI), temperature: 27,
    });
  }
  const last = recs[recs.length - 1];
  return {
    recordMesgs: recs,
    eventMesgs: events,
    sessionMesgs: [{
      sport: 'running', startTime: start, totalDistance: last.distance, totalTimerTime: N,
      totalElapsedTime: N + (opt.pause ? 90 : 0), avgHeartRate: Math.round(recs.reduce((s, r) => s + r.heartRate, 0) / recs.length),
      maxHeartRate: Math.max(...recs.map((r) => r.heartRate)), totalCalories: Math.round(N / 6), totalTrainingEffect: 2.8,
    }],
  };
}

function iso(d) { return d.toISOString().slice(0, 10); }
function addDays(isoDate, n) { const d = new Date(isoDate + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); }

// Monta o payload (formato do localStorage) usando o motor E (precisa de setState).
export function buildSynthetic(E) {
  const R = rng(20261119);
  const athlete = Object.assign({}, E.DEFAULT_ATHLETE, { fcRef: 145, bandFc: 3, alert: '' });
  E.setState({ athlete, workouts: [], daily: [] });
  const ws = [];
  let n = 0;
  const day0 = '2026-09-07';
  const plan = [
    // [offset em dias, tipo, min, speed, opções]
    [0, 'facil', 48, 2.70, { hrBase: 142, drift: 2 }], [2, 'facil', 52, 2.72, { hilly: true }], [5, 'longão', 75, 2.62, { drift: 10 }],
    [7, 'facil', 50, 2.74, { pause: true }], [9, 'tempo', 45, 3.05, { hrBase: 140 }], [12, 'longão', 85, 2.64, { hilly: true, drift: 12 }],
    [14, 'regenerativo', 40, 2.55, {}], [16, 'facil', 55, 2.76, { smart: true }], [19, 'longão', 95, 2.66, {}],
    [21, 'facil', 50, 2.78, { hilly: true }], [26, 'longão', 100, 2.68, { drift: 9 }], [28, 'facil', 52, 2.80, { hrBase: 141, drift: 2 }],
    [33, 'longão', 105, 2.70, { hilly: true }], [35, 'facil', 50, 2.82, { hrBase: 141, drift: 2 }], [40, 'prova', 62, 3.20, { hrBase: 150 }],
    [44, 'facil', 48, 2.80, { hrBase: 142, drift: 2 }], [47, 'longão', 110, 2.72, {}], [50, 'facil', 52, 2.84, { hilly: true }],
    [55, 'facil', 50, 2.85, { hrBase: 140, drift: 2 }], [58, 'longão', 115, 2.73, { drift: 8 }], [62, 'facil', 50, 2.86, {}],
    [66, 'facil', 52, 2.87, { pause: true }], [69, 'longão', 120, 2.74, {}],
  ];
  for (const [off, type, min, speed, o] of plan) {
    const date = addDays(day0, off);
    const w = E.fitMessagesToWorkout(fitMessages(R, Object.assign({ date, min, speed, seed: n }, o)));
    w.id = 'syn' + (n++);
    w.type = type;
    w.updatedAt = date + 'T12:00:00.000Z';
    w.rpe = 3 + (n % 5);
    w.sleepH = n % 4 === 0 ? null : Math.round((6.2 + R() * 1.8) * 10) / 10;
    w.soreness = n % 6 === 0 ? 3 : null;
    if (n % 3 === 0) { w.waterBefore = 300 + (n % 4) * 100; w.waterDuring = min > 70 ? 500 + n * 10 : null; w.waterAfter = 450; }
    // clima "como o Open-Meteo devolveria" (a busca real é bloqueada no golden)
    if (n % 2 === 0) w.weather = { tempC: 10 + (n % 13), dewC: 6 + (n % 9), rh: 70, windKmh: 8 + (n % 18), hour: date + 'T10:00', source: 'open-meteo/forecast', tags: [], inStandard: true, localTime: date + ' 07:00 (UTC−3)' };
    ws.push(w);
  }
  ws[ws.length - 1].pain = true; // dor no último → alerta de recuo
  // Teste do Motor: aquecimento 10' + 135 bpm 6' + 145 bpm 6'
  const mt = E.fitMessagesToWorkout(fitMessages(R, {
    date: addDays(day0, 60), min: 22, speed: 2.7, seed: 99, hrBase: 120,
    stages: (i) => (i < 600 ? 2.5 : i < 960 ? 2.75 : 3.0),
  }));
  Object.assign(mt, { id: 'synMotor', type: 'teste_motor', updatedAt: addDays(day0, 60) + 'T12:00:00.000Z', weather: { tempC: 14, dewC: 9, rh: 70, windKmh: 6, tags: [], inStandard: true } });
  ws.push(mt);
  // bikes (indoor sem distância e outdoor com histograma de FC)
  ws.push({ id: 'synBike1', date: addDays(day0, 3), modal: 'bike', indoor: true, type: 'bike', distKm: 0, durationSec: 3600, hrAvg: 126, hrMax: 140, kcal: 320, rpe: 4, hrHist: { 118: 600, 124: 1500, 131: 1200, 142: 300 }, updatedAt: '2026-09-10T00:00:00Z' });
  ws.push({ id: 'synBike2', date: addDays(day0, 31), modal: 'bike', indoor: false, type: 'bike_int', distKm: 41.3, durationSec: 5100, hrAvg: 141, hrMax: 171, gainM: 520, lossM: 515, kcal: 780, rpe: 6, temp: 21, hrHist: { 125: 900, 138: 1800, 150: 1500, 168: 700, 180: 200 }, updatedAt: '2026-10-08T00:00:00Z' });
  // manual com splits digitados
  ws.push({ id: 'synManual', date: addDays(day0, 24), type: 'intervalado', distKm: 6.0, durationSec: 2010, hrAvg: 164, hrMax: 185, cadence: 176, gainM: 22, lossM: 20, rpe: 8, temp: 18,
    splits: [{ distKm: 1, timeSec: 360, hrAvg: 150, elevDeltaM: 3 }, { distKm: 1, timeSec: 300, hrAvg: 170, elevDeltaM: -2 }, { distKm: 1, timeSec: 305, hrAvg: 174, elevDeltaM: 4 }, { distKm: 1, timeSec: 298, hrAvg: 178, elevDeltaM: -3 }, { distKm: 1, timeSec: 380, hrAvg: 158, elevDeltaM: 1 }, { distKm: 1, timeSec: 367, hrAvg: 155, elevDeltaM: 0 }],
    notes: 'Intervalado 4×1 km', updatedAt: '2026-10-01T00:00:00Z' });
  // diário de recuperação (Apple Saúde): 75 dias
  const daily = [];
  for (let d = 0; d < 75; d++) {
    const date = addDays(day0, d - 3);
    const row = { date, restingHR: 62 + Math.round(R() * 6 - (d / 30)), hrv: Math.round(48 + R() * 14 + d / 10), updatedAt: date + 'T08:00:00Z' };
    if (d % 5 !== 2) row.sleepH = Math.round((6 + R() * 2.2) * 10) / 10;
    if (d % 30 === 4) row.vo2 = Math.round((39.4 + d / 40) * 10) / 10;
    if (d === 50) { row.soreness = 4; row.note = 'panturrilha'; }
    daily.push(row);
  }
  // prova e plano da semana (inclui semana passada, atual e próxima a "hoje" = 19/11)
  const race = { name: 'Maratona de Curitiba', type: 'maratona', date: '2027-03-28', distKm: 42.195, goal: 'finish', objective: 'terminar inteiro', startDate: '2026-09-07', longRunTargetKm: 30, peakKmTarget: 50, updatedAt: '2026-09-07T00:00:00Z' };
  const steps = [
    { rep: false, label: 'Aquecimento', durSec: 900, distKm: null, zone: 'Z2' },
    { rep: true, times: 5, segs: [{ label: 'Forte', durSec: 180, distKm: null, zone: 'Z4' }, { label: 'Rec', durSec: 90, distKm: null, zone: 'Z1' }] },
    { rep: false, label: 'Desaquecimento', durSec: 600, distKm: null, zone: 'Z2' },
  ];
  const planWeeks = {
    '2026-W46': { updatedAt: '2026-11-09T00:00:00Z', sessions: [
      { dow: 1, type: 'rodagem', title: 'Rodagem', zone: 'Z2', durMin: 50, distKm: null, steps: [], adapt: null, linkedWorkoutId: null },
      { dow: 3, type: 'intervalado', title: 'Tiros', zone: 'Z4', steps, adapt: null, done: true },
      { dow: 5, type: 'rodagem', title: 'Rodagem', zone: 'Z2', durMin: 45, distKm: 8, steps: [], adapt: { modal: 'bike', note: 'canela' } },
      { dow: 7, type: 'longao', title: 'Longão', zone: 'Z2', durMin: null, distKm: 22, steps: [], adapt: null },
    ] },
    '2026-W47': { updatedAt: '2026-11-16T00:00:00Z', sessions: [
      { dow: 1, type: 'rodagem', title: 'Rodagem', zone: 'Z2', durMin: 50, steps: [], adapt: null },
      { dow: 2, type: 'descanso', title: 'Descanso', zone: '', steps: [], adapt: null },
      { dow: 4, type: 'intervalado', title: 'Tiros', zone: 'Z4', steps, adapt: null },
      { dow: 6, type: 'longao', title: 'Longão', zone: 'Z2', distKm: 24, steps: [], adapt: null },
    ] },
    '2026-W48': { updatedAt: '2026-11-17T00:00:00Z', sessions: [{ dow: 2, type: 'rodagem', title: 'Rodagem', zone: 'Z1', durMin: 40, steps: [], adapt: null }] },
  };
  const races = [{ race: { name: 'Meia de Floripa', type: 'meia', date: '2026-08-29', distKm: 21.0975, startDate: '2026-06-01', objective: 'sub 2:45' }, summary: { totalKm: 312.4, maxLong: 17, nRuns: 38, efStart: 0.0131, efEnd: 0.0139, efDelta: 6.1, ctlEnd: 31.2, adesao: 84, weeks: 12, okN: 32, totN: 38 }, archivedAt: '2026-09-01T00:00:00Z' }];
  E.setState(null);
  return { athlete, workouts: ws, daily, deleted: [], race, races, planWeeks, updatedAt: '2026-11-18T00:00:00Z', lastSyncAt: null };
}
