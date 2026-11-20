// IndexedDB do app de análise ("apex-performance").
// - backups: cópias de apex.analise.v1 (a da migração para a versão nova + diárias).
// - tracks: trajeto e séries de cada treino, por id do treino (Etapa 2).
// Nada daqui entra na sincronização.
import { openDB, type IDBPDatabase } from 'idb';
import type { Track } from './track';

export const DB_NAME = 'apex-performance';
export const DB_VERSION = 2;

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
