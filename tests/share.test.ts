import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
// @ts-expect-error módulo JS sem tipos
import { fitMessages } from '../analise/golden/synthetic.mjs';
// @ts-expect-error módulo JS sem tipos
import { rng } from '../analise/golden/env.mjs';
// @ts-expect-error módulo JS sem tipos
import { bareJpeg } from './helpers/exif.mjs';
import { buildTrack, haversine, duration, idxAtTime, type Track } from '../analise/app/track';
import { sharedTrack, drawnPoints, normPrivacy, privacyOf, PRIVACY_DEFAULT } from '../analise/app/privacy';
import { cardGeometry, defaultNums, numberDefs, tempoCurto } from '../analise/app/share/card';
import { fitPhoto, parseExifDate, parseOffset, readPhotoTime, OFF_ROUTE_SEC } from '../analise/app/photos';

const synth = buildTrack(fitMessages(rng(42), { date: '2026-10-01', min: 50, speed: 2.9, seed: 3, hilly: true, pause: true }))!;
const REAL = ['25074758427', '25106458116', '25128573610'].map((n) => 'fixtures/privado/' + n + '.fit').filter(existsSync);
async function realTrack(path: string): Promise<Track> {
  const { Decoder, Stream } = await import('@garmin/fitsdk');
  const res = new Decoder(Stream.fromByteArray(new Uint8Array(readFileSync(path)))).read();
  return buildTrack(res.messages)!;
}
function startEnd(tr: Track) {
  const g = tr.lat.map((x, i) => (x != null ? i : -1)).filter((i) => i >= 0);
  return [g[0], g[g.length - 1]].map((i) => [tr.lat[i] as number, tr.lon[i] as number]);
}
function minDistToEnds(tr: Track, idx: number[]) {
  const [[sa, so], [ea, eo]] = startEnd(tr);
  return Math.min(...idx.map((i) => Math.min(haversine(tr.lat[i]!, tr.lon[i]!, sa, so), haversine(tr.lat[i]!, tr.lon[i]!, ea, eo))));
}
const RECT = { x: 92, y: 260, w: 896, h: 1100 };

// ---------------- critério 9 ----------------
describe('privacidade: "Ocultar início e fim" (critério 9)', () => {
  for (const raio of [200, 500, 1000]) {
    it(`sintético · ${raio} m: nenhum ponto desenhado (linha ou marco de km) a menos de ${raio} m da largada ou da chegada`, () => {
      const sh = sharedTrack(synth, { mapa: 'ocultar', raio });
      expect(sh.show).toBe(true);
      const geo = cardGeometry(synth, sh, RECT, 1);
      const idx = [...geo.lines.flat().map((p) => p.i), ...geo.marks.map((m) => m.i)];
      expect(idx.length).toBeGreaterThan(10);
      expect(minDistToEnds(synth, idx)).toBeGreaterThanOrEqual(raio);
      expect(geo.start).toBeNull(); expect(geo.end).toBeNull();
    });
  }
  it('a linha é cortada nas zonas (nunca liga dois lados passando por dentro)', () => {
    const sh = sharedTrack(synth, { mapa: 'ocultar', raio: 500 });
    for (const run of sh.runs) for (let k = 1; k < run.length; k++)
      for (let j = run[k - 1] + 1; j < run[k]; j++) if (synth.lat[j] != null) expect(sh.keep(j)).toBe(true);
  });
  it('"Completo" desenha tudo, com largada e chegada; "Sem mapa" não desenha nada', () => {
    const full = sharedTrack(synth, { mapa: 'completo', raio: 500 });
    expect(drawnPoints(full)).toEqual(synth.draw);
    expect(full.start).not.toBeNull();
    expect(sharedTrack(synth, { mapa: 'nenhum', raio: 500 }).show).toBe(false);
    expect(sharedTrack(null, { mapa: 'completo', raio: 500 }).show).toBe(false);
  });
  it.skipIf(!REAL.length)('com os .FIT reais (fixtures/privado): 500 m respeitados em todos', async () => {
    for (const p of REAL) {
      const tr = await realTrack(p);
      const sh = sharedTrack(tr, { mapa: 'ocultar', raio: 500 });
      const geo = cardGeometry(tr, sh, RECT);
      const idx = [...geo.lines.flat().map((q) => q.i), ...geo.marks.map((m) => m.i)];
      // (um treino em voltas perto de casa pode sumir inteiro: aí o card sai sem trajeto)
      if (!idx.length) { expect(sh.show, p).toBe(false); continue; }
      expect(minDistToEnds(tr, idx), p).toBeGreaterThanOrEqual(500);
    }
  });
});

describe('privacidade: modelo e padrão', () => {
  it('normaliza valores inválidos para o padrão', () => {
    expect(normPrivacy({ mapa: 'x', raio: 300, quemVe: 'mundo' })).toEqual(PRIVACY_DEFAULT);
    expect(normPrivacy({ mapa: 'nenhum', raio: '1000', quemVe: 'eu' })).toEqual({ mapa: 'nenhum', raio: 1000, quemVe: 'eu' });
  });
  it('treino sem o campo usa o padrão do atleta; com o campo, o dele', () => {
    const a = { privacidadePadrao: { mapa: 'completo', raio: 200, quemVe: 'eu' } };
    expect(privacyOf({}, a)).toEqual({ mapa: 'completo', raio: 200, quemVe: 'eu' });
    expect(privacyOf({ privacy: { mapa: 'ocultar', raio: 1000, quemVe: 'todos' } }, a).raio).toBe(1000);
    expect(privacyOf({}, {})).toEqual(PRIVACY_DEFAULT);
  });
});

// ---------------- critério 8 ----------------
describe('fotos: encaixe pelo horário (critério 8)', () => {
  // o sintético não tem local_timestamp: simulamos um fuso de −3 h
  const tr: Track = { ...synth, tzOffsetSec: -3 * 3600 };
  const localOf = (t: number) => tr.start + t + (tr.tzOffsetSec as number); // "hora do relógio" da foto
  it('duas fotos dentro do treino caem no ponto certo (erro ≤ 1 amostra)', () => {
    for (const t of [600, 1800.4]) {
      const f = fitPhoto(tr, Math.round(localOf(t)));
      expect(f.off).toBe(false); expect(f.tz).toBe('treino');
      expect(Math.abs((f.i as number) - idxAtTime(tr, t))).toBeLessThanOrEqual(1);
    }
  });
  it('foto a mais de 10 min do treino vai para "Fora do percurso"; dentro da margem encosta na largada/chegada', () => {
    expect(fitPhoto(tr, localOf(-OFF_ROUTE_SEC - 60)).off).toBe(true);
    expect(fitPhoto(tr, localOf(duration(tr) + OFF_ROUTE_SEC + 60)).off).toBe(true);
    expect(fitPhoto(tr, localOf(-120)).i).toBe(0);
    expect(fitPhoto(tr, localOf(duration(tr) + 120)).i).toBe(tr.t.length - 1);
    expect(fitPhoto(tr, null).off).toBe(true);
  });
  it('sem o fuso do .FIT, usa o fuso gravado na foto', () => {
    const t2: Track = { ...synth, tzOffsetSec: null };
    const f = fitPhoto(t2, t2.start + 900 - 3 * 3600, -3 * 3600);
    expect(f.tz).toBe('foto'); expect(f.t).toBeCloseTo(t2.t[idxAtTime(t2, 900)], 5);
  });
  it('lê DateTimeOriginal e OffsetTimeOriginal do EXIF (exifr)', async () => {
    const r = await readPhotoTime(new Blob([bareJpeg('2026:11:14 06:40:12', '-03:00')]));
    expect(r.iso).toBe('2026-11-14T06:40:12');
    expect(r.offset).toBe(-10800);
    expect(r.local).toBe(Date.UTC(2026, 10, 14, 6, 40, 12) / 1000);
    expect(parseExifDate('lixo')).toBeNull(); expect(parseOffset('+05:30')).toBe(19800);
  });
  it.skipIf(!REAL.length)('com o .FIT real: o fuso vem do relógio e duas fotos caem no ponto certo', async () => {
    const r = await realTrack(REAL[0]);
    expect(r.tzOffsetSec).toBe(-10800);
    for (const t of [300, duration(r) * 0.6]) {
      const f = fitPhoto(r, Math.round(r.start + t + r.tzOffsetSec!));
      expect(Math.abs((f.i as number) - idxAtTime(r, t))).toBeLessThanOrEqual(1);
    }
    expect(fitPhoto(r, r.start + duration(r) + 3600 + r.tzOffsetSec!).off).toBe(true);
  });
});

// ---------------- números do card ----------------
describe('card: números', () => {
  const w = { date: '2026-11-14', modal: 'corrida', type: 'facil', distKm: 21.2, durationSec: 9723, hrAvg: 167 };
  it('padrão: distância, pace e tempo, no formato brasileiro', () => {
    expect(defaultNums(w)).toEqual(['dist', 'pace', 'tempo']);
    const d = numberDefs(w);
    expect(d.find((x) => x.key === 'dist')!.inline).toBe('21,20 km');
    expect(d.find((x) => x.key === 'pace')!.inline).toBe('7:39/km');
    expect(tempoCurto(9723)).toBe('2h42');
  });
  it('bike usa velocidade no lugar do pace', () => {
    expect(defaultNums({ ...w, modal: 'bike', type: 'bike' })).toEqual(['dist', 'vel', 'tempo']);
  });
});
