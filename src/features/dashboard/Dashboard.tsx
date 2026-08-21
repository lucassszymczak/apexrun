// Container do dashboard: lê activities, splits, zonas do atleta e streams (para
// zonas de FC) do Supabase e monta as seções. Não recalcula splits no front —
// só lê o que já foi persistido.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  aggregateZones,
  timeInZones,
  type DashActivity,
  type DashSplit,
  type HrZone,
  type StreamSampleLite,
  type ZoneTime,
} from './transform';
import { Diary } from './Diary';
import { WeeklyTrend } from './WeeklyTrend';
import { KmComparison } from './KmComparison';
import { HrZones } from './HrZones';

const ACTIVITY_COLS =
  'id, data, tipo, distancia_m, duracao_s, pace_medio, fc_media, fc_max, rpe, dor_flag, quality_status, confirmed_at, source';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      activities: DashActivity[];
      splitsByActivity: Map<string, DashSplit[]>;
      zoneTimes: ZoneTime[];
    };

export function Dashboard({ reloadKey }: { reloadKey: number }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabase) {
        setState({ status: 'error', message: 'Supabase não configurado.' });
        return;
      }
      setState({ status: 'loading' });
      try {
        const [actsRes, splitsRes, athRes, streamsRes] = await Promise.all([
          supabase.from('activities').select(ACTIVITY_COLS).order('data', { ascending: false }),
          supabase
            .from('splits')
            .select('activity_id, km_index, distancia_m, parcial, pace_s_por_km, fc_media, fc_max, gap_s_por_km'),
          supabase.from('athletes').select('zonas_fc').limit(1).maybeSingle(),
          supabase.from('activities').select('id, raw_streams').not('raw_streams', 'is', null),
        ]);
        const firstErr = actsRes.error || splitsRes.error || athRes.error || streamsRes.error;
        if (firstErr) throw new Error(firstErr.message);
        if (!alive) return;

        const activities = (actsRes.data ?? []) as DashActivity[];

        const splitsByActivity = new Map<string, DashSplit[]>();
        for (const s of (splitsRes.data ?? []) as DashSplit[]) {
          const arr = splitsByActivity.get(s.activity_id) ?? [];
          arr.push(s);
          splitsByActivity.set(s.activity_id, arr);
        }

        const zonas = ((athRes.data?.zonas_fc as HrZone[] | undefined) ?? []).filter(
          (z) => z && z.fc_min != null && z.fc_max != null,
        );

        const perActivityZones: ZoneTime[][] = [];
        for (const row of (streamsRes.data ?? []) as Array<{ raw_streams: { samples?: StreamSampleLite[] } | null }>) {
          const samples = row.raw_streams?.samples;
          if (Array.isArray(samples) && samples.length > 1 && zonas.length > 0) {
            perActivityZones.push(timeInZones(samples, zonas));
          }
        }
        const zoneTimes = aggregateZones(perActivityZones);

        setState({ status: 'ready', activities, splitsByActivity, zoneTimes });
      } catch (err) {
        if (alive) setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  if (state.status === 'loading') {
    return <p className="text-sm text-slate-500">Carregando dashboards…</p>;
  }
  if (state.status === 'error') {
    return <p className="text-sm text-red-300">Erro: {state.message}</p>;
  }

  return (
    <DashboardView
      activities={state.activities}
      splitsByActivity={state.splitsByActivity}
      zoneTimes={state.zoneTimes}
    />
  );
}

/** Apresentação pura — recebe os dados por props (usada também no preview). */
export function DashboardView({
  activities,
  splitsByActivity,
  zoneTimes,
}: {
  activities: DashActivity[];
  splitsByActivity: Map<string, DashSplit[]>;
  zoneTimes: ZoneTime[];
}) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Nenhum treino ainda. Suba um arquivo na aba Conferência ou rode o seed.
      </p>
    );
  }
  return (
    <div className="space-y-10">
      <WeeklyTrend activities={activities} />
      <KmComparison activities={activities} splitsByActivity={splitsByActivity} />
      <HrZones zoneTimes={zoneTimes} />
      <Diary activities={activities} />
    </div>
  );
}
