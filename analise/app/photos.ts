// FOTOS DO PERCURSO (Etapa 3) — encaixadas pelo HORÁRIO, nunca pelo GPS da foto (o iPhone
// remove a localização ao compartilhar).
// 1. Lê DateTimeOriginal (exifr). É a hora LOCAL de quando a foto foi tirada.
// 2. Converte para UTC com o fuso do treino (local_timestamp − timestamp do .FIT). Sem ele,
//    usa o OffsetTimeOriginal da própria foto; sem os dois, o fuso do aparelho naquela data.
// 3. Encaixa no ponto de tempo mais próximo do trajeto. A mais de 10 min do treino (ou sem
//    horário) → "Fora do percurso", com opção de posicionar à mão.
// 4. Guarda só a miniatura (≤ 600 px, WebP) no IndexedDB, por id do treino.
import { useEffect, useState } from 'react';
import { type Track, duration, idxAtTime } from './track';
import { type PhotoRec, putPhoto, getPhotos, onPhotoChange } from './db';

export const OFF_ROUTE_SEC = 600;
export const THUMB_MAX = 600;

// "2026:11:14 06:32:10" → { local: epoch como se fosse UTC, iso: "2026-11-14T06:32:10" }
export function parseExifDate(s: any): { local: number; iso: string } | null {
  if (s instanceof Date) s = s.toISOString(); // (não deveria acontecer: lemos sem converter)
  const m = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(s || ''));
  if (!m) return null;
  const [y, mo, d, h, mi, se] = m.slice(1).map(Number);
  if (y < 1990 || mo < 1 || mo > 12) return null;
  return { local: Date.UTC(y, mo - 1, d, h, mi, se) / 1000, iso: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` };
}
// "-03:00" → −10800
export function parseOffset(s: any): number | null {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  return (m[1] === '-' ? -1 : 1) * (+m[2] * 3600 + +m[3] * 60);
}
function deviceOffset(local: number): number {
  const d = new Date(local * 1000); // campos UTC = hora local da foto
  return -new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()).getTimezoneOffset() * 60;
}

export type Fit = { utc: number | null; t: number | null; i: number | null; off: boolean; tz: 'treino' | 'foto' | 'aparelho' | null };
// Encaixe puro (testável): hora local da foto + fuso → ponto do trajeto.
export function fitPhoto(tr: Track | null, local: number | null, photoOffset: number | null = null): Fit {
  if (local == null) return { utc: null, t: null, i: null, off: true, tz: null };
  const tz: Fit['tz'] = tr && tr.tzOffsetSec != null ? 'treino' : photoOffset != null ? 'foto' : 'aparelho';
  const off = tz === 'treino' ? tr!.tzOffsetSec! : tz === 'foto' ? photoOffset! : deviceOffset(local);
  const utc = local - off;
  if (!tr || !tr.t.length) return { utc, t: null, i: null, off: true, tz };
  const t = utc - tr.start, total = duration(tr);
  if (t < -OFF_ROUTE_SEC || t > total + OFF_ROUTE_SEC) return { utc, t: null, i: null, off: true, tz };
  const tc = Math.max(0, Math.min(total, t));
  const i = idxAtTime(tr, tc);
  return { utc, t: tr.t[i], i, off: false, tz };
}

export async function readPhotoTime(file: Blob): Promise<{ local: number | null; iso: string | null; offset: number | null }> {
  try {
    const exifr: any = await import('exifr');
    // o EXIF fica no começo do arquivo: lê só os primeiros 256 KB
    const head = await file.slice(0, 256 * 1024).arrayBuffer();
    const x = await (exifr.default || exifr).parse(head, { pick: ['DateTimeOriginal', 'CreateDate', 'OffsetTimeOriginal', 'OffsetTime'], reviveValues: false });
    const dt = parseExifDate(x && (x.DateTimeOriginal || x.CreateDate));
    return { local: dt ? dt.local : null, iso: dt ? dt.iso : null, offset: parseOffset(x && (x.OffsetTimeOriginal || x.OffsetTime)) };
  } catch { return { local: null, iso: null, offset: null }; }
}

// Miniatura ≤ 600 px (lado maior), WebP; se o navegador não gerar WebP, JPEG.
export async function makeThumb(file: Blob): Promise<{ blob: Blob; w: number; h: number }> {
  let src: any, W = 0, H = 0, cleanup = () => {};
  try { src = await createImageBitmap(file); W = src.width; H = src.height; cleanup = () => src.close && src.close(); }
  catch {
    const url = URL.createObjectURL(file);
    src = await new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Não consegui abrir esta imagem.')); im.src = url; });
    W = src.naturalWidth; H = src.naturalHeight; cleanup = () => URL.revokeObjectURL(url);
  }
  const k = Math.min(1, THUMB_MAX / Math.max(W, H));
  const w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d')!.drawImage(src, 0, 0, w, h); cleanup();
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((res) => c.toBlob(res, type, q));
  let blob = await toBlob('image/webp', 0.82);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.85);
  if (!blob) throw new Error('Não consegui gerar a miniatura.');
  return { blob, w, h };
}

const pid = () => 'ph_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Prepara a foto (miniatura + encaixe) sem gravar — o Completar guarda depois de salvar o treino.
export async function preparePhoto(file: File, tr: Track | null, wid = ''): Promise<PhotoRec> {
  const [tm, th] = await Promise.all([readPhotoTime(file), makeThumb(file)]);
  const f = fitPhoto(tr, tm.local, tm.offset);
  return { id: pid(), wid, blob: th.blob, w: th.w, h: th.h, name: file.name, taken: tm.iso, utc: f.utc, t: f.t, i: f.i, off: f.off, addedAt: new Date().toISOString() };
}
export async function addPhotos(wid: string, files: File[], tr: Track | null): Promise<{ ok: number; off: number; fail: number }> {
  const r = { ok: 0, off: 0, fail: 0 };
  for (const file of files) {
    try { const p = await preparePhoto(file, tr, wid); await putPhoto(p); if (p.off) r.off++; else r.ok++; }
    catch { r.fail++; }
  }
  return r;
}
// Reencaixa depois de reimportar o .FIT (as posicionadas à mão ficam onde estão).
export async function refitPhotos(wid: string, tr: Track | null): Promise<void> {
  for (const p of await getPhotos(wid)) {
    if (p.manual || !p.taken) continue;
    const dt = parseExifDate(p.taken); if (!dt) continue;
    const f = fitPhoto(tr, dt.local, null);
    await putPhoto({ ...p, utc: f.utc, t: f.t, i: f.i, off: f.off });
  }
}
export async function placeManually(p: PhotoRec, tr: Track, i: number): Promise<void> {
  await putPhoto({ ...p, i, t: tr.t[i], off: false, manual: true });
}
export async function moveToOffRoute(p: PhotoRec): Promise<void> { await putPhoto({ ...p, i: null, t: null, off: true, manual: true }); }

export function photoSummary(r: { ok: number; off: number; fail: number }): string {
  const parts = [];
  if (r.ok) parts.push(r.ok + (r.ok > 1 ? ' fotos encaixadas' : ' foto encaixada') + ' no trajeto');
  if (r.off) parts.push(r.off + ' em Fora do percurso');
  if (r.fail) parts.push(r.fail + ' não abriu');
  return parts.join(' · ') || 'Nenhuma foto adicionada';
}

// Hook: fotos do treino com URL de exibição (revogadas ao trocar)
export type PhotoView = PhotoRec & { url: string };
export function usePhotos(wid: string | null): PhotoView[] {
  const [list, setList] = useState<PhotoView[]>([]);
  useEffect(() => {
    if (!wid) { setList([]); return; }
    let alive = true, urls: string[] = [];
    const load = () => getPhotos(wid).then((l) => {
      if (!alive) return;
      urls.forEach((u) => URL.revokeObjectURL(u));
      const v = l.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) }));
      urls = v.map((p) => p.url); setList(v);
    });
    load();
    const off = onPhotoChange((x) => { if (x === wid) load(); });
    return () => { alive = false; off(); urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [wid]);
  return list;
}
