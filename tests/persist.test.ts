import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { persistIngest } from '../src/features/ingest/persist';
import type { IngestResult, ParsedActivity } from '../src/core/types';

// Fake Supabase client: registra as linhas inseridas e devolve ids fixos.
function makeFake(captured: Record<string, unknown>) {
  const insertBuilder = (table: string, rows: unknown) => {
    captured[table] = rows;
    return {
      select() {
        return { single: async () => ({ data: { id: 'act-1' }, error: null }) };
      },
      then(resolve: (v: { error: null }) => void) {
        resolve({ error: null });
      },
    };
  };
  return {
    from(table: string) {
      return {
        select() {
          return { limit() {
            return { maybeSingle: async () => ({ data: { id: 'ath-1' }, error: null }) };
          } };
        },
        insert(rows: unknown) {
          return insertBuilder(table, rows);
        },
        delete() {
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  } as unknown as SupabaseClient;
}

const parsed: ParsedActivity = {
  source_format: 'fit',
  samples: [
    { time_s: 0, distance_m: 0, hr: 150, altitude_m: 100, lat: -25, lng: -51, speed_mps: 2, cadence_spm: 164 },
  ],
  device: {
    sport: 'running', start_time: '2026-08-12T23:09:32.000Z', total_distance_m: 6013.9,
    total_timer_s: 2745, total_elapsed_s: 2745, total_ascent_m: 37, total_descent_m: 49,
    avg_hr: 165, max_hr: 182, avg_speed_mps: 2.19, avg_cadence_spm: 164,
  },
};

const result: IngestResult = {
  metrics: {
    distancia_total_m: 6013.9, duracao_movel_s: 2745, duracao_total_s: 2745,
    pace_medio_s_por_km: 456, gap_medio_s_por_km: 456, fc_media: 165, fc_max: 182,
    elevacao_ganho_m: 43.6, cardiac_drift: null,
  },
  splits: [
    { km_index: 1, distancia_m: 1000, parcial: false, duracao_s: 456, pace_s_por_km: 456,
      fc_media: 160, fc_max: 168, elevacao_ganho_m: 8, gap_s_por_km: 450 },
  ],
  report: {
    status: 'ok', gerado_em: '2026-08-18T00:00:00.000Z', source_format: 'fit',
    metrics: {
      distancia_total_m: 6013.9, duracao_movel_s: 2745, duracao_total_s: 2745,
      pace_medio_s_por_km: 456, gap_medio_s_por_km: 456, fc_media: 165, fc_max: 182,
      elevacao_ganho_m: 43.6, cardiac_drift: null,
    },
    checagens: {},
    issues: [{ tipo: 'split_incompleto', severidade: 'info', descricao: 'último km parcial' }],
  },
  device: parsed.device,
};

const input = {
  data: '2026-08-12T23:09:32.000Z', tipo: 'rodagem', rpe: 5,
  dor_flag: false, dor_desc: null, obs: 'teste',
};

describe('persistIngest — mapeamento', () => {
  it('aprovar → activity oficial + splits + issues corretos', async () => {
    const captured: Record<string, any> = {};
    const id = await persistIngest(makeFake(captured), {
      parsed, result, input, official: true,
    });
    expect(id).toBe('act-1');

    const act = captured.activities;
    expect(act.athlete_id).toBe('ath-1');
    expect(act.source).toBe('fit_upload');
    expect(act.quality_status).toBe('ok');
    expect(act.confirmed_at).not.toBeNull();
    expect(act.distancia_m).toBe(6013.9);
    expect(act.duracao_s).toBe(2745);
    expect(act.raw_streams.source_format).toBe('fit');

    expect(captured.splits).toHaveLength(1);
    expect(captured.splits[0].activity_id).toBe('act-1');
    expect(captured.data_issues).toHaveLength(1);
    expect(captured.data_issues[0].tipo).toBe('split_incompleto');
  });

  it('rejeitar → quality_status rejected e não oficial', async () => {
    const captured: Record<string, any> = {};
    await persistIngest(makeFake(captured), { parsed, result, input, official: false });
    expect(captured.activities.quality_status).toBe('rejected');
    expect(captured.activities.confirmed_at).toBeNull();
  });
});
