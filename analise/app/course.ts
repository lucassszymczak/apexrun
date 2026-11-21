// PERCURSO DA PROVA no app (Fase 4 · Etapa 2): lê GPX e .FIT, monta o course com o módulo puro
// percurso.mjs e guarda em race.course (sincroniza junto com o ciclo, que já vai na sync).
import { commit, getState, toast } from './store';
import { buildTrack, type Track } from './track';
import { parseGpx, deLeve, resumoCourse, type Parte, type Resumo } from '../percurso.mjs';

export type ParteLida = Parte & { arquivo: string; km: number; data: string | null; esporte: string; baro: boolean; temAltitude: boolean };

const ESPORTE: Record<string, string> = { running: 'corrida', cycling: 'bike', walking: 'caminhada', hiking: 'caminhada', training: 'treino' };
const dataDe = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString().slice(0, 10));

export async function lerArquivo(f: File): Promise<ParteLida> {
  const nome = f.name || 'arquivo';
  if (/\.gpx$/i.test(nome) || f.type === 'application/gpx+xml') {
    const g = parseGpx(await f.text());
    const km = kmDe(g);
    return { ...g, arquivo: nome, km, data: dataDe(g.inicio), esporte: 'gpx', baro: false };
  }
  const SDK: any = await import('@garmin/fitsdk');
  const stream = SDK.Stream.fromByteArray(new Uint8Array(await f.arrayBuffer()));
  if (!SDK.Decoder.isFIT(stream)) throw new Error(nome + ': não parece um .FIT nem um GPX.');
  const res = new SDK.Decoder(stream).read();
  const tr: Track | null = buildTrack(res.messages);
  if (!tr || !tr.hasGps) throw new Error(nome + ': o arquivo não tem GPS.');
  const s = res.messages.sessionMesgs && res.messages.sessionMesgs[0];
  const inicio = s && s.startTime instanceof Date ? s.startTime.getTime() : tr.start * 1000;
  const idx = tr.lat.map((x, i) => (x != null ? i : -1)).filter((i) => i >= 0);
  // o .FIT diz se o relógio tem altímetro barométrico (deviceInfo.localDeviceType)
  const baro = (res.messages.deviceInfoMesgs || []).some((d: any) => d && d.localDeviceType === 'barometer');
  const p: Parte = { lat: idx.map((i) => tr.lat[i] as number), lon: idx.map((i) => tr.lon[i] as number), ele: idx.map((i) => tr.alt[i]), d: idx.map((i) => tr.dist[i]), inicio };
  return { ...p, arquivo: nome, km: kmDe(p), data: dataDe(inicio), esporte: ESPORTE[s && s.sport] || (s && s.sport) || 'atividade', baro, temAltitude: p.ele.some((x) => x != null) };
}
function kmDe(p: Parte): number {
  if (p.d && p.d.length && p.d[0] != null && p.d[p.d.length - 1] != null) return ((p.d[p.d.length - 1] as number) - (p.d[0] as number)) / 1000;
  let s = 0; for (let i = 1; i < p.lat.length; i++) { const r = (x: number) => (x * Math.PI) / 180; const a = Math.sin(r(p.lat[i] - p.lat[i - 1]) / 2) ** 2 + Math.cos(r(p.lat[i - 1])) * Math.cos(r(p.lat[i])) * Math.sin(r(p.lon[i] - p.lon[i - 1]) / 2) ** 2; s += 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a))); }
  return s / 1000;
}

export function salvarCourse(course: any) {
  const S = getState(); if (!S.race) return;
  S.race.course = course;
  S.race.updatedAt = new Date().toISOString(); // o ciclo sincroniza inteiro pela data de atualização
  commit();
}
export function removerCourse() {
  const S = getState(); if (!S.race || !S.race.course) return;
  delete S.race.course; S.race.updatedAt = new Date().toISOString(); commit(); toast('Percurso removido');
}

// Trajeto "falso" para reaproveitar os mapas do Treino (Ruas / Só trajeto)
export function trackDoCourse(course: any): Track | null {
  const L = deLeve(course.perfil);
  if (!L.rota || L.rota.lat.length < 2) return null;
  const n = L.rota.lat.length, idx = Array.from({ length: n }, (_, i) => i);
  return { v: 1, start: 0, tzOffsetSec: null, hasGps: true, t: idx.slice(), lat: L.rota.lat, lon: L.rota.lon, dist: L.rota.d, hr: idx.map(() => null), spd: idx.map(() => null), alt: idx.map(() => null), grade: idx.map(() => null), draw: idx };
}
export const resumo = (course: any): Resumo => resumoCourse(course);
export const FONTE_ROTULO: Record<string, string> = { gpx: 'Arquivo da prova', gravacao: 'Reconhecimento gravado', digitada: 'Altimetria digitada' };
