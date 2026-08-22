// Comparativo automático por km: sobrepõe treinos do mesmo tipo (longões entre
// si; qualidade entre si; e "outros treinos com parciais"), uma linha por treino.
// Mais antigo com opacidade menor, mais recente em destaque. Hue único (emerald)
// + rampa de opacidade = série distinguível por recência, sem seleção manual.
// Lê splits já persistidos. Treinos SEM parciais por km (ex: histórico do seed)
// não podem ser plotados aqui — são contados num aviso transparente.

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
import {
  countWithoutSplits,
  kmSeries,
  toWideByKm,
  type DashActivity,
  type DashSplit,
  type KmSeries,
} from './transform';
import { formatPace } from '@/lib/format';
import { Empty, Section, tooltipStyle } from './WeeklyTrend';

const isLongao = (a: DashActivity) => a.tipo === 'longao';
const isQualidade = (a: DashActivity) => a.tipo === 'qualidade';
const isOutro = (a: DashActivity) => a.tipo !== 'longao' && a.tipo !== 'qualidade';

export function KmComparison({
  activities,
  splitsByActivity,
}: {
  activities: DashActivity[];
  splitsByActivity: Map<string, DashSplit[]>;
}) {
  const longoes = kmSeries(activities, splitsByActivity, isLongao);
  const qualidade = kmSeries(activities, splitsByActivity, isQualidade);
  const outros = kmSeries(activities, splitsByActivity, isOutro);

  // Treinos que existem no diário mas não têm parciais por km → não plotáveis.
  const semParciais = countWithoutSplits(activities, splitsByActivity, () => true);
  const longSem = countWithoutSplits(activities, splitsByActivity, isLongao);

  const nada = longoes.length === 0 && qualidade.length === 0 && outros.length === 0;

  return (
    <Section title="Comparativo por km">
      {semParciais > 0 && (
        <p className="text-xs text-slate-500 -mt-1">
          {semParciais} treino(s) sem parciais por km não entram aqui
          {longSem > 0 ? ` (incluindo ${longSem} longão(ões) do histórico)` : ''}. Para
          compará-los, registre o arquivo <b>.FIT</b> deles na aba Conferência.
        </p>
      )}

      {nada ? (
        <Empty>
          Ainda sem nenhum treino com parciais por km. Estes gráficos preenchem quando você
          registrar um arquivo <b>.FIT</b> (ex: um longão) na aba Conferência.
        </Empty>
      ) : (
        <div className="space-y-4">
          {longoes.length > 0 && <Category title="Longões" series={longoes} />}
          {qualidade.length > 0 && <Category title="Treinos de qualidade" series={qualidade} />}
          {outros.length > 0 && <Category title="Outros treinos (com parciais)" series={outros} />}
        </div>
      )}
    </Section>
  );
}

function Category({ title, series }: { title: string; series: KmSeries[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm font-medium text-slate-200">
          {title} <span className="text-slate-500">· {series.length}</span>
        </span>
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
              allowDecimals={metric === 'fc' ? false : true}
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
  const ordered = [...series].reverse(); // mais recentes primeiro
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
