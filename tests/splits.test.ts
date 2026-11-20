import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as E from '../analise/engine.mjs';
import { formFrom, extrasOf, buildWorkout } from '../analise/app/actions';

// Decisão do Lucas (20/11): salvar sem mexer nos splits mantém os splits EXATOS do .FIT
// (antes o último km era "esticado" até a distância total e o decoupling mudava).
beforeAll(() => { E.setState({ athlete: { ...E.DEFAULT_ATHLETE }, workouts: [], daily: [] }); });

const fitLike = {
  date: '2026-11-19', modal: 'corrida', type: 'facil', distKm: 6.09, durationSec: 2520, hrAvg: 156, hrMax: 190, cadence: 174, gainM: 38, lossM: 36,
  splits: [
    { distKm: 1, timeSec: 458, hrAvg: 142, elevDeltaM: 3.2 }, { distKm: 1, timeSec: 456, hrAvg: 147, elevDeltaM: -1.4 },
    { distKm: 1, timeSec: 348, hrAvg: 168, elevDeltaM: 5.1 }, { distKm: 1, timeSec: 334, hrAvg: 176, elevDeltaM: -6 },
    { distKm: 1, timeSec: 412, hrAvg: 160, elevDeltaM: 2.4 }, { distKm: 1, timeSec: 465, hrAvg: 151, elevDeltaM: -3.3 },
  ],
};

describe('salvar o treino preserva os splits do relógio', () => {
  it('sem mexer no texto: splits idênticos e o decoupling do .FIT se mantém', () => {
    const r = buildWorkout(formFrom(fitLike), extrasOf(fitLike), null) as { w: any };
    expect(r.w.splits).toEqual(fitLike.splits);
    expect(E.computeDecoupling(r.w)).toBe(E.computeDecoupling(fitLike));
  });
  it('o comportamento antigo mudaria o último km (1,00 → 1,09 km) — é isso que deixou de acontecer', () => {
    const old = E.parseSplits(formFrom(fitLike).splits as string);
    old[old.length - 1].distKm = Math.max(0.05, 6.09 - (old.length - 1));
    expect(old[old.length - 1].distKm).toBeCloseTo(1.09, 5);
    expect(E.computeDecoupling({ ...fitLike, splits: old })).not.toBe(E.computeDecoupling(fitLike));
  });
  it('splits digitados ou editados à mão seguem a regra antiga', () => {
    const f = formFrom(fitLike); f.splits = '7:38, 142\n7:36, 147\n5:48, 168';
    const r = buildWorkout(f, extrasOf(fitLike), null) as { w: any };
    expect(r.w.splits.length).toBe(3);
    expect(r.w.splits[2].distKm).toBeCloseTo(6.09 - 2, 5);
  });
  it('editar um treino já salvo sem mexer nos splits não altera nada', () => {
    const saved = { ...fitLike, id: 'x1', splits: [...fitLike.splits.slice(0, 5), { ...fitLike.splits[5], distKm: 1.09 }] };
    const r = buildWorkout(formFrom(saved), extrasOf(saved), 'x1') as { w: any };
    expect(r.w.splits).toEqual(saved.splits);
  });
  const real = 'fixtures/privado/25128573610.fit';
  it.skipIf(!existsSync(real))('com o .FIT real de 19/11: decoupling 8,4% preservado ao salvar', async () => {
    const { Decoder, Stream } = await import('@garmin/fitsdk');
    const res = new Decoder(Stream.fromByteArray(new Uint8Array(readFileSync(real)))).read();
    const w = E.fitMessagesToWorkout(res.messages);
    const r = buildWorkout(formFrom(w), extrasOf(w), null) as { w: any };
    expect(r.w.splits).toEqual(w.splits);
    expect(E.computeDecoupling(r.w)).toBeCloseTo(8.39, 1);
  });
});
