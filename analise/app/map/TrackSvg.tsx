// "SÓ TRAJETO": o trajeto desenhado em SVG, sem mapa-base — funciona sem internet.
// Trechos coloridos (agrupados por cor), marcos de km (5 em 5; 1 em 1 com zoom),
// largada/chegada, ponto do replay. Tocar no trajeto move o cursor; arrastar move o
// mapa; botões +/− e roda do mouse dão zoom.
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconPlus, IconMinus, IconFocusCentered } from '@tabler/icons-react';
import { type Track, coloredRuns, cortaRuns, kmMarks, PALETTE, totalDist } from '../track';
import { describeRoute } from './describe';

const R = 6371000;

export function TrackSvg({ tr, band, cursor, onPick, photos, onPhoto, palette = PALETTE, marca, destaque, ate = null, fantasma = null, boneco = '' }: { boneco?: string; fantasma?: { lat: number; lon: number; label: string } | null; tr: Track; band: (i: number) => number | null; cursor: number | null; onPick: (i: number) => void; photos?: { i: number; id: string; url: string; label: string }[]; onPhoto?: (id: string) => void; palette?: string[]; marca?: { i: number; label: string } | null; destaque?: { a: number; b: number } | null; ate?: number | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 400 });
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number] | null>(null);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 390, h: el.clientHeight || 400 }));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  // projeção local em metros (equiretangular) — precisa para áreas do tamanho de um treino
  const proj = useMemo(() => {
    const i0 = tr.draw[0];
    const lat0 = ((tr.lat[i0] as number) * Math.PI) / 180;
    const P = (i: number): [number, number] => [((tr.lon[i] as number) * Math.PI / 180) * Math.cos(lat0) * R, -((tr.lat[i] as number) * Math.PI / 180) * R];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const i of tr.draw) { const [x, y] = P(i); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const pad = Math.max(x1 - x0, y1 - y0) * 0.1 + 30;
    const PL = (la: number, lo: number): [number, number] => [(lo * Math.PI / 180) * Math.cos(lat0) * R, -(la * Math.PI / 180) * R];
    return { P, PL, x0: x0 - pad, x1: x1 + pad, y0: y0 - pad, y1: y1 + pad };
  }, [tr]);

  // viewBox com o mesmo aspecto do contêiner, deixando livres as faixas cobertas pelos
  // controles sobre o mapa (cabeçalho em cima, chips embaixo)
  const full = useMemo(() => {
    const bw = proj.x1 - proj.x0, bh = proj.y1 - proj.y0;
    const ins = { t: Math.min(140, size.h * 0.3), b: Math.min(64, size.h * 0.15), l: 8, r: size.w >= 600 ? 64 : 8 };
    const aw = Math.max(40, size.w - ins.l - ins.r), ah = Math.max(40, size.h - ins.t - ins.b);
    const k = Math.min(aw / bw, ah / bh); // px por metro
    const w = size.w / k, h = size.h / k;
    // centro do trajeto cai no centro da área livre
    const cx = (proj.x0 + proj.x1) / 2 - ((ins.l - ins.r) / 2) / k, cy = (proj.y0 + proj.y1) / 2 - ((ins.t - ins.b) / 2) / k;
    return { cx, cy, w, h };
  }, [proj, size]);
  const c = center || [full.cx, full.cy];
  const vw = full.w / zoom, vh = full.h / zoom;
  const vb = [c[0] - vw / 2, c[1] - vh / 2, vw, vh];
  const pxPerM = size.w / vw;
  const unit = 1 / pxPerM; // 1 px em metros (traços com espessura constante na tela)

  const todas = useMemo(() => coloredRuns(tr, band), [tr, band]);
  const runs = useMemo(() => cortaRuns(todas, ate), [todas, ate]);
  const every = pxPerM * 1000 >= 48 ? 1 : 5;
  // no replay, cada marco só aparece depois que o cursor completa aquele km
  const marks = useMemo(() => kmMarks(tr, every).filter((m) => ate == null || m.i <= ate), [tr, every, ate]);
  const first = tr.draw[0], last = tr.draw[tr.draw.length - 1];
  const pts = (idx: number[]) => idx.map((i) => proj.P(i).map((v) => v.toFixed(1)).join(',')).join(' ');

  // tocar: ponto com GPS mais perto (na tela); arrastar: mover
  const drag = useRef<{ x: number; y: number; c: [number, number]; moved: boolean } | null>(null);
  const toWorld = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    return [vb[0] + ((e.clientX - r.left) / r.width) * vb[2], vb[1] + ((e.clientY - r.top) / r.height) * vb[3]];
  };
  const pick = (wx: number, wy: number) => {
    // tocar numa foto abre a foto
    for (const p of photos || []) { const [x, y] = proj.P(nearestGps(tr, p.i)); if (Math.abs(x - wx) * pxPerM <= 22 && Math.abs(y - wy) * pxPerM <= 22) { if (onPhoto) onPhoto(p.id); return; } }
    let best = -1, bd = Infinity;
    for (let i = 0; i < tr.lat.length; i++) { if (tr.lat[i] == null) continue; const [x, y] = proj.P(i); const d = (x - wx) ** 2 + (y - wy) ** 2; if (d < bd) { bd = d; best = i; } }
    if (best >= 0 && Math.sqrt(bd) * pxPerM < 40) onPick(best);
  };
  const desc = useMemo(() => describeRoute(tr), [tr]);
  const cur = cursor != null && tr.lat[cursor] != null ? proj.P(cursor) : null;

  return (
    <div ref={box} className="trackmap" onWheel={(e) => { const z = Math.max(1, Math.min(16, zoom * (e.deltaY < 0 ? 1.25 : 0.8))); setZoom(z); if (z === 1) setCenter(null); }}>
      <svg viewBox={vb.join(' ')} preserveAspectRatio="xMidYMid meet" role="img" aria-label={desc}
        onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, c: [c[0], c[1]], moved: false }; }}
        onPointerMove={(e) => { const d = drag.current; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.hypot(dx, dy) > 6) d.moved = true; if (d.moved && zoom > 1) setCenter([d.c[0] - dx * unit, d.c[1] - dy * unit]); }}
        onPointerUp={(e) => { const d = drag.current; drag.current = null; if (d && !d.moved) { const [x, y] = toWorld(e); pick(x, y); } }}>
        <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} fill="var(--noite)" />
        <polyline points={pts(tr.draw)} fill="none" stroke="var(--linha)" strokeWidth={9 * unit} strokeLinejoin="round" strokeLinecap="round" />
        {destaque ? <polyline points={pts(trechoIdx(tr, destaque.a, destaque.b))} fill="none" stroke="var(--ciano)" strokeOpacity={0.45} strokeWidth={14 * unit} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" /> : null}
        {runs.map((r, k) => <polyline key={k} points={pts(r.idx)} fill="none" stroke={r.band == null ? 'var(--texto-3)' : palette[r.band]} strokeWidth={4.5 * unit} strokeLinejoin="round" strokeLinecap="round" />)}
        {marks.map((m) => { const [x, y] = proj.P(nearestGps(tr, m.i)); return (
          <g key={m.km} aria-hidden="true">
            <circle cx={x} cy={y} r={10 * unit} fill="var(--noite)" stroke="var(--texto)" strokeWidth={1.5 * unit} />
            <text x={x} y={y + 3.6 * unit} textAnchor="middle" style={{ font: `500 ${10 * unit}px var(--font-brand)`, fill: 'var(--texto)' }}>{m.km}</text>
          </g>); })}
        {(photos || []).map((p) => { const [x, y] = proj.P(nearestGps(tr, p.i)); const s = 40 * unit; return (
          <g key={p.id} aria-label={p.label} role="img">
            <clipPath id={'ph-' + p.id}><rect x={x - s / 2} y={y - s / 2} width={s} height={s} rx={7 * unit} /></clipPath>
            <rect x={x - s / 2 - 2 * unit} y={y - s / 2 - 2 * unit} width={s + 4 * unit} height={s + 4 * unit} rx={9 * unit} fill="var(--texto)" />
            <image href={p.url} x={x - s / 2} y={y - s / 2} width={s} height={s} preserveAspectRatio="xMidYMid slice" clipPath={'url(#ph-' + p.id + ')'} />
          </g>); })}
        {(() => { const [x, y] = proj.P(last); return <g aria-hidden="true"><circle cx={x} cy={y} r={8 * unit} fill="var(--noite)" stroke="var(--texto)" strokeWidth={3 * unit} /><circle cx={x} cy={y} r={3 * unit} fill="var(--texto)" /></g>; })()}
        {(() => { const [x, y] = proj.P(first); return <circle cx={x} cy={y} r={7 * unit} fill="var(--texto)" stroke="var(--noite)" strokeWidth={2.5 * unit} aria-hidden="true" />; })()}
        {marca && (ate == null || marca.i <= ate) ? (() => { const [x, y] = proj.P(nearestGps(tr, marca.i)); return <g role="img" aria-label={marca.label}><circle cx={x} cy={y} r={9 * unit} fill="var(--noite)" stroke="var(--atencao)" strokeWidth={3 * unit} /><circle cx={x} cy={y} r={3.5 * unit} fill="var(--atencao)" /></g>; })() : null}
        {fantasma ? (() => { const [x, y] = proj.PL(fantasma.lat, fantasma.lon); return <g role="img" aria-label={fantasma.label}><circle cx={x} cy={y} r={9 * unit} fill="var(--texto)" fillOpacity={0.18} stroke="var(--texto)" strokeWidth={2 * unit} strokeDasharray={`${3 * unit} ${2.5 * unit}`} /></g>; })() : null}
        {cur && boneco ? <g className="svg-boneco" aria-hidden="true" transform={`translate(${cur[0]} ${cur[1]}) scale(${unit * 1.05})`} dangerouslySetInnerHTML={{ __html: boneco }} /> : null}
        {cur && !boneco ? <circle cx={cur[0]} cy={cur[1]} r={8 * unit} fill="var(--ciano)" stroke="var(--noite)" strokeWidth={3 * unit} aria-hidden="true" /> : null}
      </svg>
      <div className="mapzoom" role="group" aria-label="Zoom do trajeto">
        <button type="button" onClick={() => setZoom(Math.min(16, zoom * 1.6))} aria-label="Aproximar"><IconPlus size={18} stroke={1.75} /></button>
        <button type="button" onClick={() => { const z = Math.max(1, zoom / 1.6); setZoom(z); if (z === 1) setCenter(null); }} aria-label="Afastar"><IconMinus size={18} stroke={1.75} /></button>
        {zoom > 1 ? <button type="button" onClick={() => { setZoom(1); setCenter(null); }} aria-label="Ver o trajeto inteiro"><IconFocusCentered size={18} stroke={1.75} /></button> : null}
      </div>
      <span className="sr-only">{(totalDist(tr) / 1000).toFixed(2).replace('.', ',')} km. Marcos a cada {every} km.</span>
    </div>
  );
}

export function nearestGps(tr: Track, i: number): number {
  for (let k = 0; k < tr.lat.length; k++) {
    if (i - k >= 0 && tr.lat[i - k] != null) return i - k;
    if (i + k < tr.lat.length && tr.lat[i + k] != null) return i + k;
  }
  return tr.draw[0];
}

// índices com GPS do trecho [a, b], usando o traçado simplificado + as pontas
export function trechoIdx(tr: Track, a: number, b: number): number[] {
  const out = [nearestGps(tr, a)];
  for (const i of tr.draw) if (i > a && i < b) out.push(i);
  out.push(nearestGps(tr, b));
  return out;
}
