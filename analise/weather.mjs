// ============================================================================
// CLIMA (Open-Meteo) — busca por sessão a partir do GPS inicial + horário.
// Puro e testável: monta URL, escolhe a hora e classifica. NÃO usa o campo
// temperature do .FIT como clima (sensor de pulso esquenta com o corpo).
// ============================================================================

// Monta a URL do Open-Meteo. forecast cobre ~92 dias passados + futuro; archive
// (ERA5) cobre o histórico antigo com atraso de alguns dias.
export function weatherUrl(geo, when, opts = {}) {
  const d = when instanceof Date ? when : new Date(when);
  const date = d.toISOString().slice(0, 10);
  const base = opts.archive ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast";
  const lat = Math.round(geo.lat * 1e4) / 1e4, lon = Math.round(geo.lon * 1e4) / 1e4;
  return base + "?latitude=" + lat + "&longitude=" + lon +
    "&start_date=" + date + "&end_date=" + date +
    "&hourly=temperature_2m,dew_point_2m,relative_humidity_2m,wind_speed_10m&timezone=UTC";
}

// Escolhe a hora mais próxima do horário do treino (tempos do Open-Meteo em UTC).
export function pickHour(hourly, when) {
  if (!hourly || !hourly.time || !hourly.time.length) return null;
  const d = when instanceof Date ? when : new Date(when);
  const target = d.getTime();
  let best = -1, bestDiff = Infinity;
  for (let i = 0; i < hourly.time.length; i++) {
    const t = Date.parse(hourly.time[i] + "Z"); // Open-Meteo com timezone=UTC vem sem sufixo
    if (isNaN(t)) continue;
    const diff = Math.abs(t - target);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  if (best < 0 || bestDiff > 3 * 3600 * 1000) return null; // >3h de distância → sem correspondência
  const g = (k) => (hourly[k] && hourly[k][best] != null ? hourly[k][best] : null);
  const dew = g("dew_point_2m") != null ? g("dew_point_2m") : g("dewpoint_2m");
  return {
    tempC: g("temperature_2m"), dewC: dew, rh: g("relative_humidity_2m"),
    windKmh: g("wind_speed_10m"), hour: hourly.time[best],
  };
}

// Classifica a sessão: dentro do PADRÃO_CLIMA? + etiquetas (calor/frio/úmido/vento/fora da base).
export function climateTags(w, opts = {}) {
  const o = Object.assign({ tempLo: 8, tempHi: 18, dewMax: 14, windMax: 20, altMax: 200, baseAlt: null, alt: null }, opts);
  const tags = [];
  let inStandard = false;
  if (w && w.tempC != null) {
    inStandard = w.tempC >= o.tempLo && w.tempC <= o.tempHi && (w.dewC == null || w.dewC <= o.dewMax);
    if (w.tempC > o.tempHi) tags.push("calor");
    if (w.tempC < o.tempLo) tags.push("frio");
    if (w.dewC != null && w.dewC > o.dewMax) tags.push("úmido");
    if (w.windKmh != null && w.windKmh > o.windMax) tags.push("vento");
  }
  if (o.alt != null && o.baseAlt != null && Math.abs(o.alt - o.baseAlt) > o.altMax) tags.push("fora da base");
  return { tags, inStandard };
}

// Busca de fato (navegador). fetchImpl injetável p/ teste. Tenta forecast; se vier
// vazio (data muito antiga), tenta o archive. Retorna {tempC,dewC,rh,windKmh,hour,source,tags,inStandard} ou null.
export async function fetchWeather(geo, when, opts = {}) {
  if (!geo || geo.lat == null || geo.lon == null) return null;
  const fetchImpl = opts.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  if (!fetchImpl) return null;
  const tryOne = async (archive) => {
    const url = weatherUrl(geo, when, { archive });
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeoutMs || 8000) : null;
    try {
      const r = await fetchImpl(url, ctrl ? { signal: ctrl.signal } : {});
      if (!r || !r.ok) return null;
      const j = await r.json();
      const h = pickHour(j.hourly, when);
      return h && h.tempC != null ? Object.assign(h, { source: archive ? "open-meteo/archive" : "open-meteo/forecast" }) : null;
    } catch (e) { return null; } finally { if (timer) clearTimeout(timer); }
  };
  const ageDays = (Date.now() - (when instanceof Date ? when : new Date(when)).getTime()) / 86400000;
  let h = await tryOne(ageDays > 80);        // antigo → archive primeiro
  if (!h) h = await tryOne(ageDays <= 80);   // fallback no outro endpoint
  if (!h) return null;
  const c = climateTags(h, opts);
  return Object.assign(h, { tags: c.tags, inStandard: c.inStandard });
}
