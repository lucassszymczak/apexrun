// Ações sobre treinos — portadas do app antigo SEM mudar a lógica:
// saveModal/finalizeSave (salvar + aviso de duplicata), deleteWorkout (com registro
// para a sync) e handleFitFile (ler .FIT + clima).
import * as E from '../engine.mjs';
import { commit, getState, toast } from './store';

// ---------------- .FIT ----------------
// Mesma sequência do handleFitFile antigo. O leitor (@garmin/fitsdk 21) agora vem
// do npm, junto com o app — não depende mais do CDN (funciona offline).
export async function readFitFile(file: File): Promise<any> {
  const buf = await file.arrayBuffer();
  const SDK: any = await import('@garmin/fitsdk');
  const bytes = new Uint8Array(buf);
  const stream = SDK.Stream.fromByteArray(bytes);
  if (!SDK.Decoder.isFIT(stream)) throw new Error('Não parece um arquivo .FIT válido.');
  const decoder = new SDK.Decoder(stream);
  const res = decoder.read();
  const w = E.fitMessagesToWorkout(res.messages);
  // clima automático (Open-Meteo): só corrida com GPS; melhor esforço, não bloqueia
  let when = w.date ? new Date(w.date + 'T12:00:00Z') : new Date();
  if (w.geo && w.geo.lat != null) {
    const st = res.messages.sessionMesgs && res.messages.sessionMesgs[0] && res.messages.sessionMesgs[0].startTime;
    if (st instanceof Date) when = st;
  }
  const needWeather = w.modal !== 'bike' && w.geo && w.geo.lat != null;
  w.weather = needWeather ? (await E.fetchWeather(w.geo, when, getState().athlete)) || null : null;
  return w;
}

// ---------------- formulário ----------------
export type FormVals = Record<string, string | boolean>;
export const RUN_TYPES: [string, string][] = [['facil', 'Fácil / rodagem'], ['longão', 'Longão'], ['tempo', 'Tempo'], ['limiar', 'Limiar'], ['intervalado', 'Intervalado'], ['regenerativo', 'Regenerativo'], ['teste_motor', 'Teste do Motor'], ['teste', 'Teste'], ['prova', 'Prova']];
export const BIKE_TYPES: [string, string][] = [['bike', 'Bike (base / Z2)'], ['bike_int', 'Bike forte / intervalado']];

// Campos não editáveis preservados ao salvar (como modalExtras no app antigo)
export function extrasOf(s: any): Record<string, any> {
  return {
    hrHist: s && s.hrHist ? s.hrHist : null, sport: s && s.sport ? s.sport : null, bikeRpm: s && s.bikeRpm != null ? s.bikeRpm : null,
    trainingEffect: s && s.trainingEffect != null ? s.trainingEffect : null, stream: s && s.stream ? s.stream : null, quality: s && s.quality ? s.quality : null,
    paceGap: s && s.paceGap ? s.paceGap : null, hrLagSec: s && s.hrLagSec != null ? s.hrLagSec : null, geo: s && s.geo ? s.geo : null,
    eff: s && s.eff ? s.eff : null, mech: s && s.mech ? s.mech : null, cadAdherencePct: s && s.cadAdherencePct != null ? s.cadAdherencePct : null,
    imp: s && s.imp ? s.imp : null, weather: s && s.weather ? s.weather : null,
  };
}

// Valores iniciais do formulário a partir de um treino (openModal antigo)
export function formFrom(s: any): FormVals {
  const modal = s && s.modal ? s.modal : (s && E.isBike(s) ? 'bike' : 'corrida');
  const v = (x: any) => (x == null ? '' : String(x));
  return {
    modal, type: s && s.type ? s.type : (modal === 'bike' ? 'bike' : 'facil'), indoor: s ? !!s.indoor : false,
    kcal: s && s.kcal != null ? v(s.kcal) : '', date: s && s.date ? s.date : new Date().toISOString().slice(0, 10),
    dist: s && s.distKm ? v(s.distKm) : '', dur: s && s.durationSec ? E.hms(s.durationSec) : '',
    hr: s && s.hrAvg ? v(s.hrAvg) : '', hrmax: s && s.hrMax ? v(s.hrMax) : '', cad: s && s.cadence ? v(s.cadence) : '',
    gain: s && s.gainM != null ? v(s.gainM) : '', loss: s && s.lossM != null ? v(s.lossM) : '',
    rpe: s && s.rpe ? v(s.rpe) : '', temp: s && s.temp != null ? v(s.temp) : '', terrain: s && s.terrain ? s.terrain : '',
    sleep: s && s.sleepH != null ? v(s.sleepH) : '', sore: s && s.soreness != null ? v(s.soreness) : '',
    waterB: s && s.waterBefore != null ? v(s.waterBefore) : '', waterD: s && s.waterDuring != null ? v(s.waterDuring) : '', waterA: s && s.waterAfter != null ? v(s.waterAfter) : '',
    dec: s && s.decouplingPct != null ? v(s.decouplingPct) : '', notes: s && s.notes ? s.notes : '', pain: s ? !!s.pain : false,
    splits: s && s.splits ? s.splits.map((sp: any) => [E.hms(sp.timeSec), sp.hrAvg || '', sp.elevDeltaM != null ? sp.elevDeltaM : ''].filter((x, i) => i === 0 || x !== '').join(', ')).join('\n') : '',
  };
}

// Monta o treino exatamente como saveModal. Devolve erro de validação (texto) ou o treino.
export function buildWorkout(f: FormVals, extras: Record<string, any>, editingId: string | null): { error: string } | { w: any } {
  const S = (k: string) => String(f[k] ?? '');
  const modal = S('modal'); const isBk = modal === 'bike';
  const dist = +S('dist'); const dur = E.parseDur(S('dur'));
  const hrAvg = +S('hr') || null; const kcal = S('kcal') !== '' ? +S('kcal') : null;
  if (isBk) {
    if (!dur) return { error: 'Informe ao menos a duração da bike.' };
    if (!hrAvg && !kcal) return { error: 'Na bike, informe a FC média ou as calorias (a carga usa a FC).' };
  } else if (!dist || !dur) return { error: 'Informe ao menos distância e duração.' };
  const indoor = isBk ? !!f.indoor : false;
  const splits = isBk ? null : E.parseSplits(S('splits'));
  // se splits não trazem distância explícita, ajusta a última para bater com o total
  if (splits && dist) { const sd = splits.length; if (sd && Math.abs(sd - dist) > 0.001) splits[sd - 1].distKm = Math.max(0.05, dist - (sd - 1)); }
  const num = (k: string) => (S(k) !== '' ? +S(k) : null);
  const sleepSrc = (() => { const sv = num('sleep'); if (sv == null) return null; const d = (getState().daily || []).find((x: any) => x && x.date === S('date')); return d && d.sleepH != null && Math.abs(sv - d.sleepH) < 0.05 ? 'apple' : 'manual'; })();
  const w = {
    id: editingId || E.uid(), date: S('date'), modal, indoor: isBk ? indoor : undefined, type: S('type'),
    distKm: dist || (isBk ? 0 : dist), durationSec: dur, hrAvg, hrMax: +S('hrmax') || null,
    cadence: isBk ? null : (+S('cad') || null), bikeRpm: isBk ? (extras.bikeRpm || null) : null,
    gainM: num('gain'), lossM: num('loss'), rpe: num('rpe'), temp: num('temp'),
    waterBefore: num('waterB'), waterDuring: num('waterD'), waterAfter: num('waterA'),
    terrain: S('terrain').trim() || null, kcal, trainingEffect: isBk ? (extras.trainingEffect || null) : null,
    sleepH: num('sleep'), sleepSrc, soreness: num('sore'), decouplingPct: isBk ? null : num('dec'),
    notes: S('notes').trim() || null, pain: !!f.pain, splits: splits || null,
    hrHist: extras.hrHist || null, sport: extras.sport || null,
    stream: isBk ? null : (extras.stream || null), quality: isBk ? null : (extras.quality || null),
    paceGap: isBk ? null : (extras.paceGap || null), hrLagSec: isBk ? null : (extras.hrLagSec != null ? extras.hrLagSec : null),
    eff: isBk ? null : (extras.eff || null), mech: isBk ? null : (extras.mech || null),
    cadAdherencePct: isBk ? null : (extras.cadAdherencePct != null ? extras.cadAdherencePct : null),
    imp: isBk ? null : (extras.imp || null), weather: extras.weather || null, geo: extras.geo || null,
    updatedAt: new Date().toISOString(),
  };
  return { w };
}

// Duplicata: já existe treino na mesma data? (mesma regra do app antigo)
export function findDuplicate(w: any): { match: any; same: boolean } | null {
  const dups = getState().workouts.filter((x: any) => x.date === w.date && x.id !== w.id);
  if (!dups.length) return null;
  const match = dups.slice().sort((a: any, b: any) => Math.abs((a.durationSec || 0) - w.durationSec) - Math.abs((b.durationSec || 0) - w.durationSec))[0];
  const sameModal = E.isBike(match) === E.isBike(w);
  const sameDist = w.distKm > 0 && match.distKm != null && Math.abs(match.distKm - w.distKm) / w.distKm < 0.05;
  const sameDur = match.durationSec && w.durationSec && Math.abs(match.durationSec - w.durationSec) / w.durationSec < 0.05;
  return { match, same: sameModal && (sameDist || (!w.distKm && sameDur)) };
}

// choice: 'new' (sem duplicata) | 'edit' | 'replace' | 'keep'
export function commitWorkout(w: any, choice: 'new' | 'edit' | 'replace' | 'keep', matchId?: string): string {
  const st = getState();
  let msg = 'Treino registrado';
  if (choice === 'edit') { const idx = st.workouts.findIndex((x: any) => x.id === w.id); st.workouts[idx] = w; msg = 'Treino atualizado'; }
  else if (choice === 'replace') { const i = st.workouts.findIndex((x: any) => x.id === matchId); if (i >= 0) st.workouts[i] = w; else st.workouts.push(w); msg = 'Treino substituído'; }
  else if (choice === 'keep') { st.workouts.push(w); msg = 'Treino registrado (2 no dia)'; }
  else st.workouts.push(w);
  // finalizeSave
  try { E.pruneStreams(st.workouts, 20); } catch { /* idem */ }
  try { E.linkSleepToWorkouts(); } catch { /* idem */ }
  commit();
  toast(msg);
  return w.id;
}

export function deleteWorkout(id: string) {
  const st = getState();
  st.workouts = st.workouts.filter((x: any) => x.id !== id);
  st.deleted = (st.deleted || []).filter((d: any) => d.id !== id);
  st.deleted.push({ id, at: new Date().toISOString() });
  commit();
  toast('Treino excluído');
}

// §5 do app antigo (recalcKpis): recalcula os KPIs das sessões que ainda têm stream e
// refaz as etiquetas de clima. Mesma lógica; o alert virou mensagem de retorno.
export function recalcKpis(): string {
  const st = getState();
  const a = st.athlete, runs = st.workouts.filter(E.isRun);
  let after = 0; const need: string[] = [];
  runs.forEach((w: any) => {
    if (w.weather && w.weather.tempC != null) { const c = E.climateTags(w.weather, E.climateOpts(a, w.geo)); w.weather.tags = c.tags; w.weather.inStandard = c.inStandard; }
    if (w.stream) {
      const samples = E.expandStream(w.stream), lag = w.hrLagSec != null ? w.hrLagSec : 0, fcRef = a.fcRef || 145, band = a.bandFc || 3;
      w.paceGap = E.paceGapAtHR(samples, { fcRef, band, lagSec: lag, win: [10, 45] });
      w.eff = E.sessionEff(samples); w.mech = E.mechDecoupling(samples); w.imp = E.impSample(samples, { fcRef, band, lagSec: lag });
      if (w.quality) { w.quality.minInBand = w.paceGap ? w.paceGap.minInBand : 0; if (w.quality.smart) { if (w.paceGap) w.paceGap.confidence = E.downgradeConf(w.paceGap.confidence); if (w.imp && w.imp.confidence) w.imp.confidence = E.downgradeConf(w.imp.confidence); } }
      after++;
    } else if (w.quality || w.streamPruned) need.push(w.date);
  });
  try { E.pruneStreams(st.workouts, 20); } catch { /* idem */ }
  commit();
  let msg = after ? after + ' sessão(ões) recalculada(s) do stream.' : 'Nenhuma sessão com stream para recalcular agora.';
  if (need.length) msg += ' ' + need.length + ' sessão(ões) sem records brutos salvos — reimporte o .FIT para aplicar a correção de pausa/lacuna: ' + need.sort().join(', ') + '.';
  return msg;
}
