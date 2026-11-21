// MAPA DE CALOR com as ruas no fundo: MapLibre + OpenFreeMap (o mesmo do Treino), linhas por faixa.
// Sem rede ou com erro no estilo, avisa e a tela volta ao desenho sem fundo.
import { useEffect, useRef } from 'react';
import { centro, type Agregado } from '../../calor.mjs';
import { STYLE, recolore, cssVar, resolve } from './RuasMap';
import { COR_FAIXA, OPAC_FAIXA, LARG_FAIXA, dentro } from './calor-estilo';

const coords = (cells: string[]) => cells.map((k) => { const c = centro(k); return [c.lon, c.lat]; });
export function CalorMap({ ag, linhas, sel, onPick, onFail, desc }: { ag: Agregado; linhas: { faixa: number; cells: string[] }[]; sel: string[] | null; onPick: (lat: number, lon: number, maxM: number) => void; onFail: (why: string) => void; desc: string }) {
  const box = useRef<HTMLDivElement>(null);
  const S = useRef<{ map: any; ready: boolean } | null>(null);
  const selRef = useRef(sel); selRef.current = sel;
  const linRef = useRef(linhas); linRef.current = linhas;
  useEffect(() => {
    let dead = false, timer: any, ro: ResizeObserver | null = null;
    (async () => {
      let ml: any;
      try { ml = await import('maplibre-gl'); await import('maplibre-gl/dist/maplibre-gl.css'); } catch { onFail('o mapa não carregou'); return; }
      if (dead || !box.current) return;
      let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
      for (const k of ag.cont.keys()) { const p = centro(k); a = Math.min(a, p.lon); b = Math.max(b, p.lon); c = Math.min(c, p.lat); d = Math.max(d, p.lat); }
      const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      const map = new (ml.Map || ml.default.Map)({
        container: box.current, style: STYLE[theme], attributionControl: false,
        bounds: [[a, c], [b, d]], fitBoundsOptions: { padding: window.innerWidth >= 1024 ? { top: 140, bottom: 60, left: 48, right: 72 } : { top: 170, bottom: 72, left: 24, right: 24 } },
      });
      const MLx = ml.AttributionControl ? ml : ml.default;
      map.addControl(new MLx.AttributionControl({ compact: true }), 'top-right');
      S.current = { map, ready: false };
      ro = new ResizeObserver(() => { try { map.resize(); } catch { /* */ } }); ro.observe(box.current);
      timer = setTimeout(() => { if (S.current && !S.current.ready) onFail('o mapa de ruas não respondeu'); }, 9000);
      map.on('error', (e: any) => { if (S.current && !S.current.ready) { clearTimeout(timer); onFail('o mapa de ruas não carregou' + (e && e.error && e.error.status ? ' (' + e.error.status + ')' : '')); } });
      map.on('load', () => {
        if (!S.current) return;
        S.current.ready = true; clearTimeout(timer);
        recolore(map);
        map.addSource('sel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'sel', type: 'line', source: 'sel', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': cssVar('--texto'), 'line-width': ['+', ['get', 'w'], 5] } });
        map.addSource('calor', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'calor', type: 'line', source: 'calor', layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['get', 'f'] }, paint: { 'line-color': ['get', 'cor'], 'line-opacity': ['get', 'op'], 'line-width': ['get', 'w'] } });
        desenha(); desenhaSel();
        map.on('click', (e: any) => {
          const p2 = map.unproject([e.point.x + 24, e.point.y]);
          const m = Math.abs(p2.lng - e.lngLat.lng) * 111195 * Math.cos((e.lngLat.lat * Math.PI) / 180);
          onPick(e.lngLat.lat, e.lngLat.lng, Math.max(30, m));
        });
        map.getCanvas().setAttribute('aria-label', desc);
        box.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      });
    })();
    return () => { dead = true; clearTimeout(timer); ro?.disconnect(); if (S.current) { try { S.current.map.remove(); } catch { /* */ } } S.current = null; };
  }, [ag]);
  function desenha() {
    const s = S.current; if (!s || !s.ready) return;
    const features = linRef.current.map((l) => ({ type: 'Feature', properties: { f: l.faixa, cor: resolve(COR_FAIXA[l.faixa]), op: OPAC_FAIXA[l.faixa], w: LARG_FAIXA[l.faixa] }, geometry: l.cells.length > 1 ? { type: 'LineString', coordinates: coords(l.cells) } : { type: 'LineString', coordinates: [...coords(l.cells), ...coords(l.cells)] } }));
    s.map.getSource('calor').setData({ type: 'FeatureCollection', features });
  }
  function desenhaSel() {
    const s = S.current; if (!s || !s.ready) return;
    const sl = selRef.current ? new Set(selRef.current) : null;
    const features = sl ? linRef.current.flatMap((l) => dentro(l.cells, sl).map((cs) => ({ type: 'Feature', properties: { w: LARG_FAIXA[l.faixa] }, geometry: { type: 'LineString', coordinates: cs.length > 1 ? coords(cs) : [...coords(cs), ...coords(cs)] } }))) : [];
    s.map.getSource('sel').setData({ type: 'FeatureCollection', features });
  }
  useEffect(() => { desenha(); }, [linhas]);
  useEffect(() => { desenhaSel(); }, [sel ? sel.join() : '']);
  return <div className="trackmap ruas calor"><div ref={box} style={{ width: '100%', height: '100%' }} /></div>;
}
