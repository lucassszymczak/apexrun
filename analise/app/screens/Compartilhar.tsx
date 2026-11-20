// COMPARTILHAR — "seu treino pronto para postar" (design/telas/Compartilhar.dc.html).
// Prévia do card, formato (Stories 9:16 · Feed 4:5), modelo (Foto · Mapa · Só números),
// até 3 números, foto (do treino ou da galeria) e "Ocultar início e fim" com o raio do treino.
// Ação principal: Compartilhar imagem (menu nativo); secundária: Salvar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconShare, IconPhotoPlus, IconDownload } from '@tabler/icons-react';
import { useApex, toast } from '../store';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, Empty, Seg } from '../ui';
import { dayMon, workoutTitle } from '../fmt';
import { getTrack } from '../db';
import { type Track, colorer } from '../track';
import { privacyOf, sharedTrack } from '../privacy';
import { usePhotos } from '../photos';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  // modelo inicial: Foto se houver foto, senão Mapa; sem mapa permitido, Só números
  const m: Model = model || (tr === undefined ? 'numeros' : photos.length ? 'foto' : mapAllowed ? 'mapa' : 'numeros');
  const photoId = photoSel || (photos[0] && photos[0].id) || null;
  const raio = priv.raio;
  const shared = useMemo(() => sharedTrack(tr || null, { mapa: !mapAllowed ? 'nenhum' : ocultar ? 'ocultar' : 'completo', raio }), [tr, mapAllowed, ocultar, raio]);
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
  const toggleNum = (k: NumKey) => setNums((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : cur.length >= 3 ? cur : [...cur, k]));
  const { W, H } = SIZES[format];
  const pw = format === 'stories' ? 214 : 300, ph = Math.round(pw * H / W);
  const mapHint = !tr || !tr.hasGps ? 'Este treino não tem trajeto com GPS: o card sai só com a foto e os números.'
    : priv.mapa === 'nenhum' ? 'A privacidade deste treino está em “Sem mapa”: o card sai sem o trajeto.'
    : ocultar && !shared.show ? 'O treino inteiro fica a menos de ' + (raio >= 1000 ? '1 km' : raio + ' m') + ' da largada ou da chegada: com início e fim ocultos, o card sai sem o trajeto.' : null;

  return (<>
    <PageHead title="Compartilhar" sub={workoutTitle(w) + ' · ' + dayMon(w.date)} back={href('treino', w.id)} right={null} />
    <div className="share">
      <div className="share-prev">
        <canvas ref={canvasRef} width={W} height={H} style={{ width: pw, height: ph }} role="img"
          aria-label={'Prévia do card no formato ' + (format === 'stories' ? 'Stories' : 'Feed') + ', modelo ' + (m === 'foto' ? 'Foto' : m === 'mapa' ? 'Mapa' : 'Só números') + (shared.show && ocultar ? ', com início e fim ocultos' : '')} />
      </div>
      <div className="share-opts">
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
      </div>
    </div>
    <div className="share-actions">
      <button type="button" className="btn-primary" onClick={() => out('share')} disabled={busy}><IconShare size={20} stroke={1.75} aria-hidden="true" />Compartilhar imagem</button>
      <button type="button" className="btn quiet" onClick={() => out('save')} disabled={busy}><IconDownload size={18} stroke={1.75} aria-hidden="true" />Salvar</button>
    </div>
    <span className="sr-only" aria-live="polite">{busy ? 'Gerando a imagem' : ''}</span>
  </>);
}
