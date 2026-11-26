// COMPARTILHAR — "seu treino pronto para postar" (design/telas/Compartilhar.dc.html).
// Prévia do card, formato (Stories 9:16 · Feed 4:5), modelo (Foto · Mapa · Só números),
// até 3 números, foto (do treino ou da galeria) e "Ocultar início e fim" com o raio do treino.
// Ação principal: Compartilhar imagem (menu nativo); secundária: Salvar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconShare, IconPhotoPlus, IconDownload, IconMovie, IconX } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { useApex, toast } from '../store';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, Empty, Seg } from '../ui';
import { dayMon, workoutTitle } from '../fmt';
import { getTrack } from '../db';
import { type Track, colorer } from '../track';
import { privacyOf, sharedTrack } from '../privacy';
import { usePhotos } from '../photos';
import { videoSuportado, duracaoVideo, VIDEO, compartilharVideo } from '../share/video-treino';
import { type Format, type Model, type NumKey, SIZES, numberDefs, defaultNums, renderCard, toPng, shareOrDownload, download } from '../share/card';

type Img = { img: CanvasImageSource; w: number; h: number };
async function loadImg(blob: Blob): Promise<Img> {
  try { const b = await createImageBitmap(blob); return { img: b, w: b.width, h: b.height }; }
  catch {
    const url = URL.createObjectURL(blob);
    const im = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    return { img: im, w: im.naturalWidth, h: im.naturalHeight };
  }
}

export function Compartilhar({ id }: { id: string }) {
  const { st } = useApex();
  const a = st.athlete;
  const w = st.workouts.find((x: any) => x.id === id);
  const priv = useMemo(() => privacyOf(w, a), [w, a]);
  const photos = usePhotos(id);
  const [tr, setTr] = useState<Track | null | undefined>(undefined);
  useEffect(() => { let ok = true; getTrack(id).then((t) => { if (ok) setTr(t); }); return () => { ok = false; }; }, [id]);

  const mapAllowed = priv.mapa !== 'nenhum' && !!(tr && tr.hasGps);
  const [format, setFormat] = useState<Format>('stories');
  const [model, setModel] = useState<Model | null>(null);
  const [ocultar, setOcultar] = useState(priv.mapa !== 'completo');
  const [nums, setNums] = useState<NumKey[]>(() => (w ? defaultNums(w) : []));
  const [photoSel, setPhotoSel] = useState<string | null>(null); // id da foto do treino ou 'galeria'
  const [gallery, setGallery] = useState<Img | null>(null);
  const [busy, setBusy] = useState(false);
  // vídeo 9:16 (gerado no aparelho, só quando pedido)
  const [tipo, setTipo] = useState<'imagem' | 'video'>('imagem');
  const [podeVideo, setPodeVideo] = useState<boolean | null>(null);
  const [prog, setProg] = useState<number | null>(null);
  const [video, setVideo] = useState<{ blob: Blob; url: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => { videoSuportado().then(setPodeVideo); }, []);
  useEffect(() => () => { abortRef.current?.abort(); }, []);
  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url); }, [video]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  // modelo inicial: Foto se houver foto, senão Mapa; sem mapa permitido, Só números
  const m: Model = model || (tr === undefined ? 'numeros' : photos.length ? 'foto' : mapAllowed ? 'mapa' : 'numeros');
  const photoId = photoSel || (photos[0] && photos[0].id) || null;
  const raio = priv.raio;
  const shared = useMemo(() => sharedTrack(tr || null, { mapa: !mapAllowed ? 'nenhum' : ocultar ? 'ocultar' : 'completo', raio }), [tr, mapAllowed, ocultar, raio]);
  useEffect(() => { setVideo(null); }, [ocultar]);
  const band = useMemo(() => (tr && w ? colorer(tr, 'fc', w, a).band : null), [tr, w, a]);

  // foto escolhida (miniatura guardada do treino, ou a imagem da galeria em resolução cheia)
  const [photoImg, setPhotoImg] = useState<Img | null>(null);
  useEffect(() => {
    let ok = true;
    if (photoSel === 'galeria') { setPhotoImg(gallery); return; }
    const p = photos.find((x) => x.id === photoId);
    if (!p) { setPhotoImg(null); return; }
    loadImg(p.blob).then((im) => { if (ok) setPhotoImg(im); }).catch(() => setPhotoImg(null));
    return () => { ok = false; };
  }, [photoSel, photoId, photos, gallery]);

  // redesenha a prévia (é o mesmo canvas que vira o PNG)
  useEffect(() => {
    if (!w || !canvasRef.current || tr === undefined) return;
    let alive = true;
    renderCard({ format, model: m, w, tr: tr || null, shared, band, photo: m === 'foto' ? photoImg : null, nums, title: workoutTitle(w) }, canvasRef.current)
      .then(() => { if (alive && canvasRef.current) canvasRef.current.dataset.ready = format + '-' + m; });
    return () => { alive = false; };
  }, [w, tr, format, m, shared, band, photoImg, nums]);

  if (!w) return (<><PageHead title="Compartilhar" back={href('treinos')} right={null} /><Card><Empty>Treino não encontrado.</Empty></Card></>);
  const defs = numberDefs(w);
  const name = 'apex-' + w.date + '-' + (format === 'stories' ? 'stories' : 'feed') + '.png';
  const out = async (mode: 'share' | 'save') => {
    if (!canvasRef.current) return;
    setBusy(true);
    try {
      const blob = await toPng(canvasRef.current);
      if (mode === 'save') { download(blob, name); toast('Imagem salva (' + SIZES[format].W + '×' + SIZES[format].H + ')'); }
      else {
        const r = await shareOrDownload(blob, name, workoutTitle(w));
        if (r === 'downloaded') toast('Seu aparelho não abre o menu de compartilhar aqui: a imagem foi baixada.');
      }
    } catch (e: any) { toast('Não consegui gerar a imagem: ' + (e && e.message ? e.message : e)); }
    finally { setBusy(false); }
  };
  const gerar = async () => {
    if (!tr) return;
    const ac = new AbortController(); abortRef.current = ac; setVideo(null); setProg(0);
    try {
      const tema = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      const fotos = photos.filter((p) => p.i != null && !p.off).map((p) => ({ i: p.i as number, blob: p.blob, hora: p.taken ? p.taken.slice(11, 16) : null }));
      const blob = await (await import('../share/video-treino')).gerarVideo({ tr, mapa: ocultar ? 'ocultar' : 'completo', raio, tema, titulo: workoutTitle(w), bike: !!E.isBike(w), fotos, onProgresso: (p) => setProg(p), sinal: ac.signal });
      setVideo({ blob, url: URL.createObjectURL(blob) });
    } catch (e: any) { if (!(e && e.name === 'AbortError')) toast('Não consegui gerar o vídeo: ' + (e && e.message ? e.message : e)); }
    finally { setProg(null); abortRef.current = null; }
  };
  const nomeVideo = 'apex-' + w.date + '-video.mp4';
  const outVideo = async (mode: 'share' | 'save') => {
    if (!video) return;
    if (mode === 'save') { const u = URL.createObjectURL(video.blob); const el = document.createElement('a'); el.href = u; el.download = nomeVideo; document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); toast('Vídeo salvo (1080×1920)'); return; }
    const r = await compartilharVideo(video.blob, nomeVideo, workoutTitle(w));
    if (r === 'downloaded') toast('Seu aparelho não abre o menu de compartilhar aqui: o vídeo foi baixado.');
  };
  const toggleNum = (k: NumKey) => setNums((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : cur.length >= 3 ? cur : [...cur, k]));
  const { W, H } = SIZES[format];
  const pw = format === 'stories' ? 214 : 300, ph = Math.round(pw * H / W);
  const mapHint = !tr || !tr.hasGps ? 'Este treino não tem trajeto com GPS: o card sai só com a foto e os números.'
    : priv.mapa === 'nenhum' ? 'A privacidade deste treino está em “Sem mapa”: o card sai sem o trajeto.'
    : ocultar && !shared.show ? 'O treino inteiro fica a menos de ' + (raio >= 1000 ? '1 km' : raio + ' m') + ' da largada ou da chegada: com início e fim ocultos, o card sai sem o trajeto.' : null;

  const sv = sharedTrack(tr || null, { mapa: !mapAllowed ? 'nenhum' : ocultar ? 'ocultar' : 'completo', raio });
  let kmVis = 0; if (tr && sv.show) { let d0: number | null = null, d1 = 0; for (let i = 0; i < tr.lat.length; i++) if (tr.lat[i] != null && sv.keep(i) && tr.dist[i] != null) { if (d0 == null) d0 = tr.dist[i] as number; d1 = tr.dist[i] as number; } kmVis = d0 == null ? 0 : (d1 - d0) / 1000; }
  const videoSeg = duracaoVideo(kmVis);
  const videoAviso = podeVideo === false ? 'Este navegador não gera vídeo. No iPhone, precisa do iOS 16.4 ou mais novo; no computador, Chrome, Edge ou Safari atual.'
    : !tr || !tr.hasGps ? 'Este treino não tem trajeto com GPS: o vídeo precisa do percurso.'
    : priv.mapa === 'nenhum' ? 'A privacidade deste treino está em “Sem mapa”: o vídeo não é feito.'
    : !sv.show ? 'Com início e fim ocultos, não sobra trajeto para o vídeo.' : null;

  return (<>
    <PageHead title="Compartilhar" sub={workoutTitle(w) + ' · ' + dayMon(w.date)} back={href('treino', w.id)} right={null} />
    <div className="share">
      {tipo === 'video' ? (
      <div className="share-prev share-video">
        {video ? <video src={video.url} controls playsInline muted loop autoPlay aria-label="Prévia do vídeo do treino" />
          : <div className="share-video-vazio"><IconMovie size={28} stroke={1.75} aria-hidden="true" />
              {prog != null ? <><span>Gerando o vídeo · {Math.round(prog * 100)}%</span><progress max={1} value={prog} aria-label="Progresso do vídeo" /></>
                : <span>{videoAviso || 'Vídeo de ' + (videoSeg + VIDEO.COMEMORA) + ' s, com o percurso, suas fotos e a chegada'}</span>}</div>}
      </div>) : (
      <div className="share-prev">
        <canvas ref={canvasRef} width={W} height={H} style={{ width: pw, height: ph }} role="img"
          aria-label={'Prévia do card no formato ' + (format === 'stories' ? 'Stories' : 'Feed') + ', modelo ' + (m === 'foto' ? 'Foto' : m === 'mapa' ? 'Mapa' : 'Só números') + (shared.show && ocultar ? ', com início e fim ocultos' : '')} />
      </div>)}
      <div className="share-opts">
        <div className="field"><span className="lab">Tipo</span>
          <Seg value={tipo} onChange={setTipo} label="Tipo" options={[['imagem', 'Imagem'], ['video', 'Vídeo']]} /></div>
        {tipo === 'video' ? <>
          <span className="help">O vídeo segue o boneco pelo mapa, mostra as fotos do treino onde foram tiradas e termina com a comemoração. É feito no seu aparelho e não é enviado para nenhum lugar.</span>
          {mapAllowed ? (
            <Card className="share-priv">
              <label className="switch">
                <span className="stack" style={{ gap: 0 }}><span>Ocultar início e fim</span><span className="apoio muted">Raio de {raio >= 1000 ? '1 km' : raio + ' m'}, para não mostrar onde você mora</span></span>
                <input type="checkbox" role="switch" checked={ocultar} onChange={(e) => setOcultar(e.target.checked)} disabled={prog != null} />
              </label>
            </Card>) : null}
        </> : <>
        <div className="field"><span className="lab">Formato</span>
          <Seg value={format} onChange={setFormat} label="Formato" options={[['stories', 'Stories 9:16'], ['feed', 'Feed 4:5']]} /></div>
        <div className="field"><span className="lab" id="sh-modelo">Modelo</span>
          <div className="share-models" role="group" aria-labelledby="sh-modelo">
            {([['foto', 'Foto'], ['mapa', 'Mapa'], ['numeros', 'Só números']] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={m === k} onClick={() => setModel(k)} disabled={k === 'mapa' && !mapAllowed}>{l}</button>))}
          </div>
          {mapHint && m !== 'numeros' ? <span className="help">{mapHint}</span> : null}
        </div>
        {m === 'foto' ? (
          <div className="field"><span className="lab" id="sh-foto">Foto</span>
            <div className="row wrap" style={{ gap: 8 }} role="group" aria-labelledby="sh-foto">
              {photos.map((p, k) => (
                <button key={p.id} type="button" className="share-thumb" aria-pressed={photoSel !== 'galeria' && photoId === p.id} onClick={() => setPhotoSel(p.id)} aria-label={'Usar a foto ' + (k + 1) + ' do treino'}>
                  <img src={p.url} alt="" />
                </button>))}
              <button type="button" className="share-thumb add" aria-pressed={photoSel === 'galeria'} onClick={() => galRef.current?.click()} aria-label="Escolher uma foto da galeria">
                {photoSel === 'galeria' && gallery ? <span>Galeria</span> : <IconPhotoPlus size={22} stroke={1.75} aria-hidden="true" />}
              </button>
              <input ref={galRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true"
                onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return; try { setGallery(await loadImg(f)); setPhotoSel('galeria'); } catch { toast('Não consegui abrir essa imagem.'); } }} />
            </div>
            {!photos.length && photoSel !== 'galeria' ? <span className="help">Sem fotos neste treino: escolha uma da galeria (ela não fica guardada no app).</span> : null}
          </div>
        ) : null}
        <div className="field"><span className="lab" id="sh-nums">Números (até 3)</span>
          <div className="row wrap" style={{ gap: 6 }} role="group" aria-labelledby="sh-nums">
            {defs.map((d) => <button key={d.key} type="button" className="chip" aria-pressed={nums.includes(d.key)} onClick={() => toggleNum(d.key)} disabled={!nums.includes(d.key) && nums.length >= 3}>{d.label}</button>)}
          </div>
        </div>
        {mapAllowed && m !== 'numeros' ? (
          <Card className="share-priv">
            <label className="switch">
              <span className="stack" style={{ gap: 0 }}><span>Ocultar início e fim</span><span className="apoio muted">Raio de {raio >= 1000 ? '1 km' : raio + ' m'}, para não mostrar onde você mora</span></span>
              <input type="checkbox" role="switch" checked={ocultar} onChange={(e) => setOcultar(e.target.checked)} />
            </label>
          </Card>
        ) : null}
        </>}
      </div>
    </div>
    {tipo === 'video' ? (
    <div className="share-actions">
      {video ? <button type="button" className="btn-primary" onClick={() => outVideo('share')}><IconShare size={20} stroke={1.75} aria-hidden="true" />Compartilhar vídeo</button>
        : <button type="button" className="btn-primary" onClick={gerar} disabled={prog != null || !!videoAviso}><IconMovie size={20} stroke={1.75} aria-hidden="true" />{prog != null ? 'Gerando…' : 'Gerar vídeo'}</button>}
      {prog != null ? <button type="button" className="btn quiet" onClick={() => abortRef.current?.abort()}><IconX size={18} stroke={1.75} aria-hidden="true" />Cancelar</button>
        : <button type="button" className="btn quiet" onClick={() => outVideo('save')} disabled={!video}><IconDownload size={18} stroke={1.75} aria-hidden="true" />Salvar</button>}
    </div>) : (
    <div className="share-actions">
      <button type="button" className="btn-primary" onClick={() => out('share')} disabled={busy}><IconShare size={20} stroke={1.75} aria-hidden="true" />Compartilhar imagem</button>
      <button type="button" className="btn quiet" onClick={() => out('save')} disabled={busy}><IconDownload size={18} stroke={1.75} aria-hidden="true" />Salvar</button>
    </div>)}
    <span className="sr-only" aria-live="polite">{busy ? 'Gerando a imagem' : prog != null ? 'Gerando o vídeo' : video ? 'Vídeo pronto' : ''}</span>
  </>);
}
