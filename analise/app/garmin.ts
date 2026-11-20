// Cliente da função "garmin" (Supabase Edge Function). A chave do Garmin passa por aqui
// UMA vez (connect) e nunca é guardada no aparelho: nem localStorage, nem IndexedDB.
// A identidade é o mesmo sync_id da sincronização (hash do código).
import * as E from '../engine.mjs';

export type GarminStatus = { conectado: boolean; keyExpiresAt?: string | null; status?: string; since?: string | null; filtros?: { corrida: boolean; bike: boolean }; lastListAt?: string | null; retryAt?: string | null };
export type GarminAtividade = { id: string; nome: string | null; inicio: string | null; inicioLocal: string | null; tipo: 'corrida' | 'bike'; subtipo: string | null; duracaoS: number | null; distanciaM: number | null; fcMedia: number | null };
export class GarminError extends Error { constructor(public codigo: string, msg: string, public retryAt?: string) { super(msg); } }

export const VALIDADES: [number, string][] = [[30, '30 dias'], [90, '90 dias'], [180, '180 dias'], [365, '1 ano']];

export function garminReady(): boolean { return !!(E.sbReady() && E.syncEnabled()); }
function fnUrl(): string { return String((window.__APEX_SB__ || { url: '' }).url).replace(/\/$/, '') + '/functions/v1/garmin'; }

async function call(action: string, body: Record<string, unknown> = {}): Promise<Response> {
  if (!garminReady()) throw new GarminError('sem_sync', 'Ligue a sincronização entre aparelhos primeiro (Configurações › Sincronizar).');
  const syncId: string = await E.syncHashId(E.getSyncCode());
  const anon = (window.__APEX_SB__ || { anon: '' }).anon;
  let r: Response;
  try {
    r = await fetch(fnUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon }, body: JSON.stringify({ action, syncId, ...body }) });
  } catch { throw new GarminError('sem_internet', 'Sem conexão com a internet agora.'); }
  if (r.ok) return r;
  let j: any = null; try { j = await r.json(); } catch { /* sem corpo */ }
  throw new GarminError(j && j.erro || 'erro', (j && j.mensagem) || 'O servidor respondeu ' + r.status + '.', j && j.retryAt);
}
const js = async (r: Response) => r.json();

export const garminStatus = (): Promise<GarminStatus> => call('status').then(js);
export const garminConnect = (apiKey: string, since: string | null, validadeDias: number): Promise<{ ok: boolean; keyExpiresAt: string }> => call('connect', { apiKey, since, validadeDias }).then(js);
export const garminSettings = (s: { filtros?: { corrida: boolean; bike: boolean }; since?: string | null }) => call('settings', s).then(js);
export const garminDisconnect = () => call('disconnect').then(js);
export const garminList = (o: { since?: string | null; force?: boolean } = {}): Promise<{ atividades: GarminAtividade[]; mais?: boolean; recente?: boolean }> => call('list', o).then(js);
export const garminRpe = (activityIds: string[]): Promise<{ notas: { id: string; rpe: number | null; feel: number | null }[] }> => call('rpe', { activityIds }).then(js);
export async function garminFit(activityId: string): Promise<ArrayBuffer> { return (await call('fit', { activityId })).arrayBuffer(); }

// "Trazer treinos desde" → data AAAA-MM-DD
export type Desde = '30' | '90' | 'ciclo' | 'tudo';
export function sinceDate(d: Desde, now = new Date()): string | null {
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  if (d === '30' || d === '90') return iso(new Date(now.getTime() - +d * 86400000));
  if (d === 'ciclo') { const r = E.getState().race; return r && r.startDate ? String(r.startDate).slice(0, 10) : iso(new Date(now.getTime() - 90 * 86400000)); }
  return '2000-01-01';
}
// dias até a chave vencer (negativo = vencida)
export function diasParaVencer(keyExpiresAt: string | null | undefined, now = Date.now()): number | null {
  if (!keyExpiresAt) return null;
  return Math.floor((Date.parse(keyExpiresAt) - now) / 86400000);
}
