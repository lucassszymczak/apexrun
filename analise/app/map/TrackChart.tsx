// Gráfico de pace, FC e elevação LIGADO ao mapa: o cursor é o mesmo do replay.
// Arrastar/tocar move o ponto no mapa; as setas do teclado também (Home/End nos extremos).
import { useMemo, type KeyboardEvent } from 'react';
import { type Track } from '../track';
import * as E from '../../engine.mjs';

const W = 360;

export function TrackChart({ tr, cursor, onCursor, height = 120, bike, label = 'Pace, FC e elevação ao longo do treino' }: { tr: Track; cursor: number | null; onCursor: (i: number) => void; height?: number; bike?: boolean; label?: string }) {
  const H = height;
  const data = useMemo(() => {
    const n = tr.t.length, step = Math.max(1, Math.floor(n / 600));
    const useDist = tr.dist.some((d) => d != null && d > 0);
    const xs: number[] = [], idx: number[] = [];
    for (let i = 0; i < n; i += step) { idx.push(i); xs.push(useDist ? (tr.dist[i] ?? 0) : tr.t[i]); }
    // velocidade suavizada (só para o desenho; nenhum KPI usa isto)
    const sm = (arr: (number | null)[], i: number, k = 8) => { let s = 0, c = 0; for (let j = Math.max(0, i - k); j <= Math.min(arr.length - 1, i + k); j++) { const v = arr[j]; if (v != null) { s += v; c++; } } return c ? s / c : null; };
    const spd = idx.map((i) => sm(tr.spd, i, Math.max(8, step * 2)));
    const hr = idx.map((i) => tr.hr[i]);
    const alt = idx.map((i) => tr.alt[i]);
    const rng = (a: (number | null)[], lo = 0.03, hi = 0.97) => { const v = a.filter((x): x is number => x != null && isFinite(x)).sort((p, q) => p - q); return v.length ? [v[Math.floor(lo * (v.length - 1))], v[Math.floor(hi * (v.length - 1))]] : null; };
    const moving = spd.map((s) => (s != null && s > 0.5 ? s : null));
    return { idx, xs, useDist, spd: moving, hr, alt, rs: rng(moving), rh: rng(hr, 0.01, 0.99), ra: rng(alt, 0, 1), x0: xs[0] ?? 0, x1: xs[xs.length - 1] ?? 1 };
  }, [tr]);
  const X = (x: number) => ((x - data.x0) / (data.x1 - data.x0 || 1)) * W;
  const Yn = (v: number, r: number[] | null, top: number, bot: number) => (r ? bot - ((Math.max(r[0], Math.min(r[1], v)) - r[0]) / (r[1] - r[0] || 1)) * (bot - top) : bot);
  const line = (arr: (number | null)[], r: number[] | null, top: number, bot: number) => {
    let d = '', pen = false;
    arr.forEach((v, k) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(data.xs[k]).toFixed(1) + ' ' + Yn(v, r, top, bot).toFixed(1); pen = true; });
    return d;
  };
  const area = (() => {
    if (!data.ra) return '';
    let d = ''; data.alt.forEach((v, k) => { if (v == null) return; d += (d ? 'L' : 'M') + X(data.xs[k]).toFixed(1) + ' ' + Yn(v, data.ra, H * 0.55, H).toFixed(1); });
    return d ? d + `L${X(data.x1)} ${H}L${X(data.x0)} ${H}Z` : '';
  })();
  const pickAt = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect(); const x = data.x0 + ((clientX - r.left) / r.width) * (data.x1 - data.x0);
    // índice original mais perto de x
    let lo = 0, hi = data.xs.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (data.xs[m] < x) lo = m + 1; else hi = m; }
    onCursor(data.idx[lo]);
  };
  const onKey = (e: KeyboardEvent) => {
    const n = tr.t.length, cur = cursor ?? 0, stepK = Math.max(1, Math.round(n / 100));
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onCursor(Math.min(n - 1, cur + stepK)); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onCursor(Math.max(0, cur - stepK)); }
    else if (e.key === 'Home') { e.preventDefault(); onCursor(0); }
    else if (e.key === 'End') { e.preventDefault(); onCursor(n - 1); }
  };
  const ci = cursor != null ? cursor : null;
  const cx = ci != null ? X(data.useDist ? (tr.dist[ci] ?? 0) : tr.t[ci]) : null;
  const sAt = ci != null ? tr.spd[ci] : null, hAt = ci != null ? tr.hr[ci] : null, aAt = ci != null ? tr.alt[ci] : null, dAt = ci != null ? tr.dist[ci] : null;
  const readout = ci != null ? [dAt != null ? 'km ' + (dAt / 1000).toFixed(2).replace('.', ',') : E.hms(tr.t[ci]),
    sAt != null && sAt > 0.5 ? (bike ? (sAt * 3.6).toFixed(1).replace('.', ',') + ' km/h' : E.paceStr(1000 / sAt) + '/km') : null,
    hAt != null ? hAt + ' bpm' : null, aAt != null ? Math.round(aAt) + ' m' : null].filter(Boolean).join(' · ') : 'Arraste no gráfico ou use as setas';
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: H, touchAction: 'none' }} tabIndex={0} role="slider"
        aria-label={label} aria-valuemin={0} aria-valuemax={tr.t.length - 1} aria-valuenow={ci ?? 0} aria-valuetext={readout} onKeyDown={onKey}
        onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); pickAt(e.clientX, e.currentTarget); }}
        onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') pickAt(e.clientX, e.currentTarget); }}>
        {area ? <path d={area} fill="var(--superficie-2)" /> : null}
        <path d={line(data.hr, data.rh, 4, H * 0.62)} fill="none" stroke="var(--ciano)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        <path d={line(data.spd, data.rs, 4, H * 0.62)} fill="none" stroke="var(--magenta)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        {cx != null ? <line x1={cx} x2={cx} y1={0} y2={H} stroke="var(--texto)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /> : null}
      </svg>
      <div className="row between wrap legend" style={{ marginTop: 4 }}>
        <span><span style={{ color: 'var(--magenta)' }}>—</span> {bike ? 'velocidade' : 'pace'} · <span style={{ color: 'var(--ciano)' }}>—</span> FC · área: elevação</span>
        <span className="tn" aria-live="polite">{readout}</span>
      </div>
    </div>
  );
}
