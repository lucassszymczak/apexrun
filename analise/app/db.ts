// IndexedDB do app de análise ("apex-performance").
// - backups: cópias de apex.analise.v1 (a da migração para a versão nova + diárias).
// - tracks: trajeto e séries de cada treino, por id do treino (Etapa 2).
// - photos: miniaturas (≤ 600 px) das fotos do percurso, com o ponto encaixado (Etapa 3).
// Nada daqui entra na sincronização.
import { openDB, type IDBPDatabase } from 'idb';
import type { Track } from './track';

export const DB_NAME = 'apex-performance';
export const DB_VERSION = 3;

let dbp: Promise<IDBPDatabase> | null = null;
export function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        // cada store só é criada se não existir — atualizar a versão nunca apaga dados
        if (!d.objectStoreNames.contains('backups')) {
          const s = d.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
          s.createIndex('kind', 'kind');
        }
        if (!d.objectStoreNames.contains('tracks')) d.createObjectStore('tracks', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('photos')) d.createObjectStore('photos', { keyPath: 'id' }).createIndex('wid', 'wid');
      },
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}

// ---------------- trajetos ----------------
const trackListeners = new Set<(id: string) => void>();
export function onTrackChange(fn: (id: string) => void) { trackListeners.add(fn); return () => trackListeners.delete(fn); }

export async function putTrack(id: string, tr: Track): Promise<void> {
  const d = await db();
  await d.put('tracks', { ...tr, id });
  trackListeners.forEach((l) => l(id));
}
export async function getTrack(id: string): Promise<Track | null> {
  try { const d = await db(); return ((await d.get('tracks', id)) as Track) || null; } catch { return null; }
}
export async function delTrack(id: string): Promise<void> {
  try { const d = await db(); await d.delete('tracks', id); trackListeners.forEach((l) => l(id)); } catch { /* sem IndexedDB */ }
}
export async function trackIds(): Promise<Set<string>> {
  try { const d = await db(); return new Set((await d.getAllKeys('tracks')) as string[]); } catch { return new Set(); }
}

// ---------------- fotos (miniaturas) ----------------
export type PhotoRec = {
  id: string; wid: string; blob: Blob; w: number; h: number; name?: string;
  taken: string | null;   // DateTimeOriginal como veio (hora local da foto, "AAAA-MM-DDTHH:MM:SS")
  utc: number | null;     // epoch (s) depois de aplicar o fuso
  t: number | null;       // s desde o início do treino (no trajeto)
  i: number | null;       // índice do ponto do trajeto
  off: boolean;           // "Fora do percurso" (sem horário ou a mais de 10 min do treino)
  manual?: boolean;       // posicionada à mão
  addedAt: string;
};
const photoListeners = new Set<(wid: string) => void>();
export function onPhotoChange(fn: (wid: string) => void) { photoListeners.add(fn); return () => photoListeners.delete(fn); }
const firePhotos = (wid: string) => photoListeners.forEach((l) => l(wid));
export async function putPhoto(p: PhotoRec): Promise<void> { const d = await db(); await d.put('photos', p); firePhotos(p.wid); }
export async function getPhotos(wid: string): Promise<PhotoRec[]> {
  try { const d = await db(); const l = (await d.getAllFromIndex('photos', 'wid', wid)) as PhotoRec[]; return l.sort((a, b) => (a.t ?? 1e12) - (b.t ?? 1e12) || a.addedAt.localeCompare(b.addedAt)); } catch { return []; }
}
export async function delPhoto(p: PhotoRec): Promise<void> { try { const d = await db(); await d.delete('photos', p.id); firePhotos(p.wid); } catch { /* sem IndexedDB */ } }
export async function delPhotosOf(wid: string): Promise<void> {
  try { const d = await db(); for (const k of await d.getAllKeysFromIndex('photos', 'wid', wid)) await d.delete('photos', k); firePhotos(wid); } catch { /* idem */ }
}
export async function photoCounts(): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  try { const d = await db(); for (const p of (await d.getAll('photos')) as PhotoRec[]) m.set(p.wid, (m.get(p.wid) || 0) + 1); } catch { /* idem */ }
  return m;
}
