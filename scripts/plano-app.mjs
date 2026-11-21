// Plano de prova (Fase 4 · Etapa 3) num Chromium real, com o Open-Meteo SIMULADO. Percurso e
// previsão sintéticos (nenhum valor das telas de design). Critérios 7, 10, 11 e 14 pela tela.
// Prints em 390 e 1440 px se SHOTS apontar uma pasta.  Uso: node scripts/plano-app.mjs
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_NOW, GOLDEN_TZ } from '../analise/golden/env.mjs';
import { parseGpx, juntaPartes, reamostra, montaCourse } from '../analise/percurso.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const SHOTS = process.env.SHOTS || null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };

// percurso de teste já montado (como se viesse de um GPX), com uma subida do km 13 ao 15
const M_GRAU = 111195;
function gpxCircuito(km) {
  let s = '<gpx><trk><trkseg>';
  for (let x = 0; x <= km * 1000; x += 20) {
    const a = (x / (km * 1000)) * 2 * Math.PI, r = (km * 1000) / (2 * Math.PI), k = x / 1000;
    const ele = 900 + Math.min(Math.max(k - 12, 0), 3) * 35 - Math.min(Math.max(k - 30, 0), 3) * 35;
    s += `<trkpt lat="${(-25.43 + (r * Math.sin(a)) / M_GRAU).toFixed(7)}" lon="${(-49.27 + (r * (1 - Math.cos(a))) / (M_GRAU * 0.9)).toFixed(7)}"><ele>${ele}</ele></trkpt>`;
  }
  return s + '</trkseg></trk></gpx>';
}
const g = parseGpx(gpxCircuito(42.195));
const { course } = montaCourse({ fonte: 'gpx', perfilBruto: reamostra(juntaPartes([{ ...g, d: null }])), kmOficiais: 42.195, agora: new Date(GOLDEN_NOW) });
const base = JSON.parse(readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8'));
const estado = (race) => JSON.stringify({ ...base, race: { ...base.race, ...race } });

// previsão: começa em 18 °C e esquenta 1,5 °C por hora, orvalho 17 °C
function meteo(url) {
  const u = new URL(url), d = u.searchParams.get('start_date');
  const time = Array.from({ length: 24 }, (_, h) => d + 'T' + String(h).padStart(2, '0') + ':00');
  return { timezone: 'America/Sao_Paulo', hourly: { time, temperature_2m: time.map((_, h) => 18 + Math.max(0, h - 6) * 1.5), dew_point_2m: time.map(() => 17), precipitation_probability: time.map(() => 10), wind_speed_10m: time.map(() => 8), wind_direction_10m: time.map(() => 90) } };
}

const PORT = 5218;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
let chamadas = 0;
async function device(w, h, state, { meteoOk = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: GOLDEN_TZ, locale: 'pt-BR', deviceScaleFactor: SHOTS ? 2 : 1, acceptDownloads: true });
  await ctx.addInitScript((p) => { if (!sessionStorage.getItem('__d')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', p); sessionStorage.setItem('__d', '1'); }
    // compartilhar do iPhone, simulado: guarda o arquivo recebido
    navigator.canShare = (d) => !!(d && d.files && d.files.length); navigator.share = async (d) => { window.__shared = { name: d.files[0].name, type: d.files[0].type, size: d.files[0].size }; }; }, state);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.route(/open-meteo\.com/, (r) => { chamadas++; return meteoOk ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(meteo(r.request().url())) }) : r.abort(); });
  await page.route(/^https:\/\/(?!.*open-meteo\.com)/, (r) => r.abort());
  return { ctx, page, errors };
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: resolve(SHOTS, name), fullPage: true }); };
const url = (r) => `http://localhost:${PORT}/analise/#/${r}`;

try {
  console.log('\n== tempo-alvo, longe da prova (critérios 7 e 10) ==');
  const A = await device(390, 844, estado({ goal: 'time', targetSec: 4 * 3600 + 47 * 60, strategy: 'constante', startTime: '06:00', course }));
  await A.page.goto(url('mais/plano'));
  await A.page.waitForSelector('h2:has-text("Mire")');
  const tit = await A.page.locator('h2.titulo-2').innerText();
  ok('título-conclusão com o trecho mais duro', /^Mire \d:\d\d\/km no plano; do km 1[23] ao 15, cerca de \d:\d\d\/km$/.test(tit), tit);
  const pass3 = await A.page.locator('.passagens .pass').allInnerTexts();
  ok('passagens Meia, km 30 e Chegada; chegada = tempo-alvo', pass3.length === 3 && /Chegada\s+4:47:00/.test(pass3[2]), pass3.map((x) => x.replace(/\n/g, ' ')).join(' | '));
  ok('critério 10 · mais de 16 dias antes: clima padrão, com a data em que a previsão abre', await A.page.locator('text=/clima padrão até 12 mar/i').count() > 0 && await A.page.locator('text=/Até 12 mar, o plano usa o clima padrão/').count() === 1);
  ok('longe da prova: nenhuma busca de previsão', chamadas === 0);
  ok('9 blocos de 5 km', (await A.page.locator('.bl-row').count()) === 9);
  await A.page.locator('.bl-row').nth(2).click();
  ok('sanfona: aria-expanded e o km a km com inclinação e "subida" escrita', (await A.page.locator('.bl-row').nth(2).getAttribute('aria-expanded')) === 'true' && await A.page.locator('.km-tab td:has-text("subida")').count() > 0);
  ok('gráficos com texto alternativo (pace no plano e na subida)', /no plano, \d:\d\d\/km na subida mais dura/.test(await A.page.locator('.pace-chart svg').getAttribute('aria-label')));
  await A.page.waitForFunction(() => !!window.__apexPlanoImg, null, { timeout: 10000 });
  const im = await A.page.evaluate(() => window.__apexPlanoImg);
  ok('critério 11 · imagem 1080×1920 com os 34% de cima e os 12% de baixo livres', im.W === 1080 && im.H === 1920 && im.top === Math.round(1920 * 0.34) && im.bottom === Math.round(1920 * 0.88) && im.conteudoAte <= im.bottom, JSON.stringify(im));
  ok('texto da imagem com 40 px ou mais (≥ 13 px na tela do iPhone)', im.fonteMin >= 40);
  await shot(A.page, 'plano-390.png');
  await A.page.getByRole('button', { name: 'Salvar no celular' }).click();
  await A.page.waitForFunction(() => !!window.__shared);
  const sh = await A.page.evaluate(() => window.__shared);
  ok('critério 11 · no celular, abre o compartilhar com a imagem PNG', sh.type === 'image/png' && /apex-plano-2027-03-28\.png/.test(sh.name) && sh.size > 10000, sh.name + ' · ' + Math.round(sh.size / 1024) + ' KB');
  const png = await A.page.evaluate(async () => { const img = document.querySelector('.plano-img') || null; return img ? null : null; });
  void png;

  console.log('\n== terminar bem (critério 14) ==');
  const B = await device(390, 844, estado({ goal: 'finish', strategy: 'negativa', course: null }));
  await B.page.goto(url('mais/plano'));
  await B.page.waitForSelector('h2:has-text("Mire")');
  const nota = await B.page.locator('text=/ponta lenta do seu tempo realista/').innerText();
  const m = /usa a ponta lenta do seu tempo realista: (\dh\d\d) \(faixa de (\dh\d\d) a (\dh\d\d)/.exec(nota);
  ok('critério 14 · "Terminar bem" usa a ponta lenta da faixa', m && m[1] === m[3], nota.slice(0, 120));
  ok('sem percurso: "Mire X/km do início ao fim"', /do início ao fim$/.test(await B.page.locator('h2.titulo-2').innerText()));
  ok('estimativa, não garantia', /Estimativa, não garantia/.test(nota));
  await shot(B.page, 'plano-terminar-390.png');

  console.log('\n== dentro dos 16 dias, com e sem previsão (critério 10) ==');
  const perto = { goal: 'time', targetSec: 4 * 3600 + 47 * 60, strategy: 'constante', startTime: '06:00', course, date: '2026-11-29' };
  chamadas = 0;
  const C = await device(390, 844, estado(perto));
  await C.page.goto(url('mais/plano'));
  await C.page.waitForSelector('text=/O plano usa a previsão para as 06:00/');
  ok('critério 10 · com previsão: usa a previsão para o horário da largada', await C.page.locator('.chip:has-text("Previsão de")').count() === 1 && await C.page.locator('text=/O calor previsto soma/').count() === 1);
  ok('uma busca por abertura, no máximo', chamadas === 1, chamadas + ' chamada');
  const cacheOk = await C.page.evaluate(() => { const c = JSON.parse(localStorage.getItem('apex.previsao.prova') || 'null'); const syncState = JSON.parse(localStorage.getItem('apex.analise.v1')); return !!c && !JSON.stringify(syncState).includes('apex.previsao') && !('previsao' in syncState); });
  ok('a previsão fica só no aparelho, fora dos dados que sincronizam', cacheOk);
  await C.page.reload(); await C.page.waitForSelector('text=/O plano usa a previsão/');
  ok('reabrir antes de 3 h: usa a guardada, sem nova busca', chamadas === 1, chamadas + ' chamada');
  await shot(C.page, 'plano-previsao-390.png');
  const D = await device(390, 844, estado(perto), { meteoOk: false });
  await D.page.goto(url('mais/plano'));
  await D.page.waitForSelector('text=/Sem previsão agora/');
  ok('critério 10 · previsão falhou: clima padrão, com aviso', await D.page.locator('h2:has-text("Mire")').count() === 1);
  ok('sem erro de página', ![...A.errors, ...B.errors, ...C.errors, ...D.errors].length, [...A.errors, ...B.errors, ...C.errors, ...D.errors][0]);

  console.log('\n== computador ==');
  const W = await device(1440, 900, estado({ goal: 'time', targetSec: 4 * 3600 + 47 * 60, strategy: 'constante', startTime: '06:00', course }));
  await W.page.goto(url('mais/plano'));
  await W.page.waitForSelector('h2:has-text("Mire")'); await W.page.waitForFunction(() => !!window.__apexPlanoImg);
  const [dl] = await Promise.all([W.page.waitForEvent('download'), W.page.getByRole('button', { name: 'Baixar imagem do plano' }).click()]);
  ok('critério 11 · no computador, baixa a imagem', /apex-plano-2027-03-28\.png/.test(dl.suggestedFilename()), dl.suggestedFilename());
  if (SHOTS) { const p = resolve(SHOTS, 'plano-imagem.png'); await dl.saveAs(p); }
  await shot(W.page, 'plano-1440.png');
  await W.page.evaluate(() => localStorage.setItem('apex.theme', 'light')); await W.page.reload(); await W.page.waitForSelector('h2:has-text("Mire")');
  await shot(W.page, 'plano-1440-claro.png');
  await W.page.goto(url('mais/livro'));
  ok('Livro: seção Plano de prova com 4 verbetes', await W.page.locator('h2:has-text("Plano de prova") ~ details').count() >= 4);
} catch (e) { ok('execução sem exceção', false, e && e.message); }
finally { await browser.close(); vite.kill(); }
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
