// Ações sobre treinos — portadas do app antigo SEM mudar a lógica:
// saveModal/finalizeSave (salvar + aviso de duplicata), deleteWorkout (com registro
// para a sync) e handleFitFile (ler .FIT + clima).
import * as E from '../engine.mjs';
import { commit, getState, toast } from './store';
import { buildTrack, totalDist, duration, type Track } from './track';
import { putTrack, delTrack, delPhotosOf, getPhotos, putPhoto } from './db';
import { refitPhotos } from './photos';
import { pushTrack, deleteRemoteTrack } from './track-sync';
import { computeLeitura, voltasParaLaps } from '../leitura.mjs';
import { lapsFromMessages, tirosPorOrigem } from '../laps.mjs';
import { fetchWind } from '../wind.mjs';

// ---------------- .FIT ----------------
// Mesma sequência do handleFitFile antigo. O leitor (@garmin/fitsdk 21) agora vem
// do npm, junto com o app — não depende mais do CDN (funciona offline).
export type FitRead = { w: any; track: Track | null; name: string; messages: any };
export async function readFitFile(file: File): Promise<any> { return (await readFit(file)).w; }
// Lê o .FIT: treino (motor, igual ao app antigo) + trajeto (novo, separado).
export async function readFit(file: File, opts: { weather?: boolean } = {}): Promise<FitRead> {
  const buf = await file.arrayBuffer();
  const SDK: any = await import('@garmin/fitsdk');
  const bytes = new Uint8Array(buf);
  const stream = SDK.Stream.fromByteArray(bytes);
  if (!SDK.Decoder.isFIT(stream)) throw new Error('Não parece um arquivo .FIT válido.');
  const decoder = new SDK.Decoder(stream);
  const res = decoder.read();
  const w = E.fitMessagesToWorkout(res.messages);
  let track: Track | null = null;
  try { track = buildTrack(res.messages); } catch (e) { console.warn('[apex] trajeto não montado', e); }
  const laps = lapsFromMessages(res.messages);
  if (track) entradas.set(track, { laps, wind: null });
  if (opts.weather === false) { anexaLeitura(w, track, laps, null); return { w, track, name: file.name, messages: res.messages }; }
  // clima automático (Open-Meteo): só corrida com GPS; melhor esforço, não bloqueia
  let when = w.date ? new Date(w.date + 'T12:00:00Z') : new Date();
  if (w.geo && w.geo.lat != null) {
    const st = res.messages.sessionMesgs && res.messages.sessionMesgs[0] && res.messages.sessionMesgs[0].startTime;
    if (st instanceof Date) when = st;
  }
  const needWeather = w.modal !== 'bike' && w.geo && w.geo.lat != null;
  w.weather = needWeather ? (await E.fetchWeather(w.geo, when, getState().athlete)) || null : null;
  // vento (item 2 aprovado): mesma fonte e mesma consulta do clima (coordenada e horário)
  const wind = needWeather && track && track.hasGps ? await fetchWind(w.geo, when) : null;
  if (track) entradas.set(track, { laps, wind });
  anexaLeitura(w, track, laps, wind);
  return { w, track, name: file.name, messages: res.messages };
}

// ---------------- formulário ----------------
// Leitura do treino (Fase 2 · Etapa 5): calculada uma vez, com o trajeto completo (1 Hz).
// As voltas e o vento lidos do .FIT ficam ligados ao trajeto até o treino ser salvo: a
// leitura final usa o treino salvo (tipo, splits, clima), não o rascunho.
const entradas = new WeakMap<Track, { laps: any[]; wind: any }>();
export function anexaLeitura(w: any, track: Track | null, laps: any[], wind: any) {
  try { w.leitura = computeLeitura({ w, tr: track, laps, wind, athlete: getState().athlete }); }
  catch (e) { console.warn('[apex] leitura', e); }
}
// Leitura de um treino salvo, a partir do trajeto completo. Sem voltas/vento novos, usa os
// que já estavam guardados na leitura anterior.
export function leituraPara(w: any, track: Track | null, novo?: { laps?: any[]; wind?: any }): any {
  const prev = w.leitura || {};
  const laps = novo && novo.laps && novo.laps.length ? novo.laps : voltasParaLaps(prev.voltas);
  const wind = (novo && novo.wind) || prev.ventoHora || null;
  try {
    if (track) {
      const L = computeLeitura({ w, tr: track, laps, wind, athlete: getState().athlete });
      if (prev.origem) { // origem escolhida à mão (Trocar origem) vale sobre a automática
        L.origem = prev.origem;
        const t = E.isBike(w) ? null : tirosPorOrigem(prev.origem, laps, track);
        if (t) L.tiros = t; else delete L.tiros;
      }
      if (prev.segmentos) L.segmentos = prev.segmentos; // passagens dos segmentos (Fase 3) ficam
      return L;
    }
    // sem trajeto (edição do treino): só o que depende do treino salvo é refeito
    const base = computeLeitura({ w, tr: null, laps: [], wind: null, athlete: getState().athlete });
    const out: any = { ...prev, v: base.v };
    delete out.climaPadrao; delete out.deriva;
    if (base.climaPadrao) out.climaPadrao = base.climaPadrao;
    if (base.deriva) out.deriva = base.deriva;
    return out;
  } catch (e) { console.warn('[apex] leitura', e); return w.leitura || null; }
}
// Vento na hora do treino (Open-Meteo), para treinos que chegam sem ele.
async function ventoDe(w: any, track: Track | null): Promise<any> {
  if (!track || !track.hasGps || !w.geo || w.geo.lat == null || E.isBike(w)) return null;
  const when = track.start ? new Date(track.start * 1000) : new Date(w.date + 'T12:00:00Z');
  return fetchWind(w.geo, when).catch(() => null);
}

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
    splitsOrig: s && s.splits ? s.splits : null,
    privacy: s && s.privacy ? s.privacy : null, // Etapa 3 (campo novo, opcional)
    garminActivityId: s && s.garminActivityId ? String(s.garminActivityId) : null, // Fase 2 (origem Garmin)
    leitura: s && s.leitura ? s.leitura : null, // Fase 2 (leitura do treino)
    gearId: s && s.gearId ? s.gearId : null, // Fase 5 (equipamento)
    dorRegioes: s && s.dorRegioes ? s.dorRegioes : null, // Fase 5 (mapa do corpo)
  };
}

// Splits → texto do campo (igual ao openModal antigo)
export function splitsText(sp: any[]): string {
  return sp.map((x: any) => [E.hms(x.timeSec), x.hrAvg || '', x.elevDeltaM != null ? x.elevDeltaM : ''].filter((v, i) => i === 0 || v !== '').join(', ')).join('\n');
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
    splits: s && s.splits ? splitsText(s.splits) : '',
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
  // Decisão do Lucas (20/11, daqui para frente): se o texto dos splits não foi mexido, ficam
  // os splits EXATOS do relógio/do treino. Antes, o texto era relido e o último km era
  // "esticado" até a distância total (ex.: 1,00 → 1,09 km), o que mudava o decoupling.
  // Splits digitados/editados à mão seguem a regra antiga (abaixo).
  const keepOrig = !isBk && extras.splitsOrig && S('splits') === splitsText(extras.splitsOrig);
  const splits = isBk ? null : keepOrig ? JSON.parse(JSON.stringify(extras.splitsOrig)) : E.parseSplits(S('splits'));
  // se splits não trazem distância explícita, ajusta a última para bater com o total
  if (!keepOrig && splits && dist) { const sd = splits.length; if (sd && Math.abs(sd - dist) > 0.001) splits[sd - 1].distKm = Math.max(0.05, dist - (sd - 1)); }
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
  } as Record<string, any>;
  // privacidade do treino (Etapa 3): campo novo e opcional — só existe se foi definido
  if (extras.privacy) w.privacy = extras.privacy;
  if (extras.garminActivityId) w.garminActivityId = extras.garminActivityId;
  if (extras.leitura) w.leitura = extras.leitura;
  // Fase 5: equipamento e regiões de dor (campos novos e opcionais; só existem se definidos)
  if (extras.gearId) w.gearId = extras.gearId;
  if (extras.dorRegioes && extras.dorRegioes.length) w.dorRegioes = extras.dorRegioes;
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
export function commitWorkout(w: any, choice: 'new' | 'edit' | 'replace' | 'keep', matchId?: string, track?: Track | null, opts: { quiet?: boolean } = {}): string {
  const st = getState();
  let msg = 'Treino registrado';
  if (track) { const ent = entradas.get(track); w.leitura = leituraPara(w, track, ent); }
  else if (w.leitura) w.leitura = leituraPara(w, null);
  if (choice === 'edit') { const idx = st.workouts.findIndex((x: any) => x.id === w.id); st.workouts[idx] = w; msg = 'Treino atualizado'; }
  else if (choice === 'replace') { const i = st.workouts.findIndex((x: any) => x.id === matchId); if (i >= 0) st.workouts[i] = w; else st.workouts.push(w); msg = 'Treino substituído'; }
  else if (choice === 'keep') { st.workouts.push(w); msg = 'Treino registrado (2 no dia)'; }
  else st.workouts.push(w);
  // finalizeSave
  try { E.pruneStreams(st.workouts, 20); } catch { /* idem */ }
  try { E.linkSleepToWorkouts(); } catch { /* idem */ }
  commit();
  if (!opts.quiet) toast(msg);
  // trajeto vai para o IndexedDB pelo id do treino (o treino substituído perde o dele)
  if (choice === 'replace' && matchId && matchId !== w.id) { delTrack(matchId); movePhotos(matchId, w.id, track || null); }
  if (track) putTrack(w.id, track).then(() => pushTrack(w.id, track, opts)).catch((e) => toast('Não consegui guardar o trajeto neste aparelho: ' + (e && e.message ? e.message : e)));
  if (choice === 'replace' && matchId && matchId !== w.id) deleteRemoteTrack(matchId);
  return w.id;
}

// treino substituído: as fotos dele passam para o novo (reencaixadas no novo trajeto)
async function movePhotos(from: string, to: string, tr: Track | null) {
  try {
    const list = await getPhotos(from);
    if (!list.length) return;
    await delPhotosOf(from);
    for (const p of list) await putPhoto({ ...p, wid: to });
    if (tr) await refitPhotos(to, tr);
  } catch { /* sem IndexedDB */ }
}

export function deleteWorkout(id: string) {
  const st = getState();
  st.workouts = st.workouts.filter((x: any) => x.id !== id);
  st.deleted = (st.deleted || []).filter((d: any) => d.id !== id);
  st.deleted.push({ id, at: new Date().toISOString() });
  commit();
  delTrack(id);
  delPhotosOf(id);
  deleteRemoteTrack(id);
  toast('Treino excluído');
}

// REIMPORTAR .FIT num treino já salvo: reconhece pelo dia, distância e duração e SÓ
// acrescenta o trajeto e as séries. Nenhum campo do treino (RPE, notas, números,
// análises) muda — o treino nem é regravado.
export function fitMatches(w: any, fw: any): { ok: boolean; why: string } {
  if (fw.date !== w.date) return { ok: false, why: 'o arquivo é de ' + fw.date.split('-').reverse().join('/') + ' e o treino, de ' + w.date.split('-').reverse().join('/') };
  const near = (a: number, b: number, tol: number) => a > 0 && b > 0 && Math.abs(a - b) / b <= tol;
  const dOk = (!w.distKm && !fw.distKm) || near(fw.distKm, w.distKm, 0.05);
  const tOk = near(fw.durationSec, w.durationSec, 0.05);
  if (!dOk && !tOk) return { ok: false, why: 'distância e duração não batem (' + fw.distKm + ' km × ' + w.distKm + ' km)' };
  if (!dOk) return { ok: false, why: 'a distância não bate (' + fw.distKm + ' km no arquivo × ' + w.distKm + ' km no treino)' };
  if (!tOk) return { ok: false, why: 'a duração não bate (' + E.hms(fw.durationSec) + ' × ' + E.hms(w.durationSec) + ')' };
  return { ok: true, why: '' };
}
export async function reimportFit(w: any, file: File): Promise<string> {
  const r = await readFit(file, { weather: false });
  const m = fitMatches(w, r.w);
  if (!m.ok) throw new Error('Este .FIT não parece ser deste treino: ' + m.why + '.');
  if (!r.track) throw new Error('O arquivo não tem registros de trajeto.');
  await putTrack(w.id, r.track);
  pushTrack(w.id, r.track);
  await setLeitura(w.id, r.track);
  await refitPhotos(w.id, r.track).catch(() => {});
  return r.track.hasGps ? 'Trajeto adicionado. Nada nas análises mudou.' : 'Séries adicionadas (o arquivo não tem GPS). Nada nas análises mudou.';
}
// Usado pelo teste de fumaça / verificação: o trajeto não altera o treino.
export function _trackSummary(tr: Track) { return { km: totalDist(tr) / 1000, sec: duration(tr), pts: tr.t.length, draw: tr.draw.length }; }

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

// Privacidade do treino (Etapa 3): campo novo e opcional; vai junto na sincronização.
export function setWorkoutPrivacy(id: string, p: { mapa: string; raio: number; quemVe: string }) {
  const w = getState().workouts.find((x: any) => x.id === id);
  if (!w) return;
  w.privacy = { mapa: p.mapa, raio: p.raio, quemVe: p.quemVe };
  w.updatedAt = new Date().toISOString();
  commit();
  toast('Privacidade do treino salva');
}

// Guarda a leitura calculada num treino já salvo (campo novo; nenhum número existente muda).
export async function setLeitura(id: string, track: Track, ent?: { laps?: any[]; wind?: any }) {
  const w0 = getState().workouts.find((x: any) => x.id === id);
  if (!w0) return;
  ent = ent || entradas.get(track);
  const wind = (ent && ent.wind) || (w0.leitura && w0.leitura.ventoHora) || (await ventoDe(w0, track));
  const w = getState().workouts.find((x: any) => x.id === id); // pode ter mudado durante a busca
  if (!w) return;
  w.leitura = leituraPara(w, track, { laps: ent && ent.laps, wind });
  w.updatedAt = new Date().toISOString();
  commit();
}
// "Recalcular leitura": treinos com o trajeto completo neste aparelho.
export async function recalcularLeitura(ids?: string[]): Promise<number> {
  const { trackIds, getTrack } = await import('./db');
  const local = await trackIds();
  let n = 0;
  for (const w of getState().workouts.slice()) {
    if (!local.has(w.id) || (ids && !ids.includes(w.id))) continue;
    const tr = await getTrack(w.id); if (!tr) continue;
    await setLeitura(w.id, tr); n++;
  }
  return n;
}

// "Trocar origem" dos tiros: o que cada origem daria neste treino (precisa do trajeto completo
// neste aparelho para a detecção automática).
export async function opcoesOrigem(w: any): Promise<{ k: string; rotulo: string | null }[]> {
  const { getTrack } = await import('./db');
  const tr = await getTrack(w.id);
  const laps = voltasParaLaps(w.leitura && w.leitura.voltas);
  return ['estruturado', 'voltas', 'auto', 'nenhum'].map((k) => {
    if (k === 'nenhum') return { k, rotulo: 'Não são tiros' };
    if (k === 'auto' && !tr) return { k, rotulo: null };
    const t = tirosPorOrigem(k, laps, tr);
    return { k, rotulo: t ? t.rotulo : null };
  });
}
export async function trocarOrigem(id: string, origem: string | null) {
  const w = getState().workouts.find((x: any) => x.id === id); if (!w) return;
  const { getTrack } = await import('./db');
  const tr = await getTrack(id);
  const laps = voltasParaLaps(w.leitura && w.leitura.voltas);
  const L = { ...(w.leitura || { v: 1 }) };
  if (origem) { L.origem = origem; const t = tirosPorOrigem(origem, laps, tr); if (t) L.tiros = t; else delete L.tiros; }
  else { delete L.origem; if (tr) { const n = leituraPara({ ...w, leitura: L }, tr); Object.assign(L, n); if (!n.tiros) delete L.tiros; } }
  w.leitura = L; w.updatedAt = new Date().toISOString();
  commit(); toast(origem === 'nenhum' ? 'Tiros removidos deste treino' : 'Origem dos tiros trocada');
}
