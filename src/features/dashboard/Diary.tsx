// Diário de treinos: tabela filtrável (tipo, status, dor). Lê activities já
// persistidas (histórico do seed + registrados).

import { useMemo, useState } from 'react';
import type { DashActivity } from './transform';
import { Section } from './WeeklyTrend';
import { formatKm, formatPace } from '@/lib/format';

export function Diary({ activities }: { activities: DashActivity[] }) {
  const [tipo, setTipo] = useState('todos');
  const [status, setStatus] = useState('todos');
  const [dor, setDor] = useState('todos');

  const tipos = useMemo(
    () => Array.from(new Set(activities.map((a) => a.tipo).filter(Boolean))) as string[],
    [activities],
  );

  const rows = useMemo(
    () =>
      activities
        .filter((a) => (tipo === 'todos' ? true : a.tipo === tipo))
        .filter((a) => (status === 'todos' ? true : a.quality_status === status))
        .filter((a) => (dor === 'todos' ? true : dor === 'com' ? a.dor_flag : !a.dor_flag))
        .slice()
        .sort((x, y) => new Date(y.data).getTime() - new Date(x.data).getTime()),
    [activities, tipo, status, dor],
  );

  return (
    <Section title={`Diário de treinos (${rows.length})`}>
      <div className="flex flex-wrap gap-2">
        <Select label="Tipo" value={tipo} onChange={setTipo} options={['todos', ...tipos]} />
        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          options={['todos', 'ok', 'warning', 'rejected', 'pending']}
        />
        <Select label="Dor" value={dor} onChange={setDor} options={['todos', 'com', 'sem']} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              {['Data', 'Tipo', 'Dist', 'Pace', 'FC', 'RPE', 'Dor', 'Status'].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
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
                  <StatusChip status={r.quality_status} official={r.confirmed_at != null} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                  Nenhum treino com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-slate-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-400"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function StatusChip({ status, official }: { status: string; official: boolean }) {
  const color =
    status === 'ok'
      ? 'text-emerald-300'
      : status === 'warning'
        ? 'text-amber-300'
        : status === 'rejected'
          ? 'text-red-300'
          : 'text-slate-400';
  return (
    <span className={`text-xs ${color}`}>
      {status}
      {official ? ' · oficial' : ''}
    </span>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
