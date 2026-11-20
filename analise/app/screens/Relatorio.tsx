// RELATÓRIO SEMANAL (Mais). Porta de renderRelatorio + rcard + weeklyLesson (app antigo):
// heatmap de consistência e um card por semana, com os mesmos números. Só leitura.
import { IconCalendarStats } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { useApex } from '../store';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, CardH, Rich, Empty, IC } from '../ui';
import { dec, dur, dayMon, workoutTitle } from '../fmt';

function RCard({ l, v, d }: { l: string; v: string; d: string }) {
  return <div className="stat" style={{ alignItems: 'flex-start', textAlign: 'left', padding: 12 }}><span className="l">{l}</span><span className="v" style={{ fontSize: 18 }}>{v}</span><span className="l">{d}</span></div>;
}

export function Relatorio() {
  const { st } = useApex();
  const a = st.athlete, ws = E.sortedWorkouts();
  if (!ws.length) return (<><PageHead title="Relatório semanal" back={href('mais')} /><Card><Empty>Nenhum treino ainda.</Empty></Card></>);
  const hm = E.consistencyHeatmap(ws, a, 18);
  const pctAct = hm.total ? Math.round(hm.active / hm.total * 100) : 0;
  const byWeek: Record<string, any[]> = {}; ws.forEach((w: any) => { const k = E.isoWeekKey(w.date); (byWeek[k] = byWeek[k] || []).push(w); });
  const keys = Object.keys(byWeek).sort().reverse();
  return (<>
    <PageHead title="Relatório semanal" sub="Um card por semana: números, motor e a lição da semana" back={href('mais')} />
    <Card>
      <CardH icon={<IconCalendarStats {...IC} />} title="Consistência" right={<span className="badge ciano">{hm.active} dias ativos</span>} />
      <div className="heat" role="img" aria-label={`Treinou em ${hm.active} de ${hm.total} dias nas últimas 18 semanas`}>
        {hm.cols.flatMap((col: any) => col.cells.map((cc: any) => <i key={cc.date} className={cc.lvl < 0 ? 'fut' : 'l' + cc.lvl} title={dayMon(cc.date) + (cc.v > 0 ? ' · TRIMP ' + Math.round(cc.v) : ' · sem treino')} />))}
      </div>
      <div className="legend"><span>menos</span>{[0, 1, 2, 3, 4].map((l) => <span key={l} className="heat" style={{ display: 'inline-grid', gridTemplateRows: '12px' }}><i className={'l' + l} /></span>)}<span>mais</span></div>
      <p className="hint">Cada quadrado é um dia (18 semanas); a cor é a <b>carga (TRIMP)</b> daquele dia. Treinou em <b>{pctAct}%</b> dos dias. Correr é um jogo de consistência — ritmo de longo prazo importa mais que um dia forte.</p>
    </Card>
    {keys.map((k) => {
      const wk = byWeek[k];
      const wkRuns = E.runsOnly(wk), wkBikes = E.bikesOnly(wk);
      const totKm = wkRuns.reduce((s: number, w: any) => s + (w.distKm || 0), 0);
      const runs = wkRuns.length;
      const biggest = wkRuns.slice().sort((a2: any, b2: any) => (b2.distKm || 0) - (a2.distKm || 0))[0];
      const efVals = E.easyRuns(wkRuns).map(E.computeEF).filter(Boolean);
      const efAvg = efVals.length ? E.mean(efVals) : null;
      const decs = wkRuns.map(E.computeDecoupling).filter((x: any) => x != null);
      const hrRun = wkRuns.filter((w: any) => w.hrAvg);
      const pol = E.polarization(wk, a);
      const dates = wk.map((w: any) => w.date).sort();
      const maxHr = hrRun.length ? Math.max(...hrRun.map((w: any) => w.hrMax || w.hrAvg)) : null;
      const trimpTot = wk.map((w: any) => E.computeTrimp(w, a) || 0).reduce((s: number, x: number) => s + x, 0);
      const wkDaily = E.sortedDaily().filter((e: any) => E.isoWeekKey(e.date) === k);
      const sleepVals = wkDaily.map((e: any) => e.sleepH).filter((x: any) => x != null);
      const restVals = wkDaily.map((e: any) => e.restingHR).filter((x: any) => x != null);
      const decM = decs.length ? E.mean(decs) : null;
      return (
        <Card key={k}>
          <div className="row between wrap">
            <div className="stack" style={{ gap: 0 }}><h2 className="lead">Semana {k.split('-W')[1]} · {a.cycleName}</h2><span className="apoio muted">{dayMon(dates[0])} – {dayMon(dates[dates.length - 1])}</span></div>
            <span className="badge neutro">{runs} corrida(s){wkBikes.length ? ' · ' + wkBikes.length + ' bike(s)' : ''} · {dec(totKm, 1)} km</span>
          </div>
          <div className="grid-2 grid-3" style={{ gap: 8 }}>
            <RCard l="Os números" v={dec(totKm, 1) + ' km'} d={runs + ' corrida(s)' + (wkBikes.length ? ' + ' + wkBikes.length + ' bike' : '') + (pol ? ' · ' + Math.round(pol.easyPct) + '% fácil' : '')} />
            {biggest ? <RCard l="A maior sessão" v={dec(biggest.distKm || 0, 1) + ' km'} d={workoutTitle(biggest) + (biggest.distKm ? ' · ' + E.paceStr(biggest.durationSec / biggest.distKm) + '/km' : '')} /> : null}
            <RCard l="O motor (EF)" v={efAvg ? dec(efAvg, 4) : '—'} d={efAvg ? 'média das rodagens fáceis' : 'sem rodagem fácil registrada'} />
            {decM != null ? <RCard l="Decoupling" v={dec(decM, 1) + '%'} d={decM < 0 ? 'negativo = closer comprovado' : decM < 7 ? 'base sólida' : 'acima do alvo'} /> : null}
            {maxHr ? <RCard l="Coração" v={Math.round(E.mean(hrRun.map((w: any) => w.hrAvg))) + ' bpm'} d={'média · pico ' + maxHr + ' bpm'} /> : null}
            {wkBikes.length ? <RCard l="Bike (cross-training)" v={dur(wkBikes.reduce((s: number, w: any) => s + (w.durationSec || 0), 0))} d={wkBikes.length + ' sessão(ões) · TRIMP ' + Math.round(wkBikes.map((w: any) => E.computeTrimp(w, a) || 0).reduce((s: number, x: number) => s + x, 0))} /> : null}
            <RCard l="Carga total (TRIMP)" v={String(Math.round(trimpTot))} d="corrida + bike da semana" />
            {sleepVals.length || restVals.length ? <RCard l="Recuperação" v={sleepVals.length ? dec(E.mean(sleepVals), 1) + ' h' : '—'} d={'sono médio' + (restVals.length ? ' · FC repouso ' + Math.round(E.mean(restVals)) + ' bpm' : '')} /> : null}
          </div>
          <div className="card" style={{ background: 'var(--superficie-2)' }}>
            <span className="cap" style={{ color: 'var(--ciano)' }}>A lição e a decisão</span>
            <Rich as="p" className="apoio" html={E.weeklyLesson(wk, a, wkDaily)} />
          </div>
        </Card>
      );
    })}
  </>);
}
