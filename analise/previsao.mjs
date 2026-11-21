// PREVISÃO HORA A HORA (Fase 4 · item 3 e "Amanhã cedo"). Mesmo padrão do wind.mjs: Open-Meteo,
// por coordenada e data, até 16 dias. Horas no fuso do lugar (timezone=auto), para casar com o
// horário da largada. Timeout de 10 s. Nada de cache aqui: o app guarda o resultado.
export const TIMEOUT_MS = 10000;

export async function fetchPrevisao(geo, dataIso, fetchFn = (typeof fetch !== 'undefined' ? fetch : null)) {
  if (!geo || geo.lat == null || geo.lon == null || !fetchFn || !/^\d{4}-\d{2}-\d{2}$/.test(dataIso || '')) return null;
  const lat = Math.round(geo.lat * 1e4) / 1e4, lon = Math.round(geo.lon * 1e4) / 1e4;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${dataIso}&end_date=${dataIso}` +
    '&hourly=temperature_2m,dew_point_2m,precipitation_probability,wind_speed_10m,wind_direction_10m&timezone=auto';
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
  try {
    const r = await fetchFn(url, ctrl ? { signal: ctrl.signal } : {});
    if (!r || !r.ok) return null;
    const j = await r.json(); const h = j && j.hourly; if (!h || !h.time || !h.time.length) return null;
    const horas = h.time.map((t, i) => ({ hora: String(t).slice(11, 16), tempC: h.temperature_2m?.[i] ?? null, dewC: h.dew_point_2m?.[i] ?? null, chuvaPct: h.precipitation_probability?.[i] ?? null, ventoKmh: h.wind_speed_10m?.[i] ?? null, ventoDe: h.wind_direction_10m?.[i] ?? null }))
      .filter((x) => x.tempC != null);
    return horas.length ? { data: dataIso, horas, fuso: j.timezone || null, buscadaEm: new Date().toISOString() } : null;
  } catch { return null; }
  finally { if (timer) clearTimeout(timer); }
}
