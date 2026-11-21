// IMAGEM 9:16 DO PLANO DE PROVA (Fase 4 · Etapa 3; design/telas-fase4/PlanoImagem). 1080×1920,
// fundo --noite. Os 34% de cima ficam livres (relógio da tela de bloqueio) e os 12% de baixo
// também (botões do iPhone). Tabela de blocos com números grandes; símbolo e nome da marca no pé.
// O menor texto tem 40 px: na tela do iPhone (≈ 390 pt de largura) equivale a mais de 13 px.
import * as E from '../../engine.mjs';
import { tokens, SYM, toPng } from './card';
import type { Plano } from '../../plano.mjs';

export const IMG = { W: 1080, H: 1920, TOPO_LIVRE: 0.34, PE_LIVRE: 0.12, MIN_FONTE: 40 };
export type ImgInput = { titulo: string; sub: string; plano: Plano; duro: { de: number; ate: number } | null; rodape: string };

const hms = (s: number) => E.hms(Math.round(s));

export async function renderPlanoImg(inp: ImgInput, canvas?: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  try { await (document as any).fonts?.load?.('500 48px Outfit'); await (document as any).fonts?.load?.('400 48px Outfit'); } catch { /* fonte do sistema */ }
  const T = tokens();
  const c = canvas || document.createElement('canvas');
  c.width = IMG.W; c.height = IMG.H;
  const g = c.getContext('2d')!;
  const F = (w: number, px: number) => `${w} ${px}px ${T['font-brand'] || 'Outfit'}, system-ui, sans-serif`;
  const M = 72, top = Math.round(IMG.H * IMG.TOPO_LIVRE), bottom = Math.round(IMG.H * (1 - IMG.PE_LIVRE));
  g.fillStyle = T.noite; g.fillRect(0, 0, IMG.W, IMG.H);
  g.textBaseline = 'alphabetic';

  // linhas da tabela: blocos de 5 km; o trecho mais duro e a metade entram como linhas extras
  type Row = { a: string; b: string; c: string; tom?: string };
  const rows: Row[] = [];
  const meia = inp.plano.passagens[0];
  let meiaPosta = false;
  for (const bl of inp.plano.blocos) {
    if (!meiaPosta && bl.de + bl.kms.reduce((s, l) => s + l.distKm, 0) - 1 >= meia.km) { rows.push({ a: meia.rotulo, b: '', c: hms(meia.tS), tom: T.texto }); meiaPosta = true; }
    rows.push({ a: bl.rotulo, b: E.paceStr(bl.paceSkm), c: hms(bl.acumS), tom: bl.terreno === 'subida' || bl.terreno === 'sobe e desce' ? T.atencao : undefined });
  }
  if (inp.duro) {
    const ls = inp.plano.linhas.filter((l) => l.km >= inp.duro!.de && l.km <= inp.duro!.ate);
    const d = ls.reduce((s, l) => s + l.distKm, 0), t = ls.reduce((s, l) => s + l.paceSkm * l.distKm, 0);
    const i = rows.findIndex((r) => r.a.startsWith('km ') && +r.a.slice(3).split('–')[0] > inp.duro!.de);
    rows.splice(i < 0 ? rows.length : i, 0, { a: 'Subida km ' + inp.duro.de + '–' + inp.duro.ate, b: E.paceStr(t / d), c: '', tom: T.atencao });
  }
  // a última linha é a chegada
  const last = rows[rows.length - 1]; if (last) { last.a = 'Chegada'; last.tom = T.magenta; }

  // tamanhos: cabem entre o topo livre e o pé (com a marca)
  const brandH = 80, headH = 150, colH = 56;
  const rowH = Math.max(64, Math.min(96, Math.floor((bottom - top - brandH - headH - colH - 24) / Math.max(1, rows.length))));
  const fs = Math.max(IMG.MIN_FONTE, Math.min(56, Math.floor(rowH * 0.62)));
  let y = top + 64;
  g.fillStyle = T.texto; g.font = F(500, 56); g.fillText(fit(g, inp.titulo, IMG.W - 2 * M), M, y);
  y += 60; g.fillStyle = T['texto-2']; g.font = F(400, 40); g.fillText(fit(g, inp.sub, IMG.W - 2 * M), M, y);
  y += colH + 20;
  const xB = IMG.W - M - 300, xC = IMG.W - M;
  g.fillStyle = T['texto-3']; g.font = F(500, 40);
  g.fillText('Trecho', M, y); g.textAlign = 'right'; g.fillText('Pace', xB, y); g.fillText('Passa em', xC, y); g.textAlign = 'left';
  y += 14; g.fillStyle = T.linha; g.fillRect(M, y, IMG.W - 2 * M, 2);
  for (const r of rows) {
    y += rowH;
    g.font = F(r.tom ? 500 : 400, fs); g.fillStyle = r.tom || T.texto; g.fillText(fit(g, r.a, xB - M - 230), M, y);
    g.textAlign = 'right'; g.font = F(500, fs); g.fillStyle = r.tom || T.texto;
    if (r.b) g.fillText(r.b, xB, y);
    if (r.c) g.fillText(r.c, xC, y);
    g.textAlign = 'left';
  }
  // marca no pé (acima da faixa livre dos botões)
  const by = bottom - 24;
  const s = 56 / 90; g.save(); g.translate(M, by - 56); g.scale(s, s);
  g.fillStyle = T.magenta; g.fill(new Path2D(SYM.ida)); g.fillStyle = T.ciano; g.fill(new Path2D(SYM.volta)); g.fillStyle = T.violeta; g.fill(new Path2D(SYM.pico));
  g.restore();
  g.fillStyle = T.texto; g.font = F(500, 40); g.fillText('Apex Performance', M + 76, by - 10);
  g.textAlign = 'right'; g.fillStyle = T['texto-2']; g.font = F(400, 40); g.fillText(inp.rodape, IMG.W - M, by - 10); g.textAlign = 'left';
  (window as any).__apexPlanoImg = { W: c.width, H: c.height, top, bottom, conteudoAte: y, linhas: rows.length, fonteMin: Math.min(fs, 40) };
  return c;
}
function fit(g: CanvasRenderingContext2D, s: string, max: number): string {
  if (g.measureText(s).width <= max) return s;
  let t = s; while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}
export { toPng };
