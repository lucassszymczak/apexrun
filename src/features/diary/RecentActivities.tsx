// =============================================================================
// Lista compacta dos últimos treinos registrados (lê da tabela activities).
// Fecha o ciclo do Passo 3: histórico do seed + uploads recém-aprovados
// aparecem aqui. O diário filtrável completo + gráficos vêm no Passo 5.
// =============================================================================

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ActivitySource, QualityStatus } from '@/types/database';
import { formatKm, formatPace } from '@/lib/format';

interface Row {
  id: string;
  data: string;
  tipo: string | null;
  distancia_m: number | null;
  pace_medio: number | null;
  fc_media: number | null;
  fc_max: number | null;
  rpe: number | null;
  dor_flag: boolean;
  quality_status: QualityStatus;
  confirmed_at: string | null;
  source: ActivitySource;
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: Row[] };

export function RecentActivities({ reloadKey }: { reloadKey: number }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabase) {
        setState({ status: 'error', message: 'Supabase não configurado.' });
        return;
      }
      setState({ status: 'loading' });
      const { data, error } = await supabase
        .from('activities')
        .select(
          'id, data, tipo, distancia_m, pace_medio, fc_media, fc_max, rpe, dor_flag, quality_status, confirmed_at, source',
        )
        .order('data', { ascending: false })
        .limit(20);
      if (!alive) return;
      if (error) setState({ status: 'error', message: error.message });
      else setState({ status: 'ready', rows: (data ?? []) as Row[] });
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  return (
    <section className="mt-10 space-y-3">
      <h2 className="text-sm font-medium text-slate-300">Últimos treinos registrados</h2>

      {state.status === 'loading' && <p className="text-sm text-slate-500">Carregando…</p>}
      {state.status === 'error' && (
        <p className="text-sm text-red-300">Erro ao carregar: {state.message}</p>
      )}
      {state.status === 'ready' && state.rows.length === 0 && (
        <p className="text-sm text-slate-500">
          Nenhum treino ainda. Suba um arquivo acima ou rode o seed.
        </p>
      )}
      {state.status === 'ready' && state.rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                {['Data', 'Tipo', 'Dist', 'Pace', 'FC', 'RPE', 'Dor', 'Status', 'Fonte'].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {state.rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="px-3 py-2 text-slate-300">{fmtDate(r.data)}</td>
                  <td className="px-3 py-2 text-slate-400">{r.tipo ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-300">{formatKm(r.distancia_m)}</td>
                  <td className="px-3 py-2 text-slate-200">
                    {r.pace_medio != null ? `${formatPace(r.pace_medio)}/km` : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {r.fc_media != null ? `${r.fc_media}/${r.fc_max}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{r.rpe ?? '—'}</td>
                  <td className="px-3 py-2">{r.dor_flag ? '⚠️' : '—'}</td>
                  <td className="px-3 py-2">
                    <StatusDot status={r.quality_status} official={r.confirmed_at != null} />
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-xs">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusDot({ status, official }: { status: QualityStatus; official: boolean }) {
  const color = {
    ok: 'text-emerald-300',
    warning: 'text-amber-300',
    rejected: 'text-red-300',
    pending: 'text-slate-400',
  }[status];
  return (
    <span className={`text-xs ${color}`}>
      {status}
      {official ? ' · oficial' : ''}
    </span>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
