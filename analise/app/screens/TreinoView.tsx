// TREINO — "o treino num olhar: onde, quanto e como foi" (design/telas/Treino e TreinoDesktop).
// Mapa em tela cheia (Ruas = MapLibre/OpenFreeMap; Só trajeto = SVG offline), cores por
// FC/Pace/Zona/Inclinação, marcos de km, largada/chegada, replay (~10 s), gaveta de 3
// alturas (celular) ou painel fixo (computador). Os números vêm dos mesmos blocos de
// antes (treinoBlocks) — nada nas análises muda.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronLeft, IconDotsVertical, IconPencil, IconTrash, IconPlayerPlayFilled, IconPlayerPauseFilled, IconFileUpload, IconMapOff, IconRoute, IconChevronUp, IconChevronDown, IconShare, IconPhotoPlus, IconMapPin } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { useApex, toast } from '../store';
import { href, go } from '../route';
import { Card, Kpi, Sheet, Seg, Empty, IC } from '../ui';
import { dec, signed, pace, dayMon, workoutTitle, noEmoji, dur as hShort } from '../fmt';
import { deleteWorkout, reimportFit, setWorkoutPrivacy } from '../actions';
import { getTrack, onTrackChange } from '../db';
import { fetchRemoteTrack } from '../track-sync';
import { buscarTrajetos } from '../garmin-sync';
import { garminReady } from '../garmin';
import { type Track, type ColorMode, colorer, duration, idxAtTime, PALETTE } from '../track';
import { TrackSvg } from '../map/TrackSvg';
import { TrackChart } from '../map/TrackChart';
import { treinoBlocks } from './Treino';
import { HistoriaCard, TirosCard, EsforcosCard, SubidaCard, VentoChip, idxDoKm } from './Leitura';
import { delPhoto } from '../db';
import { usePhotos, addPhotos, photoSummary, placeManually, moveToOffRoute, type PhotoView } from '../photos';
import { privacyOf, privacyLabel } from '../privacy';
import { PrivacySheet, PrivacyIcon } from './Privacidade';

// "no km 8,2" / "fora do percurso"
export function photoWhere(tr: Track | null, p: PhotoView): string {
  if (p.off || p.i == null) return 'fora do percurso';
  const d = tr && tr.dist[p.i] != null ? (tr.dist[p.i] as number) / 1000 : null;
  return d != null ? 'no km ' + d.toFixed(1).replace('.', ',') : 'no ' + E.hms(p.t || 0);
}

const RuasMap = lazy(() => import('../map/RuasMap').then((m) => ({ default: m.RuasMap })));
let ruasFailed = false; // se o mapa de ruas falhou nesta sessão, não tenta de novo a cada treino

function useTrack(id: string): { tr: Track | null; loading: boolean } {
  const [s, setS] = useState<{ tr: Track | null; loading: boolean }>({ tr: null, loading: true });
  useEffect(() => {
    let alive = true;
    // sem trajeto aqui? tenta a versão leve que o outro aparelho subiu (Fase 2 · Etapa 3)
    const load = () => getTrack(id).then(async (tr) => { if (!tr) { try { tr = await fetchRemoteTrack(id); } catch { /* sem internet */ } } if (alive) setS({ tr, loading: false }); });
    load();
    const off = onTrackChange((x) => { if (x === id) load(); });
    return () => { alive = false; off(); };
  }, [id]);
  return s;
}
function reducedMotion() { return typeof window.matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; }

type Snap = 'min' | 'mid' | 'max';

export function Treino({ id }: { id: string }) {
  const { st } = useApex();
  const a = st.athlete;
  const w = st.workouts.find((x: any) => x.id === id);
  const { tr, loading } = useTrack(id);
  const [mode, setMode] = useState<'ruas' | 'trajeto'>(() => (ruasFailed ? 'trajeto' : (a.mapaPadrao === 'trajeto' ? 'trajeto' : 'ruas')));
  const [color, setColor] = useState<ColorMode>(() => (['fc', 'pace', 'zona', 'grade'].includes(a.corPadrao) ? a.corPadrao : 'fc'));
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [replayAtivo, setReplayAtivo] = useState(false); // o play foi apertado (o mapa se preenche)
  const [speed, setSpeed] = useState<'1' | '2' | '4'>('1');
  const [snap, setSnap] = useState<Snap>('min');
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ y: number; h: number } | null>(null);
  const drawer = useRef<HTMLDivElement>(null);
  const rm = useMemo(reducedMotion, []);
  const photos = usePhotos(id);
  const [privOpen, setPrivOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState<string | null>(null);
  const [placing, setPlacing] = useState<{ p: PhotoView; i: number } | null>(null);
  const [pop, setPop] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const prevT = useRef(0);

  const total = tr ? duration(tr) : 0;
  const cursor = tr ? idxAtTime(tr, t) : null;
  // replay em andamento (tocando, ou parado no meio): o trajeto vai se preenchendo atrás do
  // corredor. No começo (0:00, parado) e no fim, o trajeto aparece inteiro.
  const emReplay = !!tr && replayAtivo && t < total;
  const ateRaw = emReplay && cursor != null ? cursor : null;
  // no mapa de ruas, redesenha a cada ~0,5% do trajeto (suave sem pesar)
  const passo = tr ? Math.max(1, Math.floor(tr.t.length / 200)) : 1;
  const ate = ateRaw == null ? null : Math.floor(ateRaw / passo) * passo;
  const L = (w && w.leitura) || {};
  const temVento = !!(L.vento && !L.vento.fraco);
  const corEf: ColorMode = color === 'vento' && !temVento ? 'fc' : color;
  const col = useMemo(() => (tr && w ? colorer(tr, corEf, w, a) : null), [tr, corEf, w, a]);
  const derivaI = tr && L.deriva && L.deriva.km ? idxDoKm(tr, L.deriva.km) : null;
  const marca = derivaI != null ? { i: derivaI, label: 'A deriva começa no km ' + L.deriva.km } : null;

  // replay: o treino inteiro em ~10 s (1×); a barra e o relógio mostram o tempo real
  useEffect(() => {
    if (!playing || !tr) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      setT((x) => { const nx = x + (dt * total / 10) * +speed; if (nx >= total) { setPlaying(false); return total; } return nx; });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, tr, total]);
  // fotos "saltam" quando o ponto do replay passa por elas
  useEffect(() => {
    const a0 = prevT.current; prevT.current = t;
    if (!playing || t <= a0) return;
    const hit = photos.find((p) => !p.off && p.t != null && p.t > a0 && p.t <= t);
    if (hit) setPop(hit.id);
  }, [t, playing, photos]);
  useEffect(() => { if (!pop) return; const h = setTimeout(() => setPop(null), 1800); return () => clearTimeout(h); }, [pop]);
  // espaço = play/pausa (fora de campos e botões)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || rm || !tr) return;
      const el = e.target as HTMLElement;
      if (el && el.closest('input, textarea, select, button, a, [role="slider"], [contenteditable]')) return;
      e.preventDefault(); toggle();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  const toggle = () => { if (!tr) return; if (!playing && t >= total) setT(0); if (!playing) setReplayAtivo(true); setPlaying(!playing); };
  const [destaque, setDestaque] = useState<{ a: number; b: number } | null>(null);
  const pickIdx = (i: number) => { if (!tr) return; setPlaying(false); setReplayAtivo(false); setT(tr.t[i]); };
  // tiros e melhores esforços: tocar destaca o trecho no mapa e no gráfico (tocar de novo tira)
  const pickTrecho = (a: number, b?: number) => { if (!tr) return; if (b == null || (destaque && destaque.a === a && destaque.b === b)) { setDestaque(null); pickIdx(a); return; } setDestaque({ a, b }); pickIdx(a); };

  if (!w) return (<div className="main-pad"><Card><Empty>Treino não encontrado. Ele pode ter sido excluído em outro aparelho.</Empty></Card><a className="btn" href={href('treinos')}>Voltar aos treinos</a></div>);
  const bk = E.isBike(w);
  const B = treinoBlocks(w, st);
  const sub = [dayMon(w.date), w.temp != null ? Math.round(w.temp) + ' °C' : null, w.terrain ? noEmoji(w.terrain) : null].filter(Boolean).join(' · ');
  const g0 = !bk && w.distKm ? E.computeGap(w) : null;
  const dc = bk ? null : E.computeDecoupling(w);
  const noGps = (tr && !tr.hasGps) || (!tr && !loading && (w.indoor || (bk && !(w.distKm > 0.05)) || (!w.geo && !w.splits && !w.stream)));
  const oldNoTrack = !tr && !loading && !noGps;

  const reimport = async (f: File | undefined | null) => {
    if (!f) return; setBusy('Lendo ' + f.name + '…');
    try { const msg = await reimportFit(w, f); toast(msg); setMenu(false); }
    catch (e: any) { alert(e && e.message ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  const priv = privacyOf(w, a);
  const onRoute = photos.filter((p) => !p.off && p.i != null);
  const offRoute = photos.filter((p) => p.off || p.i == null);
  const mapPhotos = tr && tr.hasGps ? onRoute.map((p, k) => ({ id: p.id, i: p.i as number, url: p.url, label: 'Foto ' + (k + 1) + ', ' + photoWhere(tr, p) })) : [];
  const addFiles = async (files: FileList | null) => {
    const list = files ? Array.from(files) : []; if (!list.length) return;
    setBusy('Encaixando ' + list.length + (list.length > 1 ? ' fotos' : ' foto') + '…');
    try { toast(photoSummary(await addPhotos(w.id, list, tr))); } finally { setBusy(null); }
  };
  const openPhoto = photoOpen ? photos.find((p) => p.id === photoOpen) || null : null;
  const popPhoto = pop ? photos.find((p) => p.id === pop) || null : null;

  // ---------------- números do topo da gaveta ----------------
  const kmNow = cursor != null && tr && tr.dist[cursor] != null ? (tr.dist[cursor]! / 1000) : null;
  const nums = (
    <div className="tv-nums">
      <Kpi doc="gap" value={dec(w.distKm, 2) + ' km'} className="block" label="Distância"><span className="tv-n">{w.distKm ? dec(w.distKm, 2) : '—'}</span><span className="tv-l">km{w.gainM ? ' · D+ ' + Math.round(w.gainM) + ' m' : ''}</span></Kpi>
      {bk ? <Kpi doc="trimp" value={E.kmH(w) != null ? dec(E.kmH(w), 1) + ' km/h' : hShort(w.durationSec)} className="block" label="Velocidade"><span className="tv-n" style={{ color: 'var(--magenta)' }}>{E.kmH(w) != null ? dec(E.kmH(w), 1) : hShort(w.durationSec)}</span><span className="tv-l">{E.kmH(w) != null ? 'km/h · ' + hShort(w.durationSec) : 'tempo'}</span></Kpi>
        : <Kpi doc="gap" value={w.distKm ? pace(w.durationSec / w.distKm) + '/km' : '—'} band={g0 && g0.gapPace ? 'GAP ' + pace(g0.gapPace) + '/km' : undefined} conf={g0 ? g0.confidence : null} className="block" label="Pace"><span className="tv-n" style={{ color: 'var(--magenta)' }}>{w.distKm ? pace(w.durationSec / w.distKm) : '—'}</span><span className="tv-l">/km{g0 && g0.gapPace ? ' · GAP ' + pace(g0.gapPace) : ''}</span></Kpi>}
      <Kpi doc="trimp" value={(w.hrAvg || '—') + ' bpm'} className="block" label="FC média"><span className="tv-n">{w.hrAvg || '—'}</span><span className="tv-l">bpm{w.hrMax ? ' · pico ' + w.hrMax : ''}</span></Kpi>
    </div>
  );
  const deriva = dc != null ? (
    <Kpi doc="decoupling" value={signed(dc, 1) + '%'} className="block tv-chip" label="Deriva">
      <span><b style={{ color: dc < 5 ? 'var(--ok)' : dc <= 8 ? 'var(--atencao)' : 'var(--alerta)', fontWeight: 500 }}>Deriva {signed(dc, 1)}%</b> · {dc < 5 ? 'base sólida até o fim' : dc <= 8 ? 'limítrofe' : 'alta — revise combustível, calor e pacing'}</span>
    </Kpi>
  ) : null;
  const climaP = !bk && L.climaPadrao ? (
    <Kpi doc="clima-padrao" value={'≈ ' + pace(L.climaPadrao.paceSkm) + '/km'} band={'correção de ' + String(L.climaPadrao.pct).replace('.', ',') + '% · temperatura + orvalho = ' + L.climaPadrao.somaF + ' °F'} conf={L.climaPadrao.conf} className="block tv-chip" label="Pace em clima padrão">
      <span><b style={{ fontWeight: 500 }} className="tn">≈ {pace(L.climaPadrao.paceSkm)}/km em clima padrão</b> · calor e umidade custaram {String(L.climaPadrao.pct).replace('.', ',')}%</span>
    </Kpi>
  ) : null;
  const derivaIni = L.deriva && L.deriva.km ? (
    <Kpi doc="inicio-deriva" value={'km ' + L.deriva.km} band={'EF caiu 5% abaixo da base do começo (' + dec(L.deriva.base, 2) + ' → limiar ' + dec(L.deriva.limiar, 2) + ')'} conf={L.deriva.conf} className="block tv-chip" label="Início da deriva">
      <span><b style={{ color: 'var(--atencao)', fontWeight: 500 }}>A deriva começa no km {L.deriva.km}</b> · marcado no mapa e no gráfico</span>
    </Kpi>
  ) : null;
  const legend = col && tr && tr.hasGps ? (
    <div className={'tv-legend' + (col.palette ? ' tres' : '')} aria-label={col.title}>
      <span className="faint">{col.legend[0]}</span>
      {(col.palette || PALETTE).map((c, i) => <i key={i} style={{ background: c }} title={col.legend[i] || undefined} />)}
      <span className="faint">{col.legend[col.legend.length - 1]}</span>
      <span className="sr-only">{col.title}: {col.legend.filter(Boolean).join(', ')}</span>
    </div>
  ) : null;
  const replay = tr ? (
    <div className="tv-replay">
      {!rm ? <button type="button" className="tv-play" onClick={toggle} aria-label={playing ? 'Pausar o replay' : 'Reproduzir o trajeto'}>{playing ? <IconPlayerPauseFilled size={20} /> : <IconPlayerPlayFilled size={20} />}</button> : null}
      <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
        <input type="range" min={0} max={Math.max(1, Math.round(total))} step={1} value={Math.round(t)} onChange={(e) => { setPlaying(false); setT(+e.target.value); }} aria-label="Posição do replay" aria-valuetext={(kmNow != null ? 'km ' + kmNow.toFixed(1).replace('.', ',') + ', ' : '') + E.hms(t)} />
        <div className="row between tn apoio muted" style={{ fontSize: 11, lineHeight: '14px' }}><span>{kmNow != null ? 'km ' + kmNow.toFixed(1).replace('.', ',') : ''}</span><span>{E.hms(t)} / {E.hms(total)}</span></div>
      </div>
      {!rm ? <Seg value={speed} onChange={setSpeed} label="Velocidade do replay" options={[['1', '1×'], ['2', '2×'], ['4', '4×']]} /> : null}
    </div>
  ) : null;
  const chart = tr ? <TrackChart tr={tr} cursor={cursor} onCursor={pickIdx} bike={bk} deriva={derivaI != null ? { i: derivaI, km: L.deriva.km } : null} destaque={destaque} /> : null;

  // ---------------- área do mapa ----------------
  let mapArea: any;
  if (loading) mapArea = <div className="trackmap" aria-busy="true" />;
  else if (tr && tr.hasGps && col) {
    mapArea = mode === 'ruas'
      ? <Suspense fallback={<div className="trackmap" aria-busy="true" />}><RuasMap tr={tr} band={col.band} bandKey={corEf} palette={col.palette} marca={marca} destaque={destaque} ate={ate} cursor={cursor} onPick={pickIdx} photos={mapPhotos} onPhoto={setPhotoOpen} onFail={(why) => { ruasFailed = true; setMode('trajeto'); toast('Sem o mapa de ruas agora (' + why + '): mostrando só o trajeto.'); }} /></Suspense>
      : <TrackSvg tr={tr} band={col.band} cursor={cursor} onPick={pickIdx} photos={mapPhotos} onPhoto={setPhotoOpen} palette={col.palette} marca={marca} destaque={destaque} ate={ate} />;
  } else if (noGps) {
    mapArea = (
      <div className="trackmap tv-empty">
        <div className="card" style={{ margin: 'auto', maxWidth: 560, width: 'calc(100% - 32px)' }}>
          <div className="row"><IconMapOff size={22} stroke={1.75} color="var(--texto-2)" aria-hidden="true" /><b>Treino sem GPS{w.indoor ? ' (indoor)' : ''}</b></div>
          {tr ? <TrackChart tr={tr} cursor={cursor} onCursor={pickIdx} height={170} bike={bk} label="FC e ritmo ao longo do treino (sem GPS)" /> : (B.splits || <p className="apoio muted">Sem trajeto: os números do treino estão abaixo.</p>)}
        </div>
      </div>
    );
  } else {
    mapArea = (
      <div className="trackmap tv-empty">
        <div className="card" style={{ margin: 'auto', maxWidth: 480, width: 'calc(100% - 32px)', alignItems: 'flex-start' }}>
          <div className="row"><IconRoute size={22} stroke={1.75} color="var(--ciano)" aria-hidden="true" /><b>Mapa indisponível para este treino</b></div>
          <p className="apoio muted">Reimporte o .FIT para ver o mapa; nada nas análises muda.</p>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={!!busy}><IconFileUpload size={18} stroke={1.75} aria-hidden="true" />{busy || 'Reimportar .FIT'}</button>
        </div>
      </div>
    );
  }

  const controls = tr && tr.hasGps ? (<>
    <div className="tv-ctl-top">
      <div className="seg on-map" role="group" aria-label="Fundo do mapa">
        {([['ruas', 'Ruas'], ['trajeto', 'Só trajeto']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}
      </div>
    </div>
    <div className="tv-ctl-colors" role="group" aria-label="Cor do trajeto">
      {([['fc', 'FC'], ['pace', bk ? 'Velocidade' : 'Pace'], ['zona', 'Zona'], ['grade', 'Inclinação'], ...(temVento ? [['vento', 'Vento']] : [])] as [ColorMode, string][]).map(([k, l]) => <button key={k} type="button" className="chip on-map" aria-pressed={corEf === k} onClick={() => setColor(k)}>{l}</button>)}
    </div>
    {L.vento ? <div className="tv-vento"><VentoChip v={L.vento} /></div> : null}
  </>) : null;

  const top = (
    <div className="tv-top">
      <a className="iconbtn" href={href('treinos')} aria-label="Voltar aos treinos"><IconChevronLeft size={24} stroke={1.75} /></a>
      <div className="stack grow" style={{ gap: 0, minWidth: 0 }}><h1 className="tv-title">{workoutTitle(w)}</h1><span className="apoio muted" style={{ fontSize: 11, lineHeight: '14px' }}>{sub}</span></div>
      <button type="button" className="iconbtn priv only-mob" aria-label={'Privacidade deste treino: ' + privacyLabel(priv)} aria-haspopup="dialog" onClick={() => setPrivOpen(true)}><PrivacyIcon p={priv} size={22} /></button>
      <button type="button" className="iconbtn only-mob" aria-label="Mais opções do treino" aria-haspopup="dialog" onClick={() => setMenu(true)}><IconDotsVertical size={22} stroke={1.75} /></button>
    </div>
  );
  const share = <a className="btn-primary tv-share" href={href('compartilhar', w.id)}><IconShare size={20} stroke={1.75} aria-hidden="true" />Compartilhar</a>;
  const fotos = (
    <Card className="tv-fotos">
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="stack" style={{ gap: 2 }}><h2 className="lead">Fotos do percurso</h2><p className="apoio muted">{tr ? 'Encaixadas no mapa pelo horário' : 'Sem trajeto salvo: as fotos ficam em Fora do percurso'}</p></div>
        <button type="button" className="btn" style={{ minHeight: 40 }} onClick={() => photoRef.current?.click()} disabled={!!busy}><IconPhotoPlus size={18} stroke={1.75} aria-hidden="true" />Adicionar</button>
      </div>
      {onRoute.length ? <div className="photos-row">{onRoute.map((p, k) => (
        <figure key={p.id} className="photo-fig"><button type="button" onClick={() => setPhotoOpen(p.id)} aria-label={'Abrir a foto ' + (k + 1) + ', ' + photoWhere(tr, p)}><img src={p.url} alt="" /></button><figcaption>{photoWhere(tr, p)}</figcaption></figure>))}</div> : null}
      {offRoute.length ? (<>
        <h3 className="cap" style={{ marginTop: 4 }}>Fora do percurso</h3>
        <div className="photos-row">{offRoute.map((p, k) => (
          <figure key={p.id} className="photo-fig"><button type="button" onClick={() => setPhotoOpen(p.id)} aria-label={'Abrir a foto ' + (k + 1) + ' fora do percurso'}><img src={p.url} alt="" /></button><figcaption>{p.taken ? p.taken.slice(11, 16) : 'sem horário'}</figcaption></figure>))}</div>
        <p className="hint">Tiradas a mais de 10 min do treino ou sem horário. Abra a foto para posicioná-la no trajeto.</p>
      </>) : null}
      {!photos.length ? <p className="apoio muted">Nenhuma foto. O app encaixa cada uma no ponto do trajeto pelo horário em que foi tirada.</p> : null}
    </Card>
  );

  // conteúdo da gaveta / painel
  const panel = (<>
    <div className="tv-actions only-desk">{share}<button type="button" className="iconbtn bordered" aria-label={'Privacidade deste treino: ' + privacyLabel(priv)} onClick={() => setPrivOpen(true)}><PrivacyIcon p={priv} /></button><button type="button" className="iconbtn bordered plain" aria-label="Mais opções do treino" aria-haspopup="dialog" onClick={() => setMenu(true)}><IconDotsVertical size={20} stroke={1.75} /></button></div>
    {legend}
    {replay}
    {nums}
    {climaP}
    {deriva}
    {derivaIni}
    <HistoriaCard w={w} st={st} />
    {tr && tr.hasGps ? chart : null}
    <div className="only-mob tv-share-mob">{share}</div>
    <TirosCard w={w} tr={tr} onPick={pickTrecho} />
    <EsforcosCard w={w} st={st} tr={tr} onPick={pickTrecho} />
    {B.splits}
    {fotos}
    <div className="tv-blocks">{B.hero}{B.motor}{B.resist}{B.mec}<SubidaCard w={w} />{B.carga}{B.hidr}{B.percep}{B.cond}{B.quality}</div>
  </>);

  // gaveta: arrastar o puxador ou tocar nele (recolhida → média → expandida)
  const order: Snap[] = ['min', 'mid', 'max'];
  const onHandleDown = (e: React.PointerEvent) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); drag.current = { y: e.clientY, h: drawer.current!.getBoundingClientRect().height }; };
  const onHandleMove = (e: React.PointerEvent) => { const d = drag.current; if (!d || !drawer.current) return; drawer.current.style.height = Math.max(160, d.h - (e.clientY - d.y)) + 'px'; drawer.current.style.transition = 'none'; };
  const onHandleUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null; if (!d || !drawer.current) return;
    const moved = d.y - e.clientY; drawer.current.style.height = ''; drawer.current.style.transition = '';
    if (Math.abs(moved) < 8) { setSnap(order[(order.indexOf(snap) + 1) % 3]); return; }
    const hNow = d.h + moved, vh = window.innerHeight;
    setSnap(hNow > vh * 0.78 ? 'max' : hNow > vh * 0.42 ? 'mid' : 'min');
  };

  return (
    <div className={'tv snap-' + snap}>
      <input ref={fileRef} type="file" accept=".fit,.FIT,application/octet-stream" className="sr-only" id="reimportFile" aria-label="Escolher o .FIT para reimportar" onChange={(e) => { reimport(e.target.files && e.target.files[0]); e.target.value = ''; }} />
      <input ref={photoRef} type="file" accept="image/*" multiple className="sr-only" id="photoFiles" tabIndex={-1} aria-hidden="true" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      <div className="tv-map">
        {mapArea}
        {top}
        {controls}
        {popPhoto ? <div className="photo-pop" aria-hidden="true"><img src={popPhoto.url} alt="" /><span>{photoWhere(tr, popPhoto)}</span></div> : null}
        <div className="tv-replaybar only-desk">{legend}{replay}</div>
      </div>
      <aside className="tv-panel" ref={drawer} aria-label="Detalhes do treino">
        <button type="button" className="tv-handle only-mob" aria-label={snap === 'max' ? 'Recolher detalhes' : 'Expandir detalhes'}
          onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleUp}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSnap(order[(order.indexOf(snap) + 1) % 3]); } }}>
          <i aria-hidden="true" />{snap === 'max' ? <IconChevronDown size={16} stroke={1.75} aria-hidden="true" /> : <IconChevronUp size={16} stroke={1.75} aria-hidden="true" />}
        </button>
        <div className="tv-panel-in">{panel}</div>
      </aside>
      {menu ? (
        <Sheet title="Treino" onClose={() => setMenu(false)}>
          <a className="btn quiet" href={href('editar', w.id)} onClick={() => setMenu(false)}><IconPencil {...IC} aria-hidden="true" />Editar</a>
          <button type="button" className="btn quiet" onClick={() => fileRef.current?.click()} disabled={!!busy}><IconFileUpload {...IC} aria-hidden="true" />{busy || 'Reimportar .FIT'}</button>
          {!tr && w.garminActivityId && garminReady() ? <button type="button" className="btn quiet" disabled={!!busy} onClick={async () => { setBusy('Buscando no Garmin…'); try { const r = await buscarTrajetos([w.id]); toast(r && r.ok ? 'Trajeto adicionado. Nada nas análises mudou.' : 'Não deu para buscar agora. Tente de novo mais tarde.'); setMenu(false); } finally { setBusy(null); } }}><IconRoute {...IC} aria-hidden="true" />Buscar trajeto no Garmin</button> : null}
          <p className="hint">Reimportar acrescenta o trajeto (mapa e replay) de um treino antigo. RPE, notas, análises e números não mudam.</p>
          <button type="button" className="btn danger" onClick={() => { if (confirm('Excluir este treino?')) { deleteWorkout(w.id); setMenu(false); go('treinos'); } }}><IconTrash {...IC} aria-hidden="true" />Excluir</button>
        </Sheet>
      ) : null}
      {privOpen ? <PrivacySheet value={priv} onClose={() => setPrivOpen(false)} onSave={(p) => setWorkoutPrivacy(w.id, p)} /> : null}
      {openPhoto && !placing ? (
        <Sheet title={'Foto ' + photoWhere(tr, openPhoto)} onClose={() => setPhotoOpen(null)}>
          <img className="photo-big" src={openPhoto.url} alt={'Foto do treino, ' + photoWhere(tr, openPhoto)} />
          {openPhoto.taken ? <p className="apoio muted">Tirada às {openPhoto.taken.slice(11, 16)} de {openPhoto.taken.slice(8, 10)}/{openPhoto.taken.slice(5, 7)}{openPhoto.manual ? ' · posicionada à mão' : ''}</p> : <p className="apoio muted">Sem horário na foto{openPhoto.manual ? ' · posicionada à mão' : ''}</p>}
          {tr ? <button type="button" className="btn" onClick={() => setPlacing({ p: openPhoto, i: openPhoto.i != null ? openPhoto.i : 0 })}><IconMapPin {...IC} aria-hidden="true" />{openPhoto.off ? 'Posicionar no trajeto' : 'Mudar de lugar'}</button> : null}
          {!openPhoto.off ? <button type="button" className="btn quiet" onClick={() => { moveToOffRoute(openPhoto); setPhotoOpen(null); }}>Mover para Fora do percurso</button> : null}
          <button type="button" className="btn danger" onClick={() => { if (confirm('Remover esta foto do treino?')) { delPhoto(openPhoto); setPhotoOpen(null); } }}><IconTrash {...IC} aria-hidden="true" />Remover foto</button>
        </Sheet>
      ) : null}
      {placing && tr ? (
        <Sheet title="Posicionar a foto" onClose={() => setPlacing(null)}>
          <img className="photo-big" style={{ maxHeight: 180 }} src={placing.p.url} alt="" />
          <label htmlFor="ph-pos" className="lab">Onde foi tirada: <b className="tn">{tr.dist[placing.i] != null ? 'km ' + ((tr.dist[placing.i] as number) / 1000).toFixed(2).replace('.', ',') : ''} · {E.hms(tr.t[placing.i])}</b></label>
          <input id="ph-pos" type="range" min={0} max={tr.t.length - 1} step={1} value={placing.i} onChange={(e) => { const i = +e.target.value; setPlacing({ ...placing, i }); setT(tr.t[i]); }} aria-valuetext={(tr.dist[placing.i] != null ? 'km ' + ((tr.dist[placing.i] as number) / 1000).toFixed(1).replace('.', ',') + ', ' : '') + E.hms(tr.t[placing.i])} />
          <p className="hint">O ponto ciano no mapa acompanha. Arraste até o lugar da foto.</p>
          <button type="button" className="btn" onClick={() => { placeManually(placing.p, tr, placing.i); setPlacing(null); setPhotoOpen(null); toast('Foto posicionada'); }}>Salvar posição</button>
        </Sheet>
      ) : null}
      {oldNoTrack ? <span className="sr-only">Reimporte o .FIT para ver o mapa; nada nas análises muda.</span> : null}
    </div>
  );
}
