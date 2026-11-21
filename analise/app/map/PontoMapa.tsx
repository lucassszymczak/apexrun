// Mapa para escolher o ponto da previsão (Configurações › Treino). MapLibre + OpenFreeMap; tocar
// no mapa (ou Enter no centro, pelo teclado) marca o ponto. Sem internet, o mapa não carrega e
// fica o botão "Usar minha localização".
import { useEffect, useRef, useState } from 'react';
import { STYLE } from './RuasMap';

export function PontoMapa({ ponto, onPonto }: { ponto: { lat: number; lon: number } | null; onPonto: (p: { lat: number; lon: number }) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const S = useRef<{ map: any; mk: any; ml: any } | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let dead = false;
    (async () => {
      let ml: any;
      try { ml = await import('maplibre-gl'); await import('maplibre-gl/dist/maplibre-gl.css'); } catch { setFalhou(true); return; }
      if (dead || !box.current) return;
      const M = ml.Map ? ml : ml.default;
      const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      const map = new M.Map({ container: box.current, style: STYLE[theme], center: ponto ? [ponto.lon, ponto.lat] : [-47.9, -15.8], zoom: ponto ? 13 : 3, attributionControl: false });
      map.addControl(new M.AttributionControl({ compact: true }), 'top-right');
      S.current = { map, mk: null, ml: M };
      const t = setTimeout(() => { if (!map.loaded()) setFalhou(true); }, 9000);
      map.on('load', () => clearTimeout(t));
      map.on('click', (e: any) => onPonto({ lat: e.lngLat.lat, lon: e.lngLat.lng }));
    })();
    return () => { dead = true; if (S.current) { try { S.current.map.remove(); } catch { /* */ } } S.current = null; };
  }, []);
  useEffect(() => {
    const s = S.current; if (!s || !ponto) return;
    if (!s.mk) { const el = document.createElement('div'); el.className = 'mk cur'; s.mk = new s.ml.Marker({ element: el }).setLngLat([ponto.lon, ponto.lat]).addTo(s.map); }
    else s.mk.setLngLat([ponto.lon, ponto.lat]);
  }, [ponto && ponto.lat, ponto && ponto.lon]);
  if (falhou) return <p className="hint">Sem o mapa agora (sem internet). Use "Usar minha localização".</p>;
  return <div className="ponto-mapa" ref={box} role="application" aria-label="Mapa para escolher o local da previsão. Toque no ponto desejado." tabIndex={0}
    onKeyDown={(e) => { if (e.key === 'Enter' && S.current) { const c = S.current.map.getCenter(); onPonto({ lat: c.lat, lon: c.lng }); } }} />;
}
