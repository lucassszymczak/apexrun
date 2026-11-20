// Gráficos SVG próprios (sem biblioteca). Mesmos dados e opções dos gráficos do
// app antigo (lineChart/barChart): séries de pontos {label, y, extra}, meta (target),
// limiar (threshold), linha do zero e eixo invertido (pace).
// Acessível: foco por teclado, setas movem o cursor, o valor aparece na legenda.
import { useMemo, useState, type KeyboardEvent } from 'react';

export type Pt = { label: string; y: number; extra?: string; color?: string };
export type Series = { name: string; points: Pt[]; color?: string };
type Common = { yfmt?: (v: number) => string; target?: { y: number; label: string } | null; threshold?: { y: number; label: string } | null; zeroLine?: boolean; height?: number; label: string };

const W = 340, PADL = 40, PADR = 10, PADT = 12, PADB = 22;
export const SERIES_COLORS = ['var(--ciano)', 'var(--magenta)', 'var(--zona-3)', 'var(--zona-1)', 'var(--ok)', 'var(--atencao)'];

function niceScale(min: number, max: number, ticks = 4) {
  if (min === max) { const d = Math.abs(min) * 0.1 || 1; min -= d; max += d; }
  const span = max - min, step0 = span / ticks, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out: number[] = []; for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(10));
  return { lo, hi, ticks: out };
}

function useCursor(n: number) {
  const [i, setI] = useState<number | null>(null);
  const onKey = (e: KeyboardEvent) => {
    if (!n) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setI((x) => (x == null ? 0 : Math.min(n - 1, x + 1))); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setI((x) => (x == null ? n - 1 : Math.max(0, x - 1))); }
    else if (e.key === 'Home') { e.preventDefault(); setI(0); }
    else if (e.key === 'End') { e.preventDefault(); setI(n - 1); }
    else if (e.key === 'Escape') setI(null);
  };
  return { i, setI, onKey };
}

export function LineChart({ series, reverseY, ...o }: Common & { series: Series[]; reverseY?: boolean }) {
  const H = o.height || 150;
  const fmt = o.yfmt || ((v: number) => String(Math.round(v * 100) / 100));
  const all = series.flatMap((s) => s.points);
  const n = Math.max(0, ...series.map((s) => s.points.length));
  const { i, setI, onKey } = useCursor(n);
  const sc = useMemo(() => {
    const ys = all.map((p) => p.y).concat(o.target ? [o.target.y] : []).filter((y) => isFinite(y));
    return ys.length ? niceScale(Math.min(...ys), Math.max(...ys)) : null;
  }, [series, o.target]);
  if (!all.length || !sc) return <div className="chart-cap">Sem dados suficientes para o gráfico.</div>;
  const X = (k: number) => PADL + (n <= 1 ? (W - PADL - PADR) / 2 : (k * (W - PADL - PADR)) / (n - 1));
  const Y = (y: number) => { const f = (y - sc.lo) / (sc.hi - sc.lo || 1); return reverseY ? PADT + f * (H - PADT - PADB) : H - PADB - f * (H - PADT - PADB); };
  const labels = (series[0]?.points || []).map((p) => p.label);
  const step = Math.max(1, Math.ceil(labels.length / 5));
  const cap = i != null ? series.map((s) => s.points[i] ? `${s.points[i].label} · ${series.length > 1 ? s.name + ' ' : ''}${fmt(s.points[i].y)}${s.points[i].extra ? ' · ' + s.points[i].extra : ''}` : '').filter(Boolean).join('  |  ') : '';
  const last = series[0]?.points[series[0].points.length - 1];
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} tabIndex={0} role="img"
        aria-label={`${o.label}. ${n} pontos${last ? `; último ${last.label}: ${fmt(last.y)}` : ''}. Use as setas para percorrer.`}
        onKeyDown={onKey} onBlur={() => setI(null)}
        onPointerMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W; let k = Math.round(((x - PADL) / (W - PADL - PADR)) * (n - 1)); k = Math.max(0, Math.min(n - 1, isFinite(k) ? k : 0)); setI(k); }}
        onPointerLeave={() => setI(null)}>
        {sc.ticks.map((t) => <g key={t}><line className="grid" x1={PADL} x2={W - PADR} y1={Y(t)} y2={Y(t)} /><text x={PADL - 6} y={Y(t) + 4} textAnchor="end">{fmt(t)}</text></g>)}
        {o.target ? <g><line x1={PADL} x2={W - PADR} y1={Y(o.target.y)} y2={Y(o.target.y)} stroke="var(--magenta)" strokeDasharray="4 4" /><text x={W - PADR} y={Y(o.target.y) - 4} textAnchor="end" style={{ fill: 'var(--magenta)' }}>{o.target.label}</text></g> : null}
        {series.map((s, si) => {
          const col = s.color || SERIES_COLORS[si % SERIES_COLORS.length];
          const d = s.points.map((p, k) => (k ? 'L' : 'M') + X(k).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
          return <g key={si}><path d={d} fill="none" stroke={col} strokeWidth={2} strokeLinejoin="round" />
            {s.points.map((p, k) => <circle key={k} cx={X(k)} cy={Y(p.y)} r={i === k ? 5 : 3} fill={p.color || col} stroke="var(--superficie)" strokeWidth={1.5} />)}</g>;
        })}
        {labels.map((l, k) => (k % step === 0 || k === labels.length - 1) ? <text key={k} x={X(k)} y={H - 6} textAnchor="middle">{l}</text> : null)}
        {i != null ? <line x1={X(i)} x2={X(i)} y1={PADT} y2={H - PADB} stroke="var(--ciano)" strokeWidth={1} /> : null}
      </svg>
      {series.length > 1 ? <div className="legend">{series.map((s, si) => <span key={si}><i style={{ background: s.color || SERIES_COLORS[si % SERIES_COLORS.length] }} />{s.name}</span>)}</div> : null}
      <div className="chart-cap" aria-live="polite">{cap}</div>
    </div>
  );
}

export function BarChart({ bars, ...o }: Common & { bars: Pt[] }) {
  const H = o.height || 150;
  const fmt = o.yfmt || ((v: number) => String(Math.round(v * 100) / 100));
  const { i, setI, onKey } = useCursor(bars.length);
  if (!bars.length) return <div className="chart-cap">Sem dados suficientes para o gráfico.</div>;
  const ys = bars.map((b) => b.y).concat(o.threshold ? [o.threshold.y] : []).concat(o.zeroLine ? [0] : []).filter((y) => isFinite(y));
  const sc = niceScale(Math.min(0, ...ys), Math.max(0, ...ys));
  const Y = (y: number) => H - PADB - ((y - sc.lo) / (sc.hi - sc.lo || 1)) * (H - PADT - PADB);
  const bw = (W - PADL - PADR) / bars.length;
  const step = Math.max(1, Math.ceil(bars.length / 7));
  const b = i != null ? bars[i] : null;
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} tabIndex={0} role="img" onKeyDown={onKey} onBlur={() => setI(null)} onPointerLeave={() => setI(null)}
        aria-label={`${o.label}. ${bars.map((x) => x.label + ': ' + fmt(x.y)).slice(-8).join('; ')}.`}>
        {sc.ticks.map((t) => <g key={t}><line className="grid" x1={PADL} x2={W - PADR} y1={Y(t)} y2={Y(t)} /><text x={PADL - 6} y={Y(t) + 4} textAnchor="end">{fmt(t)}</text></g>)}
        {bars.map((x, k) => {
          const y0 = Y(0), y1 = Y(x.y), top = Math.min(y0, y1), h = Math.max(1, Math.abs(y1 - y0));
          return <rect key={k} x={PADL + k * bw + bw * 0.18} y={top} width={bw * 0.64} height={h} rx={3}
            fill={x.color || 'var(--ciano)'} opacity={i == null || i === k ? 1 : 0.55} onPointerEnter={() => setI(k)} onClick={() => setI(k)} />;
        })}
        {o.zeroLine ? <line x1={PADL} x2={W - PADR} y1={Y(0)} y2={Y(0)} stroke="var(--texto-3)" /> : null}
        {o.threshold ? <g><line x1={PADL} x2={W - PADR} y1={Y(o.threshold.y)} y2={Y(o.threshold.y)} stroke="var(--atencao)" strokeDasharray="4 4" /><text x={W - PADR} y={Y(o.threshold.y) - 4} textAnchor="end" style={{ fill: 'var(--atencao)' }}>{o.threshold.label}</text></g> : null}
        {bars.map((x, k) => (k % step === 0 || k === bars.length - 1) ? <text key={k} x={PADL + k * bw + bw / 2} y={H - 6} textAnchor="middle">{x.label}</text> : null)}
      </svg>
      <div className="chart-cap" aria-live="polite">{b ? `${b.label} · ${fmt(b.y)}${b.extra ? ' · ' + b.extra : ''}` : ''}</div>
    </div>
  );
}

// Cores das zonas Z1..Z5 (tokens) — usadas em barras de zona e legendas.
export const ZONE_COLORS = ['var(--zona-1)', 'var(--zona-2)', 'var(--zona-3)', 'var(--zona-4)', 'var(--zona-5)'];
export function ZoneLegend({ labels = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] }: { labels?: string[] }) {
  return <div className="legend">{labels.map((l, k) => <span key={k}><i style={{ background: ZONE_COLORS[k] }} />{l}</span>)}</div>;
}
// Cores antigas var(--good|warn|crit) → tokens novos
export function toneColor(c: string | null | undefined): string {
  const s = String(c || '');
  if (/good/.test(s)) return 'var(--ok)';
  if (/warn|serious/.test(s)) return 'var(--atencao)';
  if (/crit/.test(s)) return 'var(--alerta)';
  if (/trend|accent/.test(s)) return 'var(--ciano)';
  return 'var(--ciano)';
}
