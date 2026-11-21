// MAPA DE CALOR sem o mapa-base ("sem ruas no fundo"): as linhas em SVG, agrupadas por faixa.
// Funciona sem internet. Arrastar move; +/− e a roda do mouse dão zoom; tocar escolhe a rua.
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconPlus, IconMinus, IconFocusCentered } from '@tabler/icons-react';
import { centro, type Agregado } from '../../calor.mjs';
import { COR_FAIXA, OPAC_FAIXA, LARG_FAIXA, dentro } from './calor-estilo';

const R = 6371000;
export function CalorSvg({ ag, linhas, sel, onPick, desc }: { ag: Agregado; linhas: { faixa: number; cells: string[] }[]; sel: string[] | null; onPick: (lat: number, lon: number, maxM: number) => void; desc: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 500 });
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number] | null>(null);
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 390, h: el.clientHeight || 500 })); ro.observe(el); return () => ro.disconnect(); }, []);
  const proj = useMemo(() => {
    let la0 = 0, n = 0; for (const k of ag.cont.keys()) { la0 += centro(k).lat; n++; } la0 = n ? la0 / n : 0;
    const cl = Math.cos((la0 * Math.PI) / 180);
    const P = (k: string): [number, number] => { const c = centro(k); return [((c.lon * Math.PI) / 180) * cl * R, -((c.lat * Math.PI) / 180) * R]; };
    const inv = (x: number, y: number) => ({ lat: (-y / R) * 180 / Math.PI, lon: (x / (cl * R)) * 180 / Math.PI });
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const k of ag.cont.keys()) { const [x, y] = P(k); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const pad = Math.max(x1 - x0, y1 - y0) * 0.06 + 60;
    return { P, inv, x0: x0 - pad, x1: x1 + pad, y0: y0 - pad, y1: y1 + pad };
  }, [ag]);
  const full = useMemo(() => {
    const ins = size.w >= 1024 ? { t: 140, b: 60, l: 8, r: 64 } : { t: 170, b: 64, l: 8, r: 8 };
    const bw = proj.x1 - proj.x0, bh = proj.y1 - proj.y0;
    const k = Math.min(Math.max(40, size.w - ins.l - ins.r) / bw, Math.max(40, size.h - ins.t - ins.b) / bh);
    return { cx: (proj.x0 + proj.x1) / 2 - ((ins.l - ins.r) / 2) / k, cy: (proj.y0 + proj.y1) / 2 - ((ins.t - ins.b) / 2) / k, w: size.w / k, h: size.h / k };
  }, [proj, size]);
  const c = center || [full.cx, full.cy];
  const vw = full.w / zoom, vh = full.h / zoom, vb = [c[0] - vw / 2, c[1] - vh / 2, vw, vh];
  const unit = vw / size.w;
  const pts = (cells: string[]) => cells.map((k) => proj.P(k).map((v) => v.toFixed(1)).join(',')).join(' ');
  const selSet = useMemo(() => new Set(sel || []), [sel]);
  const drag = useRef<{ x: number; y: number; c: [number, number]; moved: boolean } | null>(null);
  const ordem = useMemo(() => linhas.slice().sort((a, b) => a.faixa - b.faixa), [linhas]);
  return (
    <div ref={box} className="trackmap calor" onWheel={(e) => { const z = Math.max(1, Math.min(40, zoom * (e.deltaY < 0 ? 1.25 : 0.8))); setZoom(z); if (z === 1) setCenter(null); }}>
      <svg viewBox={vb.join(' ')} preserveAspectRatio="xMidYMid meet" role="img" aria-label={desc}
        onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, c: [c[0], c[1]], moved: false }; }}
        onPointerMove={(e) => { const d = drag.current; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.hypot(dx, dy) > 6) d.moved = true; if (d.moved) setCenter([d.c[0] - dx * unit, d.c[1] - dy * unit]); }}
        onPointerUp={(e) => { const d = drag.current; drag.current = null; if (d && !d.moved) { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const x = vb[0] + ((e.clientX - r.left) / r.width) * vb[2], y = vb[1] + ((e.clientY - r.top) / r.height) * vb[3]; const p = proj.inv(x, y); onPick(p.lat, p.lon, Math.max(30, 24 * unit)); } }}>
        <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} fill="var(--noite)" />
        {sel ? ordem.flatMap((l, i) => dentro(l.cells, selSet).map((cs, j) => <polyline key={'s' + i + '-' + j} points={pts(cs)} fill="none" stroke="var(--texto)" strokeWidth={(LARG_FAIXA[l.faixa] + 5) * unit} strokeLinejoin="round" strokeLinecap="round" />)) : null}
        {[0, 1, 2, 3, 4].map((f) => (
          <g key={f} stroke={COR_FAIXA[f]} strokeOpacity={OPAC_FAIXA[f]} strokeWidth={LARG_FAIXA[f] * unit} fill="none" strokeLinejoin="round" strokeLinecap="round">
            {ordem.filter((l) => l.faixa === f).map((l, i) => l.cells.length > 1 ? <polyline key={i} points={pts(l.cells)} /> : (() => { const [x, y] = proj.P(l.cells[0]); return <circle key={i} cx={x} cy={y} r={LARG_FAIXA[f] * unit / 2} fill={COR_FAIXA[f]} />; })())}
          </g>))}
      </svg>
      <div className="mapzoom" role="group" aria-label="Zoom do mapa de calor">
        <button type="button" onClick={() => setZoom(Math.min(40, zoom * 1.6))} aria-label="Aproximar"><IconPlus size={18} stroke={1.75} /></button>
        <button type="button" onClick={() => { const z = Math.max(1, zoom / 1.6); setZoom(z); if (z === 1) setCenter(null); }} aria-label="Afastar"><IconMinus size={18} stroke={1.75} /></button>
        {zoom > 1 || center ? <button type="button" onClick={() => { setZoom(1); setCenter(null); }} aria-label="Ver tudo"><IconFocusCentered size={18} stroke={1.75} /></button> : null}
      </div>
    </div>
  );
}
