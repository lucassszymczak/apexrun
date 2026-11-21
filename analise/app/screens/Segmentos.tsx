// SEGMENTOS (Fase 3 · Etapa 4; design/telas-fase3/Segmentos, SegmentoDetalhe, SegmentosDesktop,
// TreinoSegmentos). Lista por modalidade, detalhe (trecho, evolução, ranking, renomear) e a seção
// "Segmentos deste treino". Só você vê: nada daqui vai para card, compartilhamento ou comunidade.
import { useMemo, useState } from 'react';
import { IconArrowUpRight, IconArrowDownRight, IconMinus, IconPencil, IconChevronRight, IconRoute, IconLock } from '@tabler/icons-react';
import { useApex, getState, commit } from '../store';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, Kpi, Sheet, Empty } from '../ui';
import { dayMon } from '../fmt';
import { TrackSvg } from '../map/TrackSvg';
import { type Track } from '../track';
import { catalogo, resumoSeg, useBusca, useAtualizaSegmentos, type Modal, type PassagemW } from '../segmentos-app';
import { type Segmento, type Tendencia } from '../../segmentos.mjs';
import { SeloEsforco } from './Leitura';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const tmm = (s: number | null | undefined) => { if (s == null || !isFinite(s)) return '—'; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0') : m + ':' + String(x).padStart(2, '0'); };
const km = (m: number) => (m / 1000).toFixed(1).replace('.', ',');
const sinal = (m: number) => (m > 0 ? '+' : m < 0 ? '−' : '') + Math.abs(Math.round(m));
export function relevo(s: Segmento, pct = false) {
  if (s.ganhoM == null) return '';
  const g = (s.ganhoM / s.distM) * 100;
  if (Math.abs(g) <= 2) return 'plano';
  return sinal(s.ganhoM) + ' m' + (pct ? ' (' + (g > 0 ? '+' : g < 0 ? '−' : '') + Math.abs(g).toFixed(1).replace('.', ',') + '%)' : '');
}
const ord = (n: number) => n + 'º';

export function TendenciaTxt({ td, curto = false }: { td: Tendencia; curto?: boolean }) {
  const mes = td.desde ? MES3[+td.desde.slice(5, 7) - 1] : '';
  if (td.estado === 'rapido') return <span className="seg-td ok"><IconArrowUpRight size={16} stroke={2} aria-hidden="true" />{curto ? 'mais rápido' : td.difS + ' s mais rápido desde ' + mes}</span>;
  if (td.estado === 'lento') return <span className="seg-td atencao"><IconArrowDownRight size={16} stroke={2} aria-hidden="true" />{curto ? 'mais lento' : Math.abs(td.difS || 0) + ' s mais lento desde ' + mes}</span>;
  if (td.estado === 'estavel') return <span className="seg-td"><IconMinus size={16} stroke={2} aria-hidden="true" />estável</span>;
  return <span className="seg-td">poucas passagens</span>;
}
export function conclusao(td: Tendencia, n: number) {
  const mes = td.desde ? MESES[+td.desde.slice(5, 7) - 1] : '';
  if (td.estado === 'rapido') return 'Você está ' + td.difS + ' s mais rápido que em ' + mes + '.';
  if (td.estado === 'lento') return 'Você está ' + Math.abs(td.difS || 0) + ' s mais lento que em ' + mes + '.';
  if (td.estado === 'estavel') return 'Tempo estável nas últimas passagens.';
  return 'Ainda são ' + n + ' passagens: a tendência aparece com 6.';
}

// desenho pequeno do trecho (sem mapa)
export function FormaMini({ s, w = 56, h = 44 }: { s: Segmento; w?: number; h?: number }) {
  const f = s.forma; const c = Math.cos((f.lat[0] * Math.PI) / 180);
  const xs = f.lon.map((v) => v * c), ys = f.lat.map((v) => -v);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min((w - 12) / ((x1 - x0) || 1e-9), (h - 12) / ((y1 - y0) || 1e-9));
  const ox = (w - (x1 - x0) * k) / 2, oy = (h - (y1 - y0) * k) / 2;
  const pts = xs.map((x, i) => (ox + (x - x0) * k).toFixed(1) + ',' + (oy + (ys[i] - y0) * k).toFixed(1)).join(' ');
  return <svg className="seg-forma" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><polyline points={pts} fill="none" stroke="var(--ciano)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function SegItem({ s, st, on }: { s: Segmento; st: any; on?: boolean }) {
  const R = resumoSeg(st, s); const b = R.rk[0];
  return (
    <a className={'seg-item' + (on ? ' on' : '')} href={href('progresso', 'segmentos', s.id)} aria-current={on ? 'true' : undefined}>
      <FormaMini s={s} />
      <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
        <b className="seg-nome">{s.nome}</b>
        <span className="apoio muted tn">{km(s.distM)} km · {relevo(s)} · {R.ps.length} passagens</span>
        {b ? <span className="apoio tn">Melhor {tmm(b.t)}{R.corrida ? (b.tAj != null ? ' · ajustado ' + tmm(b.tAj) : '') : ' · tempo real'}</span> : null}
        <TendenciaTxt td={R.td} />
      </span>
      <IconChevronRight size={18} stroke={1.75} className="faint" aria-hidden="true" />
    </a>
  );
}

function SegLista({ modal, setModal, st, selId }: { modal: Modal; setModal: (m: Modal) => void; st: any; selId?: string | null }) {
  const b = useBusca();
  const lista = catalogo(st, modal);
  return (<>
    <div className="seg full" role="radiogroup" aria-label="Modalidade">
      {(['corrida', 'pedal'] as Modal[]).map((m) => <button key={m} type="button" role="radio" aria-checked={modal === m} onClick={() => setModal(m)}>{m === 'corrida' ? 'Corrida' : 'Pedal'}</button>)}
    </div>
    {modal === 'pedal' ? <p className="hint">No pedal, a comparação é só pelo tempo real. O ajuste por inclinação e clima vale só para corrida.</p> : null}
    {b.rodando === modal ? <p className="hint" role="status">Procurando segmentos nos seus trajetos…</p> : null}
    {lista.length ? (<>
      <span className="cap">Mais passagens</span>
      <div className="seg-lista">{lista.map((s) => <SegItem key={s.id} s={s} st={st} on={selId === s.id} />)}</div>
    </>) : b.rodando !== modal ? <Card><Empty>Nenhum trecho repetido ainda. Um segmento aparece quando você passa pelo menos 3 vezes pelo mesmo trecho de 500 m, no mesmo sentido.</Empty></Card> : null}
    <Kpi doc="segmento" className="link-kpi" label="Sobre os segmentos">Como os segmentos são encontrados</Kpi>
  </>);
}

const pseudoTrack = (s: Segmento): Track => {
  const n = s.forma.lat.length; const dist: number[] = [0];
  for (let i = 1; i < n; i++) { const a = s.forma, M = 111195; dist.push(dist[i - 1] + Math.hypot((a.lat[i] - a.lat[i - 1]) * M, (a.lon[i] - a.lon[i - 1]) * M * Math.cos((a.lat[i] * Math.PI) / 180))); }
  const nul = () => new Array(n).fill(null);
  return { v: 1, start: 0, tzOffsetSec: null, hasGps: true, t: dist.map((_, i) => i), lat: s.forma.lat, lon: s.forma.lon, dist, hr: nul(), spd: nul(), alt: nul(), grade: nul(), draw: Array.from({ length: n }, (_, i) => i) };
};

function Evolucao({ ps, corrida }: { ps: PassagemW[]; corrida: boolean }) {
  const [modo, setModo] = useState<'aj' | 'real'>(corrida ? 'aj' : 'real');
  const v = (p: PassagemW) => (modo === 'aj' && p.tAj != null ? p.tAj : p.t);
  const L = ps.slice().sort((a, b) => a.date.localeCompare(b.date)).filter((p) => v(p) > 0);
  if (L.length < 2) return null;
  const W = 340, H = 150, pl = 44, pr = 12, pt = 12, pb = 22;
  const vs = L.map(v), mn = Math.min(...vs), mx = Math.max(...vs), pad = Math.max(5, (mx - mn) * 0.15);
  const y = (s: number) => pt + ((s - (mn - pad)) / ((mx + pad) - (mn - pad))) * (H - pt - pb); // menor tempo = mais alto
  const x = (i: number) => pl + (L.length === 1 ? 0 : (i / (L.length - 1)) * (W - pl - pr));
  const best = vs.indexOf(mn);
  const ticks = [mn, (mn + mx) / 2, mx];
  return (
    <Card>
      <div className="row between" style={{ alignItems: 'center' }}>
        <h2 className="lead">Evolução</h2>
        {corrida ? <div className="seg" role="radiogroup" aria-label="Tempo do gráfico">{([['aj', 'Ajustado'], ['real', 'Real']] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={modo === k} onClick={() => setModo(k)}>{l}</button>)}</div> : null}
      </div>
      <svg className="seg-evo" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={'Evolução do tempo ' + (modo === 'aj' ? 'ajustado' : 'real') + ': ' + L.map((p) => dayMon(p.date) + ' ' + tmm(v(p))).join(', ')}>
        {ticks.map((t, i) => <g key={i}><line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--linha)" strokeDasharray="3 3" /><text x={pl - 6} y={y(t) + 4} textAnchor="end" className="seg-evo-t">{tmm(t)}</text></g>)}
        <polyline points={L.map((p, i) => x(i) + ',' + y(v(p))).join(' ')} fill="none" stroke="var(--ciano)" strokeWidth="2" strokeLinejoin="round" />
        {L.map((p, i) => i === best ? <path key={i} d={`M${x(i)} ${y(v(p)) - 7} l7 7 -7 7 -7 -7Z`} fill="var(--violeta)" stroke="var(--on-violeta)" strokeWidth="1.5" /> : <circle key={i} cx={x(i)} cy={y(v(p))} r="3.5" fill="var(--ciano)" />)}
        <text x={pl} y={H - 4} className="seg-evo-t">{dayMon(L[0].date)}</text>
        <text x={W - pr} y={H - 4} textAnchor="end" className="seg-evo-t">{dayMon(L[L.length - 1].date)}</text>
      </svg>
      <p className="hint">Mais alto = mais rápido. O losango marca o seu melhor ({dayMon(L[best].date)}).</p>
    </Card>
  );
}

function SegDetalhe({ s, st, desk }: { s: Segmento; st: any; desk: boolean }) {
  const R = resumoSeg(st, s);
  const [todas, setTodas] = useState(false);
  const [ren, setRen] = useState<string | null>(null);
  const tr = useMemo(() => pseudoTrack(s), [s.id]);
  const linhas = todas ? R.rk : R.rk.slice(0, 5);
  const salvarNome = () => {
    const nome = (ren || '').trim(); if (!nome) return;
    const S = getState(); const a: any = S.athlete; const x = (a.segmentos || []).find((o: any) => o.id === s.id); if (!x) return;
    x.nome = nome.slice(0, 40); x.renomeado = true; a.updatedAt = new Date().toISOString(); commit(); setRen(null);
  };
  return (<>
    <div className="stack" style={{ gap: 4 }}>
      <span className="apoio muted tn">{km(s.distM)} km · {relevo(s, true)} · {s.modal === 'pedal' ? 'pedal' : 'corrida'}</span>
      <h2 className="titulo-2">{conclusao(R.td, R.ps.length)}</h2>
      <span className="apoio muted">{R.corrida ? 'No tempo ajustado, que desconta a inclinação e o clima' : 'No tempo real'} · {R.ps.length} passagens</span>
    </div>
    <div className="row wrap" style={{ gap: 8 }}>
      <button type="button" className="btn quiet sm" onClick={() => setRen(s.nome)}><IconPencil size={18} stroke={1.75} aria-hidden="true" />Renomear</button>
    </div>
    <div className="seg-mapa" aria-label="Desenho do trecho"><TrackSvg tr={tr} band={() => 0} palette={['var(--ciano)']} cursor={null} onPick={() => {}} /></div>
    <Evolucao ps={R.ps} corrida={R.corrida} />
    <Card>
      <h2 className="lead">Suas melhores passagens</h2>
      <table className="tbl seg-tbl">
        <thead><tr><th scope="col">#</th><th scope="col">Data</th><th scope="col">Tempo</th>{R.corrida ? <th scope="col">Ajustado</th> : null}<th scope="col">FC</th>{desk && R.corrida ? <th scope="col">Clima</th> : null}</tr></thead>
        <tbody>
          {linhas.map((p, i) => (
            <tr key={p.wid}>
              <td className="tn">{i + 1}</td>
              <td><a href={href('treino', p.wid)}>{dayMon(p.date)}</a>{i === 0 ? <> <SeloMelhor /></> : null}</td>
              <td className="tn">{tmm(p.t)}{p.prec === 5 ? <span className="muted"> ±5</span> : null}</td>
              {R.corrida ? <td className="tn">{p.tAj != null ? tmm(p.tAj) : '—'}</td> : null}
              <td className="tn">{p.fc || '—'}</td>
              {desk && R.corrida ? <td className="tn">{p.w.weather && p.w.weather.tempC != null ? Math.round(p.w.weather.tempC) + ' °C' : 'sem clima'}</td> : null}
            </tr>))}
        </tbody>
      </table>
      {R.rk.length > 5 ? <button type="button" className="link mc-ver" aria-expanded={todas} onClick={() => setTodas(!todas)}>{todas ? 'Mostrar menos' : 'Ver as ' + R.rk.length + ' passagens'}</button> : null}
      {R.leve ? <p className="hint">±5: passagem medida pela versão leve do trajeto, com precisão de cerca de 5 s.</p> : null}
      <p className="hint">{R.corrida ? 'Tempo ajustado: inclinação (GAP) e clima padrão, as mesmas regras do resto do app.' : 'No pedal, só o tempo real: as fórmulas de inclinação e clima do app são de corrida.'}</p>
      <div className="row wrap" style={{ gap: 12 }}>
        {R.corrida ? <Kpi doc="tempo-ajustado" className="link-kpi" label="Sobre o tempo ajustado">O que é o tempo ajustado</Kpi> : null}
        <Kpi doc="tendencia" className="link-kpi" label="Sobre a tendência">Como a tendência é calculada</Kpi>
      </div>
    </Card>
    {ren != null ? (
      <Sheet title="Renomear segmento" onClose={() => setRen(null)}>
        <div className="field"><label htmlFor="seg-nome">Nome</label><input id="seg-nome" value={ren} maxLength={40} onChange={(e) => setRen(e.target.value)} /></div>
        <p className="hint">Só você vê este nome.</p>
        <button type="button" className="btn-primary" onClick={salvarNome}>Salvar</button>
      </Sheet>) : null}
  </>);
}
export function SeloMelhor() { return <span className="selo pr"><svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M4 0 8 4 4 8 0 4Z" fill="currentColor" /></svg>Seu melhor</span>; }

export function Segmentos({ id }: { id: string | null }) {
  const { st } = useApex();
  const sel = id ? catalogo(st).find((s) => s.id === id) || null : null;
  const [modal, setModal] = useState<Modal>(sel ? sel.modal : 'corrida');
  useAtualizaSegmentos(modal);
  const desk = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches;
  if (!desk && sel) return (<><PageHead title={sel.nome} back={href('progresso', 'segmentos')} /><SegDetalhe s={sel} st={st} desk={false} /></>);
  const alvo = sel && sel.modal === modal ? sel : desk ? catalogo(st, modal)[0] || null : null;
  return (<>
    <PageHead title="Segmentos" sub="Trechos que você repete, encontrados pelo app" back={href('progresso')} />
    <div className={desk ? 'seg-cols' : ''}>
      <div className="stack" style={{ gap: 12 }}><SegLista modal={modal} setModal={setModal} st={st} selId={alvo ? alvo.id : null} /></div>
      {desk && alvo ? <div className="stack seg-det" style={{ gap: 16 }}><h2 className="titulo-1" style={{ fontSize: 24, lineHeight: '30px' }}>{alvo.nome}</h2><SegDetalhe s={alvo} st={st} desk /></div> : null}
    </div>
  </>);
}

// ---------------- Treino › Segmentos deste treino ----------------
export function SegmentosDoTreino({ w, st, onPick, idxAt }: { w: any; st: any; onPick: (a: number, b: number) => void; idxAt: ((t: number) => number) | null }) {
  const ps = (w.leitura && w.leitura.segmentos) || [];
  const cat = catalogo(st);
  const itens = ps.map((p: any) => { const s = cat.find((x) => x.id === p.id); if (!s) return null; const R = resumoSeg(st, s); const pos = R.rk.findIndex((x) => x.wid === w.id); return { p, s, pos, n: R.rk.length, corrida: R.corrida }; }).filter(Boolean) as any[];
  if (!itens.length) return null;
  const melhor = itens.find((x) => x.pos === 0 && x.n >= 2);
  return (
    <Card>
      <span className="cap row" style={{ gap: 6 }}><IconRoute size={14} stroke={1.75} aria-hidden="true" />Segmentos deste treino · {itens.length}</span>
      <h2 className="lead">{melhor ? 'Seu melhor no ' + melhor.s.nome : itens.length === 1 ? 'Você passou por 1 segmento' : 'Você passou por ' + itens.length + ' segmentos'}</h2>
      <ul className="seg-treino">
        {itens.map((x, i) => (
          <li key={x.s.id}>
            <button type="button" onClick={() => { if (idxAt) onPick(idxAt(x.p.ini), idxAt(x.p.ini + x.p.t)); }} disabled={!idxAt} aria-label={x.s.nome + ': destacar no mapa'}>
              <span className="n tn">{i + 1}</span>
              <span className="stack grow" style={{ gap: 0, minWidth: 0 }}><b className="seg-nome">{x.s.nome}</b><span className="apoio muted tn">{km(x.s.distM)} km · {tmm(x.p.t)}{x.corrida && x.p.tAj != null ? ' · ajustado ' + tmm(x.p.tAj) : ''}</span></span>
              {x.pos === 0 && x.n >= 2 ? <SeloMelhor /> : <span className="apoio muted tn">{ord(x.pos + 1)} de {x.n}</span>}
            </button>
          </li>))}
      </ul>
      <a className="link-kpi" href={href('progresso', 'segmentos')}>Ver todos os segmentos</a>
      <span className="hint"><IconLock size={12} stroke={1.75} aria-hidden="true" style={{ verticalAlign: '-1px', marginRight: 4 }} />Só você vê os segmentos.</span>
    </Card>
  );
}
export { SeloEsforco };
