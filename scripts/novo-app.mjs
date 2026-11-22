// App para outras pessoas (22/11/2026; docs/app-para-outros.md) num Chromium real.
// Aparelho novo: começa vazio (nada do Lucas), tour de 5 passos com "Pular", perfil em branco,
// cidade e estado → altitude, metas vazias, sem "NaN"/"undefined" nas telas com 1 e com 2 treinos,
// sem Força e canela, sem Teste do Motor, Garmin só pelo .FIT, nenhum pedido aos servidores do
// Lucas (Supabase). Aparelho do Lucas (com dados): sem tour e tudo como antes.
// Prints em 390 e 1440 px se SHOTS apontar uma pasta. Uso: node scripts/novo-app.mjs
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_TZ, GOLDEN_NOW } from '../analise/golden/env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const { Encoder, Profile } = require('@garmin/fitsdk');
const SHOTS = process.env.SHOTS || null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };

// .FIT de corrida sintético com GPS (lugar fictício), 5 km
function fit(dia, n = 1800) {
  const SEMI = 2147483648 / 180, enc = new Encoder(), st = new Date(dia + 'T09:00:00Z');
  enc.onMesg(Profile.MesgNum.FILE_ID, { manufacturer: 'development', product: 1, timeCreated: st, type: 'activity' });
  for (let i = 0; i <= n; i++) { const a = (i / n) * 2 * Math.PI; enc.onMesg(Profile.MesgNum.RECORD, { timestamp: new Date(st.getTime() + i * 1000), distance: 2.778 * i, enhancedSpeed: 2.778, heartRate: Math.round(140 + i / 60), enhancedAltitude: 900 + 10 * Math.sin(a), cadence: 85, positionLat: Math.round((10.5 + 0.008 * Math.sin(a)) * SEMI), positionLong: Math.round((20.5 + 0.009 * Math.cos(a)) * SEMI) }); }
  enc.onMesg(Profile.MesgNum.SESSION, { timestamp: new Date(st.getTime() + n * 1000), startTime: st, sport: 'running', totalDistance: 2.778 * n, totalTimerTime: n, totalElapsedTime: n, avgHeartRate: 155, maxHeartRate: 170 });
  return Buffer.from(enc.close());
}
// marcas do Lucas (o Livro de fórmulas explica o "Baseline 5K" como conceito: fica fora da busca)
const LUCAS = /Lucas|Guarapuava|Floripa|Base & Pace|tíbia|Maratona de Curitiba|PAUSA PROTETORA/;
const RUIM = /\bNaN\b|undefined|\bnull\b|Infinity/;
const PORT = 5241;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch();
const url = (r) => `http://localhost:${PORT}/analise/#/${r}`;
async function device(w, h, { estado = null, tema = 'dark' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: GOLDEN_TZ, locale: 'pt-BR', deviceScaleFactor: SHOTS ? 2 : 1 });
  await ctx.addInitScript(([p, t]) => { if (!sessionStorage.getItem('__n')) { localStorage.clear(); if (p) localStorage.setItem('apex.analise.v1', p); localStorage.setItem('apex.theme', t); sessionStorage.setItem('__n', '1'); } }, [estado, tema]);
  const page = await ctx.newPage(); const errors = [], pedidos = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (/supabase\.co|\/functions\/v1\//i.test(r.url())) pedidos.push(r.url().split('?')[0]); });
  await page.clock.setFixedTime(new Date(GOLDEN_NOW));
  // busca de cidades (Open-Meteo) respondida aqui; o resto da internet fica fora
  await page.route(/geocoding-api\.open-meteo\.com/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [{ name: 'Cidade Teste', admin1: 'Paraná', elevation: 934.6, country_code: 'BR' }, { name: 'Cidade Teste', admin1: 'São Paulo', elevation: 700, country_code: 'BR' }] }) }));
  await page.route(/^https:\/\/(?!geocoding-api)/, (r) => r.abort());
  return { ctx, page, errors, pedidos };
}
const shot = async (page, name, full = true) => { if (SHOTS) await page.screenshot({ path: resolve(SHOTS, name), fullPage: full }); };
const est = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('apex.analise.v1')));
async function importa(page, dia) {
  await page.goto(url('importar')); await page.waitForSelector('#fitFile', { state: 'attached' });
  await page.setInputFiles('#fitFile', { name: dia + '.fit', mimeType: 'application/octet-stream', buffer: fit(dia) });
  await page.waitForSelector('h1:has-text("Conferência")', { timeout: 15000 });
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForSelector('text=Arquivo lido', { timeout: 15000 });
  await page.getByRole('button', { name: 'Salvar treino' }).click();
  await page.waitForFunction(() => /#\/treino\//.test(location.hash), null, { timeout: 15000 });
}

try {
  console.log('\n== aparelho novo: primeiro acesso ==');
  const A = await device(390, 844);
  await A.page.goto(url('hoje')); await A.page.waitForSelector('.tour');
  const s0 = await est(A.page);
  ok('começa vazio: sem treinos, sem sono, sem ciclo', s0.workouts.length === 0 && s0.daily.length === 0 && s0.race === null);
  ok('perfil em branco: nada do Lucas (nome, cidade, FC, peso, aviso, EF de base)', s0.athlete.name == null && s0.athlete.city == null && s0.athlete.fcRep == null && s0.athlete.fcMax == null && s0.athlete.weight == null && s0.athlete.alert === '' && s0.athlete.efBaseline == null && s0.athlete.novo === true);
  ok('nada do Lucas guardado no aparelho', !LUCAS.test(JSON.stringify(s0)) && !/"(fcMax|fcRep)":(198|67)/.test(JSON.stringify(s0)));
  ok('o tour abre sem a barra de navegação', await A.page.locator('.bottomnav:visible').count() === 0 && /Passo 1 de 5/.test(await A.page.locator('.tour').innerText()));
  await shot(A.page, 'novo-1.png');
  await A.page.getByRole('button', { name: 'Começar' }).click();
  await A.page.fill('#t_nome', 'Pessoa Teste'); await A.page.fill('#t_cid', 'Cidade Teste'); await A.page.selectOption('#t_uf', 'PR');
  await A.page.fill('#t_rep', '58'); await A.page.fill('#t_max', '50');
  ok('FC máxima menor que a de repouso: avisa e não deixa seguir', /precisa ser maior/.test(await A.page.locator('.tour').innerText()) && await A.page.getByRole('button', { name: 'Continuar' }).isDisabled());
  await A.page.fill('#t_max', '188'); await shot(A.page, 'novo-2.png');
  await A.page.getByRole('button', { name: 'Continuar' }).click(); await A.page.waitForSelector('#t3');
  await A.page.waitForFunction(() => JSON.parse(localStorage.getItem('apex.analise.v1')).athlete.baseAltM != null, null, { timeout: 5000 }).catch(() => {});
  const s1 = await est(A.page);
  ok('salva nome, cidade/UF e FC; altitude da cidade do estado escolhido', s1.athlete.name === 'Pessoa Teste' && s1.athlete.city === 'Cidade Teste/PR' && s1.athlete.fcRep === 58 && s1.athlete.fcMax === 188 && s1.athlete.baseAltM === 935, JSON.stringify({ c: s1.athlete.city, alt: s1.athlete.baseAltM }));
  ok('metas vazias (cadência, deriva, km e treinos por semana)', [s1.athlete.cadenceTarget, s1.athlete.decouplingTarget, s1.athlete.weeklyTargetKm, s1.athlete.sessionsTarget].every((x) => x == null));
  await shot(A.page, 'novo-3.png');
  await A.page.getByRole('button', { name: 'Continuar' }).click(); await A.page.waitForSelector('#t4');
  ok('passo 4: como exportar o .FIT do Garmin Connect', /Exportar original/.test(await A.page.locator('.tour').innerText())); await shot(A.page, 'novo-4.png');
  await A.page.getByRole('button', { name: 'Continuar' }).click(); await A.page.waitForSelector('#t5'); await shot(A.page, 'novo-5.png');
  await A.page.getByRole('button', { name: 'Importar .FIT' }).click(); await A.page.waitForSelector('#fitFile', { state: 'attached' });
  ok('"Importar .FIT" fecha o tour e abre o importador', (await est(A.page)).athlete.tour === 'visto' && /#\/importar$/.test(A.page.url()));

  console.log('\n== aparelho novo: telas com 1 e com 2 treinos ==');
  const ROTAS = ['hoje', 'treinos', 'progresso', 'progresso/consistencia', 'progresso/corpo', 'mais', 'mais/maratona', 'mais/relatorio', 'mais/recuperacao', 'mais/equipamentos', 'mais/config', 'mais/garmin', 'mais/livro', 'coach'];
  const varre = async () => { const r = []; for (const x of ROTAS) { await A.page.goto(url(x)); await A.page.waitForSelector('.main > *', { state: 'attached' }); await A.page.waitForTimeout(250); const t = await A.page.locator('.main').innerText(); const m = t.match(new RegExp('.{0,30}(' + RUIM.source + '|' + LUCAS.source + ').{0,20}')); if (m) r.push(x + ': "' + m[0].replace(/\n/g, ' ') + '"'); } return r; };
  const v0 = await varre();
  ok('sem treino: nenhuma tela mostra NaN/undefined nem dado do Lucas', !v0.length, v0.slice(0, 4).join(' | ') || undefined);
  await importa(A.page, '2026-11-17');
  const v1 = await varre();
  ok('com 1 treino: idem', !v1.length, v1.slice(0, 4).join(' | ') || undefined);
  await importa(A.page, '2026-11-19');
  const v2 = await varre();
  ok('com 2 treinos: idem', !v2.length, v2.slice(0, 4).join(' | ') || undefined);
  await A.page.goto(url('hoje')); await A.page.waitForSelector('.main > *'); await shot(A.page, 'novo-hoje.png');
  await A.page.goto(url('mais')); await A.page.waitForSelector('.main nav');
  ok('Mais: sem "Força e canela"; Garmin vira "Como trazer os treinos do relógio"', !/Força e canela/.test(await A.page.locator('.main').innerText()) && /Como trazer os treinos do relógio/.test(await A.page.locator('.main').innerText()));
  await A.page.goto(url('mais/garmin')); await A.page.waitForSelector('.main .card, .main section');
  ok('Garmin: só o passo a passo do .FIT, sem pedir chave', /Exportar original/.test(await A.page.locator('.main').innerText()) && await A.page.locator('input[type="password"]').count() === 0);
  await shot(A.page, 'novo-garmin.png');
  await A.page.goto(url('mais/config')); await A.page.waitForSelector('#c_uf');
  const cfg = await A.page.locator('.main').innerText();
  ok('Configurações: sem gerar código de sincronização, sem dados de exemplo, sem Baseline 5K', !/Ativar e gerar/.test(cfg) && !/dados de exemplo/.test(cfg) && !/Baseline 5K/.test(cfg) && /Seus treinos ficam só neste aparelho/.test(cfg));
  await A.page.goto(url('editar')); await A.page.waitForSelector('#f_dist');
  ok('formulário: sem o tipo "Teste do Motor"', await A.page.getByRole('button', { name: 'Teste do Motor' }).count() === 0);
  const tv = await A.page.goto(url('treino/' + (await est(A.page)).workouts[0].id)).then(() => A.page.waitForSelector('.tv-top')).then(() => A.page.locator('body').innerText());
  ok('privacidade do treino sem "Só eu / Todos"', !/Só eu|Quem vê/.test(tv));
  ok('nenhum pedido aos servidores do Lucas (Supabase, Garmin)', !A.pedidos.length, A.pedidos.slice(0, 3).join(' | ') || undefined);
  ok('sem erros', !A.errors.length, A.errors.join(' | '));

  console.log('\n== Pular e computador ==');
  const B = await device(1440, 900);
  await B.page.goto(url('hoje')); await B.page.waitForSelector('.tour'); await shot(B.page, 'novo-1440.png', false);
  await B.page.getByRole('button', { name: 'Pular' }).click(); await B.page.waitForSelector('.main > *');
  ok('"Pular" fecha o tour e mostra o Hoje vazio', !(await B.page.locator('.tour').count()) && /Nenhum treino ainda/.test(await B.page.locator('.main').innerText()));
  ok('trilho do computador: sem "Força e canela"', !/Força e canela/.test(await B.page.locator('.rail').innerText()));
  await shot(B.page, 'novo-hoje-1440.png', false);
  const L = await device(390, 844, { tema: 'light' });
  await L.page.goto(url('hoje')); await L.page.waitForSelector('.tour'); await L.page.getByRole('button', { name: 'Começar' }).click(); await shot(L.page, 'novo-2-claro.png');
  ok('sem erros no computador e no claro', !B.errors.length && !L.errors.length, [...B.errors, ...L.errors].join(' | '));

  console.log('\n== compartilhar o app ==');
  const S = await device(390, 844, { estado: readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8') });
  await S.page.addInitScript(() => { window.__comp = []; navigator.share = async (d) => { window.__comp.push(d); }; });
  await S.page.goto(url('mais')); await S.page.waitForSelector('.main nav');
  await S.page.getByRole('button', { name: /Compartilhar o app/ }).click(); await S.page.waitForTimeout(200);
  const comp = await S.page.evaluate(() => window.__comp);
  ok('Mais: "Compartilhar o app" abre o menu do aparelho com só o endereço do app', comp.length === 1 && comp[0].url === `http://localhost:${PORT}/analise/` && /Seus dados ficam só no seu aparelho/.test(comp[0].text), JSON.stringify(comp[0] && comp[0].url));
  ok('o que vai no compartilhamento não leva treino, código nem nada depois do "#"', !/#|apex-|treino\/|sync/i.test(JSON.stringify(comp)));
  const K = await device(1440, 900, { estado: readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8') });
  await K.ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await K.page.addInitScript(() => { navigator.share = undefined; });
  await K.page.goto(url('mais/config')); await K.page.waitForSelector('.app-link');
  ok('Configurações (computador): o card mostra o link', (await K.page.locator('.app-link').innerText()) === `http://localhost:${PORT}/analise/`);
  await K.page.getByRole('button', { name: 'Compartilhar o link' }).click(); await K.page.waitForTimeout(300);
  ok('sem o menu do aparelho, copia o link e avisa', (await K.page.evaluate(() => navigator.clipboard.readText())) === `http://localhost:${PORT}/analise/` && /Link do app copiado/.test(await K.page.locator('.toasts').innerText()));
  await shot(K.page, 'compartilhar-app-1440.png', false);
  await S.page.goto(url('mais')); await S.page.waitForSelector('.main nav'); await shot(S.page, 'compartilhar-app-390.png');
  ok('sem erros', !S.errors.length && !K.errors.length, [...S.errors, ...K.errors].join(' | '));

  console.log('\n== aparelho do Lucas (já tem dados) ==');
  const st0 = readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8');
  const C = await device(390, 844, { estado: st0 });
  await C.page.goto(url('hoje')); await C.page.waitForSelector('.ready');
  ok('sem tour, Hoje normal', await C.page.locator('.tour').count() === 0);
  await C.page.goto(url('mais')); await C.page.waitForSelector('.main nav');
  ok('Força e canela continua no Mais', /Força e canela/.test(await C.page.locator('.main').innerText()));
  await C.page.goto(url('mais/config')); await C.page.waitForSelector('#c_city');
  ok('Configurações com a sincronização de sempre', /Ativar e gerar meu código|Este aparelho está sincronizado|versão publicada/.test(await C.page.locator('.main').innerText()));
  ok('perfil do Lucas sem a marca de novo', !(await est(C.page)).athlete.novo);
  ok('sem erros', !C.errors.length, C.errors.join(' | '));
} catch (e) { fail++; console.log('  ✗ erro: ' + e.message); }
await browser.close(); vite.kill();
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
