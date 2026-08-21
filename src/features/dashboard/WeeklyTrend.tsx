// Tendência longitudinal por semana: pace médio, FC média e eficiência (pace/FC).
// Escalas diferentes → small multiples (um mini-gráfico por métrica), nunca eixo
// duplo. Cada gráfico tem uma única série (sem legenda de cor necessária).

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART } from './chartTheme';
import { weeklyTrend, type DashActivity, type WeekPoint } from './transform';
import { formatPace } from '@/lib/format';

export function WeeklyTrend({ activities }: { activities: DashActivity[] }) {
  const rows = weeklyTrend(activities);

  if (rows.length < 2) {
    return (
      <Section title="Tendência semanal">
        <Empty>Poucas semanas com dados ainda — a tendência aparece com 2+ semanas.</Empty>
      </Section>
    );
  }

  return (
    <Section title="Tendência semanal">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Mini
          rows={rows}
          dataKey="pace"
          label="Pace médio"
          hint="menor = mais rápido"
          fmt={(v) => `${formatPace(v)}/km`}
        />
        <Mini
          rows={rows}
          dataKey="fc"
          label="FC média"
          hint="bpm"
          integer
          fmt={(v) => `${Math.round(v)} bpm`}
        />
        <Mini
          rows={rows}
          dataKey="efic"
          label="Eficiência (pace/FC)"
          hint="menor = melhor"
          fmt={(v) => v.toFixed(2)}
        />
      </div>
    </Section>
  );
}

function Mini({
  rows,
  dataKey,
  label,
  hint,
  fmt,
  integer,
}: {
  rows: WeekPoint[];
  dataKey: 'pace' | 'fc' | 'efic';
  label: string;
  hint: string;
  fmt: (v: number) => string;
  integer?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className="text-xs text-slate-500">{hint}</span>
      </div>
      <div style={{ width: '100%', height: 150 }}>
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: -2 }}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: CHART.grid }}
            />
            <YAxis
              tick={{ fill: CHART.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={50}
              allowDecimals={!integer}
              domain={['auto', 'auto']}
              tickFormatter={(v) => (dataKey === 'pace' ? formatPace(v) : String(v))}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: CHART.muted }}
              formatter={(v: number) => [fmt(v), label]}
              labelFormatter={(l) => `Semana de ${l}`}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={CHART.accent}
              strokeWidth={2}
              dot={{ r: 3, fill: CHART.accent }}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export const tooltipStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
};

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-300">{title}</h2>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}
