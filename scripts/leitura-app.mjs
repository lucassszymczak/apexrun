// Leitura do treino (Fase 2 · Etapa 5) num Chromium real. Importa .FIT (os do Lucas em
// fixtures/privado/, se existirem; senão, sintéticos) com o Open-Meteo SIMULADO, e confere
// história, tiros, melhores esforços, custo da subida, vento, início da deriva, Hoje,
// Progresso e Livro. Prints em 390 e 1440 px vão para a pasta passada em SHOTS (opcional).
// Uso: node scripts/leitura-app.mjs   (SHOTS=/caminho para salvar os prints)
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_NOW, GOLDEN_TZ } from '../analise/golden/env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const payload = readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8');
const SHOTS = process.env.SHOTS || null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };

// ---------- .FIT sintéticos (quando não há os reais) ----------
const { Encoder, Profile } = await import('@garmin/fitsdk');
const SEMI = 2147483648 / 180;
// tiros: aquecimento 10 min, 6 × (90 s rápido + 60 s lento), desaquecimento 8 min, rumo norte
function tirosFit(startIso) {
  const enc = new Encoder(), st = new Date(startIso);
  enc.onMesg(Profile.MesgNum.FILE_ID, { manufacturer: 'development', product: 1, timeCreated: st, type: 'activity' });
  const blocos = [[600, 2.6]]; for (let k = 0; k < 6; k++) blocos.push([90, 3.6], [60, 2.1]); blocos.push([480, 2.5]);
  let t = 0, d = 0; const laps = [];
  for (const [dur, v] of blocos) {
    const t0 = t, d0 = d;
    for (let i = 0; i < dur; i++) { t++; d += v; enc.onMesg(Profile.MesgNum.RECORD, { timestamp: new Date(st.getTime() + t * 1000), distance: d, enhancedSpeed: v, heartRate: Math.round(120 + v * 15), enhancedAltitude: 900 + (d / 1000) * 8, cadence: 85, positionLat: Math.round((-25.43 + d / 111000) * SEMI), positionLong: Math.round(-49.27 * SEMI) }); }
    laps.push({ t0, dur, dist: d - d0 });
  }
  for (const l of laps) enc.onMesg(Profile.MesgNum.LAP, { timestamp: new Date(st.getTime() + (l.t0 + l.dur) * 1000), startTime: new Date(st.getTime() + l.t0 * 1000), totalTimerTime: l.dur, totalElapsedTime: l.dur, totalDistance: l.dist, lapTrigger: 'time' });
  enc.onMesg(Profile.MesgNum.SESSION, { timestamp: new Date(st.getTime() + t * 1000), startTime: st, sport: 'running', totalDistance: d, totalTimerTime: t, totalElapsedTime: t, avgHeartRate: 155, maxHeartRate: 175 });
  return Buffer.from(enc.close());
}
const PRIV = resolve(root, 'fixtures/privado');
const real = existsSync(resolve(PRIV, '25128573610.fit')) && existsSync(resolve(PRIV, '24159622528.fit'));
const fitTiros = real ? readFileSync(resolve(PRIV, '25128573610.fit')) : tirosFit('2026-11-19T09:00:00Z');
const fitMeia = real ? readFileSync(resolve(PRIV, '24159622528.fit')) : null;

// Open-Meteo simulado: valores de teste (clima úmido e vento de norte), nunca da tela de design
function meteo(url) {
  const u = new URL(url), date = u.searchParams.get('start_date');
  const time = Array.from({ length: 24 }, (_, h) => date + 'T' + String(h).padStart(2, '0') + ':00');
  return { hourly: { time, temperature_2m: time.map(() => 23), dew_point_2m: time.map(() => 19), relative_humidity_2m: time.map(() => 78), wind_speed_10m: time.map(() => 16), wind_direction_10m: time.map(() => 10) } };
}

const PORT = 5216;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
async function device(w, h, state = payload) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: GOLDEN_TZ, locale: 'pt-BR', deviceScaleFactor: SHOTS ? 2 : 1 });
  await ctx.addInitScript((p) => { if (!sessionStorage.getItem('__d')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', p); localStorage.setItem('apex.periodo', 'tudo'); sessionStorage.setItem('__d', '1'); } }, state);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.route(/open-meteo\.com/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(meteo(r.request().url())) }));
  await page.route(/^https:\/\/(?!.*open-meteo\.com)/, (r) => r.abort());
  return { ctx, page, errors };
}
async function importa(page, name, buf) {
  await page.goto(`http://localhost:${PORT}/analise/#/importar`);
  await page.setInputFiles('#fitFile', { name, mimeType: 'application/octet-stream', buffer: buf });
  await page.waitForSelector('h1:has-text("Conferência")', { timeout: 20000 });
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Salvar treino' }).click();
  await page.waitForFunction(() => /#\/treino\//.test(location.hash));
  await page.waitForTimeout(1500);
  return page.evaluate(() => location.hash.split('/').pop());
}
const W = (page, id) => page.evaluate((i) => JSON.parse(localStorage.getItem('apex.analise.v1')).workouts.find((w) => w.id === i), id);

try {
  console.log(real ? '\n== .FIT reais do Lucas ==' : '\n== .FIT sintéticos ==');
  const M = await device(390, 844);
  const idT = await importa(M.page, 'tiros.fit', fitTiros);
  const wT = await W(M.page, idT);
  ok('o treino salvo ganhou a leitura (v1)', wT.leitura && wT.leitura.v === 1);
  ok('tiros reconhecidos pelas voltas', wT.leitura.tiros && /6 × 90 s/.test(wT.leitura.tiros.rotulo), wT.leitura.tiros && wT.leitura.tiros.rotulo);
  ok('vento guardado com a hora (Open-Meteo)', wT.leitura.vento && wT.leitura.vento.kmh === 16 && wT.leitura.ventoHora, wT.leitura.vento && JSON.stringify(wT.leitura.vento));
  ok('melhores esforços e custo da subida calculados', !!wT.leitura.esforcos && !!wT.leitura.subida);
  ok('pace em clima padrão (23 °C, orvalho 19 °C)', !!wT.leitura.climaPadrao, wT.leitura.climaPadrao && JSON.stringify(wT.leitura.climaPadrao));
  await M.page.waitForSelector('.card.historia');
  ok('história: 3 linhas', (await M.page.locator('.tv-panel .card.historia li').count()) === 3, (await M.page.locator('.tv-panel .card.historia li').allInnerTexts()).join(' | '));
  ok('seção Tiros com o rótulo e a tabela', await M.page.locator('text=/Tiros · 6 × 90 s/').count() > 0 && (await M.page.locator('.tv-panel table').first().locator('tbody tr').count()) >= 6);
  ok('linha "Origem" e botão "Trocar origem"', await M.page.locator('text=/^Origem: /').count() > 0 && await M.page.getByRole('button', { name: 'Trocar origem' }).count() === 1);
  ok('seções Melhores esforços e Custo da subida', await M.page.locator('text=Melhores esforços').count() > 0 && await M.page.locator('text=Custo da subida').count() > 0);
  ok('pace em clima padrão abaixo do pace', await M.page.locator('text=/em clima padrão/').count() > 0);
  ok('chip do vento no mapa', await M.page.locator('.tv-vento').count() === 1, await M.page.locator('.tv-vento').innerText());
  await M.page.getByRole('button', { name: 'Vento', exact: true }).click();
  const leg = await M.page.locator('.tv-legend').first().innerText();
  ok('modo de cor Vento com legenda "a favor … contra"', /a favor/.test(leg) && /contra/.test(leg), leg.replace(/\s+/g, ' '));
  // replay: o trajeto se preenche atrás do corredor
  await M.page.getByRole('button', { name: 'Só trajeto' }).click();
  await M.page.getByRole('button', { name: 'FC', exact: true }).click();
  const pts = () => M.page.evaluate(() => [...document.querySelectorAll('.trackmap svg polyline')].filter((p) => (p.getAttribute('stroke') || '') !== 'var(--linha)' && p.getAttribute('stroke-opacity') == null).reduce((n, p) => n + p.getAttribute('points').trim().split(/\s+/).length, 0));
  const cheio = await pts();
  await M.page.getByRole('button', { name: 'Reproduzir o trajeto' }).click();
  await M.page.waitForTimeout(3500);
  await M.page.getByRole('button', { name: 'Pausar o replay' }).click();
  const meio = await pts();
  if (SHOTS) await M.page.screenshot({ path: resolve(SHOTS, 'replay-390-meio.png') });
  ok('replay: no meio, só o trecho percorrido está colorido', meio > 0 && meio < cheio * 0.8, meio + ' de ' + cheio + ' pontos');
  await M.page.getByRole('button', { name: 'Reproduzir o trajeto' }).click();
  // replay em 5 s por km (decisão do Lucas, 24/11/2026): espera o fim de verdade, não um tempo fixo
  await M.page.waitForFunction(() => { const el = document.querySelector('.tv-panel input[type="range"]'); return el && +el.value >= +el.max; }, null, { timeout: 120000, polling: 200 });
  await M.page.waitForTimeout(300);
  ok('replay: no fim, o trajeto inteiro volta colorido', (await pts()) === cheio);
  await M.page.getByRole('button', { name: 'Ruas' }).click();
  // tocar num tiro destaca o trecho no gráfico e no mapa (Só trajeto)
  await M.page.getByRole('button', { name: 'Só trajeto' }).click();
  await M.page.getByRole('button', { name: /Destacar o 3º tiro/ }).click();
  ok('tocar num tiro destaca o trecho no mapa e no gráfico', await M.page.locator('.trackmap svg polyline[stroke-opacity="0.45"]').count() === 1 && await M.page.locator('.tv-panel svg[role="slider"] rect[fill="var(--ciano)"]').count() === 1);
  await M.page.getByRole('button', { name: 'Ruas' }).click();
  // toque num número abre a Folha do KPI com o verbete novo
  await M.page.locator('.tv-vento .kpi').click();
  ok('Folha do KPI do vento com confiança Baixa e fonte', await M.page.locator('[role="dialog"] >> text=/confiança Baixa/').count() > 0 && await M.page.locator('[role="dialog"] >> text=/Pugh/').count() > 0);
  await M.page.getByRole('button', { name: 'Fechar' }).click();
  // trocar origem → "não são tiros" → voltar ao automático
  await M.page.getByRole('button', { name: 'Trocar origem' }).click();
  await M.page.getByRole('radio', { name: /Não são tiros/ }).click();
  await M.page.waitForTimeout(400);
  ok('trocar origem: "Não são tiros" tira a seção', (await W(M.page, idT)).leitura.tiros == null && await M.page.locator('text=Sem tiros neste treino').count() === 1);
  await M.page.getByRole('button', { name: 'Voltar ao automático' }).click();
  await M.page.waitForTimeout(600);
  ok('voltar ao automático devolve os tiros', !!(await W(M.page, idT)).leitura.tiros);
  if (SHOTS) {
    await M.page.getByRole('button', { name: 'Pace', exact: true }).click();
    await M.page.screenshot({ path: resolve(SHOTS, 'tiros-390-mapa.png') });
    await M.page.locator('.tv-handle').click(); await M.page.locator('.tv-handle').click(); await M.page.waitForTimeout(500);
    const pan = M.page.locator('.tv-panel-in');
    await M.page.screenshot({ path: resolve(SHOTS, 'tiros-390-1.png') });
    for (const [k, sel] of [['2', 'text=/Tiros · /'], ['3', 'text=Melhores esforços'], ['4', 'text=Custo da subida']]) { await M.page.locator(sel).first().scrollIntoViewIfNeeded(); await pan.evaluate((el) => el.scrollBy(0, -60)); await M.page.waitForTimeout(200); await M.page.screenshot({ path: resolve(SHOTS, 'tiros-390-' + k + '.png') }); }
  }
  let idM = null;
  if (fitMeia) {
    idM = await importa(M.page, 'meia.fit', fitMeia);
    // a Meia foi um longão/prova: o tipo decide se há início da deriva (contínuos)
    await M.page.goto(`http://localhost:${PORT}/analise/#/editar/${idM}`);
    await M.page.getByRole('button', { name: 'Longão', exact: true }).click();
    await M.page.getByRole('button', { name: /Salvar/ }).first().click();
    await M.page.waitForTimeout(800);
    const wM = await W(M.page, idM);
    ok('Meia (longão): a deriva começa no km 14', wM.leitura && wM.leitura.deriva && wM.leitura.deriva.km === 14, wM.leitura && wM.leitura.deriva && wM.leitura.deriva.km);
    ok('Meia: km automático não vira tiro', !wM.leitura.tiros);
    await M.page.goto(`http://localhost:${PORT}/analise/#/treino/${idM}`);
    await M.page.waitForSelector('.tv-panel');
    ok('chip "A deriva começa no km 14" e faixa no gráfico', await M.page.locator('text=A deriva começa no km 14').count() === 1 && await M.page.locator('.tv-panel svg[role="slider"] rect').count() >= 1);
    await M.page.getByRole('button', { name: 'Só trajeto' }).click();
    ok('marcador da deriva no mapa', await M.page.locator('.trackmap svg g[aria-label="A deriva começa no km 14"]').count() === 1);
    if (SHOTS) {
      await M.page.screenshot({ path: resolve(SHOTS, 'meia-390-mapa.png') });
      await M.page.getByRole('button', { name: 'Reproduzir o trajeto' }).click();
      await M.page.waitForTimeout(4500);
      await M.page.getByRole('button', { name: 'Pausar o replay' }).click();
      await M.page.screenshot({ path: resolve(SHOTS, 'replay-meia-390.png') });
    }
  }
  if (fitMeia) {
    console.log('\n== desempenho: leitura da Meia (trajeto 1 Hz) ==');
    const medir = () => M.page.evaluate(async (bytes) => {
      const SDK = await import('/node_modules/@garmin/fitsdk/src/index.js');
      const { buildTrack } = await import('/analise/app/track.ts');
      const { computeLeitura } = await import('/analise/leitura.mjs');
      const { lapsFromMessages } = await import('/analise/laps.mjs');
      const E = await import('/analise/engine.mjs');
      const m = new SDK.Decoder(SDK.Stream.fromByteArray(new Uint8Array(bytes))).read().messages;
      const w = { ...E.fitMessagesToWorkout(m), type: 'longão' }, tr = buildTrack(m), laps = lapsFromMessages(m);
      computeLeitura({ w, tr, laps, wind: { kmh: 16, de: 10 }, athlete: {} });
      const t0 = performance.now(); for (let i = 0; i < 5; i++) computeLeitura({ w, tr, laps, wind: { kmh: 16, de: 10 }, athlete: {} });
      return { ms: (performance.now() - t0) / 5, pts: tr.t.length };
    }, [...fitMeia]);
    const r1 = await medir();
    const cdp = await M.ctx.newCDPSession(M.page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const r4 = await medir(); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    ok('Meia: leitura em ≤ 300 ms (CPU 4× mais lenta, simulando celular)', r4.ms <= 300, r1.ms.toFixed(0) + ' ms normal · ' + r4.ms.toFixed(0) + ' ms a 4× · ' + r1.pts + ' pontos');
  }
  console.log('\n== Hoje, Progresso e Livro ==');
  await M.page.goto(`http://localhost:${PORT}/analise/#/hoje`);
  await M.page.waitForSelector('.card.historia');
  ok('Hoje: "Último treino · história" com 3 linhas', (await M.page.locator('.card.historia li').count()) === 3 && await M.page.locator('text=/Último treino · história/').count() === 1);
  if (SHOTS) { await M.page.locator('.card.historia').scrollIntoViewIfNeeded(); await M.page.screenshot({ path: resolve(SHOTS, 'hoje-390.png') }); }
  await M.page.goto(`http://localhost:${PORT}/analise/#/progresso`);
  await M.page.waitForSelector('text=Melhores esforços');
  ok('Progresso: melhores esforços do período', (await M.page.locator('.esforcos li').count()) >= 3, (await M.page.locator('.esforcos li').count()) + ' distâncias');
  ok('Progresso: curva pessoal da subida', await M.page.locator('text=/Custo da subida · sua curva/').count() === 1);
  if (SHOTS) { await M.page.locator('text=Melhores esforços').first().scrollIntoViewIfNeeded(); await M.page.screenshot({ path: resolve(SHOTS, 'progresso-390.png') }); }
  await M.page.goto(`http://localhost:${PORT}/analise/#/mais/livro`);
  ok('Livro: seção Leitura do treino com 7 verbetes', await M.page.locator('h2:has-text("Leitura do treino") + details, h2:has-text("Leitura do treino") ~ details').count() === 7);
  ok('sem erro de página', !M.errors.length, M.errors[0]);

  if (SHOTS) {
    const state = await M.page.evaluate(() => localStorage.getItem('apex.analise.v1'));
    const D = await device(1440, 900, state);
    // o trajeto completo fica no IndexedDB do aparelho M: reimporta no D para os prints
    await importa(D.page, 'tiros.fit', fitTiros).catch(() => null);
    const ids = await D.page.evaluate(() => JSON.parse(localStorage.getItem('apex.analise.v1')).workouts.filter((w) => w.leitura && w.leitura.tiros).map((w) => w.id));
    await D.page.goto(`http://localhost:${PORT}/analise/#/treino/${ids[ids.length - 1]}`);
    await D.page.waitForSelector('.tv-panel'); await D.page.waitForTimeout(1500);
    await D.page.screenshot({ path: resolve(SHOTS, 'tiros-1440.png') });
    await D.page.locator('text=/Tiros · /').first().scrollIntoViewIfNeeded(); await D.page.waitForTimeout(200);
    await D.page.screenshot({ path: resolve(SHOTS, 'tiros-1440-2.png') });
    await D.page.goto(`http://localhost:${PORT}/analise/#/progresso`); await D.page.waitForSelector('text=Melhores esforços');
    await D.page.locator('text=Melhores esforços').first().scrollIntoViewIfNeeded();
    await D.page.screenshot({ path: resolve(SHOTS, 'progresso-1440.png') });
    // tema claro
    await M.page.evaluate(() => localStorage.setItem('apex.theme', 'light'));
    await M.page.goto(`http://localhost:${PORT}/analise/#/treino/${idT}`); await M.page.reload(); await M.page.waitForSelector('.tv-panel');
    await M.page.locator('.tv-handle').click(); await M.page.locator('.tv-handle').click(); await M.page.waitForTimeout(400);
    await M.page.locator('text=/Tiros · /').first().scrollIntoViewIfNeeded(); await M.page.locator('.tv-panel-in').evaluate((el) => el.scrollBy(0, -60));
    await M.page.screenshot({ path: resolve(SHOTS, 'tiros-390-claro.png') });
  }
} catch (e) { ok('execução sem exceção', false, e && e.message); }
finally { await browser.close(); vite.kill(); }
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
