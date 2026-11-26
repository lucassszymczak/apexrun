// VÍDEO DO TREINO 9:16 (Stories e Reels; aprovado pelo Lucas em 26/11/2026).
// Câmera inclinada seguindo o boneco pelo mapa do tema (escuro ou claro), rastro colorido pela
// inclinação, km ao lado do boneco, "Visão do percurso", subida e descida do km, as fotos do treino
// no ponto em que foram tiradas e a comemoração na chegada. Gerado no próprio aparelho, quadro a
// quadro (WebCodecs + MP4), só quando a pessoa pede. Nada é enviado: o arquivo fica no aparelho.
// Duração: 4 s por km, de 12 a 56 s, mais 4 s de comemoração (máximo de 1 minuto).
// Privacidade: o vídeo começa e termina nos pontos visíveis do trajeto (início e fim ocultos pela
// regra do treino); a comemoração acontece no último ponto visível, nunca na chegada real.
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { Track } from '../track';
import { sharedTrack } from '../privacy';
import { rumo } from '../map/rumo';
import { pose, bandeira, coresDoTema, svgCompleto, RITMO } from '../map/boneco';
import { SYM } from './card';

export const VIDEO = { W: 1080, H: 1920, FPS: 24, POR_KM: 4, MIN: 12, MAX_CORRIDA: 56, COMEMORA: 4, CODEC: 'avc1.640028' };
export const duracaoVideo = (km: number) => Math.max(VIDEO.MIN, Math.min(VIDEO.MAX_CORRIDA, Math.round(km * VIDEO.POR_KM)));

export async function videoSuportado(): Promise<boolean> {
  try {
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return false;
    const s = await VideoEncoder.isConfigSupported({ codec: VIDEO.CODEC, width: VIDEO.W, height: VIDEO.H, bitrate: 8e6, framerate: VIDEO.FPS });
    return !!s.supported;
  } catch { return false; }
}

export type FotoVideo = { i: number; blob: Blob; hora: string | null };
export type VideoOpts = {
  tr: Track; mapa: 'ocultar' | 'completo'; raio: number; tema: 'dark' | 'light';
  titulo: string; bike: boolean; fotos: FotoVideo[];
  onProgresso?: (p: number) => void; sinal?: AbortSignal;
};

const kmTxt = (m: number) => (m / 1000).toFixed(1).replace('.', ',');
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
function tok(): Record<string, string> {
  const cs = getComputedStyle(document.documentElement), v = (k: string) => cs.getPropertyValue('--' + k).trim();
  return { noite: v('noite'), sup: v('superficie'), sup2: v('superficie-2'), linha: v('linha'), texto: v('texto'), texto2: v('texto-2'), texto3: v('texto-3'), ciano: v('ciano'), magenta: v('magenta'), violeta: v('violeta'), z4: v('zona-4'), z5: v('zona-5') };
}
// faixa de inclinação do rastro (a mesma legenda do vídeo): < 1%, 1–2%, > 2% (subindo ou descendo)
const faixa = (g: number | null) => (g == null ? 0 : Math.abs(g) < 1 ? 0 : Math.abs(g) <= 2 ? 1 : 2);
async function imagem(src: string | Blob): Promise<HTMLImageElement | ImageBitmap> {
  if (src instanceof Blob) return createImageBitmap(src);
  const im = new Image(); im.src = src; await im.decode(); return im;
}

export async function gerarVideo(o: VideoOpts): Promise<Blob> {
  const { tr } = o, T = tok(), C = coresDoTema();
  // trecho que pode aparecer (regra de privacidade do treino)
  const sh = sharedTrack(tr, { mapa: o.mapa, raio: o.raio });
  if (!sh.show) throw new Error('Com início e fim ocultos, não sobra trajeto para o vídeo.');
  const vis: number[] = []; for (let i = 0; i < tr.lat.length; i++) if (tr.lat[i] != null && sh.keep(i) && tr.dist[i] != null) vis.push(i);
  const a = vis[0], b = vis[vis.length - 1];
  const d0 = tr.dist[a] as number, d1 = tr.dist[b] as number, metros = d1 - d0;
  const seg = duracaoVideo(metros / 1000), NC = seg * VIDEO.FPS, NF = VIDEO.COMEMORA * VIDEO.FPS;
  // índice do trajeto na distância m (dentro do trecho visível)
  let cur = 0;
  const idxEm = (m: number) => { while (cur < vis.length - 1 && (tr.dist[vis[cur + 1]] as number) <= m) cur++; while (cur > 0 && (tr.dist[vis[cur]] as number) > m) cur--; return vis[cur]; };

  // mapa escondido, do tamanho do vídeo (540×960 com densidade 2)
  const ml: any = await import('maplibre-gl'); await import('maplibre-gl/dist/maplibre-gl.css');
  const { STYLE, recolore } = await import('../map/RuasMap');
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:-10000px;top:0;width:540px;height:960px;';
  document.body.appendChild(box);
  const MapC = ml.Map || ml.default.Map;
  const map = new MapC({ container: box, style: STYLE[o.tema], interactive: false, attributionControl: false, preserveDrawingBuffer: true, pixelRatio: 2, fadeDuration: 0, center: [tr.lon[a], tr.lat[a]], zoom: 15 });
  const fim = () => { try { map.remove(); } catch { /* */ } box.remove(); };
  try {
    await new Promise<void>((res, rej) => { map.once('load', () => res()); map.once('error', (e: any) => rej(new Error('o mapa não carregou' + (e && e.error && e.error.status ? ' (' + e.error.status + ')' : '')))); setTimeout(() => rej(new Error('o mapa não respondeu')), 20000); });
    recolore(map);
    // trajeto inteiro (apagado) e o percorrido (colorido pela inclinação), só nos trechos visíveis
    const cor = [T.ciano, T.z4, T.z5];
    const todo = sh.runs.map((r) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: r.map((i) => [tr.lon[i], tr.lat[i]]) } }));
    map.addSource('todo', { type: 'geojson', data: { type: 'FeatureCollection', features: todo } });
    map.addSource('feito', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'todo-b', type: 'line', source: 'todo', paint: { 'line-color': T.noite, 'line-width': 9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'todo', type: 'line', source: 'todo', paint: { 'line-color': T.texto3, 'line-opacity': 0.55, 'line-width': 4 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'feito', type: 'line', source: 'feito', paint: { 'line-color': ['get', 'cor'], 'line-width': 6 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    // percorrido até o índice ii: trechos visíveis, quebrados por faixa de inclinação
    const feito = (ii: number) => {
      const fs: any[] = [];
      for (const r of sh.runs) { let pts: number[][] = [], f = -1;
        for (const i of r) { if (i > ii) break; const fi = faixa(tr.grade[i]); if (f >= 0 && fi !== f && pts.length) { pts.push([tr.lon[i] as number, tr.lat[i] as number]); fs.push({ type: 'Feature', properties: { cor: cor[f] }, geometry: { type: 'LineString', coordinates: pts } }); pts = []; } f = fi; pts.push([tr.lon[i] as number, tr.lat[i] as number]); }
        if (pts.length > 1) fs.push({ type: 'Feature', properties: { cor: cor[f < 0 ? 0 : f] }, geometry: { type: 'LineString', coordinates: pts } }); }
      return { type: 'FeatureCollection', features: fs };
    };
    await new Promise<void>((res) => { map.once('idle', () => res()); setTimeout(res, 8000); });

    // imagens: fotos do treino (só as que caem no trecho visível) e o símbolo da marca
    const fotos: { i: number; img: any; hora: string | null }[] = [];
    for (const f of o.fotos) if (f.i >= a && f.i <= b && sh.keep(f.i)) { try { fotos.push({ i: f.i, img: await imagem(f.blob), hora: f.hora }); } catch { /* foto ilegível */ } }
    const imBandeira = await imagem('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -40 40 42" width="80" height="84">${bandeira(C)}</svg>`));
    // visão do percurso (mini mapa): projeção simples dos trechos visíveis
    const xs = vis.map((i) => tr.lon[i] as number), ys = vis.map((i) => tr.lat[i] as number);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const kx = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
    const esc = Math.min(232 / Math.max(1e-9, (x1 - x0) * kx), 150 / Math.max(1e-9, y1 - y0));
    const V = (i: number): [number, number] => [10 + ((tr.lon[i] as number) - x0) * kx * esc + (232 - (x1 - x0) * kx * esc) / 2, 158 - ((tr.lat[i] as number) - y0) * esc - (150 - (y1 - y0) * esc) / 2];

    // codificador de vídeo + MP4
    const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: VIDEO.W, height: VIDEO.H, frameRate: VIDEO.FPS }, fastStart: 'in-memory' });
    let erroEnc: any = null;
    const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { erroEnc = e; } });
    enc.configure({ codec: VIDEO.CODEC, width: VIDEO.W, height: VIDEO.H, bitrate: 8e6, framerate: VIDEO.FPS });
    const cv = document.createElement('canvas'); cv.width = VIDEO.W; cv.height = VIDEO.H;
    const g = cv.getContext('2d')!;
    const F = (w: number, px: number) => `${w} ${px}px Outfit, system-ui, sans-serif`;
    try { await (document as any).fonts?.load?.('500 32px Outfit'); await (document as any).fonts?.load?.('400 32px Outfit'); } catch { /* fonte do sistema */ }
    const painel = (x: number, y: number, w: number, h: number) => { g.save(); g.globalAlpha = 0.86; g.fillStyle = T.noite; g.beginPath(); (g as any).roundRect(x, y, w, h, 24); g.fill(); g.globalAlpha = 1; g.strokeStyle = T.linha; g.lineWidth = 2; g.stroke(); g.restore(); };
    const ritmo = o.bike ? RITMO.bike : RITMO.corrida;
    const vistas: Record<string, number> = {};
    let camRumo: number | null = null, fase = 0, total = NC + NF;
    for (let k = 0; k < total; k++) {
      if (o.sinal?.aborted) throw new DOMException('Cancelado', 'AbortError');
      if (erroEnc) throw erroEnc;
      const comemora = k >= NC ? (k - NC) / Math.max(1, NF - 1) : null;
      const m = d0 + metros * Math.min(1, k / Math.max(1, NC - 1));
      const i = idxEm(m);
      fase = (fase + ritmo / VIDEO.FPS) % 1;
      const r = rumo(tr, i, 25); if (r != null) { if (camRumo == null) camRumo = r; else { const d: number = ((r - (camRumo as number) + 540) % 360) - 180; camRumo = ((camRumo as number) + d * 0.08 + 360) % 360; } }
      const gira = comemora != null ? 38 * ease(comemora) : 0, zz = comemora != null ? 1.3 * ease(Math.min(1, comemora * 1.4)) : 0;
      map.jumpTo({ center: [tr.lon[i], tr.lat[i]], bearing: (camRumo ?? 0) + gira, pitch: 58, zoom: 16.1 + zz, padding: { top: 300, bottom: 0, left: 0, right: 0 } });
      (map.getSource('feito') as any).setData(feito(i));
      await new Promise<void>((res) => { let ok = false; const pronto = () => { if (!ok) { ok = true; res(); } }; map.once('idle', pronto); setTimeout(pronto, 2500); });
      g.drawImage(map.getCanvas(), 0, 0, VIDEO.W, VIDEO.H);
      // bandeira na chegada (último ponto visível) e o boneco com o km
      const pb = map.project([tr.lon[b], tr.lat[b]]); g.drawImage(imBandeira as any, pb.x * 2 + 26, pb.y * 2 - 80, 80, 84);
      const amp = comemora != null ? 0 : 0.35 + 0.65 * Math.min(1, ((tr.dist[b] as number) - m) / 60);
      // direção na tela = rumo do trajeto − rumo da câmera (a câmera vai atrás e gira na chegada)
      const rumoTela = r != null ? r - ((camRumo ?? 0) + gira) : 0;
      const pz = pose(C, { bike: o.bike, fase, amp, comemora, rumoTela }); const vz = /data-vista="([a-z-]+)"/.exec(pz); if (vz) vistas[vz[1]] = (vistas[vz[1]] || 0) + 1;
      const bon = await imagem('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgCompleto(pz, 96)));
      const pp = map.project([tr.lon[i], tr.lat[i]]); g.drawImage(bon as any, pp.x * 2 - 48, pp.y * 2 - 96, 96, 99);
      const rot = (comemora != null ? 'Chegada · ' : '') + kmTxt(m) + ' km'; // km de verdade do treino
      g.font = F(500, 28); const rw = g.measureText(rot).width + 36; painel(pp.x * 2 + 40, pp.y * 2 - 118, rw, 56); g.fillStyle = T.texto; g.textBaseline = 'middle'; g.fillText(rot, pp.x * 2 + 58, pp.y * 2 - 89);
      // marca e título (no alto, abaixo da área do Instagram)
      painel(32, 256, 660, 112);
      g.save(); g.translate(56, 280); g.scale(0.56, 0.56); g.fillStyle = T.magenta; g.fill(new Path2D(SYM.ida)); g.fillStyle = T.ciano; g.fill(new Path2D(SYM.volta)); g.fillStyle = T.violeta; g.fill(new Path2D(SYM.pico)); g.restore();
      g.fillStyle = T.texto; g.font = F(500, 30); g.textBaseline = 'alphabetic'; g.fillText('Apex Performance', 124, 312);
      g.fillStyle = T.texto2; g.font = F(400, 26); g.fillText(o.titulo, 56, 352);
      // visão do percurso
      painel(748, 400, 300, 220); g.fillStyle = T.texto2; g.font = F(500, 22); g.fillText('VISÃO DO PERCURSO', 772, 440);
      g.save(); g.translate(762, 446); g.lineCap = 'round'; g.lineJoin = 'round';
      for (const run of sh.runs) { g.strokeStyle = T.texto3; g.lineWidth = 4; g.beginPath(); run.forEach((ix, q) => { const [x, y] = V(ix); if (q) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); g.strokeStyle = T.ciano; g.lineWidth = 5; g.beginPath(); let on = false; for (const ix of run) { if (ix > i) break; const [x, y] = V(ix); if (on) g.lineTo(x, y); else { g.moveTo(x, y); on = true; } } g.stroke(); }
      const [vx, vy] = V(i); g.fillStyle = T.ciano; g.strokeStyle = T.noite; g.lineWidth = 3; g.beginPath(); g.arc(vx, vy, 8, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore();
      // km atual: subida e descida (altitude do relógio) e a legenda do rastro
      const kmN = Math.floor(m / 1000), ini = kmN * 1000; let sub = 0, des = 0, ant: number | null = null;
      for (const ix of vis) { const dd = tr.dist[ix] as number; if (dd < ini) continue; if (dd > m) break; const al = tr.alt[ix]; if (al == null) continue; if (ant != null) { const df = al - ant; if (Math.abs(df) >= 1) { if (df > 0) sub += df; else des -= df; ant = al; } } else ant = al; }
      painel(748, 640, 300, 196); g.fillStyle = T.texto2; g.font = F(500, 22); g.fillText('KM ' + (kmN + 1), 772, 680);
      g.fillStyle = T.texto; g.font = F(500, 30); g.fillText('▲ ' + Math.round(sub) + ' m   ▼ ' + Math.round(des) + ' m', 772, 724);
      g.fillStyle = T.texto2; g.font = F(500, 22); g.fillText('INCLINAÇÃO', 772, 768);
      ['<1%', '1–2%', '>2%'].forEach((t, q) => { const x = 772 + q * 90; g.fillStyle = cor[q]; g.beginPath(); (g as any).roundRect(x, 782, 64, 10, 5); g.fill(); g.fillStyle = T.texto2; g.font = F(400, 20); g.fillText(t, x + 4, 818); });
      // foto do treino: aparece ~2,5 s quando o boneco passa por ela
      const ff = fotos.find((f) => { const kf = Math.round((((tr.dist[f.i] as number) - d0) / Math.max(1, metros)) * (NC - 1)); return k >= kf && k < kf + 2.5 * VIDEO.FPS; });
      if (ff) { const kf = Math.round((((tr.dist[ff.i] as number) - d0) / Math.max(1, metros)) * (NC - 1)); const e = Math.min(1, (k - kf) / 8), s2 = Math.min(1, (kf + 2.5 * VIDEO.FPS - k) / 8), al = Math.min(e, s2);
        g.save(); g.globalAlpha = al; const x = 32, y = 400, wd = 420; painel(x, y, wd, wd + 92); const lado = Math.min(ff.img.width, ff.img.height);
        g.save(); g.beginPath(); (g as any).roundRect(x + 16, y + 16, wd - 32, wd - 32, 16); g.clip(); g.drawImage(ff.img, (ff.img.width - lado) / 2, (ff.img.height - lado) / 2, lado, lado, x + 16, y + 16, wd - 32, wd - 32); g.restore();
        g.fillStyle = T.texto; g.font = F(500, 26); g.fillText('Foto do treino', x + 20, y + wd + 26); g.fillStyle = T.texto2; g.font = F(400, 22); g.fillText('km ' + kmTxt(tr.dist[ff.i] as number) + (ff.hora ? ' · ' + ff.hora : ''), x + 20, y + wd + 62); g.restore(); }
      // créditos do mapa (licença)
      g.fillStyle = T.texto3; g.font = F(400, 18); g.textAlign = 'right'; g.fillText('© OpenFreeMap · OpenMapTiles · OpenStreetMap', VIDEO.W - 32, 232); g.textAlign = 'left';
      // quadro → vídeo (com espera se o codificador acumular)
      const vf = new VideoFrame(cv, { timestamp: Math.round((k * 1e6) / VIDEO.FPS), duration: Math.round(1e6 / VIDEO.FPS) });
      enc.encode(vf, { keyFrame: k % (VIDEO.FPS * 2) === 0 }); vf.close();
      while (enc.encodeQueueSize > 4) await new Promise((res) => setTimeout(res, 5));
      o.onProgresso?.((k + 1) / total);
    }
    await enc.flush(); enc.close(); muxer.finalize();
    (window as any).__apexVideo = { segundos: total / VIDEO.FPS, quadros: total, a, b, metros, fotos: fotos.length, vistas };
    return new Blob([(muxer.target as ArrayBufferTarget).buffer], { type: 'video/mp4' });
  } finally { fim(); }
}

// compartilhar (menu do aparelho) ou baixar
export async function compartilharVideo(blob: Blob, nome: string, titulo: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], nome, { type: 'video/mp4' }); const nav: any = navigator;
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) { try { await nav.share({ files: [file], title: titulo }); return 'shared'; } catch (e: any) { if (e && e.name === 'AbortError') return 'cancelled'; } }
  const url = URL.createObjectURL(blob); const el = document.createElement('a'); el.href = url; el.download = nome; document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
