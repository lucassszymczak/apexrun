// BONECO DO REPLAY E DO VÍDEO (26/11/2026, aprovado pelo Lucas a partir de vídeos de sobrevoo).
// Pictograma plano e "cheio": membros arredondados, um brilho de um lado (volume), contorno na
// cor do fundo e sombra no chão. Corredor (passada), ciclista (pedalada) e a comemoração da
// chegada (vira de frente e levanta os braços). Só desenho: nenhum número do treino usa isto.
// Coordenadas: o chão (pés) fica em y = 0; o boneco ocupa de y = −60 a 2 e de x = −30 a 30.
export const BONECO_VIEWBOX = '-30 -60 60 62';
export type Cores = { corpo: string; borda: string; luz: string; roda: string };

export function coresDoTema(el: Element = document.documentElement): Cores {
  const cs = getComputedStyle(el), v = (k: string, r: string) => cs.getPropertyValue(k).trim() || r;
  const corpo = v('--magenta', '#E8459A');
  return { corpo, borda: v('--noite', '#0D0F1A'), luz: clareia(corpo, 0.45), roda: v('--texto', '#F2F2F7') };
}
// mistura a cor com branco (k = 0..1 de branco), em hex: funciona também dentro de imagem SVG
export function clareia(hex: string, k: number): string {
  const h = hex.replace('#', ''); const x = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  if (!isFinite(x)) return hex;
  const c = [x >> 16, (x >> 8) & 255, x & 255].map((v) => Math.round(v + (255 - v) * k));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
// o desenho como imagem SVG completa (para o vídeo)
export function svgCompleto(interno: string, px = 128): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BONECO_VIEWBOX}" width="${px}" height="${Math.round(px * 62 / 60)}">${interno}</svg>`;
}

type Pt = [number, number];
const n = (x: number) => x.toFixed(1);
const linhas = (l: Pt[][], w: number, cor: string) => l.map((pts) => `<polyline points="${pts.map((p) => n(p[0]) + ',' + n(p[1])).join(' ')}" fill="none" stroke="${cor}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
const P = (ang: number, len: number, x: number, y: number): Pt => [x + Math.sin(ang) * len, y + Math.cos(ang) * len];

function corpo(C: Cores, partes: { l: Pt[][]; w: number }[], cab: [number, number, number], sombra = 11) {
  const desloca = (l: Pt[][], d: number) => l.map((pts) => pts.map((p) => [p[0] - d, p[1] - d] as Pt));
  return `<ellipse cx="0" cy="0" rx="${sombra}" ry="3.2" fill="#000" opacity="0.38"/>` +
    partes.map((g) => linhas(g.l, g.w + 3, C.borda)).join('') + `<circle cx="${n(cab[0])}" cy="${n(cab[1])}" r="${n(cab[2] + 1.6)}" fill="${C.borda}"/>` +
    partes.map((g) => linhas(g.l, g.w, C.corpo)).join('') + `<circle cx="${n(cab[0])}" cy="${n(cab[1])}" r="${n(cab[2])}" fill="${C.corpo}"/>` +
    partes.map((g) => linhas(desloca(g.l, g.w * 0.18), g.w * 0.32, C.luz)).join('') + `<circle cx="${n(cab[0] - 1.6)}" cy="${n(cab[1] - 1.6)}" r="${n(cab[2] * 0.42)}" fill="${C.luz}"/>`;
}

// corrida de lado; fase 0..1 (uma passada completa); amp 0..1 (1 = passada cheia, 0 = parado em pé)
export function correndo(C: Cores, fase: number, amp = 1): string {
  const a = fase * Math.PI * 2, s = Math.sin(a) * amp, pulo = Math.abs(Math.sin(a)) * 2.5 * amp;
  const quad: Pt = [0, -21 - pulo], omb: Pt = [2.5 * amp + 0.5, -36 - pulo];
  const pernas = [1, -1].map((L) => { const sw = L * s * 0.8; const joe = P(sw, 10.5, ...quad); const pe = P(sw - (0.15 + Math.max(0, L * s) * 1.3) * amp, 10.5, ...joe); return [quad, joe, pe]; });
  const bracos = [1, -1].map((L) => { const sw = -L * s * 0.9; const cot = P(sw, 7.5, ...omb); const mao = P(sw + 1.6 * amp + 0.1, 6.5, ...cot); return [omb, cot, mao]; });
  return corpo(C, [{ l: [pernas[1], bracos[1]], w: 7.5 }, { l: [[quad, omb]], w: 11.5 }, { l: [pernas[0], bracos[0]], w: 8 }], [omb[0] + 1.5, omb[1] - 8, 6.6]);
}

// de frente (chegada): braços de 0 (para baixo) a 1 (em V); pulo em unidades do desenho
export function deFrente(C: Cores, bracos: number, pulo = 0): string {
  const quad: Pt = [0, -21 - pulo], omb: Pt = [0, -36 - pulo];
  const pernas = [-1, 1].map((L) => [[L * 2.5, quad[1]], [L * 3.5, quad[1] + 10.5], [L * 4, -pulo * 0.2]] as Pt[]);
  const br = [-1, 1].map((L) => { const o: Pt = [L * 4.5, omb[1] + 1.5]; const cot = P(L * (0.2 + bracos * 2.55), 7.5, ...o); const mao = P(L * (0.1 + bracos * 2.75), 6.5, ...cot); return [o, cot, mao]; });
  return corpo(C, [{ l: pernas, w: 8 }, { l: [[quad, omb]], w: 12.5 }, { l: br, w: 7.5 }], [0, omb[1] - 8, 6.8]);
}

// ciclista de lado (pedal): rodas, quadro e pernas pedalando; fase 0..1 (uma volta do pedal)
export function ciclista(C: Cores, fase: number): string {
  const a = fase * Math.PI * 2, rr = 9;
  const r1: Pt = [-14, -rr], r2: Pt = [14, -rr], mov: Pt = [0, -rr], sel: Pt = [-6, -24], gui: Pt = [11, -27];
  const roda = (c: Pt) => `<circle cx="${c[0]}" cy="${c[1]}" r="${rr}" fill="none" stroke="${C.borda}" stroke-width="4.5"/><circle cx="${c[0]}" cy="${c[1]}" r="${rr}" fill="none" stroke="${C.roda}" stroke-width="2"/>`;
  const quadro: Pt[][] = [[r1, mov, sel, r1], [sel, gui, mov], [gui, r2]];
  const quad: Pt = [sel[0], sel[1] - 2], omb: Pt = [6, -37];
  const pedal = (L: number): Pt => [mov[0] + Math.cos(a + (L > 0 ? 0 : Math.PI)) * 4, mov[1] + Math.sin(a + (L > 0 ? 0 : Math.PI)) * 4];
  const perna = (L: number): Pt[] => { const p = pedal(L); return [quad, [(quad[0] + p[0]) / 2 + 4, (quad[1] + p[1]) / 2 - 1], p]; };
  const gente = corpo(C, [{ l: [perna(-1)], w: 7.5 }, { l: [[quad, omb]], w: 11 }, { l: [perna(1), [omb, [12, -31], gui]], w: 7.5 }], [omb[0] + 4, omb[1] - 7, 6.4], 20).replace(/^<ellipse[^>]*\/>/, '');
  return `<ellipse cx="0" cy="0" rx="20" ry="3.2" fill="#000" opacity="0.38"/>` + roda(r1) + roda(r2) + linhas(quadro, 5.5, C.borda) + linhas(quadro, 2.8, C.roda) + gente;
}

// correndo visto de costas (indo para dentro da tela) ou de frente (vindo): pernas sobem
// alternadas, braços dobrados balançam ao contrário, o corpo quica um pouco. Mesmo desenho
// nos dois sentidos (o pictograma não tem rosto).
export function correndoEixo(C: Cores, fase: number, amp = 1): string {
  const a = fase * Math.PI * 2, s = Math.sin(a) * amp, pulo = Math.abs(s) * 2.6, bal = s * 1.4; // bal: o corpo balança de lado
  const qY = -21 - pulo, oY = -36 - pulo;
  const pernas = [-1, 1].map((L) => { const sobe = Math.max(0, L * s); // a perna do lado L sobe (o pé vai para trás e para cima)
    return [[L * 3.2 + bal * 0.4, qY], [L * (4.4 + sobe * 1.6) + bal * 0.2, qY + 10.5 - sobe * 2.5], [L * (4.4 - sobe * 1.2), -pulo * 0.2 - sobe * 13]] as Pt[]; });
  const bracos = [-1, 1].map((L) => { const vai = -L * s; // braço oposto à perna que sobe
    return [[L * 5.6 + bal, oY + 1.5], [L * (9 - vai * 0.8) + bal, oY + 8.5 + vai * 1.5], [L * (6.5 - vai * 1.5) + bal, oY + 6 - vai * 6.5]] as Pt[]; });
  return corpo(C, [{ l: pernas, w: 8 }, { l: [[[bal * 0.4, qY], [bal, oY]]], w: 12.5 }, { l: bracos, w: 7 }], [bal * 1.1, oY - 8, 6.6], 10);
}

// ciclista visto de costas ou de frente: a roda vira um traço vertical, o guidão aparece dos
// dois lados do corpo (com as mãos nele) e as pernas sobem e descem alternadas com o pedal
export function ciclistaEixo(C: Cores, fase: number): string {
  const a = fase * Math.PI * 2;
  const roda = `<line x1="0" y1="-17" x2="0" y2="-1" stroke="${C.borda}" stroke-width="7" stroke-linecap="round"/><line x1="0" y1="-17" x2="0" y2="-1" stroke="${C.roda}" stroke-width="3.2" stroke-linecap="round"/>`;
  const guidao = linhas([[[-15, -29], [15, -29]]], 5.5, C.borda) + linhas([[[-15, -29], [15, -29]]], 2.8, C.roda);
  const bal = Math.sin(a) * 1, qY = -25, oY = -39;
  const pernas = [-1, 1].map((L) => { const pd = Math.sin(a + (L > 0 ? 0 : Math.PI)); return [[L * 3, qY], [L * (6.5 + pd * 0.8), -18 + pd * 4.5], [L * 3.6, -8 + pd * 4.5]] as Pt[]; });
  const bracos = [-1, 1].map((L) => [[L * 5 + bal, oY + 1.5], [L * 10, oY + 5], [L * 11, -29]] as Pt[]);
  const gente = corpo(C, [{ l: pernas, w: 7.5 }, { l: [[[0, qY], [bal, oY]]], w: 11.5 }, { l: bracos, w: 6.5 }], [bal * 1.2, oY - 7.5, 6.4]).replace(/^<ellipse[^>]*\/>/, '');
  return `<ellipse cx="0" cy="0" rx="9" ry="3" fill="#000" opacity="0.38"/>` + roda + guidao + gente;
}

// para onde o boneco olha na tela, a partir do rumo NA TELA (graus; 0 = subindo na tela,
// 90 = para a direita, 180 = descendo, 270 = para a esquerda):
// subindo ou descendo (até 35° da vertical) → de costas/de frente; senão, de lado, virado para
// o lado em que anda (espelhado quando vai para a esquerda). Assim ele nunca corre de costas.
export type Vista = 'lado' | 'lado-esq' | 'eixo';
export function vistaDoRumo(rumoTela: number | null | undefined): Vista {
  if (rumoTela == null || !isFinite(rumoTela)) return 'lado';
  const h = ((rumoTela % 360) + 360) % 360;
  if (h < 35 || h > 325 || Math.abs(h - 180) < 35) return 'eixo';
  return h > 180 ? 'lado-esq' : 'lado';
}
const vira = (v: Vista, svg: string) => (v === 'lado-esq' ? `<g transform="scale(-1 1)">${svg}</g>` : svg);

// bandeira quadriculada da chegada (pé do mastro em 0,0)
export function bandeira(C: Cores): string {
  let q = ''; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) if ((r + c) % 2 === 0) q += `<rect x="${1 + c * 3.5}" y="${-34 + r * 3.5}" width="3.5" height="3.5" fill="#0D0F1A"/>`;
  return `<line x1="0" y1="0" x2="0" y2="-35" stroke="${C.roda}" stroke-width="1.6"/><rect x="1" y="-34" width="14" height="10.5" fill="#fff" stroke="${C.borda}" stroke-width="0.8"/>${q}`;
}

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
// pose do momento. comemora: null (correndo) ou 0..1 (segundos da comemoração ÷ duração)
// rumoTela: direção em que o boneco anda NA TELA (ver vistaDoRumo); sem ele, de lado para a direita
export function pose(C: Cores, o: { bike: boolean; fase: number; amp: number; comemora: number | null; rumoTela?: number | null }): string {
  const c = o.comemora, v = vistaDoRumo(o.rumoTela);
  const g = (nome: string, svg: string) => `<g data-pose="${nome}" data-vista="${v}">${svg}</g>`; // nome da pose e vista (testes)
  const corre = (f: number, amp: number) => vira(v, v === 'eixo' ? correndoEixo(C, f, amp) : correndo(C, f, amp));
  const pedala = (f: number) => vira(v, v === 'eixo' ? ciclistaEixo(C, f) : ciclista(C, f));
  if (c == null) return o.bike ? g('pedala', pedala(o.fase)) : g('corre', corre(o.fase, o.amp));
  if (o.bike) return g('chegou', pedala(0)); // o ciclista para; não larga a bike
  if (c < 0.18) return g('freia', corre(0.3, 0.35 * (1 - c / 0.18)));
  if (c < 0.3) return g('frente', deFrente(C, 0));
  if (c < 0.5) return g('frente', deFrente(C, ease((c - 0.3) / 0.2)));
  return g('comemora', deFrente(C, 1, Math.abs(Math.sin((c - 0.5) * Math.PI * 5)) * 3));
}
// ritmo da animação (ciclos por segundo de relógio)
export const RITMO = { corrida: 1.4, bike: 1.1 };
