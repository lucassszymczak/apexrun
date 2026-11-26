// Vídeo 9:16 do treino (Compartilhar › Vídeo; aprovado pelo Lucas em 26/11/2026), num Chromium real
// com WebGL (swiftshader) e o mapa de ruas (tiles.openfreemap.org; o resto da rede bloqueado).
// Confere: 1080×1920 em H.264, duração = 4 s por km visível (12 a 56 s) + 4 s de comemoração,
// privacidade (o vídeo só usa o trecho fora do raio de início e fim), fotos só do trecho visível,
// e os avisos (Sem mapa). Trajeto e foto SINTÉTICOS num lugar fictício. Uso: node scripts/video-app.mjs
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { GOLDEN_TZ } from '../analise/golden/env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };

const [LAT, LON] = process.env.REPLAY_LUGAR === 'curitiba' ? [-25.4318, -49.2770] : [10.5, 20.5];
const M = 111195, MLON = M * Math.cos((LAT * Math.PI) / 180);
function track(vs, v) {
  const tr = { v: 1, start: 1760000000, tzOffsetSec: -10800, hasGps: true, t: [], lat: [], lon: [], dist: [], hr: [], spd: [], alt: [], grade: [], draw: [] };
  let t = 0, d = 0;
  for (let k = 1; k < vs.length; k++) { const [x0, y0] = vs[k - 1], [x1, y1] = vs[k]; const L = Math.hypot(x1 - x0, y1 - y0); const n = Math.max(1, Math.round(L / v)); for (let j = 0; j < n; j++) { const f = j / n; tr.t.push(t); tr.lat.push(LAT + (y0 + (y1 - y0) * f) / M); tr.lon.push(LON + (x0 + (x1 - x0) * f) / MLON); tr.dist.push(d); tr.hr.push(150); tr.spd.push(v); const al = 900 + Math.sin(d / 300) * 12; tr.alt.push(al); tr.grade.push(Math.cos(d / 300) * 4); t++; d += L / n; } }
  tr.draw = tr.t.map((_, i) => i).filter((i) => i % 5 === 0);
  return tr;
}
const st = JSON.parse(readFileSync(resolve(root, 'analise/golden/sintetico.state.json'), 'utf8'));
const w = st.workouts.filter((x) => x.modal !== 'bike').sort((a, b) => b.date.localeCompare(a.date))[0];
const tr = track([[0, 0], [1200, 0], [1200, 800], [0, 800], [0, 0]], 3);
w.distKm = 4.0; w.durationSec = tr.t.length - 1;
w.privacy = { mapa: 'ocultar', raio: 500, quemVe: 'eu' };
const iMeio = tr.dist.findIndex((d) => d >= 2000), iPerto = 20; // a foto perto da largada fica fora

const PORT = 5243;
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => vite.stdout.on('data', (b) => { if (/Local:/.test(String(b))) res(); }));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const url = (r) => `http://localhost:${PORT}/analise/#/${r}`;
const out = process.env.SHOTS || join(tmpdir(), 'apex-video'); mkdirSync(out, { recursive: true });

try {
  for (const tema of (process.env.TEMAS || 'dark').split(',')) {
    console.log(`\n== vídeo (${tema}) ==`);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: GOLDEN_TZ, locale: 'pt-BR', acceptDownloads: true });
    await ctx.addInitScript(([p, t]) => { if (!sessionStorage.getItem('__r')) { localStorage.clear(); localStorage.setItem('apex.analise.v1', p); localStorage.setItem('apex.theme', t); sessionStorage.setItem('__r', '1'); } }, [JSON.stringify(st), tema]);
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(/^https:\/\/(?!tiles\.openfreemap\.org)/, (r) => r.abort());
    await page.goto(url('hoje')); await page.waitForSelector('.main > *');
    await page.evaluate(async ([T, wid, iMeio, iPerto]) => {
      const foto = async (cor, txt) => { const c = document.createElement('canvas'); c.width = 600; c.height = 450; const g = c.getContext('2d'); g.fillStyle = cor; g.fillRect(0, 0, 600, 450); g.fillStyle = '#fff'; g.font = '60px sans-serif'; g.fillText(txt, 40, 240); return await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85)); };
      const fotos = [{ id: 'f-meio', i: iMeio, blob: await foto('#3a6ea5', 'foto sintética') }, { id: 'f-perto', i: iPerto, blob: await foto('#a53a3a', 'NÃO PODE') }];
      await new Promise((res, rej) => { const rq = indexedDB.open('apex-performance'); rq.onsuccess = () => { const tx = rq.result.transaction(['tracks', 'photos'], 'readwrite'); tx.objectStore('tracks').put({ ...T, id: wid }); for (const f of fotos) tx.objectStore('photos').put({ id: f.id, wid, blob: f.blob, w: 600, h: 450, taken: '2025-10-09T07:20:00', utc: T.start + T.t[f.i], t: T.t[f.i], i: f.i, off: false, addedAt: new Date().toISOString() }); tx.oncomplete = () => res(); tx.onerror = rej; }; });
    }, [tr, w.id, iMeio, iPerto]);
    await page.goto(url('compartilhar/' + w.id)); await page.waitForSelector('.share');
    await page.locator('[aria-label="Tipo"] button', { hasText: 'Vídeo' }).click(); await page.waitForTimeout(300);
    const gera = page.getByRole('button', { name: 'Gerar vídeo' });
    ok('modo Vídeo: "Gerar vídeo" disponível neste navegador', await gera.isEnabled());
    if (tema === 'dark' && process.env.SHOTS) await page.screenshot({ path: join(out, 'video-antes.png') });
    const t0 = Date.now(); await gera.click();
    await page.waitForSelector('.share-video progress', { timeout: 30000 });
    ok('mostra o progresso e o botão Cancelar', await page.getByRole('button', { name: 'Cancelar' }).count() === 1);
    if (tema === 'dark' && process.env.SHOTS) { await page.waitForTimeout(4000); await page.screenshot({ path: join(out, 'video-gerando.png') }); }
    await page.waitForSelector('.share-video video', { timeout: 600000 });
    console.log('    gerado em ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
    const info = await page.evaluate(() => window.__apexVideo);
    const b64 = await page.evaluate(async () => { const v = document.querySelector('.share-video video'); const b = await (await fetch(v.src)).arrayBuffer(); let s = ''; const u = new Uint8Array(b); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); });
    const arq = join(out, 'video-' + tema + '.mp4'); writeFileSync(arq, Buffer.from(b64, 'base64'));
    const pr = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', arq], { encoding: 'utf8' }));
    const vs = pr.streams.find((s) => s.codec_type === 'video'); const dur = +pr.format.duration;
    ok('arquivo MP4 H.264 em 1080×1920', vs && vs.codec_name === 'h264' && vs.width === 1080 && vs.height === 1920, vs && vs.codec_name + ' ' + vs.width + '×' + vs.height);
    const km = info.metros / 1000, esp = Math.max(12, Math.min(56, Math.round(km * 4))) + 4;
    ok('duração = 4 s por km visível + 4 s de comemoração', Math.abs(dur - esp) < 0.3, dur.toFixed(2) + ' s; ' + km.toFixed(2) + ' km visíveis → ' + esp + ' s');
    ok('máximo de 1 minuto', dur <= 60.3);
    ok('privacidade: começa e termina fora do raio de 500 m (o vídeo não passa pela largada real)', info.a > 0 && info.b < tr.t.length - 1 && km < 3.2, 'índices ' + info.a + '–' + info.b + ' de ' + (tr.t.length - 1));
    const vt = info.vistas || {}, nv = Object.values(vt).reduce((a, b) => a + b, 0);
    ok('com a câmera atrás (e girando na chegada), o boneco nunca corre de costas para o caminho: quase sempre de costas para a câmera', (vt.eixo || 0) / nv > 0.85, JSON.stringify(vt));
    ok('só a foto do trecho visível entra (a de perto da largada fica fora)', info.fotos === 1, info.fotos + ' foto(s)');
    // quadros: no meio (foto), e no fim (comemoração); vira PNG para o relatório
    for (const [nome, s] of [['inicio', 0.5], ['foto', (esp - 4) * 0.5 + 0.6], ['chegada', dur - 0.3]]) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(s), '-i', arq, '-frames:v', '1', join(out, `quadro-${tema}-${nome}.png`)]);
    ok('"Compartilhar vídeo" e "Salvar" aparecem com o vídeo pronto', await page.getByRole('button', { name: 'Compartilhar vídeo' }).count() === 1 && await page.getByRole('button', { name: 'Salvar' }).isEnabled());
    if (tema === 'dark' && process.env.SHOTS) await page.screenshot({ path: join(out, 'video-pronto.png') });
    const dl = page.waitForEvent('download'); await page.getByRole('button', { name: 'Salvar' }).click();
    ok('Salvar baixa o .mp4', /\.mp4$/.test((await dl).suggestedFilename()), (await dl).suggestedFilename());
    ok('sem erros', !errors.length, errors.join(' | '));
    if (tema === 'dark') {
      console.log('\n== Sem mapa ==');
      await page.evaluate((wid) => { const s = JSON.parse(localStorage.getItem('apex.analise.v1')); s.workouts.find((x) => x.id === wid).privacy = { mapa: 'nenhum', raio: 500, quemVe: 'eu' }; localStorage.setItem('apex.analise.v1', JSON.stringify(s)); }, w.id);
      await page.reload(); await page.waitForSelector('.share');
      await page.locator('[aria-label="Tipo"] button', { hasText: 'Vídeo' }).click(); await page.waitForTimeout(300);
      ok('com "Sem mapa", o vídeo não é feito e diz por quê', !(await page.getByRole('button', { name: 'Gerar vídeo' }).isEnabled()) && /Sem mapa/.test(await page.locator('.share-video').innerText()));
    }
    await ctx.close();
  }
} catch (e) { fail++; console.log('  ✗ erro: ' + e.message); }
await browser.close(); vite.kill();
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
