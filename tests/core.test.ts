import { describe, expect, it } from 'vitest';
import type { StreamSample } from '../src/core/types';
import { minettiCost, gradeAdjustFactor, gradeAdjustedDistance } from '../src/core/metrics/gap';
import { computeSplits } from '../src/core/metrics/splits';
import { computeAggregate, computeCardiacDrift } from '../src/core/metrics/aggregate';
import { runQualityChecks } from '../src/core/quality/checks';
import type { DeviceSummary } from '../src/core/types';

// -----------------------------------------------------------------------------
// Geradores de streams sintéticos (1 Hz). Sem dados pessoais.
// -----------------------------------------------------------------------------
interface RunOpts {
  distM: number;
  paceSPerKm: number;
  hr?: (t: number, dist: number) => number | null;
  altAt?: (dist: number) => number | null;
}
function buildRun({ distM, paceSPerKm, hr, altAt }: RunOpts): StreamSample[] {
  const v = 1000 / paceSPerKm; // m/s
  const total = distM / v;
  const out: StreamSample[] = [];
  for (let t = 0; t <= Math.ceil(total); t++) {
    const time_s = Math.min(t, total);
    const dist = Math.min(distM, v * time_s);
    out.push({
      time_s,
      distance_m: dist,
      // FC padrão varia levemente (evita falso "fc_travada"; dado real oscila).
      hr: hr ? hr(time_s, dist) : 150 + Math.round(3 * Math.sin(time_s / 20)),
      altitude_m: altAt ? altAt(dist) : 100,
      lat: null,
      lng: null,
      speed_mps: v,
      cadence_spm: 170,
    });
  }
  return out;
}

const emptyDevice: DeviceSummary = {
  sport: 'running', start_time: null, total_distance_m: null, total_timer_s: null,
  total_elapsed_s: null, total_ascent_m: null, total_descent_m: null,
  avg_hr: null, max_hr: null, avg_speed_mps: null, avg_cadence_spm: null,
};

describe('GAP (Minetti)', () => {
  it('custo no plano é 3.6 e fator 1', () => {
    expect(minettiCost(0)).toBeCloseTo(3.6, 6);
    expect(gradeAdjustFactor(0)).toBeCloseTo(1, 6);
  });
  it('subida custa mais que o plano (fator > 1)', () => {
    expect(gradeAdjustFactor(0.1)).toBeGreaterThan(1);
    expect(gradeAdjustedDistance(100, 10)).toBeGreaterThan(100); // +10% em 100m
  });
  it('limita o gradiente à faixa validada [-0.45, 0.45]', () => {
    // Além de 45% o custo satura (usa o valor clampado), não explode.
    expect(minettiCost(2)).toBeCloseTo(minettiCost(0.45), 6);
  });
});

describe('Splits por km', () => {
  it('run plano de 2500m a 5:00/km → 2 kms completos + 1 parcial de 500m', () => {
    const splits = computeSplits(buildRun({ distM: 2500, paceSPerKm: 300 }));
    expect(splits).toHaveLength(3);
    expect(splits[0].pace_s_por_km).toBeCloseTo(300, 0);
    expect(splits[1].parcial).toBe(false);
    expect(splits[2].parcial).toBe(true);
    expect(splits[2].distancia_m).toBeCloseTo(500, 0);
    // No plano, GAP ≈ pace.
    expect(splits[0].gap_s_por_km).toBeCloseTo(300, 0);
  });

  it('em subida de 10% o GAP fica mais RÁPIDO que o pace', () => {
    const splits = computeSplits(
      buildRun({ distM: 1000, paceSPerKm: 360, altAt: (d) => 100 + 0.1 * d }),
    );
    expect(splits).toHaveLength(1);
    const s = splits[0];
    expect(s.gap_s_por_km).not.toBeNull();
    expect(s.gap_s_por_km as number).toBeLessThan(s.pace_s_por_km as number);
    expect(s.elevacao_ganho_m as number).toBeGreaterThan(90); // ~100m de ganho
    expect(Number.isInteger(s.fc_max)).toBe(true); // sem float interpolado
  });

  it('sem altitude → GAP null (dados insuficientes), não inventa', () => {
    const splits = computeSplits(buildRun({ distM: 1000, paceSPerKm: 300, altAt: () => null }));
    expect(splits[0].gap_s_por_km).toBeNull();
    expect(splits[0].elevacao_ganho_m).toBeNull();
  });
});

describe('Cardiac drift', () => {
  it('detecta FC subindo com pace estável', () => {
    const samples = buildRun({
      distM: 2000,
      paceSPerKm: 300,
      hr: (_t, dist) => (dist < 1000 ? 150 : 165),
    });
    const drift = computeCardiacDrift(samples);
    expect(drift).not.toBeNull();
    expect(drift!.pace_estavel).toBe(true);
    expect(drift!.delta_bpm).toBeCloseTo(15, 0);
  });
});

describe('Camada de conferência', () => {
  it('run limpo de 2000m → status ok, sem warnings', () => {
    const samples = buildRun({ distM: 2000, paceSPerKm: 300 });
    const splits = computeSplits(samples);
    const metrics = computeAggregate(samples);
    const report = runQualityChecks(samples, splits, metrics, emptyDevice, 'fit');
    expect(report.status).toBe('ok');
    expect(report.issues.some((i) => i.severidade === 'warning')).toBe(false);
  });

  it('FC ausente → issue fc_ausente e status warning', () => {
    const samples = buildRun({ distM: 2000, paceSPerKm: 300, hr: () => null });
    const splits = computeSplits(samples);
    const metrics = computeAggregate(samples);
    const report = runQualityChecks(samples, splits, metrics, emptyDevice, 'fit');
    expect(report.issues.find((i) => i.tipo === 'fc_ausente')).toBeTruthy();
    expect(report.status).toBe('warning');
  });

  it('último km parcial é sinalizado como info', () => {
    const samples = buildRun({ distM: 1500, paceSPerKm: 300 });
    const splits = computeSplits(samples);
    const metrics = computeAggregate(samples);
    const report = runQualityChecks(samples, splits, metrics, emptyDevice, 'fit');
    expect(report.issues.find((i) => i.tipo === 'split_incompleto')).toBeTruthy();
  });
});
