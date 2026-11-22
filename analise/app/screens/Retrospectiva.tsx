// RETROSPECTIVA DO CICLO (Fase 5 · Etapa 5; design/telas-fase5/Retrospectiva e RetroStories).
// Blocos com rótulo em caixa alta pequena e título-conclusão, pela regra aprovada
// (analise/retrospectiva.mjs). Blocos sem dado não aparecem. "Gerar Stories" (ação principal)
// desenha até 6 cards 9:16 só com números e gráficos: nenhum mapa e nenhum segmento.
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconCheck, IconCircleHalf, IconMinus, IconChevronRight, IconDownload, IconHistory } from '@tabler/icons-react';
import { useApex } from '../store';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, Empty } from '../ui';
import { noEmoji } from '../fmt';
import { getTrack } from '../db';
import { idxAtDist, totalDist } from '../track';
import { hojeEm } from '../../consistencia.mjs';
import { retrospectiva, cardsStories, mostraCardHoje, provaDoCiclo, ddmmm, hms, type Bloco, type Retro } from '../../retrospectiva.mjs';
import { prefsTreino } from '../amanha-app';
import { usePlano } from '../plano-app';
import { gerarStories, salvarStories, altDoCard } from '../share/retro-img';

const kmTxt = (k: number) => (k >= 100 ? String(Math.round(k)) : String(Math.round(k * 10) / 10).replace('.', ','));
const Losango = () => <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M4 0 8 4 4 8 0 4Z" fill="currentColor" /></svg>;
const ICO: Record<string, any> = { consistente: IconCheck, parcial: IconCircleHalf, sem: IconMinus };
const ROT: Record<string, string> = { consistente: 'consistente', parcial: 'parcial', sem: 'sem treino' };

export function useRetrospectiva(st: any): Retro | null {
  const P = usePlano(st);
  const race = st.race;
  const hoje = hojeEm();
  const prova = race && race.date && hoje > race.date ? provaDoCiclo(race, st.workouts) : null;
  // o real das passagens sai do trajeto da prova (1 Hz), quando ele está no aparelho
  const [tr, setTr] = useState<any>(null);
  useEffect(() => { let ok = true; setTr(null); if (prova) getTrack(prova.id).then((t) => { if (ok) setTr(t); }); return () => { ok = false; }; }, [prova && prova.id]);
  return useMemo(() => {
    if (!race) return null;
    const passagens = race.goal === 'time' && P && P.plano ? P.plano.passagens : null;
    const realNoKm = tr ? (km: number) => { const m = km * 1000; if (totalDist(tr) < m - 50) return null; const i = idxAtDist(tr, m); return i >= 0 ? tr.t[i] : null; } : null;
    return retrospectiva({ workouts: st.workouts, athlete: st.athlete, race, hoje, segmentos: (st.athlete && st.athlete.segmentos) || [], planoPassagens: passagens, metaH: prefsTreino(st.athlete).metaSemanalH, realNoKm });
  }, [st.workouts, st.athlete, race, hoje, P && P.plano, tr]);
}

function Bloco_({ b, children }: { b: Bloco; children?: any }) {
  return (<Card className="retro-b" aria-labelledby={'rb-' + b.tipo}>
    <span className="cap">{b.rotulo}</span>
    <h2 className="titulo-2" id={'rb-' + b.tipo}>{b.titulo}</h2>
    {children}
  </Card>);
}

export function Retrospectiva() {
  const { st } = useApex();
  const R = useRetrospectiva(st);
  const [prev, setPrev] = useState<{ url: string; alt: string }[] | null>(null);
  const [arqs, setArqs] = useState<{ blob: Blob; nome: string; alt: string }[] | null>(null);
  const [msg, setMsg] = useState('');
  const [gerando, setGerando] = useState(false);
  const prevRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => { (prev || []).forEach((p) => URL.revokeObjectURL(p.url)); }, [prev]);
  if (!st.race || !R) return (<>
    <PageHead title="Retrospectiva" back={href('mais', 'maratona')} />
    <Card><Empty icon={<IconHistory size={32} stroke={1.75} />}>Sem ciclo de prova com início definido. Defina o início do ciclo em Editar ciclo.</Empty><a className="btn" href={href('mais', 'ciclo')}>Editar ciclo</a></Card>
  </>);
  const cards = cardsStories(R);
  const capa = R.blocos[0];
  const gerar = async () => {
    setGerando(true); setMsg('');
    const t0 = performance.now();
    try {
      const a = await gerarStories(cards, R);
      (prev || []).forEach((p) => URL.revokeObjectURL(p.url));
      setArqs(a); setPrev(a.map((x) => ({ url: URL.createObjectURL(x.blob), alt: x.alt })));
      (window as any).__apexRetroMs = Math.round(performance.now() - t0);
      setMsg(a.length + (a.length === 1 ? ' card pronto.' : ' cards prontos.'));
      setTimeout(() => prevRef.current?.focus(), 50);
    } catch { setMsg('Não consegui gerar os cards. Tente de novo.'); }
    setGerando(false);
  };
  const salvar = async () => { if (!arqs) return; const r = await salvarStories(arqs); setMsg(r === 'shared' ? 'Cards enviados.' : r === 'downloaded' ? 'Cards baixados.' : ''); };
  const sem = R.blocos.find((b) => b.tipo === 'segmentos');
  const ten = R.blocos.find((b) => b.tipo === 'tenis');
  return (<>
    <PageHead title="Retrospectiva do ciclo" back={href('mais', 'maratona')} />
    <Card className="retro-capa">
      <span className="apoio muted tn">{noEmoji(R.nome)} · de {ddmmm(R.ini)} a {ddmmm(R.fim)} · {capa.semanas} {capa.semanas === 1 ? 'semana' : 'semanas'}{R.parcial ? ' até agora' : ''}</span>
      <h1 className="titulo-1">{capa.titulo}</h1>
      {R.parcial ? <p className="hint">Versão até agora: o ciclo vai até a prova, em {ddmmm(st.race.date)}.</p> : null}
    </Card>
    {R.blocos.slice(1).map((b) => {
      if (b.tipo === 'volume') {
        const mx = Math.max(1, ...b.barras.map((x: any) => x.km)), pk = b.barras.find((x: any) => x.n === b.pico);
        return (<Bloco_ key={b.tipo} b={b}>
          <div className="retro-barras" role="img" aria-label={'Km por semana: ' + b.barras.map((x: any) => 'semana ' + x.n + ' ' + kmTxt(x.km) + ' km').join(', ')}>
            {b.barras.map((x: any) => <span key={x.n} className={x.n === b.pico ? 'on' : ''} style={{ height: Math.max(2, (x.km / mx) * 100) + '%' }} />)}
          </div>
          <div className="row between apoio muted tn"><span>{ddmmm(b.barras[0].seg)}</span>{pk ? <span>pico: {kmTxt(pk.km)} km</span> : null}<span>{ddmmm(R.fim)}</span></div>
        </Bloco_>);
      }
      if (b.tipo === 'consistencia') return (<Bloco_ key={b.tipo} b={b}>
        <div className="semanas retro-sem" role="list" aria-label="Semanas do ciclo">
          {b.estados.map((e: string, i: number) => { const I = ICO[e] || IconMinus; return <span role="listitem" key={i} className={'csw ' + e} aria-label={'Semana ' + (i + 1) + ': ' + (ROT[e] || e)}><I size={18} stroke={2} aria-hidden="true" /></span>; })}
        </div>
        <p className="hint">Verde com check: consistente · contorno âmbar: parcial · traço: sem treino. A semana em andamento fica de fora.</p>
      </Bloco_>);
      if (b.tipo === 'recordes') return (<Bloco_ key={b.tipo} b={b}>
        {b.recordes.length ? <ul className="retro-lista">{b.recordes.map((r: any) => (
          <li key={r.dist}><a href={href('treino', r.wid)}><span className="grow">{r.dist}</span><span className="selo pr"><Losango />Recorde pessoal</span><b className="tn">{hms(r.t)}</b></a></li>))}</ul> : null}
        {b.longao ? <a className="item-row opcao-link" href={href('treino', b.longao.wid)}><span className="grow">Longão mais longo</span><span className="tn">{kmTxt(b.longao.km)} km · {ddmmm(b.longao.date)}</span><IconChevronRight size={18} stroke={1.75} aria-hidden="true" /></a> : null}
      </Bloco_>);
      if (b.tipo === 'prova') return (<Bloco_ key={b.tipo} b={b}>
        {b.linhas.length ? (
          <div className="tbl-wrap"><table className="retro-tbl">
            <thead><tr><th scope="col">Passagem</th><th scope="col" className="n">Plano</th><th scope="col" className="n">Real</th></tr></thead>
            <tbody>{b.linhas.map((l: any) => <tr key={l.rotulo} className={l.rotulo === 'Chegada' ? 'cheg' : ''}><td>{l.rotulo}</td><td className="n">{hms(l.plano)}</td><td className="n"><b>{hms(l.real)}</b></td></tr>)}</tbody>
          </table></div>) : <p className="apoio">Sem tempo-alvo no ciclo: fica só o tempo final.</p>}
        <a className="link" href={href('treino', b.wid)}>Ver a prova</a>
      </Bloco_>);
      if (b.tipo === 'segmentos' || b.tipo === 'tenis') {
        if (b.tipo === 'tenis' && sem) return null; // tênis entra junto com segmentos
        return (<Card key={b.tipo} className="retro-b" aria-labelledby="rb-st">
          <span className="cap">{sem && ten ? 'Segmentos e tênis' : b.rotulo}</span>
          <h2 className="titulo-2" id="rb-st">{(sem || b).titulo}</h2>
          <ul className="retro-lista">
            {sem ? sem.lista.map((s: any) => <li key={s.id}><a href={href('progresso', 'segmentos', s.id)}><span className="grow">{s.nome}</span><b className="tn" style={{ color: 'var(--ok)' }}>{s.difS} s mais rápido</b></a></li>) : null}
            {ten ? ten.lista.map((t: any) => <li key={t.id}><a href={href('mais', 'equipamentos')}><span className="grow">{t.nome}</span><b className="tn">{kmTxt(t.km)} km no ciclo</b></a></li>) : null}
          </ul>
          {sem ? <p className="hint">Os segmentos ficam só aqui: não entram nos Stories.</p> : null}
        </Card>);
      }
      return null;
    })}
    <Card className="retro-gerar">
      <button type="button" className="btn-primary" onClick={gerar} disabled={gerando} aria-busy={gerando}>{gerando ? 'Gerando…' : 'Gerar Stories'}</button>
      <span className="apoio muted">{cards.length} {cards.length === 1 ? 'card' : 'cards'} 9:16, só com números e gráficos. Nenhum mapa.</span>
      <p className="apoio" aria-live="polite" role="status">{msg}</p>
      {prev ? (<>
        <div className="retro-prev" ref={prevRef} tabIndex={-1} role="list" aria-label="Prévia dos Stories">
          {prev.map((p, i) => <img role="listitem" key={i} src={p.url} alt={p.alt} width={1080} height={1920} />)}
        </div>
        <button type="button" className="btn quiet" onClick={salvar}><IconDownload size={18} stroke={1.75} aria-hidden="true" />Salvar os {prev.length} cards</button>
      </>) : null}
    </Card>
  </>);
}

// Hoje: do dia seguinte à prova até 14 dias depois
export function RetroCardHoje() {
  const { st } = useApex();
  if (!mostraCardHoje(st.race, hojeEm())) return null;
  return (
    <Card as="a" href={href('mais', 'retrospectiva')} className="retro-hoje" style={{ color: 'var(--texto)', textDecoration: 'none' }}>
      <div className="row" style={{ gap: 10 }}>
        <IconHistory size={22} stroke={1.75} color="var(--ciano)" aria-hidden="true" />
        <div className="stack grow" style={{ gap: 2 }}><b>Sua retrospectiva do ciclo está pronta</b><span className="apoio muted">{noEmoji((st.race && st.race.name) || 'Ciclo de prova')}: volume, consistência, recordes e a prova.</span></div>
        <span className="link">Ver retrospectiva</span>
      </div>
    </Card>);
}
export { altDoCard };
