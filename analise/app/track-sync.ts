// TRAJETO NOS DOIS APARELHOS (Fase 2 · Etapa 3). Usa a tabela analise_tracks pelas RPCs
// (mesmo código de sincronização, mesmo modelo de segurança do analise_sync).
// - Ao salvar um treino com trajeto (ou reimportar / buscar no Garmin): sobe a versão leve.
// - No outro aparelho: ao abrir um Treino sem trajeto local, baixa a versão leve; na
//   abertura do app, antecipa os 10 treinos mais recentes.
// - Excluir o treino apaga o trajeto do servidor. Fotos nunca sincronizam.
import * as E from '../engine.mjs';
import { toast, getState } from './store';
import { putTrack, getTrack, trackIds } from './db';
import { type Track } from './track';
import { toLight, fromLight, LIMITE_AVISO, type Light } from './track-light';

const on = () => !!(E.sbReady() && E.syncEnabled());
const sid = (): Promise<string> => E.syncHashId(E.getSyncCode());
const kb = (b: number) => (b / 1024).toFixed(1).replace('.', ',') + ' KB';

export async function pushTrack(wid: string, tr: Track | null, opts: { quiet?: boolean } = {}): Promise<number | null> {
  if (!on() || !tr || (tr as any).leve) return null;
  const { light, bytes } = toLight(tr);
  try {
    await E.sbRpc('analise_tracks_put', { p_sync_id: await sid(), p_workout_id: wid, p_payload: light });
    if (bytes > LIMITE_AVISO && !opts.quiet) toast('Trajeto com ' + kb(bytes) + ' (acima de 30 KB): sincronizado assim mesmo' + (light.passo > 10 ? ', com um ponto a cada ' + light.passo + ' s.' : '.'));
    return bytes;
  } catch { return null; } // sem internet: sobe na próxima abertura (syncTracks)
}
export async function deleteRemoteTrack(wid: string): Promise<void> {
  if (!on()) return;
  try { await E.sbRpc('analise_tracks_delete', { p_sync_id: await sid(), p_workout_id: wid }); } catch { /* tenta de novo? o treino já some do outro aparelho pela sync */ }
}
async function getRemote(ids: string[]): Promise<{ workout_id: string; payload: Light }[]> {
  if (!on() || !ids.length) return [];
  try { return (await E.sbRpc('analise_tracks_get', { p_sync_id: await sid(), p_ids: ids.slice(0, 20) })) || []; } catch { return []; }
}
// Treino aberto sem trajeto local: busca a versão leve
export async function fetchRemoteTrack(wid: string): Promise<Track | null> {
  const [row] = await getRemote([wid]);
  if (!row || !row.payload) return null;
  const tr = fromLight(row.payload);
  await putTrack(wid, tr);
  return tr;
}

// Na abertura: sobe os trajetos completos que o servidor ainda não tem e baixa os 10 mais
// recentes que faltam aqui. Roda em segundo plano, um por vez.
let rodando = false;
export async function syncTracks(): Promise<{ subiu: number; baixou: number } | null> {
  if (!on() || rodando) return null;
  rodando = true;
  try {
    const idx: { workout_id: string }[] = (await E.sbRpc('analise_tracks_index', { p_sync_id: await sid() })) || [];
    const remoto = new Set(idx.map((r) => r.workout_id));
    const local = await trackIds();
    const ws = getState().workouts;
    const ids = new Set(ws.map((w: any) => w.id));
    let subiu = 0, baixou = 0;
    for (const id of local) {
      if (remoto.has(id) || !ids.has(id)) continue;
      const tr = await getTrack(id);
      if (tr && !(tr as any).leve && (await pushTrack(id, tr, { quiet: true })) != null) subiu++;
    }
    const recentes = ws.slice().sort((a: any, b: any) => String(b.date).localeCompare(String(a.date))).slice(0, 10).map((w: any) => w.id).filter((id: string) => remoto.has(id) && !local.has(id));
    for (const row of await getRemote(recentes)) { await putTrack(row.workout_id, fromLight(row.payload)); baixou++; }
    return { subiu, baixou };
  } catch { return null; } finally { rodando = false; }
}

// Mapa de calor (Fase 3 · Etapa 3): baixa a versão leve dos treinos que estão no servidor e
// faltam neste aparelho (de 20 em 20). É o mesmo dado que o outro aparelho já sincronizou.
export async function baixarLeves(ids: string[], onProg?: (feito: number, total: number) => void): Promise<number> {
  if (!on() || !ids.length) return 0;
  try {
    const idx: { workout_id: string }[] = (await E.sbRpc('analise_tracks_index', { p_sync_id: await sid() })) || [];
    const remoto = new Set(idx.map((r) => r.workout_id));
    const alvo = ids.filter((id) => remoto.has(id));
    let n = 0;
    for (let i = 0; i < alvo.length; i += 20) {
      for (const row of await getRemote(alvo.slice(i, i + 20))) { if (row && row.payload) { await putTrack(row.workout_id, fromLight(row.payload)); n++; } }
      if (onProg) onProg(Math.min(alvo.length, i + 20), alvo.length);
    }
    return n;
  } catch { return 0; }
}
export const syncLigado = on;
