// PLANO DE PROVA (Fase 4 · Etapa 3; design/telas-fase4/PlanoProva, PlanoDesktop e PlanoImagem).
// Título-conclusão, chips (meta, estratégia, clima), perfil e pace alvo no mesmo eixo de km,
// passagens, blocos de 5 km (sanfona), clima e "Salvar no celular" (imagem 9:16). Abre sem
// internet: tudo sai do ciclo, do percurso e da última previsão guardada no aparelho.
import { useEffect, useMemo, useState } from 'react';
import { IconChevronDown, IconChevronRight, IconDownload, IconDeviceMobile, IconAlertTriangle } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { useApex, toast } from '../store';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, Empty, Kpi } from '../ui';
import { dec, noEmoji } from '../fmt';
import { tituloPlano } from '../../plano.mjs';
import { usePlano } from '../plano-app';
import { PerfilCourse, metaTxt } from './Ciclo';
import { FONTE_ROTULO, trackDoCourse } from '../course';
import { TrackSvg } from '../map/TrackSvg';
import { renderPlanoImg, toPng } from '../share/plano-img';
import { shareOrDownload, download } from '../share/card';

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dataLonga = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return d + ' ' + MES[m - 1] + ' ' + y; };
const dataCurta = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return d + ' ' + MES[m - 1]; };
const hms = (s: number) => E.hms(Math.round(s));
const pc = (s: number) => E.paceStr(s);
const incl = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '') + dec(Math.abs(x), 1).replace(',0', '') + '%';

// Pace alvo em degraus (mais alto = mais rápido), no mesmo eixo de km do perfil
function PaceChart({ plano, duro, dist, height = 120 }: { plano: any; duro: any; dist: number; height?: number }) {
  const W = 340, H = height, L = 0, padT = 8, padB = 8;
  const ps = plano.linhas.map((l: any) => l.paceSkm);
  const lo = Math.min(...ps), hi = Math.max(...ps), span = Math.max(20, hi - lo);
  const y0 = lo - span * 0.25, y1 = hi + span * 0.25;
  const X = (km: number) => L + (km / dist) * (W - L), Y = (p: number) => padT + ((p - y0) / (y1 - y0)) * (H - padT - padB);
  let d = '', ini = 0;
  plano.linhas.forEach((l: any, i: number) => { const fim = ini + l.distKm; d += (i ? 'L' : 'M') + X(ini).toFixed(1) + ' ' + Y(l.paceSkm).toFixed(1) + 'L' + X(fim).toFixed(1) + ' ' + Y(l.paceSkm).toFixed(1); ini = fim; });
  const passo = span > 90 ? 60 : 30;
  const refs: number[] = []; for (let r = Math.ceil(y0 / passo) * passo; r <= y1; r += passo) refs.push(r);
  const marcas = [dist > 25 ? 21.0975 : dist / 2, ...(dist > 32 ? [30] : [])];
  const subida = plano.linhas.filter((l: any) => l.subida);
  const desc = 'Pace alvo por km: ' + pc(plano.P) + '/km no plano' + (subida.length ? ', ' + pc(Math.max(...subida.map((l: any) => l.paceSkm))) + '/km na subida mais dura' : '') + '. Mais alto é mais rápido.';
  return (
    <div className="pace-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart" style={{ height: H }} role="img" aria-label={desc}>
        {duro ? <rect x={X(duro.de - 1)} y={0} width={X(duro.ate) - X(duro.de - 1)} height={H} fill="var(--atencao)" fillOpacity={0.12} /> : null}
        {refs.map((r) => <line key={r} x1={0} x2={W} y1={Y(r)} y2={Y(r)} stroke="var(--linha)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
        {marcas.map((m) => <line key={m} x1={X(m)} x2={X(m)} y1={0} y2={H} stroke="var(--texto)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />)}
        <path d={d} fill="none" stroke="var(--ciano)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="pace-refs" aria-hidden="true">{refs.map((r) => <span key={r} style={{ top: (Y(r) / H) * 100 + '%' }}>{pc(r)}</span>)}</div>
    </div>
  );
}

function Blocos({ plano }: { plano: any }) {
  const [aberto, setAberto] = useState<number | null>(null);
  return (
    <div className="blocos">
      <div className="bl-head" aria-hidden="true"><span>Trecho</span><span>Terreno</span><span className="n">Pace</span><span className="n">Passa em</span></div>
      {plano.blocos.map((b: any, i: number) => {
        const on = aberto === i, id = 'bl-' + i;
        const tom = b.terreno === 'subida' || b.terreno === 'sobe e desce' ? 'var(--atencao)' : undefined;
        return (
          <div key={i} className="bl">
            <button type="button" className="bl-row" aria-expanded={on} aria-controls={id} onClick={() => setAberto(on ? null : i)}>
              <span className="row" style={{ gap: 6 }}>{on ? <IconChevronDown size={18} stroke={1.75} color="var(--ciano)" aria-hidden="true" /> : <IconChevronRight size={18} stroke={1.75} color="var(--ciano)" aria-hidden="true" />}{b.rotulo}</span>
              <span className="muted">{b.terreno}</span>
              <b className="n tn" style={{ color: tom }}>{pc(b.paceSkm)}</b>
              <span className="n tn">{hms(b.acumS)}</span>
            </button>
            {on ? (
              <table id={id} className="km-tab">
                <caption className="sr-only">Km a km de {b.rotulo}</caption>
                <thead><tr><th scope="col">Km</th><th scope="col" className="n">Inclin.</th><th scope="col" className="n">Pace</th><th scope="col" className="n">Acumulado</th></tr></thead>
                <tbody>{b.kms.map((l: any) => (
                  <tr key={l.km}><td>{l.km}{l.distKm < 0.999 ? ' (' + dec(l.distKm, 2) + ' km)' : ''}</td>
                    <td className="n">{incl(l.inclinacao)}{l.subida ? <span style={{ color: 'var(--atencao)' }}> subida</span> : null}</td>
                    <td className="n tn" style={{ color: l.subida ? 'var(--atencao)' : undefined }}>{pc(l.paceSkm)}</td>
                    <td className="n tn">{hms(l.acumS)}</td></tr>))}</tbody>
              </table>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function PlanoProva() {
  const { st } = useApex();
  const P = usePlano(st);
  const [img, setImg] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const race = st.race;
  const tr = useMemo(() => (race && race.course ? trackDoCourse(race.course) : null), [race && race.course]);
  const duro = P && P.res ? P.res.duro : null;
  const nomeArq = 'apex-plano-' + (race ? race.date : '') + '.png';
  const titulo = P && P.plano ? tituloPlano(P.plano, duro) : '';
  const estrat = race && race.strategy === 'negativa' ? 'segunda metade mais rápida' : 'esforço constante';
  const climaTxt = !P ? '' : P.clima.modo === 'previsao'
    ? 'previsão de ' + (P.prev.buscadaEm ? dataCurta(P.prev.buscadaEm.slice(0, 10)) : 'hoje') + (P.horaLargada ? ' · ' + Math.round(P.horaLargada.tempC) + ' °C às ' + (race!.startTime || '06:00') : '')
    : P.clima.motivo === 'longe' ? 'clima padrão até ' + dataCurta(P.clima.abre!) : 'clima padrão';

  // a imagem é gerada ao abrir a tela (o iPhone exige compartilhar logo após o toque)
  useEffect(() => {
    if (!P || !P.plano || !race) return;
    let vivo = true;
    (async () => {
      const c = await renderPlanoImg({ titulo: noEmoji(race.name || 'Prova') + ' · meta ' + metaTxt(P.meta!.alvoS), sub: estrat + (P.res ? ' · percurso ' + FONTE_ROTULO[race.course.fonte].toLowerCase() : ' · sem percurso'), plano: P.plano, duro, rodape: climaTxt });
      const blob = await toPng(c);
      if (vivo) setImg((old) => { if (old) URL.revokeObjectURL(old.url); return { blob, url: URL.createObjectURL(blob) }; });
    })().catch(() => {});
    return () => { vivo = false; };
  }, [P && P.plano, climaTxt]);

  if (!race) return (<><PageHead title="Plano de prova" back={href('mais', 'maratona')} /><Card><Empty>Nenhum ciclo ativo.</Empty></Card></>);
  if (!P || !P.plano) return (<>
    <PageHead title="Plano de prova" back={href('mais', 'maratona')} />
    <Card><Empty>Para montar o plano, escolha um tempo-alvo em Editar ciclo, ou registre treinos para o app calcular o seu tempo realista.</Empty>
      <a className="btn" href={href('mais', 'ciclo')}>Editar ciclo</a></Card>
  </>);
  const { plano, realista, meta, clima } = P;
  const salvar = async (modo: 'share' | 'baixar') => {
    if (!img) return; setBusy(true);
    try {
      if (modo === 'baixar') { download(img.blob, nomeArq); toast('Imagem baixada (1080×1920)'); }
      else { const r = await shareOrDownload(img.blob, nomeArq, 'Plano de prova'); if (r === 'downloaded') toast('Seu aparelho não abre o menu de compartilhar aqui: a imagem foi baixada.'); }
    } finally { setBusy(false); }
  };
  const sub = noEmoji(race.name || 'Prova') + ' · ' + dataLonga(race.date) + (race.course ? ' · percurso: ' + FONTE_ROTULO[race.course.fonte].toLowerCase() + ' (confiança ' + String(race.course.confianca).toLowerCase() + ')' : '');
  return (<>
    <PageHead title="Plano de prova" sub={sub} back={href('mais', 'maratona')} />
    <div className="plano-grid">
      <div className="plano-col">
        <h2 className="titulo-2">{titulo}</h2>
        <div className="row wrap" style={{ gap: 8 }}>
          <a className="chip" href={href('mais', 'ciclo')}>{meta!.origem === 'alvo' ? 'Meta ' + metaTxt(meta!.alvoS) : 'Terminar bem · ' + metaTxt(meta!.alvoS)}</a>
          <a className="chip" href={href('mais', 'ciclo')}>{estrat.replace(/^./, (c) => c.toUpperCase())}</a>
          <Kpi doc="clima-plano" className="chip" label={'Clima: ' + climaTxt} value={clima.modo === 'previsao' ? '+' + dec((plano.totalS / plano.alvoS - 1) * 100, 1) + '% no tempo' : '0%'} band={climaTxt}>{climaTxt.replace(/^./, (c) => c.toUpperCase())}</Kpi>
        </div>
        {meta!.origem === 'terminar-bem' && realista ? (
          <p className="apoio muted">Em "Terminar bem", o plano usa a ponta lenta do seu tempo realista: <b className="tn">{metaTxt(realista.lentoS)}</b> (faixa de {metaTxt(realista.rapidoS)} a {metaTxt(realista.lentoS)}, confiança {realista.confianca.toLowerCase()}). Estimativa, não garantia.</p>
        ) : null}
        {tr ? <div className="course-map only-desk"><TrackSvg tr={tr} band={(i: number) => { const d = tr.dist[i] as number; return duro && d >= (duro.de - 1) * 1000 && d <= duro.ate * 1000 ? 1 : 0; }} cursor={null} onPick={() => {}} palette={['var(--ciano)', 'var(--atencao)']} />{duro ? <span className="map-cap">Subida do km {duro.de} ao {duro.ate} · +{duro.metros} m</span> : null}</div> : null}
        <Card>
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <h2 className="lead">{race.course ? 'Altimetria e pace alvo' : 'Pace alvo'}</h2>
            <a className="link" href={href('mais', 'percurso')}>{race.course ? 'Ver percurso' : 'Adicionar percurso'}</a>
          </div>
          {race.course ? <PerfilCourse course={race.course} height={90} /> : <p className="hint">Sem percurso: o pace é o mesmo do início ao fim.</p>}
          <PaceChart plano={plano} duro={duro} dist={race.distKm} />
          <p className="legend"><span style={{ color: 'var(--ciano)' }}>—</span> pace alvo (mais alto = mais rápido){duro ? <> · <span style={{ color: 'var(--atencao)' }}>▮</span> trecho mais duro</> : null} · ┊ {race.distKm > 32 ? 'meia e km 30' : 'metade'}</p>
        </Card>
      </div>
      <div className="plano-col">
        <div className="passagens">
          {plano.passagens.map((p: any, i: number) => (
            <div key={p.rotulo} className={'pass' + (i === plano.passagens.length - 1 ? ' fim' : '')}>
              <span className="cap">{p.rotulo === 'Meia' ? 'Meia (21,1)' : p.rotulo}</span>
              <b className="tn">{hms(p.tS)}</b>
            </div>
          ))}
        </div>
        <Card>
          <h2 className="lead">A cada 5 km</h2>
          <Blocos plano={plano} />
        </Card>
        <p className="hint">
          {clima.modo === 'previsao' ? <>O plano usa a previsão para as {race.startTime || '06:00'} da largada, hora a hora. {plano.climaExtraS > 1 ? <>O calor previsto soma <b className="tn">{hms(plano.climaExtraS)}</b>: o plano fecha em {hms(plano.totalS)}.</> : 'O clima previsto está no padrão.'}</>
            : clima.motivo === 'longe' ? <>Até {dataCurta(clima.abre!)}, o plano usa o clima padrão. Depois, usa a previsão para as {race.startTime || '06:00'} da largada e ajusta os paces.</>
            : clima.motivo === 'sem-previsao' ? (race.course && race.course.perfil.rota ? <>Sem previsão agora (sem internet ou o serviço não respondeu): o plano usa o clima padrão.</> : <>Sem o local da prova (o percurso não tem mapa): o plano usa o clima padrão.</>)
            : <>O plano usa o clima padrão.</>}
        </p>
        {clima.modo === 'previsao' && plano.linhas.some((l: any) => l.climaPct >= 5) ? <p className="apoio" style={{ color: 'var(--atencao)' }}><IconAlertTriangle size={16} stroke={1.75} aria-hidden="true" style={{ verticalAlign: -3 }} /> Calor forte previsto em parte da prova.</p> : null}
        <div className="stack" style={{ gap: 4 }}>
          <button type="button" className="btn-primary only-mob" onClick={() => salvar('share')} disabled={!img || busy}><IconDeviceMobile size={20} stroke={1.75} aria-hidden="true" />{img ? 'Salvar no celular' : 'Preparando a imagem…'}</button>
          <button type="button" className="btn-primary only-desk" onClick={() => salvar('baixar')} disabled={!img || busy}><IconDownload size={20} stroke={1.75} aria-hidden="true" />{img ? 'Baixar imagem do plano' : 'Preparando a imagem…'}</button>
          <p className="hint">Gera uma imagem para a tela de bloqueio. O plano também abre sem internet.</p>
        </div>
        {img ? <details className="acc"><summary>Ver a imagem</summary><img src={img.url} alt={'Imagem do plano: ' + titulo} className="plano-img" /></details> : null}
      </div>
    </div>
  </>);
}
