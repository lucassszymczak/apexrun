// MAPA DE CALOR (Fase 3 · Etapa 3; design/telas-fase3/MapaCalor). Tela cheia, como o Treino:
// mapa (com ou sem as ruas no fundo), modalidade, período, legenda e a gaveta com o resumo e a
// rua tocada. Só você vê: nada daqui é gravado, sincronizado ou compartilhado.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { IconArrowLeft, IconLock, IconCalendar, IconChevronDown, IconChevronUp, IconCheck, IconMap, IconRoute, IconChevronRight } from '@tabler/icons-react';
import { useApex } from '../store';
import { href } from '../route';
import { Kpi } from '../ui';
import { dec, dayMon, workoutTitle } from '../fmt';
import { maisPerto, rua, FAIXAS, regiaoMaisFrequente, ruasOrdenadas } from '../../calor.mjs';
import { useCalor, treinosDoRecorte, type Modal, type PerCalor } from '../calor-app';
import { CalorSvg } from '../map/CalorSvg';
import { COR_FAIXA, OPAC_FAIXA, LARG_FAIXA } from '../map/calor-estilo';
import { baixarLeves, syncLigado } from '../track-sync';
import { buscarTrajetos, useGarminSync } from '../garmin-sync';
import { garminReady } from '../garmin';

const CalorMap = lazy(() => import('../map/CalorMap').then((m) => ({ default: m.CalorMap })));
const PER: [PerCalor, string][] = [['12m', '12 meses'], ['ciclo', 'Ciclo atual'], ['tudo', 'Tudo']];
const SUB: Record<PerCalor, string> = { '12m': 'Últimos 12 meses', ciclo: 'Ciclo atual', tudo: 'Desde o início' };
const nome = (m: Modal, n: number) => (m === 'pedal' ? (n === 1 ? 'pedal' : 'pedais') : n === 1 ? 'corrida' : 'corridas');
const kmTxt = (km: number) => (km >= 10 ? String(Math.round(km)) : dec(km, 1));
const tentados = new Set<string>(); // trajetos leves já procurados no servidor nesta sessão

function PerMenu({ value, onChange, opts }: { value: PerCalor; onChange: (p: PerCalor) => void; opts: [PerCalor, string][] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null), btn = useRef<HTMLButtonElement>(null), items = useRef<(HTMLButtonElement | null)[]>([]);
  const cur = Math.max(0, opts.findIndex(([k]) => k === value));
  useEffect(() => {
    if (!open) return; items.current[cur]?.focus();
    const out = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', out); return () => document.removeEventListener('pointerdown', out);
  }, [open]);
  const close = () => { setOpen(false); btn.current?.focus(); };
  return (
    <div className="tf-per" ref={box}>
      <button ref={btn} type="button" className="tf-per-btn on-map" aria-haspopup="menu" aria-expanded={open} aria-label={'Período: ' + opts[cur][1]} onClick={() => setOpen(!open)}>
        <IconCalendar size={18} stroke={1.75} aria-hidden="true" /><span>{opts[cur][1]}</span><IconChevronDown size={16} stroke={1.75} aria-hidden="true" />
      </button>
      {open ? (
        <div className="tf-menu" role="menu" aria-label="Período">
          {opts.map(([k, l], i) => (
            <button key={k} ref={(el) => { items.current[i] = el; }} type="button" role="menuitemradio" aria-checked={value === k} tabIndex={-1}
              onClick={() => { onChange(k); close(); }}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items.current[(i + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length]?.focus(); } }}>
              <span>{l}</span>{value === k ? <IconCheck size={16} stroke={2} aria-hidden="true" /> : null}
            </button>))}
        </div>) : null}
    </div>
  );
}

export function MapaCalor() {
  const { st } = useApex();
  const [modal, setModal] = useState<Modal>('corrida');
  const [per, setPer] = useState<PerCalor>('12m');
  const [fundo, setFundo] = useState(true);
  const [falhou, setFalhou] = useState<string | null>(null);
  const [sel, setSel] = useState<{ cells: string[]; ids: string[]; km: number } | null>(null);
  const [todos, setTodos] = useState(false);
  const [aberta, setAberta] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);
  const gs = useGarminSync();
  const opts = PER.filter(([k]) => k !== 'ciclo' || (st.race && st.race.startDate));
  const ws = useMemo(() => treinosDoRecorte(st.workouts, modal, per, st), [st.workouts, modal, per, st.race]);
  const chave = modal + '|' + per + '|' + ws.map((w: any) => w.id).join(',');
  const C = useCalor(ws, chave);
  useEffect(() => { setSel(null); setTodos(false); }, [chave]);
  // trajetos leves que estão no servidor e faltam aqui: baixa uma vez por sessão
  useEffect(() => {
    if (!C || !syncLigado()) return;
    const faltam = C.semTrajeto.map((w: any) => w.id).filter((id: string) => !tentados.has(id));
    if (!faltam.length) return;
    faltam.forEach((id: string) => tentados.add(id));
    setBaixando('Baixando trajetos do servidor…');
    baixarLeves(faltam, (f, t) => setBaixando('Baixando trajetos do servidor: ' + f + ' de ' + t + '…')).finally(() => setBaixando(null));
  }, [C]);

  const n = C ? C.resumo.treinos : 0;
  const reg = useMemo(() => (C && n ? regiaoMaisFrequente(C.ag) : null), [C]);
  const desc = C ? `Mapa de calor de ${n} ${nome(modal, n)}: cerca de ${kmTxt(C.resumo.km)} km de ruas diferentes.` + (reg ? ` As ruas mais frequentes, com ${reg.min} ${reg.min === 1 ? 'passagem' : 'passagens'} ou mais, ficam ${reg.onde} do mapa.` : '') : '';
  // teclado: percorrer as ruas da mais frequente para a menos (sem precisar tocar no mapa)
  const ruas = useMemo(() => (C && n ? ruasOrdenadas(C.ag, 30) : []), [C]);
  const [ri, setRi] = useState(-1);
  useEffect(() => { setRi(-1); }, [chave]);
  const vaiRua = (d: number) => { if (!ruas.length) return; const i = ri < 0 ? (d > 0 ? 0 : ruas.length - 1) : (ri + d + ruas.length) % ruas.length; setRi(i); setSel(ruas[i]); setTodos(false); };
  const pick = (lat: number, lon: number, maxM: number) => { if (!C) return; const k = maisPerto(C.ag, lat, lon, maxM); setSel(k ? rua(C.ag, k) : null); setRi(-1); setTodos(false); if (k) setAberta(true); };
  const doSel = useMemo(() => (sel ? st.workouts.filter((w: any) => sel.ids.includes(w.id)).sort((a: any, b: any) => String(b.date).localeCompare(String(a.date))) : []), [sel, st.workouts]);
  const semGarmin = C ? C.semTrajeto.filter((w: any) => w.garminActivityId) : [];
  const buscar = async () => { await buscarTrajetos(semGarmin.map((w: any) => w.id)); };
  const cor = (f: number) => (f === 0 ? 'var(--texto-2)' : COR_FAIXA[f] === 'var(--ciano)' ? 'var(--ciano-forte)' : COR_FAIXA[f]);

  const mapa = !C ? <div className="trackmap tv-empty"><p className="apoio muted">Lendo os trajetos…</p></div>
    : !n ? <div className="trackmap tv-empty"><p className="apoio muted" style={{ padding: 24, textAlign: 'center' }}>Nenhum {nome(modal, 1)} com trajeto neste período.</p></div>
    : fundo && !falhou && navigator.onLine !== false ? <Suspense fallback={<CalorSvg ag={C.ag} linhas={C.linhas} sel={sel ? sel.cells : null} onPick={pick} desc={desc} />}><CalorMap ag={C.ag} linhas={C.linhas} sel={sel ? sel.cells : null} onPick={pick} onFail={(w) => setFalhou(w)} desc={desc} /></Suspense>
    : <CalorSvg ag={C.ag} linhas={C.linhas} sel={sel ? sel.cells : null} onPick={pick} desc={desc} />;

  const painel = (<>
    <div className="stack" style={{ gap: 2 }}>
      <h2 className="titulo-2 tn">{C ? (n ? n + ' ' + nome(modal, n) + ' · cerca de ' + kmTxt(C.resumo.km) + ' km de ruas diferentes' : 'Nenhum ' + nome(modal, 1) + ' com trajeto') : 'Lendo os trajetos…'}</h2>
      <span className="apoio muted">{SUB[per]}{modal === 'pedal' ? ' · separado da corrida' : ''}</span>
    </div>
    {sel ? (
      <div className="mc-rua" aria-live="polite">
        <div className="row between"><b className="tn">Rua selecionada · {dec(sel.km, 1)} km</b><span className="tn" style={{ color: cor(FAIXAS.findIndex((f) => sel.ids.length <= f[1])) }}>{sel.ids.length} {sel.ids.length === 1 ? 'passagem' : 'passagens'}</span></div>
        <ul className="mc-lista">
          {(todos ? doSel : doSel.slice(0, 2)).map((w: any) => (
            <li key={w.id}><a href={href('treino', w.id)}><span>{dayMon(w.date)} · {workoutTitle(w)}</span><span className="tn">{w.distKm ? dec(w.distKm, 2) + ' km' : ''}</span><IconChevronRight size={16} stroke={1.75} aria-hidden="true" /></a></li>))}
        </ul>
        {doSel.length > 2 ? <button type="button" className="link mc-ver" aria-expanded={todos} onClick={() => setTodos(!todos)}>{todos ? 'Mostrar menos' : 'Ver os ' + doSel.length + ' treinos'}</button> : null}
      </div>
    ) : n ? <p className="mc-dica apoio">Toque numa rua para ver {modal === 'pedal' ? 'os pedais' : 'as corridas'} que passaram por ela.</p> : null}
    {ruas.length ? (
      <div className="mc-teclado" role="group" aria-label="Percorrer as ruas mais frequentes">
        <button type="button" className="btn quiet sm" onClick={() => vaiRua(-1)} aria-label="Rua anterior">Anterior</button>
        <span className="apoio muted tn" aria-live="polite">{ri >= 0 ? 'Rua ' + (ri + 1) + ' de ' + ruas.length + ', da mais frequente' : 'Ou percorra as ' + ruas.length + ' ruas mais frequentes'}</span>
        <button type="button" className="btn quiet sm" onClick={() => vaiRua(1)} aria-label="Próxima rua">Próxima</button>
      </div>) : null}
    {baixando ? <p className="hint" role="status">{baixando}</p> : null}
    {C && C.semTrajeto.length ? (
      <div className="mc-sem">
        <span className="apoio muted"><IconRoute size={16} stroke={1.75} aria-hidden="true" />{C.semTrajeto.length} {nome(modal, C.semTrajeto.length)} sem trajeto neste aparelho {C.semTrajeto.length === 1 ? 'ficou' : 'ficaram'} de fora.</span>
        {semGarmin.length && garminReady() ? <button type="button" className="link mc-ver" disabled={gs.rodando} onClick={buscar}>{gs.rodando ? 'Buscando ' + gs.feito + ' de ' + gs.total + '…' : 'Buscar trajetos antigos'}</button> : null}
      </div>) : null}
    {falhou && fundo ? <p className="hint">Sem as ruas no fundo: {falhou}.</p> : null}
    <p className="hint"><IconLock size={14} stroke={1.75} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 4 }} />Só você vê. O mapa é calculado neste aparelho e não vai para cards, compartilhamento nem sincronização.</p>
    <Kpi doc="mapa-calor" className="link-kpi" label="Sobre o mapa de calor">Como o mapa de calor é calculado</Kpi>
  </>);

  return (
    <div className={'tv mc' + (aberta ? ' snap-mid' : '')}>
      <div className="tv-map">
        {mapa}
        <div className="tv-top">
          <a className="iconbtn" href={href('progresso')} aria-label="Voltar para Progresso"><IconArrowLeft size={22} stroke={1.75} /></a>
          <h1 className="tv-title grow">Mapa de calor</h1>
          <span className="mc-priv"><IconLock size={14} stroke={1.75} aria-hidden="true" />Só você vê</span>
        </div>
        <div className="mc-ctl">
          <div className="seg on-map" role="radiogroup" aria-label="Modalidade">
            {(['corrida', 'pedal'] as Modal[]).map((m) => <button key={m} type="button" role="radio" aria-checked={modal === m} onClick={() => setModal(m)}>{m === 'corrida' ? 'Corrida' : 'Pedal'}</button>)}
          </div>
          <PerMenu value={per} onChange={setPer} opts={opts} />
          <button type="button" className={'mc-fundo' + (fundo ? ' on' : '')} aria-pressed={fundo} aria-label="Mostrar as ruas no fundo" onClick={() => { setFundo(!fundo); setFalhou(null); }}><IconMap size={20} stroke={1.75} /></button>
        </div>
        {n ? (
          <div className="mc-legenda" aria-label="Legenda: de 1 vez a 20 vezes ou mais">
            <span>1 vez</span>
            {[0, 1, 2, 3, 4].map((f) => <i key={f} aria-hidden="true" style={{ background: COR_FAIXA[f], opacity: OPAC_FAIXA[f], height: Math.round(LARG_FAIXA[f]) + 'px' }} />)}
            <span>20 vezes ou mais</span>
          </div>) : null}
      </div>
      <aside className="tv-panel" aria-label="Resumo do mapa">
        <button type="button" className="tv-handle only-mob" aria-expanded={aberta} aria-label={aberta ? 'Recolher o resumo' : 'Expandir o resumo'} onClick={() => setAberta(!aberta)}>
          <i aria-hidden="true" />{aberta ? <IconChevronDown size={16} stroke={1.75} aria-hidden="true" /> : <IconChevronUp size={16} stroke={1.75} aria-hidden="true" />}
        </button>
        <div className="tv-panel-in">{painel}</div>
      </aside>
    </div>
  );
}
