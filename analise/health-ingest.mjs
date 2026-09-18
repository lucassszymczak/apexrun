// ============================================================================
// Leitor do export.xml do app Saúde (Apple Health) — extrai as métricas diárias
// que o Apple Watch mede: FC de repouso, sono, HRV (SDNN) e VO₂máx.
// Puro e testável; a mesma lógica é embutida na página (analise/index.html).
// Uso no navegador: leitura em pedaços (chunks) para aguentar arquivos grandes.
// ============================================================================

export const HK = {
  resting: "HKQuantityTypeIdentifierRestingHeartRate",
  hrv: "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
  vo2: "HKQuantityTypeIdentifierVO2Max",
  sleep: "HKCategoryTypeIdentifierSleepAnalysis",
};

// "2026-09-14 06:40:00 -0300" -> epoch ms (tolerante); e a data local (10 chars).
function parseAppleDate(s) {
  if (!s) return null;
  const iso = s.trim().replace(" ", "T").replace(/\s*([+-]\d{2})(\d{2})$/, "$1:$2");
  const t = Date.parse(iso);
  return isNaN(t) ? null : t;
}
function localDay(s) { return s ? s.slice(0, 10) : null; }

// Extrai os <Record> das 4 métricas de um trecho de texto XML.
export function extractHealthRecords(text) {
  const out = [];
  const wanted = new Set(Object.values(HK));
  const recRe = /<Record\b([^>]*?)\/?>/g;
  let m;
  while ((m = recRe.exec(text)) !== null) {
    const attrs = m[1];
    const type = (attrs.match(/\btype="([^"]*)"/) || [])[1];
    if (!type || !wanted.has(type)) continue;
    const get = (k) => (attrs.match(new RegExp("\\b" + k + '="([^"]*)"')) || [])[1];
    out.push({ type, value: get("value"), startDate: get("startDate"), endDate: get("endDate") });
  }
  return out;
}

// Agrega registros brutos em métricas por dia.
export function aggregateDaily(records) {
  const acc = {}; // date -> { restingArr, hrvArr, vo2Latest, sleepMs }
  const ensure = (d) => (acc[d] = acc[d] || { rest: [], hrv: [], vo2: null, vo2t: 0, sleepMs: 0 });
  for (const r of records) {
    if (r.type === HK.resting) {
      const d = localDay(r.startDate); const v = +r.value;
      if (d && isFinite(v)) ensure(d).rest.push(v);
    } else if (r.type === HK.hrv) {
      const d = localDay(r.startDate); const v = +r.value;
      if (d && isFinite(v)) ensure(d).hrv.push(v);
    } else if (r.type === HK.vo2) {
      const d = localDay(r.startDate); const v = +r.value; const t = parseAppleDate(r.startDate) || 0;
      if (d && isFinite(v)) { const a = ensure(d); if (t >= a.vo2t) { a.vo2 = v; a.vo2t = t; } }
    } else if (r.type === HK.sleep) {
      // conta só segmentos "asleep"; agrupa pela data em que acordou (endDate)
      if (!/Asleep/i.test(r.value || "")) continue;
      const s = parseAppleDate(r.startDate), e = parseAppleDate(r.endDate);
      const d = localDay(r.endDate);
      if (d && s != null && e != null && e > s) ensure(d).sleepMs += e - s;
    }
  }
  const days = Object.keys(acc).sort().map((d) => {
    const a = acc[d];
    const row = { date: d };
    if (a.rest.length) row.restingHR = Math.round(median(a.rest));
    if (a.hrv.length) row.hrv = Math.round(median(a.hrv));
    if (a.vo2 != null) row.vo2 = Math.round(a.vo2 * 10) / 10;
    if (a.sleepMs > 0) row.sleepH = Math.round((a.sleepMs / 3600000) * 10) / 10;
    return row;
  });
  return days.filter((r) => r.restingHR != null || r.hrv != null || r.vo2 != null || r.sleepH != null);
}

// atalho: texto XML completo -> diário
export function parseHealthText(text) {
  return aggregateDaily(extractHealthRecords(text));
}

function median(a) {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
