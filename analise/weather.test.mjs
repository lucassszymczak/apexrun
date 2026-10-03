import * as W from "./weather.mjs";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}` + (got !== undefined ? `  (${got})` : "")); } else { fail++; console.log(`  ✗ ${n}  GOT ${got}`); } };

console.log("== URL ==");
const url = W.weatherUrl({ lat: -25.39, lon: -51.46 }, new Date("2026-09-10T09:30:00Z"));
ok("forecast com lat/lon/data/UTC", /forecast\?latitude=-25.39&longitude=-51.46&start_date=2026-09-10&end_date=2026-09-10/.test(url) && /timezone=UTC/.test(url), url.slice(0, 70));
ok("archive quando pedido", /archive-api/.test(W.weatherUrl({ lat: 1, lon: 2 }, new Date("2020-01-01T00:00:00Z"), { archive: true })));

console.log("\n== pickHour ==");
const hourly = {
  time: ["2026-09-10T07:00", "2026-09-10T08:00", "2026-09-10T09:00", "2026-09-10T10:00"],
  temperature_2m: [9, 11, 13, 16], dew_point_2m: [7, 8, 10, 11], relative_humidity_2m: [80, 72, 65, 55], wind_speed_10m: [6, 9, 12, 22],
};
const h = W.pickHour(hourly, new Date("2026-09-10T09:20:00Z"));
ok("escolhe a hora mais próxima (09:00)", h && h.hour === "2026-09-10T09:00", h && h.hour);
ok("lê temperatura/orvalho/umidade/vento", h && h.tempC === 13 && h.dewC === 10 && h.rh === 65 && h.windKmh === 12, h && JSON.stringify(h));
ok("alias dewpoint_2m também funciona", (function () { const h2 = W.pickHour({ time: ["2026-09-10T09:00"], temperature_2m: [13], dewpoint_2m: [10] }, new Date("2026-09-10T09:00:00Z")); return h2 && h2.dewC === 10; })());
ok(">3h de distância → null", W.pickHour(hourly, new Date("2026-09-10T20:00:00Z")) === null);

console.log("\n== climateTags ==");
let c = W.climateTags({ tempC: 13, dewC: 10, windKmh: 12 });
ok("13°C orvalho 10 → dentro do padrão, sem etiqueta", c.inStandard === true && c.tags.length === 0, JSON.stringify(c));
c = W.climateTags({ tempC: 24, dewC: 18, windKmh: 25 }, { alt: 300, baseAlt: 1120 });
ok("quente/úmido/vento/fora da base → fora do padrão + etiquetas", c.inStandard === false && c.tags.indexOf("calor") >= 0 && c.tags.indexOf("úmido") >= 0 && c.tags.indexOf("vento") >= 0 && c.tags.indexOf("fora da base") >= 0, JSON.stringify(c.tags));
c = W.climateTags({ tempC: 5, dewC: 2, windKmh: 5 });
ok("frio (<8°C) → fora do padrão + etiqueta frio", c.inStandard === false && c.tags.indexOf("frio") >= 0, JSON.stringify(c.tags));
c = W.climateTags({ tempC: 16, dewC: 15, windKmh: 10 });
ok("orvalho >14 derruba o padrão", c.inStandard === false && c.tags.indexOf("úmido") >= 0, JSON.stringify(c));

console.log("\n== fetchWeather (fetch mockado) ==");
const fakeFetch = async (u) => ({ ok: true, json: async () => ({ hourly }) });
const fw = await W.fetchWeather({ lat: -25.39, lon: -51.46 }, new Date("2026-09-10T09:10:00Z"), { fetchImpl: fakeFetch });
ok("fetchWeather retorna clima + etiquetas + padrão", fw && fw.tempC === 13 && fw.inStandard === true && fw.source.indexOf("open-meteo") === 0, fw && JSON.stringify({ t: fw.tempC, std: fw.inStandard, src: fw.source }));
const fwNull = await W.fetchWeather({ lat: null, lon: null }, new Date(), { fetchImpl: fakeFetch });
ok("sem GPS → null", fwNull === null);
const fwErr = await W.fetchWeather({ lat: 1, lon: 2 }, new Date(), { fetchImpl: async () => ({ ok: false }) });
ok("resposta ruim → null (degrada sem quebrar)", fwErr === null);

console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
