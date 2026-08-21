import { describe, expect, it } from 'vitest';
import {
  weeklyTrend,
  kmSeries,
  toWideByKm,
  timeInZones,
  aggregateZones,
  type DashActivity,
  type DashSplit,
  type HrZone,
} from '../src/features/dashboard/transform';

function act(p: Partial<DashActivity>): DashActivity {
  return {
    id: 'x', data: '2026-08-10', tipo: 'longao', distancia_m: 10000, duracao_s: 3600,
    pace_medio: 450, fc_media: 150, fc_max: 170, rpe: 5, dor_flag: false,
    quality_status: 'ok', confirmed_at: null, source: 'manual', ...p,
  };
}

describe('weeklyTrend', () => {
  it('agrupa por semana e faz médias + eficiência', () => {
    const rows = weeklyTrend([
      act({ id: 'a', data: '2026-08-10', pace_medio: 450, fc_media: 150 }),
      act({ id: 'b', data: '2026-08-10', pace_medio: 470, fc_media: 160 }),
      act({ id: 'c', data: '2026-08-17', pace_medio: 430, fc_media: 155 }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].n).toBe(2);
    expect(rows[0].pace).toBeCloseTo(460, 0);
    expect(rows[0].fc).toBeCloseTo(155, 0);
    expect(rows[0].efic).toBeCloseTo(460 / 155, 2);
    expect(rows[1].pace).toBeCloseTo(430, 0);
  });

  it('ignora atividades sem pace e sem FC', () => {
    const rows = weeklyTrend([act({ pace_medio: null, fc_media: null })]);
    expect(rows).toHaveLength(0);
  });
});

describe('kmSeries + toWideByKm', () => {
  const acts = [
    act({ id: 'A', tipo: 'longao', data: '2026-08-02' }),
    act({ id: 'B', tipo: 'longao', data: '2026-08-15' }),
    act({ id: 'R', tipo: 'rodagem', data: '2026-08-06' }),
  ];
  const split = (aid: string, km: number, pace: number, parcial = false): DashSplit => ({
    activity_id: aid, km_index: km, distancia_m: parcial ? 400 : 1000, parcial,
    pace_s_por_km: pace, fc_media: 150 + km, fc_max: 160 + km, gap_s_por_km: pace - 5,
  });
  const map = new Map<string, DashSplit[]>([
    ['A', [split('A', 1, 460), split('A', 2, 455)]],
    ['B', [split('B', 1, 450), split('B', 2, 445), split('B', 3, 300, true)]],
  ]);

  it('só longões com splits, ordenados, opacidade por recência', () => {
    const s = kmSeries(acts, map, 'longao');
    expect(s.map((x) => x.activityId)).toEqual(['A', 'B']); // ordenado por data
    expect(s[0].opacity).toBeLessThan(1); // antigo
    expect(s[1].opacity).toBe(1); // recente em destaque
    expect(s[1].isLatest).toBe(true);
    expect(s[1].points.map((p) => p.km)).toEqual([1, 2]); // parcial (km3) excluído
  });

  it('toWideByKm monta uma coluna por treino', () => {
    const s = kmSeries(acts, map, 'longao');
    const { rows, keys } = toWideByKm(s, 'pace');
    expect(keys).toEqual(['A', 'B']);
    expect(rows).toHaveLength(2); // km 1 e 2
    expect(rows[0]).toMatchObject({ km: 1, A: 460, B: 450 });
  });
});

describe('timeInZones + aggregateZones', () => {
  const zonas: HrZone[] = [
    { zona: 1, nome: 'Z1', fc_min: 119, fc_max: 139 },
    { zona: 2, nome: 'Z2', fc_min: 139, fc_max: 158 },
    { zona: 3, nome: 'Z3', fc_min: 158, fc_max: 172 },
    { zona: 4, nome: 'Z4', fc_min: 172, fc_max: 182 },
    { zona: 5, nome: 'Z5', fc_min: 182, fc_max: 198 },
  ];
  const samples = [
    { time_s: 0, hr: 130 }, { time_s: 10, hr: 130 }, { time_s: 20, hr: 150 },
    { time_s: 30, hr: 150 }, { time_s: 40, hr: 165 }, { time_s: 50, hr: 165 },
  ];

  it('acumula segundos por zona', () => {
    const zt = timeInZones(samples, zonas);
    const seg = Object.fromEntries(zt.map((z) => [z.zona, z.segundos]));
    expect(seg[1]).toBe(20);
    expect(seg[2]).toBe(20);
    expect(seg[3]).toBe(10);
    expect(seg[4]).toBe(0);
    expect(seg[5]).toBe(0);
  });

  it('aggregateZones soma vários treinos', () => {
    const zt = timeInZones(samples, zonas);
    const agg = aggregateZones([zt, zt]);
    expect(agg.find((z) => z.zona === 1)!.segundos).toBe(40);
  });
});
