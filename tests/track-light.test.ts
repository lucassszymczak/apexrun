// Versão leve do trajeto (Fase 2 · Etapa 3): tamanho e fidelidade.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
// @ts-expect-error módulo JS sem tipos
import { fitMessages } from '../analise/golden/synthetic.mjs';
// @ts-expect-error módulo JS sem tipos
import { rng } from '../analise/golden/env.mjs';
import { buildTrack, kmMarks, totalDist, duration, type Track } from '../analise/app/track';
import { toLight, fromLight, LIMITE_AVISO, LIMITE_SERVIDOR } from '../analise/app/track-light';

const meiaSint = buildTrack(fitMessages(rng(7), { date: '2026-08-29', min: 162, speed: 2.18, seed: 5, hilly: true, pause: true }))!;
const maratona = buildTrack(fitMessages(rng(9), { date: '2026-09-01', min: 330, speed: 2.13, seed: 6, hilly: true, pause: true }))!;
const ultra = buildTrack(fitMessages(rng(11), { date: '2026-09-02', min: 900, speed: 2.0, seed: 8, hilly: true, pause: false }))!;
const MEIA = 'fixtures/privado/24159622528.fit';

describe('versão leve do trajeto', () => {
  it('meia (sintética, 1 ponto/s) fica abaixo de 30 KB, com 100 a 400 pontos no traçado', () => {
    const { light, bytes } = toLight(meiaSint);
    expect(bytes).toBeLessThanOrEqual(LIMITE_AVISO);
    const n = light.route!.lat.length;
    expect(n).toBeGreaterThanOrEqual(100); expect(n).toBeLessThanOrEqual(400);
    expect(light.passo).toBe(10);
  });
  it.skipIf(!existsSync(MEIA))('Meia de Floripa real: até 30 KB', async () => {
    const { Decoder, Stream } = await import('@garmin/fitsdk');
    const tr = buildTrack(new Decoder(Stream.fromByteArray(new Uint8Array(readFileSync(MEIA)))).read().messages)!;
    const { bytes } = toLight(tr);
    expect(bytes).toBeLessThanOrEqual(LIMITE_AVISO);
    console.log('Meia real: ' + (bytes / 1024).toFixed(1) + ' KB');
  });
  it('maratona passa de 30 KB mas cabe no servidor (aviso, não bloqueio)', () => {
    const { bytes } = toLight(maratona);
    expect(bytes).toBeGreaterThan(LIMITE_AVISO); expect(bytes).toBeLessThanOrEqual(LIMITE_SERVIDOR);
  });
  it('treino muito longo: o intervalo cresce até caber em 64 KB', () => {
    const { light, bytes } = toLight(ultra);
    expect(light.passo).toBeGreaterThan(10); expect(bytes).toBeLessThanOrEqual(LIMITE_SERVIDOR);
  });
  it('volta a ser um trajeto com mapa, replay e gráfico: distância, duração, marcos de km e FC batem', () => {
    const tr: Track = fromLight(JSON.parse(JSON.stringify(toLight(meiaSint).light)));
    expect(tr.hasGps).toBe(true);
    expect(Math.abs(totalDist(tr) - totalDist(meiaSint))).toBeLessThan(30);
    expect(Math.abs(duration(tr) - duration(meiaSint))).toBeLessThanOrEqual(1);
    expect(kmMarks(tr, 1).length).toBe(kmMarks(meiaSint, 1).length);
    expect(tr.draw.length).toBeGreaterThanOrEqual(100);
    // FC numa amostra do meio: igual à original (a série guarda a FC inteira)
    const i = Math.floor(tr.t.length / 2), t = tr.t[i];
    const j = meiaSint.t.findIndex((x) => x >= t);
    expect(Math.abs((tr.hr[i] ?? 0) - (meiaSint.hr[j] ?? 0))).toBeLessThanOrEqual(3);
    for (const k of tr.draw) expect(tr.lat[k]).not.toBeNull();
  });
  it('treino sem GPS: só as séries (gráfico), sem traçado', () => {
    const semGps: Track = { ...meiaSint, hasGps: false, lat: meiaSint.lat.map(() => null), lon: meiaSint.lon.map(() => null), draw: [] };
    const { light } = toLight(semGps);
    expect(light.route).toBeNull();
    const tr = fromLight(light);
    expect(tr.hasGps).toBe(false); expect(tr.draw.length).toBe(0); expect(tr.hr.some((h) => h != null)).toBe(true);
  });
});
