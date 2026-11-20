// Trajeto nos dois aparelhos (Fase 2 · Etapa 3), num Chromium real, com o Supabase e o
// Garmin SIMULADOS em memória. Confere:
//  - critério 10: um treino importado no aparelho A mostra mapa, replay e gráfico no B (e o
//    contrário); a versão leve sobe com até 30 KB; fotos não sobem;
//  - excluir o treino apaga o trajeto do servidor;
//  - critério 11: "Buscar trajeto dos treinos antigos" acrescenta o trajeto sem mudar nenhum
//    número do treino (comparação byte a byte).
// Uso: node scripts/tracks-app.mjs
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
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };

const { Encoder, Profile } = await import('@garmin/fitsdk');
const SEMI = 2147483648 / 180;
function gpsFit(startIso, N, lat0 = -25.39, lon0 = -51.46) {
  const enc = new Encoder(), st = new Date(startIso);
  enc.onMesg(Profile.MesgNum.FILE_ID, { manufacturer: 'development', product: 1, timeCreated: st, type: 'activity' });
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * 2 * Math.PI;
    enc.onMesg(Profile.MesgNum.RECORD, { timestamp: new Date(st.getTime() + i * 1000), distance: 2.86 * i, enhancedSpeed: 2.86, heartRate: 140 + (i % 20), enhancedAltitude: 1000 + 20 * Math.sin(a), cadence: 85, positionLat: Math.round((lat0 + 0.0085 * Math.sin(a)) * SEMI), positionLong: Math.round((lon0 + 0.0094 * Math.cos(a)) * SEMI) });
  }
  enc.onMesg(Profile.MesgNum.SESSION, { timestamp: new Date(st.getTime() + N * 1000), startTime: st, sport: 'running', totalDistance: 2.86 * N, totalTimerTime: N, totalElapsedTime: N, avgHeartRate: 150, maxHeartRate: 160 });
  return Buffer.from(enc.close());
}
const fitA = gpsFit('2026-11-18T09:00:00Z', 2100);
const fitOld = gpsFit('2024-03-07T09:00:00Z', 1800);

// "servidor" em memória: analise_sync + analise_tracks
const server = { sync: null, tracks: new Map(), calls: [] };
const PORT = 5215;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, VITE_SUPABASE_URL: 'https://teste.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-teste' } });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
async function device(state) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: GOLDEN_TZ, locale: 'pt-BR' });
  await ctx.addInitScript((p) => { if (!sessionStorage.getItem('__d')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', p); localStorage.setItem('apex.analise.synccode', 'ABCD-EFGH-JKLM-NPQR'); localStorage.setItem('apex.garmin.v1', JSON.stringify({ lastRun: new Date().toISOString() })); sessionStorage.setItem('__d', '1'); } }, state);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.route(/^https:\/\/(?!teste\.supabase\.co)/, (r) => r.abort());
  await page.route('https://teste.supabase.co/**', async (r) => {
    const u = r.request().url(); const b = JSON.parse(r.request().postData() || '{}');
    const J = (o) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
    const fn = (u.match(/rpc\/([a-z_]+)/) || [])[1]; if (fn) server.calls.push(fn);
    if (fn === 'analise_sync_get') return J(server.sync ? [{ payload: server.sync, updated_at: new Date().toISOString() }] : []);
    if (fn === 'analise_sync_put') { server.sync = b.p_payload; return J(new Date().toISOString()); }
    if (fn === 'analise_tracks_put') { server.tracks.set(b.p_workout_id, b.p_payload); return J(new Date().toISOString()); }
    if (fn === 'analise_tracks_index') return J([...server.tracks.keys()].map((k) => ({ workout_id: k, updated_at: GOLDEN_NOW })));
    if (fn === 'analise_tracks_get') return J(b.p_ids.filter((k) => server.tracks.has(k)).map((k) => ({ workout_id: k, payload: server.tracks.get(k), updated_at: GOLDEN_NOW })));
    if (fn === 'analise_tracks_delete') { server.tracks.delete(b.p_workout_id); return J(null); }
    if (u.includes('/functions/v1/garmin')) {
      if (b.action === 'status') return J({ conectado: true, status: 'ok', keyExpiresAt: '2027-11-20T00:00:00Z', filtros: { corrida: true, bike: true } });
      if (b.action === 'fit') return r.fulfill({ contentType: 'application/octet-stream', body: fitOld });
      return J({ atividades: [] });
    }
    return J([]);
  });
  return { ctx, page, errors };
}

try {
  console.log('\n== aparelho A importa um treino com GPS ==');
  const A = await device(payload);
  await A.page.goto(`http://localhost:${PORT}/analise/#/importar`);
  await A.page.setInputFiles('#fitFile', { name: 'a.fit', mimeType: 'application/octet-stream', buffer: fitA });
  await A.page.waitForSelector('h1:has-text("Conferência")', { timeout: 15000 });
  await A.page.getByRole('button', { name: 'Continuar' }).click();
  await A.page.getByRole('button', { name: 'Salvar treino' }).click();
  await A.page.waitForFunction(() => /#\/treino\//.test(location.hash));
  const idA = await A.page.evaluate(() => location.hash.split('/').pop());
  await A.page.waitForFunction(() => true); await A.page.waitForTimeout(2500);
  const L = server.tracks.get(idA);
  const kb = L ? Buffer.byteLength(JSON.stringify(L)) / 1024 : 0;
  ok('a versão leve sobe para o servidor ao salvar', !!L && L.leve === true && L.route && L.route.lat.length >= 20 && L.route.lat.length <= 400, kb.toFixed(1) + ' KB · ' + (L && L.route ? L.route.lat.length : 0) + ' pontos');
  ok('versão leve com até 30 KB', kb > 0 && kb <= 30);
  ok('fotos não sobem (nada além de sync e trajeto)', server.calls.every((c) => /^analise_(sync|tracks)_/.test(c)), [...new Set(server.calls)].join(', '));
  const stA = await A.page.evaluate(() => localStorage.getItem('apex.analise.v1'));

  console.log('\n== aparelho B (mesmo código, sem o trajeto local) ==');
  const B = await device(stA);
  await B.page.goto(`http://localhost:${PORT}/analise/#/treino/${idA}`);
  await B.page.waitForSelector('.trackmap > svg polyline', { timeout: 20000 });
  const segs = await B.page.locator('.trackmap > svg polyline').count();
  const marks = await B.page.locator('.trackmap > svg g text').count();
  ok('critério 10 · no B o Treino mostra o mapa (versão leve)', segs >= 2 && marks >= 5, segs + ' trechos · ' + marks + ' marcos de km');
  ok('replay e gráfico funcionam com a versão leve', (await B.page.locator('.tv-panel input[type="range"]').count()) === 1 && (await B.page.locator('.tv-panel svg[role="slider"]').count()) === 1);
  ok('sem erro de página no B', !B.errors.length, B.errors[0]);

  console.log('\n== o contrário: B importa, A vê ==');
  await B.page.goto(`http://localhost:${PORT}/analise/#/importar`);
  const fitB = gpsFit('2026-11-16T09:00:00Z', 1500, -25.40, -51.47);
  await B.page.setInputFiles('#fitFile', { name: 'b.fit', mimeType: 'application/octet-stream', buffer: fitB });
  await B.page.waitForSelector('h1:has-text("Conferência")', { timeout: 15000 });
  await B.page.getByRole('button', { name: 'Continuar' }).click();
  await B.page.getByRole('button', { name: 'Salvar treino' }).click();
  await B.page.waitForFunction(() => /#\/treino\//.test(location.hash));
  const idB = await B.page.evaluate(() => location.hash.split('/').pop());
  await B.page.waitForTimeout(2500);
  const stB = await B.page.evaluate(() => localStorage.getItem('apex.analise.v1'));
  await A.page.evaluate((s) => localStorage.setItem('apex.analise.v1', s), stB);
  await A.page.goto(`http://localhost:${PORT}/analise/#/hoje`); await A.page.reload(); await A.page.waitForSelector('.main > *');
  await A.page.goto(`http://localhost:${PORT}/analise/#/treino/${idB}`);
  await A.page.waitForSelector('.trackmap > svg polyline', { timeout: 15000 });
  ok('critério 10 · o treino importado no B aparece com mapa no A', (await A.page.locator('.trackmap > svg polyline').count()) >= 2);

  console.log('\n== excluir apaga do servidor ==');
  await A.page.goto(`http://localhost:${PORT}/analise/#/treino/${idA}`);
  await A.page.waitForSelector('.tv-top');
  A.page.once('dialog', (d) => d.accept());
  await A.page.getByRole('button', { name: 'Mais opções do treino' }).first().click();
  await A.page.getByRole('button', { name: 'Excluir' }).click();
  await A.page.waitForTimeout(800);
  ok('excluir o treino apaga o trajeto dele no servidor', !server.tracks.has(idA));

  console.log('\n== buscar trajeto dos treinos antigos (Garmin) ==');
  const P = JSON.parse(payload);
  P.workouts.push({ id: 'velho1', date: '2024-03-07', modal: 'corrida', type: 'facil', distKm: 5.15, durationSec: 1800, hrAvg: 150, rpe: null, garminActivityId: '555', updatedAt: '2026-11-19T00:00:00Z' });
  server.sync = null; // aparelho C isolado: a sincronização do estado não mistura os testes
  const C = await device(JSON.stringify(P));
  await C.page.goto(`http://localhost:${PORT}/analise/#/mais/garmin`);
  await C.page.waitForSelector('text=Buscar trajeto dos treinos antigos'); await C.page.waitForTimeout(1500);
  const antes = await C.page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('apex.analise.v1')).workouts));
  await C.page.getByRole('button', { name: /Buscar trajeto dos treinos antigos/ }).click();
  await C.page.waitForFunction(() => /Todos os treinos do Garmin já têm trajeto/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  // Fase 2 · Etapa 5: o treino ganha só o campo novo e opcional `leitura` (e a marca de
  // atualização, para sincronizar). Todo o resto tem de ser igual, byte a byte.
  const depoisW = await C.page.evaluate(() => JSON.parse(localStorage.getItem('apex.analise.v1')).workouts);
  const velho = depoisW.find((w) => w.id === 'velho1');
  const ganhouLeitura = !!(velho && velho.leitura && velho.leitura.v === 1);
  const depois = JSON.stringify(depoisW.map((w) => { if (w.id !== 'velho1') return w; const { leitura, updatedAt, ...r } = w; const orig = JSON.parse(antes).find((x) => x.id === 'velho1'); return { ...r, updatedAt: orig.updatedAt }; }));
  const tem = await C.page.evaluate(() => new Promise((res) => { const rq = indexedDB.open('apex-performance'); rq.onsuccess = () => { const g = rq.result.transaction('tracks').objectStore('tracks').get('velho1'); g.onsuccess = () => res(!!g.result); }; }));
  ok('trajeto do treino antigo acrescentado (e subiu para o servidor)', tem && server.tracks.has('velho1'));
  ok('critério 11 · nenhum número do treino mudou (byte a byte, fora o campo novo leitura)', antes === depois);
  ok('etapa 5 · o treino ganhou a leitura (v1) calculada com o trajeto completo', ganhouLeitura);
  for (const d of [A, B, C]) await d.ctx.close();
} finally { await browser.close(); vite.kill(); }
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
