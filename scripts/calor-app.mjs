// Mapa de calor (Fase 3 · Etapa 3) num Chromium real, com trajetos SINTÉTICOS (num lugar
// qualquer, nenhuma coordenada real) gravados no IndexedDB. Sem internet: o mapa de ruas falha e a
// tela usa o desenho sem fundo. Prints em 390 e 1440 px se SHOTS apontar uma pasta.
// Uso: node scripts/calor-app.mjs
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_TZ, GOLDEN_NOW } from '../analise/golden/env.mjs';
import { doTreino, agrega, resumo, ehPedal } from '../analise/calor.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const payload = readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8');
const SHOTS = process.env.SHOTS || null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };

// ---- trajetos sintéticos: uma malha de ruas fictícia ----
const LAT = 10.5, LON = 20.5, M = 111195, MLON = M * Math.cos((LAT * Math.PI) / 180);
const p = (x, y) => [LAT + y / M, LON + x / MLON];
const caminho = (pts) => { const out = []; for (let i = 1; i < pts.length; i++) { const [a, b] = [pts[i - 1], pts[i]]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.round(d / 10)); for (let j = 0; j < n; j++) out.push(p(a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n)); } out.push(p(...pts[pts.length - 1])); return out; };
const ROTAS = {
  volta: [[0, 0], [1200, 0], [1200, 800], [0, 800], [0, 0]],
  idaVolta: [[0, 0], [0, -1500], [0, 0]],
  longe: [[2000, 0], [3500, 0], [3500, 600]],
  pedal: [[0, 0], [6000, 0], [6000, 3000]],
};
function track(rota) {
  const pts = caminho(ROTAS[rota]); const n = pts.length;
  return { v: 1, start: 1760000000, tzOffsetSec: -10800, hasGps: true, t: pts.map((_, i) => i * 3), lat: pts.map((x) => x[0]), lon: pts.map((x) => x[1]), dist: pts.map((_, i) => i * 10), hr: pts.map(() => 140), spd: pts.map(() => 3.3), alt: pts.map(() => 900), grade: pts.map(() => 0), draw: Array.from({ length: n }, (_, i) => i) };
}
const st = JSON.parse(payload);
const hoje = GOLDEN_NOW.slice(0, 10), doze = '2025-11-19';
const corridas = st.workouts.filter((w) => !ehPedal(w) && !w.indoor && w.date >= doze).sort((a, b) => a.date.localeCompare(b.date));
const pedais = st.workouts.filter((w) => ehPedal(w) && !w.indoor && w.date >= doze);
// 6 corridas na volta do quarteirão, 3 no vai-e-volta, 1 longe; as outras ficam sem trajeto
const plano = {}; corridas.forEach((w, i) => { if (i < 6) plano[w.id] = 'volta'; else if (i < 9) plano[w.id] = 'idaVolta'; else if (i < 10) plano[w.id] = 'longe'; });
pedais.slice(0, 2).forEach((w) => { plano[w.id] = 'pedal'; });
const tracks = Object.fromEntries(Object.entries(plano).map(([id, r]) => [id, track(r)]));
const esperado = (lista) => { const pt = lista.filter((w) => tracks[w.id]).map((w) => ({ id: w.id, ...doTreino(tracks[w.id].lat, tracks[w.id].lon) })); return { ...resumo(agrega(pt)), sem: lista.length - pt.length }; };
const ER = esperado(corridas), EP = esperado(pedais);
const kmTxt = (km) => (km >= 10 ? String(Math.round(km)) : km.toFixed(1).replace('.', ','));

const PORT = 5226;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
const url = (r) => `http://localhost:${PORT}/analise/#/${r}`;
async function device(w, h, { tema = 'dark' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: GOLDEN_TZ, locale: 'pt-BR', deviceScaleFactor: SHOTS ? 2 : 1 });
  await ctx.addInitScript(([pl, t]) => { if (!sessionStorage.getItem('__d')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', pl); localStorage.setItem('apex.theme', t); sessionStorage.setItem('__d', '1'); } }, [payload, tema]);
  const page = await ctx.newPage(); const errors = [], fora = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  await page.route(/^https:\/\//, (r) => { fora.push(new URL(r.request().url()).host); return r.abort(); });
  await page.goto(url('hoje')); await page.waitForSelector('.main > *');
  // grava os trajetos sintéticos no IndexedDB do app
  await page.evaluate((T) => new Promise((res, rej) => { const rq = indexedDB.open('apex-performance'); rq.onsuccess = () => { const tx = rq.result.transaction('tracks', 'readwrite'); for (const [id, tr] of Object.entries(T)) tx.objectStore('tracks').put({ ...tr, id }); tx.oncomplete = () => res(); tx.onerror = rej; }; }), tracks);
  return { page, errors, fora };
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: resolve(SHOTS, name) }); };
// clica no meio de uma linha da faixa f (desenho sem fundo)
async function tocaFaixa(page, f) {
  const pt = await page.evaluate((f) => {
    const g = document.querySelectorAll('.trackmap.calor > svg > g')[f]; const pl = g && g.querySelector('polyline'); if (!pl) return null;
    const ps = pl.points; const q = ps.getItem(Math.floor(ps.numberOfItems / 2)); const m = pl.getScreenCTM(); return { x: q.x * m.a + q.y * m.c + m.e, y: q.x * m.b + q.y * m.d + m.f };
  }, f);
  if (pt) await page.mouse.click(pt.x, pt.y);
  return pt;
}

try {
  console.log('\n== Mapa de calor · corrida, 12 meses (celular) ==');
  const A = await device(390, 844);
  const antes = await A.page.evaluate(() => localStorage.getItem('apex.analise.v1'));
  A.fora.length = 0;
  const t0 = Date.now();
  await A.page.goto(url('progresso/calor'));
  await A.page.waitForSelector('.trackmap.calor > svg polyline', { timeout: 15000 });
  const ms = Date.now() - t0;
  const h2 = await A.page.locator('.tv-panel h2').innerText();
  ok('resumo: N corridas · cerca de X km de ruas diferentes', h2 === `${ER.treinos} corridas · cerca de ${kmTxt(ER.km)} km de ruas diferentes`, h2);
    ok('desenha em menos de 1 s', ms < 1000, ms + ' ms');
  await A.page.waitForSelector('text=/Sem as ruas no fundo/', { timeout: 15000 });
  ok('sem internet: cai no desenho sem fundo, com o motivo', await A.page.locator('.trackmap.calor > svg').count() === 1);
  ok('selo "Só você vê" no topo', (await A.page.locator('.tv-top .mc-priv').innerText()).includes('Só você vê'));
  ok('legenda: 1 vez … 20 vezes ou mais, 5 tons', /1 vez\s*20 vezes ou mais/.test(await A.page.locator('.mc-legenda').innerText()) && await A.page.locator('.mc-legenda i').count() === 5);
  ok('faixas no desenho: volta (6 treinos) em 6–10 e vai-e-volta (3) em 3–5', await A.page.locator('.trackmap.calor > svg > g').nth(2).locator('polyline').count() >= 1 && await A.page.locator('.trackmap.calor > svg > g').nth(1).locator('polyline').count() >= 1);
  const semTxt = await A.page.locator('.mc-sem').innerText();
  ok('os sem trajeto ficam de fora, com aviso', semTxt.includes(`${ER.sem} corridas sem trajeto neste aparelho ficaram de fora`), semTxt.split('\n')[0]);
  ok('mapa com descrição para leitor de tela', /Mapa de calor de \d+ corridas: cerca de/.test(await A.page.locator('.trackmap.calor > svg').getAttribute('aria-label')));
  await shot(A.page, 'calor-390.png');

  console.log('\n== Tocar numa rua ==');
  await tocaFaixa(A.page, 2);
  await A.page.waitForSelector('.mc-rua');
  const rua = await A.page.locator('.mc-rua').innerText();
  ok('rua tocada: comprimento e 6 passagens', /Rua selecionada · [\d,]+ km/.test(rua) && rua.includes('6 passagens'), rua.split('\n')[0]);
  ok('mostra 2 treinos e "Ver os 6 treinos"', await A.page.locator('.mc-lista li').count() === 2 && rua.includes('Ver os 6 treinos'));
  await A.page.getByRole('button', { name: 'Ver os 6 treinos' }).click();
  ok('"Ver os 6 treinos" abre a lista, com link para cada treino', await A.page.locator('.mc-lista li a[href*="#/treino/"]').count() === 6);
  ok('a rua tocada ganha o contorno', await A.page.locator('.trackmap.calor > svg > polyline[stroke="var(--texto)"]').count() >= 1);
  await shot(A.page, 'calor-390-rua.png');
  // o ponto da tela mais longe de qualquer linha
  const vazio = await A.page.evaluate(() => {
    const ps = []; document.querySelectorAll('.trackmap.calor > svg polyline').forEach((pl) => { const m = pl.getScreenCTM(); for (let i = 0; i < pl.points.numberOfItems; i += 3) { const q = pl.points.getItem(i); ps.push([q.x * m.a + q.y * m.c + m.e, q.x * m.b + q.y * m.d + m.f]); } });
    let best = null, bd = -1; for (let x = 20; x < 370; x += 10) for (let y = 180; y < 320; y += 10) { let d = Infinity; for (const [a, b] of ps) d = Math.min(d, Math.hypot(a - x, b - y)); if (d > bd) { bd = d; best = { x, y }; } }
    return best;
  });
  await A.page.mouse.click(vazio.x, vazio.y);
  ok('tocar longe de qualquer rua limpa a seleção', await A.page.locator('.mc-rua').count() === 0);

  console.log('\n== Pedal e período ==');
  await A.page.getByRole('radio', { name: 'Pedal' }).click();
  await A.page.waitForFunction(() => /pedais|pedal/.test(document.querySelector('.tv-panel h2')?.textContent || ''));
  const hp = await A.page.locator('.tv-panel h2').innerText();
  ok('pedal separado da corrida', hp === (EP.treinos ? `${EP.treinos} ${EP.treinos === 1 ? 'pedal' : 'pedais'} · cerca de ${kmTxt(EP.km)} km de ruas diferentes` : 'Nenhum pedal com trajeto'), hp);
  ok('subtítulo "separado da corrida"', (await A.page.locator('.tv-panel').innerText()).includes('Últimos 12 meses · separado da corrida'));
  await A.page.getByRole('radio', { name: 'Corrida' }).click();
  await A.page.getByRole('button', { name: /Período/ }).click();
  ok('menu de período: 12 meses, Ciclo atual, Tudo', (await A.page.locator('.tf-menu').innerText()).replace(/\n/g, '|') === '12 meses|Ciclo atual|Tudo');
  await A.page.getByRole('menuitemradio', { name: 'Tudo' }).click();
  await A.page.waitForFunction(() => /Desde o início/.test(document.querySelector('.tv-panel')?.textContent || ''));
  ok('"Tudo": subtítulo "Desde o início"', true);

  console.log('\n== Sem fundo, privacidade e acessibilidade ==');
  await A.page.getByRole('button', { name: 'Mostrar as ruas no fundo' }).click();
  ok('botão de fundo: aria-pressed', (await A.page.getByRole('button', { name: 'Mostrar as ruas no fundo' }).getAttribute('aria-pressed')) === 'false');
  const depois = await A.page.evaluate(() => localStorage.getItem('apex.analise.v1'));
  ok('privacidade: nada gravado em apex.analise.v1', antes === depois);
  const chaves = await A.page.evaluate(() => Object.keys(localStorage).filter((k) => /calor|heat/i.test(k)));
  ok('privacidade: nenhum dado do mapa no aparelho fora do IndexedDB de trajetos', chaves.length === 0, chaves.join());
  ok('privacidade: nenhuma chamada a servidor de dados (só o mapa de ruas)', A.fora.every((h) => /openfreemap/.test(h)), [...new Set(A.fora)].join(', '));
  const peq = await A.page.evaluate(() => [...document.querySelectorAll('.mc button, .mc a')].filter((b) => b.offsetParent && !b.closest('.mc-lista')).map((b) => { const r = b.getBoundingClientRect(); return r.height < 44 && !b.closest('.seg') ? (b.getAttribute('aria-label') || b.textContent).trim() + ' ' + Math.round(r.height) : null; }).filter(Boolean));
  ok('alvos de 44 px', !peq.length, peq.join(' | '));
  ok('sem emoji', !/\p{Extended_Pictographic}/u.test(await A.page.locator('.mc').innerText()));
  ok('sem erros', !A.errors.length, A.errors.join(' | '));

  console.log('\n== Progresso, Livro e computador ==');
  await A.page.goto(url('progresso')); await A.page.waitForSelector('a[href$="#/progresso/calor"]');
  ok('Progresso: card "Mapa de calor" com "Só você vê"', /Mapa de calor[\s\S]*Só você vê/.test(await A.page.locator('a[href$="#/progresso/calor"]').innerText()));
  await A.page.goto(url('mais/livro')); await A.page.waitForSelector('text=Mapa de calor');
  ok('Livro: verbete "Mapa de calor"', await A.page.locator('details:has-text("Mapa de calor")').count() >= 1);
  const B = await device(1440, 900);
  await B.page.goto(url('progresso/calor')); await B.page.waitForSelector('.trackmap.calor > svg polyline', { timeout: 15000 });
  await B.page.waitForSelector('text=/Sem as ruas no fundo/', { timeout: 15000 });
  await tocaFaixa(B.page, 2); await B.page.waitForSelector('.mc-rua');
  ok('computador: painel fixo à direita', (await B.page.locator('.tv-panel').boundingBox()).x > 900);
  await shot(B.page, 'calor-1440.png');
  const C = await device(390, 844, { tema: 'light' });
  await C.page.goto(url('progresso/calor')); await C.page.waitForSelector('text=/Sem as ruas no fundo/', { timeout: 15000 });
  await shot(C.page, 'calor-390-claro.png');
  ok('sem erros no computador e no claro', !B.errors.length && !C.errors.length, [...B.errors, ...C.errors].join(' | '));
} catch (e) { fail++; console.log('  ✗ erro: ' + e.message); }
await browser.close(); vite.kill();
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
