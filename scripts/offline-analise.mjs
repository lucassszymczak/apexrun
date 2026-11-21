// Teste do modo offline (Etapa 4): abre o BUILD do app de análise (vite preview), espera
// o service worker guardar os arquivos, corta a internet e reabre o app: tudo precisa
// abrir — Hoje, Treinos, um Treino com "Só trajeto" — sem rede nenhuma.
// Uso: npm run build && node scripts/offline-analise.mjs
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const payload = readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const PORT = 5207;
const srv = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('preview')), 30000); srv.stdout.on('data', (b) => { if (/Local:/.test(String(b))) { clearTimeout(t); res(); } }); });
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
  await ctx.addInitScript((p) => { if (!localStorage.getItem('apex.analise.v1')) localStorage.setItem('apex.analise.v1', p); }, payload);
  const page = await ctx.newPage();
  const base = `http://localhost:${PORT}/analise/`;
  await page.goto(base + '#/hoje');
  await page.waitForSelector('.main > *');
  const ready = await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
  ok('service worker instalado e ativo', ready);
  const cached = await page.evaluate(async () => { const ks = await caches.keys(); let n = 0; for (const k of ks) n += (await (await caches.open(k)).keys()).length; return { ks, n }; });
  ok('arquivos do app guardados no aparelho', cached.n >= 15, cached.n + ' arquivos · ' + cached.ks.join(','));
  await ctx.setOffline(true);
  for (const r of ['hoje', 'treinos', 'treino/syn22', 'progresso', 'mais/config']) {
    await page.goto(base + '#/' + r, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    const okR = await page.waitForSelector('.main > *', { timeout: 10000, state: 'attached' }).then(() => true).catch(() => false);
    ok('sem internet, #/' + r + ' abre', okR);
  }
  // Fase 4 · critério 12: o plano de prova abre em modo avião, com os dados do aparelho
  await page.goto(base + '#/mais/plano', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  const plano = await page.waitForSelector('h2:has-text("Mire")', { timeout: 10000 }).then(() => true).catch(() => false);
  ok('sem internet, o plano de prova abre com o plano montado', plano && (await page.locator('.passagens .pass').count()) >= 2);
  const font = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.family.includes('Outfit') && f.status === 'loaded').length; });
  ok('a fonte Outfit carrega sem internet', font > 0, font + ' faces');
  // o app da raiz e a versão antiga NÃO ficam sob o service worker
  const other = await page.goto(`http://localhost:${PORT}/analise-v1/`).then((r) => r && r.ok()).catch(() => false);
  ok('/analise-v1/ não é servido pelo cache do app novo', !other);
  await ctx.setOffline(false);
} finally { await browser.close(); srv.kill(); }
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
