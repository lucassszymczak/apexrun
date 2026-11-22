// STORIES DA RETROSPECTIVA (Fase 5 · Etapa 5; design/telas-fase5/RetroStories). Cards 1080×1920
// em --noite, um número grande por card, o título e a marca no pé. Nenhum mapa: o card recebe só
// os blocos da retrospectiva (números e textos), nunca trajeto nem coordenada (os blocos chegam filtrados por cardsStories).
// Os 13% de cima e os 16% de baixo ficam livres; o conteúdo começa a 20% (barras do Instagram e do iPhone).
import { tokens, SYM, toPng, download } from './card';
import type { Bloco, Retro } from '../../retrospectiva.mjs';
import { ddmmm, hms } from '../../retrospectiva.mjs';

export const STORY = { W: 1080, H: 1920, TOPO: 0.13, PE: 0.16, MIN_FONTE: 40 };
const INICIO = 0.2; // o conteúdo começa a 20% da altura, para o card não ficar vazio embaixo

const kmTxt = (k: number) => (k >= 100 ? String(Math.round(k)) : String(Math.round(k * 10) / 10).replace('.', ','));

// texto alternativo de cada card (para o leitor de tela e para quem compartilha)
export function altDoCard(blocos: Bloco[], R: Retro): string {
  const b = blocos[0];
  if (b.tipo === 'capa') return 'Retrospectiva de ' + R.nome + ', de ' + ddmmm(R.ini) + ' a ' + ddmmm(R.fim) + '. ' + b.titulo;
  return blocos.map((x) => x.rotulo + ': ' + x.titulo).join(' ');
}

export async function renderRetroCard(blocos: Bloco[], R: Retro, n: number, total: number, canvas?: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  try { await (document as any).fonts?.load?.('500 48px Outfit'); await (document as any).fonts?.load?.('400 48px Outfit'); } catch { /* fonte do sistema */ }
  const T = tokens();
  const c = canvas || document.createElement('canvas');
  c.width = STORY.W; c.height = STORY.H;
  const g = c.getContext('2d')!;
  const F = (w: number, px: number) => `${w} ${px}px ${T['font-brand'] || 'Outfit'}, system-ui, sans-serif`;
  const M = 88, W = STORY.W - 2 * M, top = Math.round(STORY.H * STORY.TOPO), bottom = Math.round(STORY.H * (1 - STORY.PE));
  g.fillStyle = T.noite; g.fillRect(0, 0, STORY.W, STORY.H);
  g.textBaseline = 'alphabetic';
  const b = blocos[0];
  let y = Math.round(STORY.H * INICIO);
  // rótulo em caixa alta pequena
  g.fillStyle = T.ciano; g.font = F(500, 40);
  const rot = b.tipo === 'capa' ? 'MEU CICLO' : blocos.map((x) => x.rotulo.toUpperCase()).join(' E ');
  g.fillText(fit(g, rot, W), M, y);
  y += 220;
  // número grande
  const big = b.tipo === 'capa' && !b.parcial && b.unidade === 'na prova' ? b.numero : b.tipo === 'capa' ? b.numero : b.tipo === 'volume' ? b.numero + ' km' : b.numero;
  g.fillStyle = b.tipo === 'recordes' && b.recordes && b.recordes.length ? T.texto : T.magenta;
  let fs = 200; g.font = F(500, fs); while (g.measureText(big).width > W && fs > 96) { fs -= 8; g.font = F(500, fs); }
  g.fillText(big, M, y);
  y += 84;
  // linha de apoio sob o número
  const sub = b.tipo === 'capa' ? (b.unidade === 'na prova' ? 'na ' + R.nome : (b.semanas === 1 ? 'semana' : 'semanas') + (b.parcial ? ' até agora' : ' de ciclo'))
    : b.tipo === 'volume' ? 'em ' + Math.round(b.horas) + ' h de treino'
    : b.tipo === 'consistencia' ? 'semanas consistentes · maior sequência: ' + b.maior
    : b.tipo === 'prova' ? b.unidade
    : b.unidade;
  g.fillStyle = T['texto-2']; g.font = F(400, 48);
  y = wrap(g, sub, M, y, W, 60, 2);
  y += 24;
  if (b.tipo === 'capa') {
    y += 56;
    if (b.unidade !== 'na prova') { g.fillStyle = T.texto; g.font = F(500, 56); y = wrap(g, R.nome, M, y, W, 66, 2) + 72; }
    g.fillStyle = T['texto-2']; g.font = F(400, 44); g.fillText(ddmmm(R.ini) + ' → ' + ddmmm(R.fim) + ' · ' + b.semanas + (b.semanas === 1 ? ' semana' : ' semanas'), M, y);
  }

  // gráfico ou lista do bloco
  const areaTop = y + 60, areaBot = bottom - 170;
  if (b.tipo === 'volume' && b.barras && b.barras.length) {
    const bars = b.barras as { n: number; km: number }[]; const mx = Math.max(1, ...bars.map((x) => x.km));
    const h = Math.min(560, areaBot - areaTop - 60), gap = bars.length > 20 ? 6 : 12, bw = (W - gap * (bars.length - 1)) / bars.length;
    const base = areaTop + h;
    bars.forEach((x, i) => { const bh = (x.km / mx) * h; g.fillStyle = x.n === b.pico ? T.ciano : T['superficie-2']; g.fillRect(M + i * (bw + gap), base - bh, bw, bh); });
    g.fillStyle = T.linha; g.fillRect(M, base, W, 3);
    const pk = bars.find((x) => x.n === b.pico);
    g.fillStyle = T['texto-2']; g.font = F(400, 40); g.fillText('semana 1', M, base + 60);
    g.textAlign = 'right'; g.fillText(pk ? 'pico: ' + kmTxt(pk.km) + ' km' : '', M + W, base + 60); g.textAlign = 'left';
  } else if (b.tipo === 'consistencia') {
    const est = b.estados as string[]; const cols = Math.min(8, est.length), sz = Math.min(100, Math.floor((W - (cols - 1) * 16) / cols));
    est.forEach((e, i) => {
      const x = M + (i % cols) * (sz + 16), yy = areaTop + Math.floor(i / cols) * (sz + 16);
      if (e === 'consistente') { g.fillStyle = mix(T.ok, 0.16); rr(g, x, yy, sz, sz, 16); g.fill(); g.strokeStyle = T.ok; g.lineWidth = 4; rr(g, x, yy, sz, sz, 16); g.stroke(); check(g, x, yy, sz, T.ok); }
      else if (e === 'parcial') { g.strokeStyle = T.atencao; g.lineWidth = 4; rr(g, x, yy, sz, sz, 16); g.stroke(); half(g, x, yy, sz, T.atencao); }
      else { g.strokeStyle = T.linha; g.lineWidth = 4; rr(g, x, yy, sz, sz, 16); g.stroke(); g.fillStyle = T['texto-3']; g.fillRect(x + sz * 0.32, yy + sz / 2 - 3, sz * 0.36, 6); }
    });
    const rows = Math.ceil(est.length / cols);
    g.fillStyle = T['texto-2']; g.font = F(400, 40); g.fillText('Verde: consistente · âmbar: parcial', M, areaTop + rows * (sz + 16) + 50);
  } else if (b.tipo === 'recordes') {
    let yy = areaTop + 20;
    for (const r of (b.recordes || []).slice(0, 5)) { g.fillStyle = T.texto; g.font = F(400, 56); g.fillText(r.dist, M, yy); g.textAlign = 'right'; g.font = F(500, 56); g.fillText(hms(r.t), M + W, yy); g.textAlign = 'left'; yy += 96; }
    if (b.longao) { g.fillStyle = T['texto-2']; g.font = F(400, 44); g.fillText('Longão mais longo', M, yy + 10); g.textAlign = 'right'; g.fillStyle = T.texto; g.font = F(500, 48); g.fillText(kmTxt(b.longao.km) + ' km', M + W, yy + 10); g.textAlign = 'left'; }
  } else if (b.tipo === 'prova') {
    let yy = areaTop + 20;
    if (b.linhas && b.linhas.length) {
      g.fillStyle = T['texto-3']; g.font = F(500, 40); g.fillText('Passagem', M, yy); g.textAlign = 'right'; g.fillText('Plano', M + W - 300, yy); g.fillText('Real', M + W, yy); g.textAlign = 'left';
      yy += 20; g.fillStyle = T.linha; g.fillRect(M, yy, W, 2); yy += 80;
      for (const l of b.linhas) { g.fillStyle = l.rotulo === 'Chegada' ? T.magenta : T.texto; g.font = F(500, 52); g.fillText(l.rotulo, M, yy); g.textAlign = 'right'; g.font = F(400, 52); g.fillStyle = T['texto-2']; g.fillText(hms(l.plano), M + W - 300, yy); g.font = F(500, 52); g.fillStyle = l.rotulo === 'Chegada' ? T.magenta : T.texto; g.fillText(hms(l.real), M + W, yy); g.textAlign = 'left'; yy += 92; }
    } else { g.fillStyle = T['texto-2']; g.font = F(400, 44); wrap(g, b.titulo, M, yy, W, 56, 3); }
  } else if (b.tipo === 'tenis') {
    let yy = areaTop + 20;
    for (const t of (b.lista || []).slice(0, 4)) { g.fillStyle = T.texto; g.font = F(400, 52); g.fillText(fit(g, t.nome, W - 300), M, yy); g.textAlign = 'right'; g.font = F(500, 52); g.fillText(kmTxt(t.km) + ' km', M + W, yy); g.textAlign = 'left'; yy += 92; }
  }

  // marca no pé e a posição do card
  const by = bottom - 24, s = 64 / 90;
  g.save(); g.translate(M, by - 64); g.scale(s, s);
  g.fillStyle = T.magenta; g.fill(new Path2D(SYM.ida)); g.fillStyle = T.ciano; g.fill(new Path2D(SYM.volta)); g.fillStyle = T.violeta; g.fill(new Path2D(SYM.pico));
  g.restore();
  g.fillStyle = T.texto; g.font = F(500, 44); g.fillText('Apex Performance', M + 88, by - 12);
  g.textAlign = 'right'; g.fillStyle = T['texto-2']; g.font = F(400, 40); g.fillText(n + ' de ' + total, M + W, by - 12); g.textAlign = 'left';
  const w: any = window; (w.__apexRetroImg = w.__apexRetroImg || [])[n - 1] = { W: c.width, H: c.height, top, bottom, tipos: blocos.map((x) => x.tipo), numero: big };
  return c;
}

export async function gerarStories(cards: Bloco[][], R: Retro): Promise<{ blob: Blob; nome: string; alt: string }[]> {
  const out: { blob: Blob; nome: string; alt: string }[] = [];
  for (let i = 0; i < cards.length; i++) {
    const c = await renderRetroCard(cards[i], R, i + 1, cards.length);
    out.push({ blob: await toPng(c), nome: 'apex-retrospectiva-' + (i + 1) + '.png', alt: altDoCard(cards[i], R) });
  }
  return out;
}

// Salvar: todos de uma vez pelo menu nativo; se o aparelho não aceitar vários, um por vez; sem
// menu nativo, baixa os arquivos.
export async function salvarStories(arqs: { blob: Blob; nome: string }[]): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const files = arqs.map((a) => new File([a.blob], a.nome, { type: 'image/png' }));
  const nav: any = navigator;
  if (nav.canShare && nav.share) {
    try {
      if (nav.canShare({ files })) { await nav.share({ files, title: 'Retrospectiva do ciclo' }); return 'shared'; }
      if (nav.canShare({ files: [files[0]] })) { for (const f of files) await nav.share({ files: [f], title: 'Retrospectiva do ciclo' }); return 'shared'; }
    } catch (e: any) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  for (const a of arqs) download(a.blob, a.nome);
  return 'downloaded';
}

function fit(g: CanvasRenderingContext2D, s: string, max: number): string {
  if (g.measureText(s).width <= max) return s;
  let t = s; while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}
function wrap(g: CanvasRenderingContext2D, s: string, x: number, y: number, max: number, lh: number, maxL: number): number {
  const ws = s.split(' '); let line = '', n = 0;
  for (let i = 0; i < ws.length; i++) {
    const t = line ? line + ' ' + ws[i] : ws[i];
    if (g.measureText(t).width > max && line) {
      if (n === maxL - 1) { g.fillText(fit(g, line + ' ' + ws.slice(i).join(' '), max), x, y); return y; }
      g.fillText(line, x, y); y += lh; n++; line = ws[i];
    } else line = t;
  }
  if (line) g.fillText(line, x, y);
  return y;
}
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function check(g: CanvasRenderingContext2D, x: number, y: number, s: number, cor: string) { g.strokeStyle = cor; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + s * 0.3, y + s * 0.52); g.lineTo(x + s * 0.45, y + s * 0.66); g.lineTo(x + s * 0.72, y + s * 0.36); g.stroke(); }
function half(g: CanvasRenderingContext2D, x: number, y: number, s: number, cor: string) { g.fillStyle = cor; g.beginPath(); g.arc(x + s / 2, y + s / 2, s * 0.2, Math.PI / 2, -Math.PI / 2); g.closePath(); g.fill(); g.strokeStyle = cor; g.lineWidth = 4; g.beginPath(); g.arc(x + s / 2, y + s / 2, s * 0.2, 0, Math.PI * 2); g.stroke(); }
function mix(hex: string, a: number): string { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
export { toPng };
