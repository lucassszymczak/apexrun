// SINCRONIZAÇÃO COM O GARMIN (Fase 2 · Etapa 2). Roda depois que a tela abriu (nunca
// atrasa a abertura), no máximo a cada 15 min, ou em "Sincronizar agora".
//
// Para cada corrida/pedal do Garmin:
// - já está salvo (mesmo garminActivityId)? só confere a nota (RPE);
// - é o mesmo treino que você importou à mão (regra de duplicata do Importar)? liga os
//   dois (garminActivityId) e confere a nota — não duplica ("M já existiam");
// - é novo: baixa o .FIT e passa pelo MESMO caminho do Importar (leitura, clima, trajeto).
//     · dos últimos 14 dias → fila "Para completar" (IndexedDB, fora de apex.analise.v1);
//     · mais antigo → salvo direto, com o RPE do Garmin (decisão do Lucas, 20/11).
// RPE: a nota que você dá no relógio vem do Garmin em dezenas (60 = 6). Ela vale para os
// treinos novos e atualiza os já salvos (decisão do Lucas, 20/11; o backup guarda o antes).
import { useSyncExternalStore, useEffect, useState } from 'react';
import { getState, commit } from './store';
import { readFit, findDuplicate, buildWorkout, formFrom, extrasOf, commitWorkout } from './actions';
import { queueAll, queuePut, queueDel, onQueueChange, type QueueItem } from './db';
import { garminReady, garminStatus, garminList, garminFit, garminRpe, GarminError, type GarminAtividade, type GarminStatus } from './garmin';

export const RECENTE_DIAS = 14;
export const INTERVALO_MIN = 15;
const LS = 'apex.garmin.v1'; // estado local do app (não é dado de treino): última execução, status, ignorados

export type Resumo = { novos: number; fila: number; salvos: number; existiam: number; rpe: number; falhas: number; pendentes?: number; at: string };
type Local = { rpeVisto?: Record<string, string>; lastRun?: string; status?: GarminStatus | null; resumo?: Resumo | null; erro?: { codigo: string; msg: string } | null };
function readLocal(): Local { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch { return {}; } }
function writeLocal(p: Partial<Local>) { try { localStorage.setItem(LS, JSON.stringify({ ...readLocal(), ...p })); } catch { /* sem storage */ } }

// ---------------- estado observável (progresso e avisos) ----------------
export type SyncView = { rodando: boolean; feito: number; total: number; local: Local };
let view: SyncView = { rodando: false, feito: 0, total: 0, local: readLocal() };
const ls = new Set<() => void>();
function set(p: Partial<SyncView>) { view = { ...view, ...p, local: readLocal() }; ls.forEach((l) => l()); }
export function useGarminSync(): SyncView { return useSyncExternalStore((cb) => { ls.add(cb); return () => ls.delete(cb); }, () => view); }
export function garminLocal(): Local { return readLocal(); }

const rpe10 = (r: number | null | undefined) => (r == null || !(r > 0) ? null : Math.round(r / 10)); // 60 → 6 (escala 0–10 do app)
const dateOf = (a: GarminAtividade) => String(a.inicioLocal || a.inicio || '').slice(0, 10);

// Pausa entre downloads (o Garmin não documenta limite: 1 por vez, com folga)
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));
let parar = false;
export function pausarGarmin() { parar = true; }

export async function runGarminSync(opts: { force?: boolean; now?: Date } = {}): Promise<Resumo | null> {
  if (!garminReady() || view.rodando) return null;
  const now = opts.now || new Date();
  const loc = readLocal();
  if (!opts.force && loc.lastRun && now.getTime() - Date.parse(loc.lastRun) < INTERVALO_MIN * 60000) return null;
  parar = false;
  set({ rodando: true, feito: 0, total: 0 });
  writeLocal({ lastRun: now.toISOString() });
  const res: Resumo = { novos: 0, fila: 0, salvos: 0, existiam: 0, rpe: 0, falhas: 0, at: now.toISOString() };
  try {
    const st = await garminStatus();
    writeLocal({ status: st, erro: null });
    if (!st.conectado) return null;
    if (st.status === 'chave_vencida' || st.status === 'chave_invalida') { writeLocal({ erro: { codigo: st.status, msg: 'A chave do Garmin venceu ou foi apagada.' } }); return null; }
    const { atividades } = await garminList({ force: true });
    const ws = getState().workouts;
    const porId = new Map(ws.filter((w: any) => w.garminActivityId).map((w: any) => [String(w.garminActivityId), w]));
    const fila = new Map((await queueAll()).map((q) => [q.id, q]));
    // 1) dois aparelhos: o que já foi salvo (em qualquer aparelho) sai da fila
    for (const id of fila.keys()) if (porId.has(id)) { await queueDel(id); fila.delete(id); }
    // 2) separa: já salvos, duplicatas de importação à mão e novos
    const novos: GarminAtividade[] = [];
    const ligar: [GarminAtividade, any][] = [];
    for (const a of atividades) {
      if (porId.has(a.id)) { res.existiam++; continue; }
      if (fila.has(a.id)) continue;
      const fake = { id: '__garmin__', date: dateOf(a), modal: a.tipo === 'bike' ? 'bike' : 'corrida', distKm: a.distanciaM ? a.distanciaM / 1000 : 0, durationSec: a.duracaoS || 0 };
      const d = findDuplicate(fake);
      if (d && d.same && !d.match.garminActivityId) { ligar.push([a, d.match]); res.existiam++; continue; }
      novos.push(a);
    }
    // 3) notas (RPE) do Garmin — só o que precisa: novos, recém-ligados, treinos dos últimos
    //    14 dias (você pode mudar a nota depois) e os que nunca foram conferidos. Em lotes de
    //    10, com pausa: o Garmin limita chamadas seguidas (visto em 20/11, resposta 429).
    const limite14 = new Date(now.getTime() - RECENTE_DIAS * 86400000).toISOString().slice(0, 10);
    const visto = { ...(loc.rpeVisto || {}) };
    const precisa = [
      ...atividades.filter((a) => porId.has(a.id) && (!visto[a.id] || dateOf(a) >= limite14)).map((a) => a.id),
      ...ligar.map(([a]) => a.id), ...novos.map((a) => a.id),
    ];
    const notas = new Map<string, number | null>();
    let pausaGarmin = false;
    for (let i = 0; i < precisa.length; i += 10) {
      if (i) await pausa(2500);
      try { for (const n of (await garminRpe(precisa.slice(i, i + 10))).notas) { notas.set(n.id, rpe10(n.rpe)); visto[n.id] = now.toISOString().slice(0, 10); } }
      catch (e) { if (!(e instanceof GarminError)) throw e; if (e.codigo === 'limite' || e.codigo === 'garmin_fora') pausaGarmin = true; break; }
    }
    writeLocal({ rpeVisto: visto });
    // 4) liga os importados à mão e atualiza as notas dos já salvos
    let mudou = false;
    const agora = now.toISOString();
    for (const [a, w] of ligar) { w.garminActivityId = a.id; w.updatedAt = agora; mudou = true; porId.set(a.id, w); }
    for (const [id, w] of porId) {
      const r = notas.get(id);
      if (r != null && w.rpe !== r) { w.rpe = r; w.updatedAt = agora; res.rpe++; mudou = true; }
    }
    if (mudou) commit();
    // 5) novos: baixa o .FIT (do mais antigo para o mais novo), um por vez
    novos.sort((x, y) => String(x.inicio).localeCompare(String(y.inicio)));
    set({ total: novos.length, feito: 0 });
    const limite = new Date(now.getTime() - RECENTE_DIAS * 86400000).toISOString().slice(0, 10);
    for (const a of novos) {
      if (parar || pausaGarmin) break;
      try {
        const buf = await garminFit(a.id);
        const r = await readFit(new File([buf], a.id + '.fit'));
        const nota = notas.get(a.id);
        if (nota != null) r.w.rpe = nota;
        r.w.garminActivityId = a.id;
        res.novos++;
        if (dateOf(a) >= limite) {
          await queuePut({ id: a.id, w: r.w, track: r.track, addedAt: agora, nome: a.nome });
          res.fila++;
        } else {
          const b = buildWorkout(formFrom(r.w), extrasOf(r.w), null);
          if ('w' in b) { commitWorkout(b.w, 'new', undefined, r.track, { quiet: true }); res.salvos++; }
          else res.falhas++;
        }
      } catch (e) {
        if (e instanceof GarminError && (e.codigo === 'limite' || e.codigo === 'garmin_fora')) { pausaGarmin = true; break; }
        if (e instanceof GarminError && e.codigo !== 'entrada_invalida') throw e;
        res.falhas++;
      }
      set({ feito: view.feito + 1 });
      await pausa(1500);
    }
    res.pendentes = Math.max(0, novos.length - res.novos - res.falhas);
    // pausa pedida pelo Garmin: guarda o que já entrou e continua sozinho na próxima abertura
    writeLocal({ resumo: res, erro: pausaGarmin ? { codigo: 'limite', msg: 'O Garmin pediu uma pausa. O que já chegou está salvo; o app continua sozinho na próxima abertura (ou em Sincronizar agora daqui a alguns minutos).' } : null });
    return res;
  } catch (e: any) {
    // sem internet: silêncio (tenta de novo na próxima abertura); o resto vira aviso discreto
    if (e instanceof GarminError && e.codigo !== 'sem_internet') writeLocal({ erro: { codigo: e.codigo, msg: e.codigo === 'limite' ? 'O Garmin pediu uma pausa. O app continua sozinho na próxima abertura (ou em Sincronizar agora daqui a alguns minutos).' : e.codigo === 'garmin_fora' ? 'O Garmin não respondeu agora. O app tenta de novo sozinho mais tarde.' : e.message } });
    if (e instanceof GarminError && e.codigo === 'sem_internet') writeLocal({ lastRun: undefined });
    return null;
  } finally {
    set({ rodando: false });
  }
}

export function resumoTexto(r: Resumo): string {
  const p: string[] = [];
  p.push(r.novos + (r.novos === 1 ? ' treino novo' : ' treinos novos'));
  p.push(r.existiam + ' já existia' + (r.existiam === 1 ? '' : 'm') + ' (ignorado' + (r.existiam === 1 ? ')' : 's)'));
  if (r.rpe) p.push(r.rpe + ' nota' + (r.rpe === 1 ? '' : 's') + ' de RPE atualizada' + (r.rpe === 1 ? '' : 's'));
  if (r.falhas) p.push(r.falhas + ' não abriu');
  if (r.pendentes) p.push(r.pendentes + ' ainda por baixar');
  return p.join(' · ');
}

// Aviso de vencimento (30 dias antes) e de chave vencida/inválida
export function avisoChave(now = Date.now()): { tom: 'atencao' | 'alerta'; texto: string } | null {
  const l = readLocal();
  const st = l.status;
  if (l.erro && (l.erro.codigo === 'chave_vencida' || l.erro.codigo === 'chave_invalida')) return { tom: 'alerta', texto: l.erro.msg };
  if (!st || !st.conectado || !st.keyExpiresAt) return null;
  const dias = Math.floor((Date.parse(st.keyExpiresAt) - now) / 86400000);
  if (dias < 0) return { tom: 'alerta', texto: 'A chave do Garmin venceu.' };
  if (dias <= 30) return { tom: 'atencao', texto: 'A chave do Garmin vence em ' + dias + (dias === 1 ? ' dia' : ' dias') + '.' };
  return null;
}

// Fila "Para completar" observável (Hoje, barra de navegação, tela Completar)
export function useGarminQueue(): QueueItem[] {
  const [q, setQ] = useState<QueueItem[]>([]);
  useEffect(() => { let ok = true; const load = () => queueAll().then((l) => { if (ok) setQ(l); }); load(); const off = onQueueChange(load); return () => { ok = false; off(); }; }, []);
  return q;
}
export function haQuantoSync(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  return m < 1 ? 'sincronizado agora' : m < 60 ? 'sincronizado há ' + m + ' min' : m < 1440 ? 'sincronizado há ' + Math.round(m / 60) + ' h' : 'sincronizado há ' + Math.round(m / 1440) + ' d';
}

// ---------------- "Buscar trajeto dos treinos antigos" (Fase 2 · Etapa 3) ----------------
// Para treinos ligados ao Garmin sem trajeto neste aparelho: baixa o .FIT e guarda SÓ o
// trajeto (como Reimportar .FIT): nenhum número do treino muda. Também sobe a versão leve.
export async function buscarTrajetos(ids?: string[]): Promise<{ ok: number; falhas: number; faltam: number } | null> {
  if (!garminReady() || view.rodando) return null;
  const { trackIds, putTrack } = await import('./db');
  const { pushTrack } = await import('./track-sync');
  const local = await trackIds();
  const alvo = getState().workouts.filter((w: any) => w.garminActivityId && !local.has(w.id) && (!ids || ids.includes(w.id)))
    .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
  parar = false;
  set({ rodando: true, feito: 0, total: alvo.length });
  const r = { ok: 0, falhas: 0, faltam: 0 };
  try {
    for (const w of alvo) {
      if (parar) break;
      try {
        const buf = await garminFit(String(w.garminActivityId));
        const f = await readFit(new File([buf], w.garminActivityId + '.fit'), { weather: false });
        if (f.track) { await putTrack(w.id, f.track); await pushTrack(w.id, f.track, { quiet: true }); r.ok++; } else r.falhas++;
      } catch (e) {
        if (e instanceof GarminError && (e.codigo === 'limite' || e.codigo === 'garmin_fora' || e.codigo === 'sem_internet')) break;
        r.falhas++;
      }
      set({ feito: view.feito + 1 });
      await pausa(1500);
    }
  } finally { r.faltam = Math.max(0, alvo.length - r.ok - r.falhas); set({ rodando: false }); }
  return r;
}
export async function semTrajetoGarmin(): Promise<number> {
  const { trackIds } = await import('./db');
  const local = await trackIds();
  return getState().workouts.filter((w: any) => w.garminActivityId && !local.has(w.id)).length;
}
