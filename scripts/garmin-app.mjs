// Teste do app com o Garmin SIMULADO (Fase 2 · Etapa 2), num Chromium real.
// A função "garmin" é interceptada: as atividades e os .FIT são sintéticos (gerados com o
// encoder oficial do Garmin). Confere:
//  - critério 5: atividade nova aparece em "Para completar" com 3 números; Completar abre
//    o passo 3 preenchido (com o RPE do Garmin); depois de salvar sai da fila e ganha o selo;
//  - critério 6: um treino já importado à mão não duplica ("já existia") e é ligado ao Garmin;
//  - antigos (> 14 dias) entram salvos direto, com o RPE do Garmin; notas atualizadas;
//  - critério 7: salvo no outro aparelho → sai da fila;
//  - critério 8: sem internet / chave vencida / Garmin fora: o app abre e avisa sem insistir;
//  - critério 9: aviso de vencimento 30 dias antes (data simulada);
//  - critério 17: com pendências, "Completar treino" é a ação magenta e o "+" fica em contorno.
// Uso: node scripts/garmin-app.mjs
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_NOW, GOLDEN_TZ } from '../analise/golden/env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const payload = readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8');
const P = JSON.parse(payload);
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };

// ---------------- .FIT sintéticos ----------------
const { Encoder, Profile } = await import('@garmin/fitsdk');
function fit(startIso, km, min, hr) {
  const enc = new Encoder(), st = new Date(startIso), N = min * 60, v = km * 1000 / N;
  enc.onMesg(Profile.MesgNum.FILE_ID, { manufacturer: 'development', product: 1, timeCreated: st, type: 'activity' });
  for (let i = 0; i <= N; i += 1) enc.onMesg(Profile.MesgNum.RECORD, { timestamp: new Date(st.getTime() + i * 1000), distance: v * i, enhancedSpeed: v, heartRate: hr, enhancedAltitude: 900, cadence: 84 });
  enc.onMesg(Profile.MesgNum.SESSION, { timestamp: new Date(st.getTime() + N * 1000), startTime: st, sport: 'running', totalDistance: km * 1000, totalTimerTime: N, totalElapsedTime: N, avgHeartRate: hr, maxHeartRate: hr + 10 });
  return new Uint8Array(enc.close()); // a função já devolve o .fit descompactado
}
// "hoje" do teste = GOLDEN_NOW (19/11/2026). syn21 = 12/11, 8,97 km, 52 min (importado à mão)
const ACTS = [
  { id: '7001', inicio: '2026-11-12 09:30:00', inicioLocal: '2026-11-12 06:30:00', tipo: 'corrida', duracaoS: 3120, distanciaM: 8970, rpe: 40 },  // = syn21 (RPE 5 no app) → já existia; nota do Garmin = 4
  { id: '7002', inicio: '2026-11-18 09:00:00', inicioLocal: '2026-11-18 06:00:00', tipo: 'corrida', duracaoS: 2400, distanciaM: 6000, rpe: 70 },  // novo, recente → fila
  { id: '7003', inicio: '2026-08-20 09:00:00', inicioLocal: '2026-08-20 06:00:00', tipo: 'corrida', duracaoS: 1800, distanciaM: 5000, rpe: 30 },  // novo, antigo → salvo direto
];
const FITS = { '7002': fit('2026-11-18T09:00:00Z', 6, 40, 150), '7003': fit('2026-08-20T09:00:00Z', 5, 30, 145) };

const PORT = 5214;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, VITE_SUPABASE_URL: 'https://teste.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-teste' } });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
const calls = [];
let mode = { status: 'ok', keyDays: 360, listErr: null, offline: false };
async function page0(state = payload) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: GOLDEN_TZ, locale: 'pt-BR' });
  await ctx.addInitScript((p) => { if (!sessionStorage.getItem('__g')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', p); localStorage.setItem('apex.analise.synccode', 'ABCD-EFGH-JKLM-NPQR'); localStorage.setItem('apex.theme', 'dark'); sessionStorage.setItem('__g', '1'); } }, state);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.route(/^https:\/\/(?!teste\.supabase\.co)/, (r) => r.abort()); // nada de rede externa (clima etc.)
  await page.route('https://teste.supabase.co/**', async (r) => {
    const u = r.request().url();
    if (!u.includes('/functions/v1/garmin')) return r.fulfill({ contentType: 'application/json', body: '[]' });
    if (mode.offline) return r.abort();
    const b = JSON.parse(r.request().postData() || '{}'); calls.push(b.action);
    const J = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (b.action === 'status') return J({ conectado: true, status: mode.status, keyExpiresAt: new Date(Date.parse(GOLDEN_NOW) + mode.keyDays * 86400000).toISOString(), filtros: { corrida: true, bike: true } });
    if (b.action === 'list') return mode.listErr ? J({ erro: mode.listErr, mensagem: 'O Garmin está fora do ar agora.', retryAt: GOLDEN_NOW }, 503) : J({ atividades: ACTS.map(({ rpe, ...a }) => a) });
    if (b.action === 'rpe') return J({ notas: b.activityIds.map((id) => ({ id, rpe: (ACTS.find((a) => a.id === id) || {}).rpe ?? null, feel: 75 })) });
    if (b.action === 'fit') return r.fulfill({ contentType: 'application/octet-stream', body: Buffer.from(FITS[b.activityId] || []) });
    return J({ ok: true });
  });
  return { ctx, page, errors };
}
const st = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('apex.analise.v1')));
const fila = (page) => page.evaluate(() => new Promise((res) => { const rq = indexedDB.open('apex-performance'); rq.onsuccess = () => { const g = rq.result.transaction('garminQueue').objectStore('garminQueue').getAllKeys(); g.onsuccess = () => res(g.result); }; }));
const waitSync = (page) => page.waitForFunction(() => { try { const l = JSON.parse(localStorage.getItem('apex.garmin.v1') || '{}'); return !!(l.resumo || l.erro); } catch { return false; } }, null, { timeout: 30000 });

try {
  console.log('\n== importação automática ==');
  let { ctx, page, errors } = await page0();
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/analise/#/hoje`);
  await page.waitForSelector('.main > *');
  ok('a tela abre antes da sincronização (não espera o Garmin)', calls.length === 0, (Date.now() - t0) + ' ms');
  await waitSync(page);
  const s1 = await st(page);
  const q1 = await fila(page);
  ok('critério 5 · atividade nova (recente) vai para "Para completar"', JSON.stringify(q1) === JSON.stringify(['7002']), JSON.stringify(q1));
  ok('fila fica FORA de apex.analise.v1 (KPIs só com treinos salvos)', !s1.workouts.some((w) => w.garminActivityId === '7002'));
  const old = s1.workouts.find((w) => w.garminActivityId === '7003');
  ok('antigo (> 14 dias) entra salvo direto, com o RPE do Garmin (30 → 3)', old && old.rpe === 3 && old.date === '2026-08-20', old ? old.date + ' · RPE ' + old.rpe : 'não salvo');
  const s21 = s1.workouts.find((w) => w.id === 'syn21');
  ok('critério 6 · treino importado à mão é reconhecido e ligado (não duplica)', s21.garminActivityId === '7001' && s1.workouts.filter((w) => w.date === '2026-11-12').length === 1);
  ok('nota do Garmin atualiza o RPE do treino já salvo (5 → 4)', s21.rpe === 4, 'RPE ' + s21.rpe);
  const loc = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.garmin.v1')));
  ok('resumo da primeira sincronização', loc.resumo.novos === 2 && loc.resumo.existiam === 1, JSON.stringify({ novos: loc.resumo.novos, existiam: loc.resumo.existiam, fila: loc.resumo.fila, salvos: loc.resumo.salvos }));
  ok('a chave não está no aparelho (localStorage/IndexedDB)', !(await page.evaluate(() => JSON.stringify(localStorage))).includes('ApiKey'));
  await page.waitForSelector('#pc-titulo');
  ok('Hoje: "Para completar · 1 do Garmin" com os 3 números', /Para completar · 1 do Garmin/.test(await page.locator('#pc-titulo').innerText()) && /6,00 km · 6:40\/km · 150 bpm/.test(await page.locator('.pc-item').innerText()), (await page.locator('.pc-item').innerText()).replace(/\n/g, ' | '));
  const mag = await page.evaluate(() => [...document.querySelectorAll('.main .btn-primary')].filter((e) => e.getBoundingClientRect().width).map((e) => e.textContent.trim()));
  const plus = await page.evaluate(() => getComputedStyle(document.querySelector('.bottomnav .plus')).backgroundColor);
  ok('critério 17 · ação magenta = "Completar treino" e o "+" vira contorno', mag.length === 1 && mag[0] === 'Completar treino' && /rgba\(0, 0, 0, 0\)|transparent/.test(plus), mag.join(',') + ' · + ' + plus);
  await page.getByRole('link', { name: 'Completar treino' }).click();
  await page.waitForSelector('text=Arquivo lido');
  ok('Completar abre o passo 3 preenchido, com o RPE do Garmin (70 → 7)', await page.getByRole('button', { name: '7', exact: true }).getAttribute('aria-pressed') === 'true');
  await page.getByLabel('Sono na véspera (h)').fill('7.5');
  await page.getByRole('button', { name: 'Salvar treino' }).click();
  await page.waitForFunction(() => /#\/treino\//.test(location.hash));
  const s2 = await st(page), w2 = s2.workouts.find((w) => w.garminActivityId === '7002');
  ok('depois de salvar: sai da fila e entra nos treinos com o selo Garmin', (await fila(page)).length === 0 && w2 && w2.rpe === 7 && w2.sleepH === 7.5, w2 ? 'RPE ' + w2.rpe + ' · sono ' + w2.sleepH : '');
  await page.goto(`http://localhost:${PORT}/analise/#/treinos`); await page.waitForSelector('.item-row');
  const badges = await page.locator('.badge.origem').allInnerTexts();
  ok('Treinos: selos "Garmin" e ".FIT manual"', badges.includes('Garmin') && badges.includes('.FIT manual'), [...new Set(badges)].join(', '));
  ok('Treinos: "sincronizado há X min" na contagem', /sincronizado/.test(await page.locator('.topbar .sub').innerText()), await page.locator('.topbar .sub').innerText());
  ok('sem erro de página', !errors.length, errors[0]);
  // segunda sincronização na mesma hora: não chama o Garmin de novo (no máximo a cada 15 min)
  const n0 = calls.length; await page.reload(); await page.waitForSelector('.main > *'); await page.waitForTimeout(2600);
  ok('reabrir antes de 15 min não chama o Garmin de novo', calls.length === n0, (calls.length - n0) + ' chamadas');
  await ctx.close();

  console.log('\n== dois aparelhos (critério 7) ==');
  ({ ctx, page } = await page0());
  await page.goto(`http://localhost:${PORT}/analise/#/hoje`); await waitSync(page);
  ok('aparelho B: o mesmo treino está na fila', JSON.stringify(await fila(page)) === '["7002"]');
  // o aparelho A salvou: a sincronização traz o treino com o mesmo garminActivityId
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('apex.analise.v1')); s.workouts.push({ id: 'deA', date: '2026-11-18', modal: 'corrida', type: 'facil', distKm: 6, durationSec: 2400, hrAvg: 150, rpe: 7, garminActivityId: '7002', updatedAt: new Date().toISOString() }); localStorage.setItem('apex.analise.v1', JSON.stringify(s)); localStorage.setItem('apex.garmin.v1', '{}'); });
  await page.reload(); await page.waitForSelector('.main > *'); await waitSync(page); await page.waitForTimeout(500);
  ok('depois da sincronização, sai da fila do aparelho B', (await fila(page)).length === 0);
  await ctx.close();

  console.log('\n== avisos sem travar (critérios 8 e 9) ==');
  mode = { status: 'ok', keyDays: 20, listErr: null, offline: false };
  ({ ctx, page, errors } = await page0());
  await page.goto(`http://localhost:${PORT}/analise/#/hoje`); await waitSync(page); await page.waitForTimeout(300); await page.reload(); await page.waitForSelector('.main > *');
  ok('critério 9 · chave vence em 20 dias: aviso no Hoje', /vence em 20 dias/.test(await page.locator('.main').innerText()));
  await ctx.close();
  mode = { status: 'chave_vencida', keyDays: -2, listErr: null, offline: false };
  ({ ctx, page, errors } = await page0());
  await page.goto(`http://localhost:${PORT}/analise/#/hoje`); await waitSync(page); await page.reload(); await page.waitForSelector('.main > *');
  ok('chave vencida: o app abre e mostra "Renovar chave"', (await page.getByRole('link', { name: 'Renovar chave' }).count()) === 1 && !errors.length);
  await ctx.close();
  mode = { status: 'ok', keyDays: 360, listErr: 'garmin_fora', offline: false };
  ({ ctx, page, errors } = await page0());
  await page.goto(`http://localhost:${PORT}/analise/#/hoje`); await waitSync(page);
  const e1 = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.garmin.v1')).erro);
  ok('Garmin fora do ar: abre normal, aviso discreto, sem repetir', e1 && e1.codigo === 'garmin_fora' && !errors.length && (await page.locator('.ready').count()) === 1, e1 && e1.msg);
  await ctx.close();
  mode = { status: 'ok', keyDays: 360, listErr: null, offline: true };
  ({ ctx, page, errors } = await page0());
  const nOff = calls.length;
  await page.goto(`http://localhost:${PORT}/analise/#/hoje`); await page.waitForSelector('.main > *'); await page.waitForTimeout(3500);
  const l2 = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.garmin.v1') || '{}'));
  ok('sem internet: abre normal, em silêncio, e tenta de novo na próxima abertura', !l2.erro && !l2.lastRun && !errors.length && calls.length === nOff);
  await ctx.close();
} finally { await browser.close(); vite.kill(); }
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
