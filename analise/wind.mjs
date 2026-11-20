// VENTO (Fase 2 · item 2 aprovado em 20/11, docs/fase2-formulas.md). Módulo puro + busca no
// Open-Meteo (mesma fonte e mesmo tipo de consulta do clima: coordenada e horário).
// O engine.mjs não muda.

// Busca velocidade (km/h) e direção DE ONDE o vento vem (graus) a 10 m, na hora do treino.
export async function fetchWind(geo, when, fetchFn = (typeof fetch !== 'undefined' ? fetch : null)) {
  if (!geo || geo.lat == null || geo.lon == null || !fetchFn) return null;
  const d = when instanceof Date ? when : new Date(when);
  const date = d.toISOString().slice(0, 10);
  const lat = Math.round(geo.lat * 1e4) / 1e4, lon = Math.round(geo.lon * 1e4) / 1e4;
  const old = Date.now() - d.getTime() > 5 * 86400000;
  const base = old ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
  const url = `${base}?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&hourly=wind_speed_10m,wind_direction_10m&timezone=UTC`;
  try {
    const r = await fetchFn(url); if (!r || !r.ok) return null;
    const j = await r.json(); const h = j && j.hourly; if (!h || !h.time) return null;
    let best = -1, bd = Infinity;
    for (let i = 0; i < h.time.length; i++) { const t = Date.parse(h.time[i] + 'Z'); const df = Math.abs(t - d.getTime()); if (df < bd) { bd = df; best = i; } }
    if (best < 0 || bd > 3 * 3600000) return null;
    const kmh = h.wind_speed_10m && h.wind_speed_10m[best], de = h.wind_direction_10m && h.wind_direction_10m[best];
    return kmh == null || de == null ? null : { kmh, de, hora: h.time[best], fonte: old ? 'open-meteo/archive' : 'open-meteo/forecast' };
  } catch { return null; }
}

const rad = (x) => (x * Math.PI) / 180;
// Rumo (graus, 0 = norte) de A para B
export function rumo(lat1, lon1, lat2, lon2) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
// Componente do vento ao longo do rumo (+ = a favor, − = contra), em km/h.
// O Open-Meteo dá de ONDE o vento vem: ele sopra para (de + 180).
export function componente(kmh, deGraus, rumoGraus) {
  const para = (deGraus + 180) % 360;
  return kmh * Math.cos(rad(para - rumoGraus));
}
export const VENTO_FRACO_KMH = 5;
export const LIMIAR_FRACAO = 0.4;
// −1 contra · 0 lateral · +1 a favor
export function classe(comp, kmh) {
  if (!(kmh >= VENTO_FRACO_KMH)) return 0;
  return comp >= LIMIAR_FRACAO * kmh ? 1 : comp <= -LIMIAR_FRACAO * kmh ? -1 : 0;
}
// Custo do vento contra em s/km (Pugh 1971; Davies 1980): custo relativo ≈ f_ar·((v+c)²−v²)/v²,
// f_ar = 0,04·(v/5)² (a resistência do ar pesa mais quanto mais rápido). Confiança Baixa.
export function custoContraSkm(vMs, contraKmh, paceSkm) {
  if (!(vMs > 0) || !(contraKmh > 0) || !(paceSkm > 0)) return null;
  const c = contraKmh / 3.6, fAr = 0.04 * (vMs / 5) ** 2;
  return paceSkm * fAr * (((vMs + c) ** 2 - vMs ** 2) / vMs ** 2);
}

// Leitura do vento no treino: % do tempo a favor/contra e o custo médio nos trechos contra.
export function ventoDoTreino(tr, wind) {
  if (!tr || !tr.hasGps || !wind || !(wind.kmh >= 0)) return null;
  if (wind.kmh < VENTO_FRACO_KMH) return { v: 1, kmh: wind.kmh, de: wind.de, fraco: true };
  const idx = tr.draw && tr.draw.length > 1 ? tr.draw : [];
  let tFav = 0, tContra = 0, tTot = 0, somaContra = 0, vSoma = 0;
  for (let k = 1; k < idx.length; k++) {
    const a = idx[k - 1], b = idx[k];
    const dt = tr.t[b] - tr.t[a]; if (!(dt > 0) || dt > 120) continue;
    const r = rumo(tr.lat[a], tr.lon[a], tr.lat[b], tr.lon[b]);
    const comp = componente(wind.kmh, wind.de, r), cl = classe(comp, wind.kmh);
    tTot += dt;
    if (cl > 0) tFav += dt;
    if (cl < 0) { tContra += dt; somaContra += -comp * dt; const d = (tr.dist[b] ?? 0) - (tr.dist[a] ?? 0); vSoma += d > 0 ? d : 0; }
  }
  if (!tTot) return null;
  const contraKmh = tContra ? somaContra / tContra : 0;
  const vContra = tContra && vSoma ? vSoma / tContra : null;
  const custo = vContra ? custoContraSkm(vContra, contraKmh, 1000 / vContra) : null;
  return {
    v: 1, kmh: Math.round(wind.kmh * 10) / 10, de: wind.de,
    aFavorPct: Math.round((tFav / tTot) * 100), contraPct: Math.round((tContra / tTot) * 100),
    custoContraSkm: custo != null ? Math.round(custo) : null, confCusto: 'Baixa',
  };
}
