// Ciclo de prova e percurso (Fase 4 · Etapa 2) num Chromium real. Percursos sintéticos
// (GPX e .FIT gerados aqui; nenhum valor das telas de design). Confere os critérios 2, 4, 5 e 6
// pela tela, o salvamento em race.course (que sincroniza com o ciclo) e tira prints em 390 e
// 1440 px se SHOTS apontar uma pasta.  Uso: node scripts/ciclo-app.mjs
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_NOW, GOLDEN_TZ } from '../analise/golden/env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const payload = readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8');
const SHOTS = process.env.SHOTS || null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };

// percurso de teste: circuito de ~42 km com uma subida no meio
const M_GRAU = 111195;
function pontos(km, lat0 = -25.43, lon0 = -49.27, passo = 20) {
  const out = [];
  for (let x = 0; x <= km * 1000 + 1e-6; x += passo) {
    const a = (x / (km * 1000)) * 2 * Math.PI, r = (km * 1000) / (2 * Math.PI);
    const k = x / 1000, ele = 900 + Math.min(Math.max(k - 12, 0), 3) * 35 - Math.min(Math.max(k - 30, 0), 3) * 35;
    out.push({ lat: lat0 + (r * Math.sin(a)) / M_GRAU, lon: lon0 + (r * (1 - Math.cos(a))) / (M_GRAU * Math.cos((lat0 * Math.PI) / 180)), ele, x });
  }
  return out;
}
const gpx = (pts) => '<?xml version="1.0"?><gpx version="1.1" creator="teste"><trk><name>Percurso de teste</name><trkseg>' + pts.map((p) => `<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"><ele>${p.ele.toFixed(1)}</ele></trkpt>`).join('') + '</trkseg></trk></gpx>';
const { Encoder, Profile } = await import('@garmin/fitsdk');
const SEMI = 2147483648 / 180;
function fit(pts, startIso, baro) {
  const enc = new Encoder(), st = new Date(startIso);
  enc.onMesg(Profile.MesgNum.FILE_ID, { manufacturer: 'development', product: 1, timeCreated: st, type: 'activity' });
  if (baro) enc.onMesg(Profile.MesgNum.DEVICE_INFO, { timestamp: st, deviceIndex: 1, deviceType: 4, sourceType: 'local' });
  const x0 = pts[0].x;
  pts.forEach((p, i) => enc.onMesg(Profile.MesgNum.RECORD, { timestamp: new Date(st.getTime() + i * 4000), distance: p.x - x0, enhancedSpeed: 5, enhancedAltitude: p.ele, positionLat: Math.round(p.lat * SEMI), positionLong: Math.round(p.lon * SEMI) }));
  const n = pts.length - 1;
  enc.onMesg(Profile.MesgNum.SESSION, { timestamp: new Date(st.getTime() + n * 4000), startTime: st, sport: 'cycling', totalDistance: pts[n].x - x0, totalTimerTime: n * 4, totalElapsedTime: n * 4 });
  return Buffer.from(enc.close());
}

const PORT = 5217;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
async function device(w, h, state = payload) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: GOLDEN_TZ, locale: 'pt-BR', deviceScaleFactor: SHOTS ? 2 : 1 });
  await ctx.addInitScript((p) => { if (!sessionStorage.getItem('__d')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', p); sessionStorage.setItem('__d', '1'); } }, state);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => { page.__dialogs = (page.__dialogs || []).concat(d.message()); d.accept(); });
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.route(/^https:\/\//, (r) => r.abort());
  return { ctx, page, errors };
}
const race = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('apex.analise.v1')).race);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: resolve(SHOTS, name), fullPage: true }); };

try {
  console.log('\n== ciclo antigo (critério 2) ==');
  const M = await device(390, 844);
  await M.page.goto(`http://localhost:${PORT}/analise/#/mais/maratona`);
  await M.page.waitForSelector('text=Resumo do ciclo');
  ok('critério 2 · ciclo sem os campos novos abre como antes', await M.page.locator('text=Terminar bem').count() > 0 && await M.page.locator('text=Sem percurso').count() === 1);
  await M.page.getByRole('link', { name: 'Editar ciclo', exact: true }).click();
  await M.page.waitForSelector('h1:has-text("Editar ciclo")');
  await shot(M.page, 'editar-390.png');

  console.log('\n== Editar ciclo ==');
  await M.page.getByRole('radio', { name: 'Tempo-alvo' }).click();
  await M.page.fill('#c_alvo', '4:50');
  const pm = await M.page.locator('text=/pace médio/').innerText();
  ok('pace médio ao vivo (4:50 em 42,195 km = 6:52/km)', /6:52\/km/.test(pm), pm);
  await M.page.getByText('Segunda metade mais rápida').click();
  await M.page.fill('#c_hora', '07:00');
  await shot(M.page, 'editar-390-alvo.png');
  await M.page.getByRole('button', { name: 'Salvar ciclo' }).click();
  await M.page.waitForSelector('text=Resumo do ciclo');
  let r = await race(M.page);
  ok('grava goal "time", targetSec, strategy e startTime (campos novos)', r.goal === 'time' && r.targetSec === 17400 && r.strategy === 'negativa' && r.startTime === '07:00', JSON.stringify({ goal: r.goal, targetSec: r.targetSec, strategy: r.strategy, startTime: r.startTime }));
  ok('os campos antigos ficam como estavam', r.name === 'Maratona de Curitiba' && r.distKm === 42.195 && r.longRunTargetKm === 30 && r.peakKmTarget === 50 && r.objective === 'terminar inteiro');
  ok('a data de atualização do ciclo muda (vai para a sincronização)', r.updatedAt > '2026-09-07T00:00:00Z');
  ok('o card do ciclo mostra a meta e a estratégia', await M.page.locator('text=Tempo-alvo 4h50').count() === 1 && await M.page.locator('text=segunda metade mais rápida').count() === 1);

  console.log('\n== Percurso: GPX com 1,4% a menos (critério 5) ==');
  await M.page.goto(`http://localhost:${PORT}/analise/#/mais/percurso`);
  await M.page.waitForSelector('text=Com o percurso, o plano ajusta o pace a cada subida.');
  await shot(M.page, 'percurso-vazio-390.png');
  const curto = pontos(42.195 * 0.986);
  await M.page.locator('input[type=file]').setInputFiles({ name: 'prova.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(gpx(curto)) });
  await M.page.waitForSelector('text=Conferir o percurso');
  ok('sem dúvida: a revisão mostra o total e a diferença', await M.page.locator('text=/−1,4%/').count() > 0, await M.page.locator('.card .apoio.tn').first().innerText());
  await M.page.getByRole('button', { name: 'Salvar percurso' }).click();
  await M.page.waitForSelector('text=/Trecho mais duro/');
  r = await race(M.page);
  ok('critério 5 · 1,4%: ajusta à oficial e avisa, sem perguntar', r.course && r.course.ajustado && r.course.diffPct === -1.4 && await M.page.locator('text=/ajustado à distância oficial/').count() > 0, r.course && r.course.diffPct + '%');
  ok('GPX = confiança Alta', r.course.confianca === 'Alta' && await M.page.locator('text=Confiança alta').count() > 0);
  const kb = Buffer.byteLength(JSON.stringify(r.course)) / 1024;
  ok('percurso salvo no ciclo com até 30 KB', kb <= 30, kb.toFixed(1) + ' KB');
  const tit = await M.page.locator('h2:has-text("Trecho mais duro")').innerText();
  ok('título "Trecho mais duro" na subida do teste (km 13 ao 15)', /do km 1[23] ao 15/.test(tit), tit);
  ok('mapa e perfil com texto para leitor de tela', await M.page.locator('.course-map svg[role="img"]').count() === 1 && await M.page.locator('svg[aria-label^="Perfil do percurso"]').count() === 1);
  await shot(M.page, 'percurso-390.png');

  console.log('\n== Trocar: gravação em 2 partes com 3% a mais (critérios 4 e 5) ==');
  await M.page.getByRole('button', { name: 'Trocar percurso' }).click();
  await M.page.getByText('Reconhecimento gravado').click();
  const longo = pontos(42.195 * 1.03);
  const meio = Math.floor(longo.length / 2);
  const p1 = fit(longo.slice(0, meio + 1), '2026-12-12T08:00:00Z', true), p2 = fit(longo.slice(meio), '2026-12-14T08:00:00Z', true);
  await M.page.locator('input[type=file]').setInputFiles([{ name: 'parte2.fit', mimeType: 'application/octet-stream', buffer: p2 }, { name: 'parte1.fit', mimeType: 'application/octet-stream', buffer: p1 }]);
  await M.page.waitForSelector('text=Conferir o percurso');
  const linhas = await M.page.locator('ol.partes li').allInnerTexts();
  ok('critério 4 · as partes saem na ordem do horário (12/12 antes de 14/12)', /parte1\.fit/.test(linhas[0]) && /parte2\.fit/.test(linhas[1]), linhas.map((x) => x.split('\n')[0]).join(' | '));
  ok('altímetro barométrico detectado no .FIT', await M.page.locator('text=/com barômetro/').count() === 2 && await M.page.locator('text=moderada').count() > 0);
  await M.page.getByRole('button', { name: 'Salvar percurso' }).click();
  await M.page.waitForSelector('text=Distância diferente da oficial');
  ok('critério 5 · 3%: pergunta antes ("Ajustar mesmo assim" ou "Trocar arquivo")', await M.page.getByRole('button', { name: 'Ajustar mesmo assim' }).count() === 1 && await M.page.getByRole('button', { name: 'Trocar arquivo' }).count() >= 1);
  await shot(M.page, 'percurso-pergunta-390.png');
  await M.page.getByRole('button', { name: 'Ajustar mesmo assim' }).click();
  await M.page.waitForSelector('text=/Trecho mais duro/');
  r = await race(M.page);
  const soma = r.course.partes.reduce((s, p) => s + p.km, 0);
  ok('critério 4 · total gravado = soma das partes', Math.abs(r.course.kmGravados - soma) <= 0.02, r.course.partes.map((p) => p.km).join(' + ') + ' = ' + r.course.kmGravados);
  ok('gravação com barômetro = confiança Moderada', r.course.fonte === 'gravacao' && r.course.confianca === 'Moderada');

  console.log('\n== Digitada (critério 6) ==');
  await M.page.getByRole('button', { name: 'Trocar percurso' }).click();
  await M.page.getByText('Digitar a altimetria').click();
  await M.page.getByRole('button', { name: 'Digitar altimetria' }).click();
  await M.page.waitForSelector('#d_fonte');
  await M.page.fill('#d_s4', '25'); await M.page.fill('#d_d6', '15');
  M.page.__dialogs = [];
  await M.page.getByRole('button', { name: 'Salvar altimetria' }).click();
  await M.page.waitForTimeout(300);
  r = await race(M.page);
  ok('critério 6 · sem fonte: não salva e avisa', r.course.fonte === 'gravacao' && (M.page.__dialogs || []).some((m) => /fonte/i.test(m)));
  await M.page.fill('#d_fonte', 'site oficial da prova');
  await M.page.getByRole('button', { name: 'Salvar altimetria' }).click();
  await M.page.waitForSelector('text=/Trecho mais duro|Percurso plano/');
  r = await race(M.page);
  ok('critério 6 · com fonte: confiança Baixa e a fonte na tela', r.course.fonte === 'digitada' && r.course.confianca === 'Baixa' && await M.page.locator('text=/Fonte: site oficial da prova/').count() === 1 && await M.page.locator('text=Confiança baixa').count() > 0);
  ok('digitada: D+ = soma do que foi digitado', await M.page.locator('.stat .v:has-text("25 m")').count() === 1);
  ok('sem erro de página', !M.errors.length, M.errors[0]);

  if (SHOTS) {
    console.log('\n== prints do computador ==');
    // volta ao GPX para os prints
    const st = await M.page.evaluate(() => localStorage.getItem('apex.analise.v1'));
    const D = await device(1440, 900, st);
    await D.page.goto(`http://localhost:${PORT}/analise/#/mais/ciclo`); await D.page.waitForSelector('h1:has-text("Editar ciclo")');
    await shot(D.page, 'editar-1440.png');
    await D.page.goto(`http://localhost:${PORT}/analise/#/mais/percurso`); await D.page.waitForSelector('text=/Trecho mais duro|Percurso plano/');
    await D.page.getByRole('button', { name: 'Trocar percurso' }).click();
    await D.page.locator('input[type=file]').setInputFiles({ name: 'prova.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(gpx(curto)) });
    await D.page.waitForSelector('text=Conferir o percurso'); await D.page.getByRole('button', { name: 'Salvar percurso' }).click();
    await D.page.waitForSelector('text=/Trecho mais duro/'); await D.page.waitForTimeout(500);
    await shot(D.page, 'percurso-1440.png');
    await D.page.evaluate(() => localStorage.setItem('apex.theme', 'light')); await D.page.reload(); await D.page.waitForSelector('text=/Trecho mais duro/');
    await shot(D.page, 'percurso-1440-claro.png');
  }
} catch (e) { ok('execução sem exceção', false, e && e.message); }
finally { await browser.close(); vite.kill(); }
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
