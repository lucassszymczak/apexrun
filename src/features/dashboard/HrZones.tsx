// Tempo em cada zona de FC, usando as zonas do atleta. Barras horizontais,
// rampa sequencial mono-hue (Z1 clara → Z5 escura) — magnitude ordinal, sem
// arco-íris. Identidade nunca só por cor: cada barra traz nome e faixa de bpm.
// Vem dos streams (FC por segundo) de treinos com raw_streams — histórico do
// seed não tem, então mostra estado vazio até você registrar um .FIT.

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART, ZONE_RAMP } from './chartTheme';
import type { ZoneTime } from './transform';
import { formatDuration } from '@/lib/format';
import { Empty, Section, tooltipStyle } from './WeeklyTrend';

export function HrZones({ zoneTimes }: { zoneTimes: ZoneTime[] }) {
  const total = zoneTimes.reduce((s, z) => s + z.segundos, 0);

  if (total === 0) {
    return (
      <Section title="Tempo nas zonas de FC">
        <Empty>
          Depende de FC por segundo (streams). Registre um treino por arquivo .FIT que este
          gráfico passa a mostrar quanto tempo você passou em cada zona.
        </Empty>
      </Section>
    );
  }

  const data = zoneTimes.map((z) => ({
    nome: `Z${z.zona}`,
    faixa: `${z.fc_min}–${z.fc_max} bpm`,
    minutos: z.segundos / 60,
    segundos: z.segundos,
    pct: total > 0 ? (z.segundos / total) * 100 : 0,
  }));

  return (
    <Section title="Tempo nas zonas de FC">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
            >
              <XAxis
                type="number"
                tick={{ fill: CHART.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: CHART.grid }}
                tickFormatter={(v) => `${Math.round(v)}m`}
              />
              <YAxis
                type="category"
                dataKey="nome"
                tick={{ fill: CHART.ink, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={34}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                contentStyle={tooltipStyle}
                formatter={(_v: number, _n: string, item: { payload?: { segundos: number; pct: number } }) => {
                  const p = item?.payload;
                  return p ? [`${formatDuration(p.segundos)} (${p.pct.toFixed(0)}%)`, 'Tempo'] : ['—', ''];
                }}
                labelFormatter={(l, payload) => {
                  const p = payload?.[0]?.payload as { faixa?: string } | undefined;
                  return `${l} · ${p?.faixa ?? ''}`;
                }}
              />
              <Bar dataKey="minutos" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {data.map((_d, i) => (
                  <Cell key={i} fill={ZONE_RAMP[i % ZONE_RAMP.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {data.map((d, i) => (
            <span key={d.nome} className="inline-flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ background: ZONE_RAMP[i % ZONE_RAMP.length] }}
              />
              {d.nome} {d.faixa}
            </span>
          ))}
        </div>
      </div>
    </Section>
  );
}
