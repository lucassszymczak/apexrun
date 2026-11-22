// Estado do app novo = o MESMO estado do app antigo (engine.mjs, chave apex.analise.v1).
// Abertura idêntica à página antiga (init): load → salva o seed → vincula o sono.
// A diferença: antes disso, o backup automático no IndexedDB (backup.ts).
import { useSyncExternalStore } from 'react';
import * as E from '../engine.mjs';
import { backupBeforeWrites, type BackupStatus } from './backup';
import { fixStretchedSplits } from './fix-splits';
import { estadoNovo } from './perfil';

export type Workout = Record<string, any> & { id: string; date: string };
export type ApexState = {
  athlete: Record<string, any>;
  workouts: Workout[];
  daily: Record<string, any>[];
  deleted: any[];
  race: Record<string, any> | null;
  races: any[];
  planWeeks: Record<string, any>;
  updatedAt: string | null;
  lastSyncAt: string | null;
  seeded?: boolean;
};

let version = 0;
const listeners = new Set<() => void>();
function emit() { version++; listeners.forEach((l) => l()); }

// toasts (mensagens curtas na parte de baixo da tela)
type Toast = { id: number; msg: string };
let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();
export function toast(msg: string) {
  const t = { id: Date.now() + Math.random(), msg: String(msg).replace(/^⚠\s*/, '') };
  toasts = [...toasts.slice(-2), t];
  toastListeners.forEach((l) => l());
  setTimeout(() => { toasts = toasts.filter((x) => x !== t); toastListeners.forEach((l) => l()); }, 2600);
}
export function useToasts(): Toast[] {
  return useSyncExternalStore((cb) => { toastListeners.add(cb); return () => toastListeners.delete(cb); }, () => toasts);
}

export let backupStatus: BackupStatus = { ok: false };
export let splitFix: string[] = []; // datas dos treinos corrigidos nesta abertura

export async function boot(): Promise<void> {
  backupStatus = await backupBeforeWrites();
  E.setToast(toast);
  const st: ApexState = E.setState(E.load());
  // Primeiro acesso (aparelho sem nenhum dado): começa vazio, sem os dados de exemplo do Lucas,
  // com o perfil em branco e o tour de boas-vindas (docs/app-para-outros.md).
  if (st.seeded) { Object.assign(st, estadoNovo()); delete st.seeded; E.save(); }
  try { if (E.linkSleepToWorkouts() > 0) E.save(); } catch { /* como no app antigo */ }
  // Correção dos splits esticados pela regra antiga (decisão do Lucas, 20/11). Roda depois do
  // backup automático (a cópia original fica guardada) e só uma vez por treino (idempotente).
  try {
    const fixed = fixStretchedSplits(st.workouts);
    if (fixed.length) {
      E.touch(); E.save();
      splitFix = fixed.map((w: any) => w.date);
      setTimeout(() => toast('Corrigi o último km de ' + fixed.length + ' treino(s) antigo(s) (' + splitFix.join(', ') + '): decoupling e pacing agora batem com o .FIT.'), 600);
    }
  } catch (e) { console.warn('[apex] correção de splits', e); }
  emit();
  // sincroniza ao abrir (puxa o que veio de outro aparelho e reenvia a união)
  if (E.syncEnabled()) setTimeout(() => { syncNow(true); }, 300);
}

export function getState(): ApexState { return E.getState(); }

// Hook: re-renderiza quando o estado muda. Devolve o estado e a versão.
export function useApex(): { st: ApexState; v: number } {
  const v = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => version);
  return { st: E.getState(), v };
}

// Depois de qualquer mudança feita pelo usuário: igual ao app antigo
// (touch → save → scheduleSync → render).
export function commit() {
  E.touch();
  E.save();
  scheduleSync();
  emit();
}
// Mudança que não marca updatedAt (ex.: vincular treino ao plano): save + render.
export function saveOnly() { E.save(); emit(); }
export function refresh() { emit(); }

// ---------------- sincronização (orquestração da página antiga) ----------------
export type SyncStatus = { state: 'idle' | 'syncing' | 'ok' | 'err'; msg: string };
let syncing = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncStatus: SyncStatus = { state: 'idle', msg: '' };
const syncListeners = new Set<() => void>();
function setSyncStatus(state: SyncStatus['state'], msg = '') { syncStatus = { state, msg }; syncListeners.forEach((l) => l()); }
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore((cb) => { syncListeners.add(cb); return () => syncListeners.delete(cb); }, () => syncStatus);
}

// pull → merge → push: os dois lados convergem para a união
export function syncNow(silent?: boolean): Promise<boolean> {
  if (!E.syncEnabled()) return Promise.resolve(false);
  if (syncing) return Promise.resolve(false);
  syncing = true; setSyncStatus('syncing');
  return E.syncPull().then((remote: any) => {
    if (remote && remote.payload) E.applyMerged(E.syncMergeStates(E.currentPayload(), remote.payload));
    return E.syncPush();
  }).then(() => {
    E.getState().lastSyncAt = new Date().toISOString(); E.save();
    syncing = false; setSyncStatus('ok'); emit();
    return true;
  }).catch((e: any) => {
    syncing = false; setSyncStatus('err', e && e.message ? e.message : String(e));
    if (!silent) toast('Falha ao sincronizar: ' + (e && e.message ? e.message : e));
    return false;
  });
}
export function scheduleSync() {
  if (!E.syncEnabled()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { syncTimer = null; syncNow(true); }, 1500);
}
// entrar num código existente: ADOTA o dataset remoto (evita levar o seed junto)
export function syncJoin(code: string): Promise<boolean> {
  const norm = E.normalizeSyncCode(code);
  if (!norm) return Promise.reject(new Error('Código vazio.'));
  E.setSyncCode(norm); setSyncStatus('syncing');
  return E.syncPull().then((remote: any) => {
    if (remote && remote.payload) E.applyMerged(remote.payload);
    return E.syncPush();
  }).then(() => { E.getState().lastSyncAt = new Date().toISOString(); E.save(); setSyncStatus('ok'); emit(); return true; })
    .catch((e: any) => { E.setSyncCode(null); setSyncStatus('err', e && e.message ? e.message : String(e)); throw e; });
}
