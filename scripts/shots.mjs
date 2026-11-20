// Prints do app novo para revisão (celular 390 px e computador 1440 px).
// Sobe o Vite, abre cada rota com relógio congelado (analise/golden/env.mjs) e os
// dados escolhidos no localStorage, e salva PNGs.
//
// Uso: node scripts/shots.mjs <saida> [seed|sintetico] [rota ...]
//   rotas: hoje treinos progresso mais/maratona … (padrão: as principais)
// Também aceita SHOTS_THEME=light.
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GOLDEN_NOW, GOLDEN_TZ } from '../analise/golden/env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');

const [outDir = 'shots', data = 'seed', ...routesArg] = process.argv.slice(2);
const routes = routesArg.length ? routesArg : ['hoje', 'treinos', 'progresso', 'mais'];
const payload = data === 'sintetico' ? readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8') : null;
const theme = process.env.SHOTS_THEME || null;
const PORT = 5199;

// Roda DENTRO da página (dev server): gera as mensagens .FIT do cenário sintético e grava
// o trajeto de cada treino no IndexedDB. Recarregue a página depois (o gerador mexe no estado).
export async function seedTracksInPage() {
  const E = await import('/analise/engine.mjs');
  const S = await import('/analise/golden/synthetic.mjs');
  const T = await import('/analise/app/track.ts');
  const D = await import('/analise/app/db.ts');
  const jobs = [];
  S.buildSynthetic(E, { onMessages: (id, m) => jobs.push([id, m]) });
  for (const [id, m] of jobs) await D.putTrack(id, T.buildTrack(m));
  return jobs.length;
}

const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('vite não subiu')), 30000);
  vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) { clearTimeout(t); ok(); } });
  vite.on('exit', (c) => fail(new Error('vite saiu ' + c)));
});

mkdirSync(resolve(root, outDir), { recursive: true });
// WebGL por software (o mapa de ruas precisa de WebGL; a máquina de teste não tem GPU)
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  for (const [dev, vp, scale] of [['celular', { width: 390, height: 844 }, 2], ['computador', { width: 1440, height: 900 }, 1]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: scale, timezoneId: GOLDEN_TZ, locale: 'pt-BR' });
    await ctx.addInitScript(([p, th]) => {
      try {
        if (!sessionStorage.getItem('__shots')) {
          localStorage.clear(); if (p) localStorage.setItem('apex.analise.v1', p); if (th) localStorage.setItem('apex.theme', th);
          sessionStorage.setItem('__shots', '1');
        }
      } catch (e) {}
    }, [payload, theme]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`[${dev}] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${dev}] console: ${m.text()}`); });
    await page.clock.setFixedTime(new Date(GOLDEN_NOW));
    if (data === 'sintetico') {
      // trajetos do cenário sintético → IndexedDB (mesmos módulos do app, servidos pelo Vite)
      await page.goto(`http://localhost:${PORT}/analise/#/hoje`);
      await page.waitForSelector('.main > *');
      await page.evaluate(seedTracksInPage);
      await page.reload();
    }
    for (const r of routes) {
      await page.goto(`http://localhost:${PORT}/analise/#/${r}`);
      await page.waitForSelector('.main > *', { timeout: 15000, state: 'attached' });
      await page.waitForTimeout(+(process.env.SHOTS_WAIT || 250));
      const file = resolve(root, outDir, `${r.replace(/\//g, '-')}-${dev}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log('✓', file.replace(root + '/', ''));
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  vite.kill();
}
if (errors.length) { console.log('ERROS:\n  ' + [...new Set(errors)].join('\n  ')); process.exitCode = 1; }
