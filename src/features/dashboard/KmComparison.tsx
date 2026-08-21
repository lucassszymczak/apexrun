// Comparativo automático por km: sobrepõe treinos do mesmo tipo (longões entre
// si; qualidade entre si), uma linha por treino. Mais antigo com opacidade menor,
// mais recente em destaque. Hue único (emerald) + rampa de opacidade = série
// distinguível por recência, sem seleção manual. Lê splits já persistidos.

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
import { kmSeries, toWideByKm, type DashActivity, type DashSplit, type KmSeries } from './transform';
import { formatPace } from '@/lib/format';
import { Empty, Section, tooltipStyle } from './WeeklyTrend';

export function KmComparison({
  activities,
  splitsByActivity,
}: {
  activities: DashActivity[];
  splitsByActivity: Map<string, DashSplit[]>;
}) {
  const longoes = kmSeries(activities, splitsByActivity, 'longao');
  const qualidade = kmSeries(activities, splitsByActivity, 'qualidade');

  if (longoes.length === 0 && qualidade.length === 0) {
    return (
      <Section title="Comparativo por km">
        <Empty>
          Ainda sem splits por km. Estes gráficos preenchem automaticamente quando você
          registrar treinos (.FIT) marcados como <b>longão</b> ou <b>qualidade</b>.
        </Empty>
      </Section>
    );
  }

  return (
    <Section title="Comparativo por km">
      {longoes.length > 0 && <Category title="Longões" series={longoes} />}
      {qualidade.length > 0 && <Category title="Treinos de qualidade" series={qualidade} />}
    </Section>
  );
}

function Category({ title, series }: { title: string; series: KmSeries[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">{title}</span>
        <LegendDates series={series} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <KmChart series={series} metric="pace" title="Pace/km" hint="menor = mais rápido" />
        <KmChart series={series} metric="fc" title="FC/km" hint="bpm" />
      </div>
    </div>
  );
}

function KmChart({
  series,
  metric,
  title,
  hint,
}: {
  series: KmSeries[];
  metric: 'pace' | 'fc';
  title: string;
  hint: string;
}) {
  const { rows, keys } = toWideByKm(series, metric);
  const labelOf = new Map(series.map((s) => [s.activityId, s.label]));
  const meta = new Map(series.map((s) => [s.activityId, s]));

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium text-slate-300">{title}</span>
        <span className="text-xs text-slate-500">{hint}</span>
      </div>
      <div style={{ width: '100%', height: 190 }}>
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 6, right: 10, bottom: 0, left: -6 }}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="km"
              tick={{ fill: CHART.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: CHART.grid }}
              label={{ value: 'km', position: 'insideBottomRight', fill: CHART.muted, fontSize: 10, dy: 8 }}
            />
            <YAxis
              tick={{ fill: CHART.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={['auto', 'auto']}
              tickFormatter={(v) => (metric === 'pace' ? formatPace(v) : String(v))}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(l) => `Km ${l}`}
              formatter={(v: number, key: string) => [
                metric === 'pace' ? `${formatPace(v)}/km` : `${Math.round(v)} bpm`,
                labelOf.get(key) ?? key,
              ]}
            />
            {keys.map((k) => {
              const s = meta.get(k)!;
              return (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  name={s.label}
                  stroke={CHART.accent}
                  strokeOpacity={s.opacity}
                  strokeWidth={s.isLatest ? 2.75 : 1.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LegendDates({ series }: { series: KmSeries[] }) {
  // Mais recentes primeiro na legenda.
  const ordered = [...series].reverse();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {ordered.map((s) => (
        <span key={s.activityId} className="inline-flex items-center gap-1 text-xs">
          <span
            className="inline-block h-2 w-3 rounded-sm"
            style={{ background: CHART.accent, opacity: s.opacity }}
          />
          <span className={s.isLatest ? 'text-slate-200 font-medium' : 'text-slate-500'}>
            {s.label}
          </span>
        </span>
      ))}
    </div>
  );
}
