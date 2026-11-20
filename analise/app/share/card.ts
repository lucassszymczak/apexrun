// CARD DE COMPARTILHAR (Etapa 3) — desenhado em <canvas>, PNG.
// Stories 1080×1920 (9:16) e Feed 1080×1350 (4:5); modelos Foto, Mapa e Só números
// (design/telas/Compartilhar.dc.html). Os pontos do trajeto vêm SEMPRE de sharedTrack
// (privacy.ts): com "Ocultar início e fim", nada a menos do raio da largada ou da chegada
// entra no desenho — nem linha, nem marco de km. Sem círculo da zona: o centro dele
// mostraria exatamente o ponto que se quer esconder.
import * as E from '../../engine.mjs';
import { type Track, kmMarks, PALETTE } from '../track';
import { type Shared, drawnPoints } from '../privacy';
import { dec, pace } from '../fmt';

export type Format = 'stories' | 'feed';
export type Model = 'foto' | 'mapa' | 'numeros';
export const SIZES: Record<Format, { W: number; H: number }> = { stories: { W: 1080, H: 1920 }, feed: { W: 1080, H: 1350 } };

// ---------------- números ----------------
export type NumKey = 'dist' | 'pace' | 'tempo' | 'fc' | 'deriva' | 'elev' | 'vel';
export type NumDef = { key: NumKey; label: string; v: string; unit: string; inline: string; tone?: 'magenta' | 'ok' | 'atencao' | 'alerta' };
// "2h42" (≥ 1 h) ou "42:10"
export function tempoCurto(sec: number): string {
  if (!(sec > 0)) return '—';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h ? h + 'h' + String(m).padStart(2, '0') : m + ':' + String(s).padStart(2, '0');
}
export function numberDefs(w: any): NumDef[] {
  const bk = E.isBike(w);
  const out: NumDef[] = [];
  if (w.distKm > 0) out.push({ key: 'dist', label: 'Distância', v: dec(w.distKm, 2), unit: 'km', inline: dec(w.distKm, 2) + ' km' });
  if (!bk && w.distKm > 0 && w.durationSec > 0) { const p = pace(w.durationSec / w.distKm); out.push({ key: 'pace', label: 'Pace', v: p, unit: '/km', inline: p + '/km', tone: 'magenta' }); }
  if (bk && E.kmH(w) != null) { const v = dec(E.kmH(w), 1); out.push({ key: 'vel', label: 'Velocidade', v, unit: 'km/h', inline: v + ' km/h', tone: 'magenta' }); }
  if (w.durationSec > 0) { const t = tempoCurto(w.durationSec); out.push({ key: 'tempo', label: 'Tempo', v: t, unit: 'tempo', inline: t }); }
  if (w.hrAvg) out.push({ key: 'fc', label: 'FC média', v: String(w.hrAvg), unit: 'bpm', inline: w.hrAvg + ' bpm' });
  const dc = bk ? null : E.computeDecoupling(w);
  if (dc != null) { const v = (dc > 0 ? '+' : dc < 0 ? '−' : '') + dec(Math.abs(dc), 1) + '%'; out.push({ key: 'deriva', label: 'Deriva', v, unit: 'deriva', inline: 'deriva ' + v, tone: dc < 5 ? 'ok' : dc <= 8 ? 'atencao' : 'alerta' }); }
  if (w.gainM > 0) out.push({ key: 'elev', label: 'Ganho', v: 'D+ ' + Math.round(w.gainM), unit: 'm', inline: 'D+ ' + Math.round(w.gainM) + ' m' });
  return out;
}
export function defaultNums(w: any): NumKey[] {
  const have = new Set(numberDefs(w).map((d) => d.key));
  return (['dist', E.isBike(w) ? 'vel' : 'pace', 'tempo', 'fc'] as NumKey[]).filter((k) => have.has(k)).slice(0, 3);
}

// ---------------- geometria (pura, testável) ----------------
export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = { i: number; x: number; y: number };
export type Geometry = { lines: Pt[][]; marks: (Pt & { km: number })[]; start: Pt | null; end: Pt | null };
const R = 6371000;
export function cardGeometry(tr: Track, sh: Shared, rect: Rect, everyKm?: number): Geometry {
  const empty: Geometry = { lines: [], marks: [], start: null, end: null };
  if (!sh.show) return empty;
  const idx = drawnPoints(sh);
  const lat0 = (tr.lat[idx[0]] as number) * Math.PI / 180;
  const X = (i: number) => ((tr.lon[i] as number) * Math.PI / 180) * Math.cos(lat0) * R;
  const Y = (i: number) => -((tr.lat[i] as number) * Math.PI / 180) * R;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const i of idx) { const x = X(i), y = Y(i); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
  const k = Math.min(rect.w / bw, rect.h / bh);
  const ox = rect.x + (rect.w - bw * k) / 2, oy = rect.y + (rect.h - bh * k) / 2;
  const P = (i: number): Pt => ({ i, x: ox + (X(i) - x0) * k, y: oy + (Y(i) - y0) * k });
  const lines = sh.runs.map((r) => r.map(P));
  const km = everyKm || ((tr.dist[tr.dist.length - 1] || 0) > 12000 ? 5 : 1);
  // marco de km só se o ponto pode aparecer (nunca dentro das zonas ocultas)
  const marks = kmMarks(tr, km).map((m) => ({ m, j: nearestKept(tr, sh, m.i) })).filter((o) => o.j != null).map((o) => ({ ...P(o.j!), km: o.m.km }));
  return { lines, marks, start: sh.start != null ? P(sh.start) : null, end: sh.end != null ? P(sh.end) : null };
}
function nearestKept(tr: Track, sh: Shared, i: number): number | null {
  for (let k = 0; k < 30; k++) { // até ~30 amostras do marco; senão o marco não aparece
    if (i - k >= 0 && tr.lat[i - k] != null && sh.keep(i - k)) return i - k;
    if (i + k < tr.lat.length && tr.lat[i + k] != null && sh.keep(i + k)) return i + k;
  }
  return null;
}

// ---------------- cores (tokens do tema escuro, lidos do CSS) ----------------
type Tok = Record<string, string>;
function tokens(): Tok {
  const el = document.createElement('div');
  el.setAttribute('data-theme', 'dark'); el.style.display = 'none';
  document.body.appendChild(el);
  const cs = getComputedStyle(el);
  const t: Tok = {};
  for (const k of ['noite', 'superficie', 'superficie-2', 'linha', 'texto', 'texto-2', 'texto-3', 'magenta', 'ciano', 'violeta', 'ok', 'atencao', 'alerta', 'zona-1', 'zona-2', 'zona-3', 'zona-4', 'zona-5', 'font-brand']) t[k] = cs.getPropertyValue('--' + k).trim();
  el.remove();
  return t;
}
const zoneTok = (b: number) => PALETTE[b].replace(/^var\(--|\)$/g, '');

// símbolo (design/marca): lâmina da ida magenta, da volta ciano, pico violeta; logo mono branco
const SYM = { ida: 'M6 86 L50 4 L59 20.77 L24 86 Z', volta: 'M94 86 L50 4 L41 20.77 L76 86 Z', pico: 'M50 4 L59 20.77 L50 37.55 L41 20.77 Z', mono: 'M6 86 L50 4 L94 86 L76 86 L50 37.55 L24 86 Z' };

export type CardInput = {
  format: Format; model: Model; w: any; tr: Track | null; shared: Shared;
  band?: ((i: number) => number | null) | null; // cor por FC (modelo Mapa)
  photo?: { img: CanvasImageSource; w: number; h: number } | null;
  nums: NumKey[]; title: string;
};

// Desenha e devolve o canvas (e a geometria usada, para conferência).
export async function renderCard(inp: CardInput, canvas?: HTMLCanvasElement): Promise<{ canvas: HTMLCanvasElement; geo: Geometry }> {
  const { W, H } = SIZES[inp.format];
  const c = canvas || document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const T = tokens();
  const font = T['font-brand'] || 'Outfit, system-ui, sans-serif';
  try { await Promise.all([document.fonts.load('500 64px Outfit'), document.fonts.load('400 32px Outfit')]); } catch { /* usa a reserva */ }
  const F = (wt: 400 | 500, px: number) => `${wt} ${px}px ${font}`;
  const stories = inp.format === 'stories';
  const defs = numberDefs(inp.w);
  const nums = inp.nums.map((k) => defs.find((d) => d.key === k)).filter(Boolean) as NumDef[];
  const toneCol = (d: NumDef, fallback: string) => (d.tone ? T[d.tone] : fallback);
  const M = 72; // margem

  // ---- fundo ----
  g.fillStyle = T.noite; g.fillRect(0, 0, W, H);
  if (inp.model === 'foto') {
    if (inp.photo) {
      const k = Math.max(W / inp.photo.w, H / inp.photo.h), pw = inp.photo.w * k, ph = inp.photo.h * k;
      g.drawImage(inp.photo.img, (W - pw) / 2, (H - ph) / 2, pw, ph);
    } else { g.fillStyle = T.superficie; g.fillRect(0, 0, W, H); }
  }

  // ---- trajeto ----
  let geo: Geometry = { lines: [], marks: [], start: null, end: null };
  if (inp.model !== 'numeros' && inp.tr && inp.shared.show) {
    const top = stories ? 260 : 200, bottom = stories ? 560 : 420;
    const rect = { x: M + 20, y: top, w: W - 2 * (M + 20), h: H - top - bottom };
    geo = cardGeometry(inp.tr, inp.shared, rect);
    const path = (pts: Pt[]) => { g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); };
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (inp.model === 'foto') {
      for (const l of geo.lines) { path(l); g.strokeStyle = '#ffffff'; g.lineWidth = 30; g.stroke(); }
      for (const l of geo.lines) { path(l); g.strokeStyle = T.magenta; g.lineWidth = 16; g.stroke(); }
    } else {
      for (const l of geo.lines) { path(l); g.strokeStyle = T.linha; g.lineWidth = 26; g.stroke(); }
      // trechos por cor de FC (cor = a mais frequente entre os pontos do trecho)
      for (const l of geo.lines) {
        for (let k = 0; k < l.length - 1; k++) {
          let col = T['texto-3'];
          if (inp.band) {
            const cnt = [0, 0, 0, 0, 0]; let any = false;
            for (let i = l[k].i; i < l[k + 1].i; i++) { const z = inp.band(i); if (z != null) { cnt[z]++; any = true; } }
            if (any) col = T[zoneTok(cnt.indexOf(Math.max(...cnt)))];
          }
          g.beginPath(); g.moveTo(l[k].x, l[k].y); g.lineTo(l[k + 1].x, l[k + 1].y);
          g.strokeStyle = col; g.lineWidth = 14; g.stroke();
        }
      }
      g.font = F(500, 26); g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const m of geo.marks) {
        g.beginPath(); g.arc(m.x, m.y, 26, 0, Math.PI * 2); g.fillStyle = T.noite; g.fill();
        g.lineWidth = 4; g.strokeStyle = T.texto; g.stroke();
        g.fillStyle = T.texto; g.fillText(String(m.km), m.x, m.y + 1);
      }
    }
    // largada e chegada só quando o mapa é completo
    const ring = inp.model === 'foto' ? '#ffffff' : T.texto;
    if (geo.end) { g.beginPath(); g.arc(geo.end.x, geo.end.y, 20, 0, Math.PI * 2); g.fillStyle = T.noite; g.fill(); g.lineWidth = 8; g.strokeStyle = ring; g.stroke(); }
    if (geo.start) { g.beginPath(); g.arc(geo.start.x, geo.start.y, 17, 0, Math.PI * 2); g.fillStyle = ring; g.fill(); g.lineWidth = 6; g.strokeStyle = T.noite; g.stroke(); }
  }

  // ---- textos ----
  const logo = (x: number, y: number, h: number, mono: boolean) => {
    const s = h / 90; g.save(); g.translate(x, y); g.scale(s, s);
    if (mono) { g.fillStyle = '#ffffff'; g.fill(new Path2D(SYM.mono)); }
    else { g.fillStyle = T.magenta; g.fill(new Path2D(SYM.ida)); g.fillStyle = T.ciano; g.fill(new Path2D(SYM.volta)); g.fillStyle = T.violeta; g.fill(new Path2D(SYM.pico)); }
    g.restore();
  };
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  if (inp.model === 'numeros') {
    const big = nums[0], rest = nums.slice(1);
    const blockH = 120 + 40 + 190 + (rest.length ? 60 + 170 : 0);
    let y = (H - blockH) / 2;
    logo(M, y, 120, false); y += 120 + 80;
    if (big) { g.font = F(500, 190); g.fillStyle = toneCol(big, T.texto); g.fillText(big.v + (big.key === 'dist' ? ' km' : ''), M - 6, y + 150); }
    y += 190; g.font = F(400, 44); g.fillStyle = T['texto-2']; g.fillText(fit(g, inp.title, W - 2 * M), M, y + 30);
    y += 100;
    rest.forEach((d, k) => {
      const x = M + k * ((W - 2 * M) / 2);
      g.font = F(500, 96); g.fillStyle = toneCol(d, T.texto); g.fillText(d.v, x, y + 90);
      g.font = F(400, 40); g.fillStyle = T['texto-2']; g.fillText(d.unit, x, y + 150);
    });
    return done(c, geo);
  }
  // escurece a base para os números (única transparência: a mesma dos painéis sobre o mapa)
  const baseH = stories ? 460 : 360;
  if (inp.model === 'foto') { g.fillStyle = 'rgba(13,15,26,0.6)'; g.fillRect(0, H - baseH, W, baseH); }
  // logo branco + nome da marca
  logo(M, M, 56, true);
  g.font = F(500, 38); g.fillStyle = '#ffffff'; g.fillText('Apex Performance', M + 80, M + 44);
  // números
  const big = nums[0], rest = nums.slice(1);
  let y = H - M;
  if (rest.length) { g.font = F(400, 48); g.fillStyle = '#ffffff'; g.fillText(fit(g, rest.map((d) => d.inline).join(' · '), W - 2 * M), M, y); y -= 70; }
  if (big) { g.font = F(500, stories ? 168 : 140); g.fillStyle = '#ffffff'; g.fillText(big.inline, M - 4, y); y -= stories ? 180 : 156; }
  g.font = F(400, 40); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillText(fit(g, inp.title, W - 2 * M), M, y);
  return done(c, geo);
}
function done(canvas: HTMLCanvasElement, geo: Geometry) {
  // conferência (teste de fumaça): os índices efetivamente desenhados
  (window as any).__apexCard = { W: canvas.width, H: canvas.height, idx: geo.lines.flat().map((p) => p.i).concat(geo.marks.map((m) => m.i)) };
  return { canvas, geo };
}
function fit(g: CanvasRenderingContext2D, s: string, max: number): string {
  if (g.measureText(s).width <= max) return s;
  let t = s; while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

export function toPng(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Não consegui gerar a imagem.'))), 'image/png'));
}
// Compartilhar: menu nativo (celular) com o arquivo; sem suporte, baixa o arquivo.
export async function shareOrDownload(blob: Blob, name: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], name, { type: 'image/png' });
  const nav: any = navigator;
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title }); return 'shared'; }
    catch (e: any) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  download(blob, name);
  return 'downloaded';
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
