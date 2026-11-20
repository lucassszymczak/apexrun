// IndexedDB do app de análise ("apex-performance").
// - backups: cópias de apex.analise.v1 (a da migração para a versão nova + diárias).
// - Etapas seguintes acrescentam trajetos, séries e fotos (por id do treino).
// Nada daqui entra na sincronização.
import { openDB, type IDBPDatabase } from 'idb';

export const DB_NAME = 'apex-performance';
export const DB_VERSION = 1;

let dbp: Promise<IDBPDatabase> | null = null;
export function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('backups')) {
          const s = d.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
          s.createIndex('kind', 'kind');
        }
      },
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}
