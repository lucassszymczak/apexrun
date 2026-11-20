// BACKUP AUTOMÁTICO de apex.analise.v1 no IndexedDB.
//
// - "migracao": na PRIMEIRA abertura da versão nova, ANTES de o app gravar qualquer
//   coisa, guarda a cópia exata do que o app antigo deixou (com data). Nunca é
//   sobrescrita nem apagada pelo app.
// - "diario": uma cópia por dia de uso (mantém as 7 mais recentes), também antes de
//   qualquer gravação daquela abertura.
// Download em Mais › Configurações › Dados.
import { db } from './db';

export const LS_KEY = 'apex.analise.v1';
const EXTRA_KEYS = ['apex.analise.synccode', 'apex.theme'];
const KEEP_DAILY = 7;

export type BackupRow = {
  id?: number;
  kind: 'migracao' | 'diario';
  at: string; // ISO
  bytes: number;
  nWorkouts: number | null;
  data: string; // conteúdo cru de apex.analise.v1
  extra: Record<string, string | null>;
};

export type BackupStatus = { ok: boolean; error?: string; migracao?: BackupRow | null };

function readLS(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}

function countWorkouts(raw: string): number | null {
  try { const p = JSON.parse(raw); return Array.isArray(p.workouts) ? p.workouts.length : null; } catch { return null; }
}

function row(kind: BackupRow['kind'], raw: string): BackupRow {
  const extra: Record<string, string | null> = {};
  for (const k of EXTRA_KEYS) extra[k] = readLS(k);
  return { kind, at: new Date().toISOString(), bytes: raw.length, nWorkouts: countWorkouts(raw), data: raw, extra };
}

// Roda no boot, antes de qualquer save(). Nunca lança: devolve o status.
export async function backupBeforeWrites(): Promise<BackupStatus> {
  const raw = readLS(LS_KEY);
  try {
    const d = await db();
    const all = (await d.getAllFromIndex('backups', 'kind', 'migracao')) as BackupRow[];
    let migracao: BackupRow | null = all[0] || null;
    if (!migracao && raw) {
      const r = row('migracao', raw);
      r.id = (await d.add('backups', r)) as number;
      migracao = r;
    }
    if (raw) {
      const daily = ((await d.getAllFromIndex('backups', 'kind', 'diario')) as BackupRow[]).sort((a, b) => (a.at < b.at ? 1 : -1));
      const today = new Date().toISOString().slice(0, 10);
      if (!daily.length || daily[0].at.slice(0, 10) !== today) {
        await d.add('backups', row('diario', raw));
        daily.unshift({} as BackupRow);
      }
      for (const old of daily.slice(KEEP_DAILY)) if (old.id != null) await d.delete('backups', old.id);
    }
    return { ok: true, migracao };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

export async function listBackups(): Promise<BackupRow[]> {
  const d = await db();
  const all = (await d.getAll('backups')) as BackupRow[];
  return all.sort((a, b) => (a.kind === b.kind ? (a.at < b.at ? 1 : -1) : a.kind === 'migracao' ? -1 : 1));
}

// O arquivo baixado é o próprio JSON de apex.analise.v1 — o mesmo formato que o
// "Importar" das Configurações aceita.
export function backupFileName(b: BackupRow): string {
  return 'apex-backup-' + (b.kind === 'migracao' ? 'migracao-' : '') + b.at.slice(0, 10) + '.json';
}
