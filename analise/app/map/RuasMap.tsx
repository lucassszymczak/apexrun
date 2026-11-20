// "RUAS": MapLibre + estilo do OpenFreeMap (gratuito, sem chave), com água, terra e ruas
// recoloridas pelos tokens (--noite, --superficie, --superficie-2). Carregado só aqui
// (import dinâmico). Sem rede ou com erro no estilo, avisa e a tela volta ao "Só trajeto".
import { useEffect, useRef } from 'react';
import { type Track, coloredRuns, kmMarks, PALETTE } from '../track';
import { nearestGps } from './TrackSvg';
import { describeRoute } from './describe';

const STYLE = { dark: 'https://tiles.openfreemap.org/styles/dark', light: 'https://tiles.openfreemap.org/styles/positron' };
const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
const resolve = (c: string) => (c.startsWith('var(') ? cssVar(c.slice(4, -1)) : c);

function markerEl(cls: string, text?: string, label?: string) {
  const el = document.createElement('div');
  el.className = 'mk ' + cls;
  if (text) el.textContent = text;
  if (label) el.setAttribute('aria-label', label);
  else el.setAttribute('aria-hidden', 'true');
  return el;
}

export type MapPhoto = { id: string; i: number; url: string; label: string };
function photoEl(p: MapPhoto, onPhoto?: (id: string) => void) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'map-photo'; b.setAttribute('aria-label', p.label);
  const im = document.createElement('img'); im.src = p.url; im.alt = ''; b.appendChild(im);
  b.addEventListener('click', (e) => { e.stopPropagation(); if (onPhoto) onPhoto(p.id); });
  return b;
}

export function RuasMap({ tr, band, bandKey, cursor, onPick, onFail, photos, onPhoto, palette = PALETTE, marca }: { tr: Track; band: (i: number) => number | null; bandKey: string; cursor: number | null; onPick: (i: number) => void; onFail: (why: string) => void; photos?: MapPhoto[]; onPhoto?: (id: string) => void; palette?: string[]; marca?: { i: number; label: string } | null }) {
  const box = useRef<HTMLDivElement>(null);
  const S = useRef<{ map: any; ml: any; cursor: any; marks: any[]; photos: any[]; ready: boolean } | null>(null);
  const photosRef = useRef<MapPhoto[]>(photos || []);
  photosRef.current = photos || [];
  const marcaRef = useRef(marca || null);
  marcaRef.current = marca || null;

  // cria o mapa uma vez
  useEffect(() => {
    let dead = false, timer: any, ro: ResizeObserver | null = null;
    (async () => {
      let ml: any;
      try {
        ml = await import('maplibre-gl');
        await import('maplibre-gl/dist/maplibre-gl.css');
      } catch (e) { onFail('o mapa não carregou'); return; }
      if (dead || !box.current) return;
      const lats = tr.draw.map((i) => tr.lat[i]!), lons = tr.draw.map((i) => tr.lon[i]!);
      const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      const map = new (ml.Map || ml.default.Map)({
        container: box.current, style: STYLE[theme], attributionControl: false,
        // folga para o cabeçalho, os chips e o replay/gaveta que ficam por cima do mapa
        bounds: [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
        fitBoundsOptions: { padding: window.innerWidth >= 1024 ? { top: 140, bottom: 210, left: 48, right: 72 } : { top: 140, bottom: 72, left: 32, right: 32 } },
      });
      const MLx = ml.AttributionControl ? ml : ml.default;
      map.addControl(new MLx.AttributionControl({ compact: true }), 'top-right');
      S.current = { map, ml: ml.Marker ? ml : ml.default, cursor: null, marks: [], photos: [], ready: false };
      // a área do mapa muda com a gaveta (celular): o mapa acompanha
      ro = new ResizeObserver(() => { try { map.resize(); } catch { /* */ } });
      ro.observe(box.current);
      timer = setTimeout(() => { if (S.current && !S.current.ready) onFail('o mapa de ruas não respondeu'); }, 9000);
      map.on('error', (e: any) => { if (S.current && !S.current.ready) { clearTimeout(timer); onFail('o mapa de ruas não carregou' + (e && e.error && e.error.status ? ' (' + e.error.status + ')' : '')); } });
      map.on('load', () => {
        if (!S.current) return;
        S.current.ready = true; clearTimeout(timer);
        // recolore água, terra e ruas com os tokens
        const water = cssVar('--noite'), land = cssVar('--superficie'), road = cssVar('--superficie-2');
        for (const l of map.getStyle().layers || []) {
          const id = String(l.id).toLowerCase();
          try {
            if (l.type === 'background') map.setPaintProperty(l.id, 'background-color', land);
            else if (l.type === 'fill' && /water|ocean|river|lake/.test(id)) map.setPaintProperty(l.id, 'fill-color', water);
            else if (l.type === 'fill' && /land|park|wood|grass|earth|residential|building/.test(id)) map.setPaintProperty(l.id, 'fill-color', land);
            else if (l.type === 'line' && /water|river|stream/.test(id)) map.setPaintProperty(l.id, 'line-color', water);
            else if (l.type === 'line' && /road|street|highway|path|track|transport|bridge|tunnel/.test(id)) map.setPaintProperty(l.id, 'line-color', road);
          } catch { /* camada sem a propriedade */ }
        }
        map.addSource('rota', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'rota-borda', type: 'line', source: 'rota', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': cssVar('--noite'), 'line-width': 8 } });
        map.addLayer({ id: 'rota', type: 'line', source: 'rota', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': ['get', 'cor'], 'line-width': 4.5 } });
        draw(); drawMarks(); drawPhotos();
        map.on('zoomend', drawMarks);
        map.on('click', (e: any) => {
          // ponto com GPS mais perto do toque (até ~40 px)
          let best = -1, bd = Infinity;
          for (let i = 0; i < tr.lat.length; i++) { if (tr.lat[i] == null) continue; const p = map.project([tr.lon[i], tr.lat[i]]); const d = (p.x - e.point.x) ** 2 + (p.y - e.point.y) ** 2; if (d < bd) { bd = d; best = i; } }
          if (best >= 0 && bd < 1600) onPick(best);
        });
        map.getCanvas().setAttribute('aria-label', describeRoute(tr));
        // crédito do mapa (obrigatório pela licença) começa recolhido no "i"
        box.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      });
    })();
    return () => { dead = true; clearTimeout(timer); ro?.disconnect(); if (S.current) { try { S.current.map.remove(); } catch { /* */ } } S.current = null; };
  }, [tr]);

  function draw() {
    const s = S.current; if (!s || !s.ready) return;
    const runs = coloredRuns(tr, band);
    const features = runs.map((r) => ({ type: 'Feature', properties: { cor: resolve(r.band == null ? 'var(--texto-3)' : palette[r.band]) }, geometry: { type: 'LineString', coordinates: r.idx.map((i) => [tr.lon[i], tr.lat[i]]) } }));
    s.map.getSource('rota').setData({ type: 'FeatureCollection', features });
  }
  function drawMarks() {
    const s = S.current; if (!s || !s.ready) return;
    s.marks.forEach((m) => m.remove()); s.marks = [];
    const every = s.map.getZoom() >= 14 ? 1 : 5;
    for (const k of kmMarks(tr, every)) { const i = nearestGps(tr, k.i); s.marks.push(new s.ml.Marker({ element: markerEl('km', String(k.km)) }).setLngLat([tr.lon[i], tr.lat[i]]).addTo(s.map)); }
    const a = tr.draw[0], b = tr.draw[tr.draw.length - 1];
    s.marks.push(new s.ml.Marker({ element: markerEl('fim', undefined, 'Chegada') }).setLngLat([tr.lon[b], tr.lat[b]]).addTo(s.map));
    s.marks.push(new s.ml.Marker({ element: markerEl('ini', undefined, 'Largada') }).setLngLat([tr.lon[a], tr.lat[a]]).addTo(s.map));
    if (marcaRef.current) { const i = nearestGps(tr, marcaRef.current.i); s.marks.push(new s.ml.Marker({ element: markerEl('deriva', undefined, marcaRef.current.label) }).setLngLat([tr.lon[i], tr.lat[i]]).addTo(s.map)); }
  }
  function drawPhotos() {
    const s = S.current; if (!s || !s.ready) return;
    s.photos.forEach((m) => m.remove()); s.photos = [];
    for (const p of photosRef.current) { const i = nearestGps(tr, p.i); s.photos.push(new s.ml.Marker({ element: photoEl(p, onPhoto) }).setLngLat([tr.lon[i], tr.lat[i]]).addTo(s.map)); }
  }
  useEffect(() => { drawPhotos(); }, [(photos || []).map((p) => p.id + ':' + p.i).join(',')]);
  // recolore quando muda o modo de cor
  useEffect(() => { draw(); }, [bandKey]);
  useEffect(() => { drawMarks(); }, [marca ? marca.i : -1]);
  // ponto do replay
  useEffect(() => {
    const s = S.current; if (!s || !s.ready) return;
    if (cursor == null || tr.lat[cursor] == null) { if (s.cursor) { s.cursor.remove(); s.cursor = null; } return; }
    if (!s.cursor) s.cursor = new s.ml.Marker({ element: markerEl('cur') }).setLngLat([tr.lon[cursor], tr.lat[cursor]]).addTo(s.map);
    else s.cursor.setLngLat([tr.lon[cursor], tr.lat[cursor]]);
  }, [cursor]);

  // o CSS do MapLibre põe position:relative no contêiner do mapa — por isso um wrapper
  return <div className="trackmap ruas"><div ref={box} style={{ width: '100%', height: '100%' }} /></div>;
}
