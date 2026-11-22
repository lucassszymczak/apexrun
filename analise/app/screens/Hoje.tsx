// HOJE — "como você está e o que fazer hoje". Porta de renderHoje (app antigo),
// com a Leitura do Coach (antiga aba Coach) e o layout aprovado (design/telas/Main e HojeDesktop).
import { IconAlertTriangle, IconMessageCircle, IconCalendarEvent, IconChevronRight, IconPlus, IconRoute, IconBike, IconRun } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { PeriodoSel } from './PeriodoSel';
import { usePeriodo, filtra, ehAtual, comTreinos } from '../periodo';
import { useApex } from '../store';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, CardH, Ring, StateBadge, Stat, Kpi, Rich, Empty, IC } from '../ui';
import { dec, signed, km, dur, dayMon, todayLabel, readyTone, workoutTitle, noEmoji, recoveryPt, recoveryTone, typeName } from '../fmt';
import { MiniRoute } from './parts';
import { ParaCompletarCard } from './ParaCompletar';
import { HistoriaCard } from './Leitura';
import { AmanhaCard, PlanoLinha } from './Amanha';
import { AvisoEquipCard } from './Equipamentos';
import { RetroCardHoje } from './Retrospectiva';

export function Hoje() {
  const { st } = useApex();
  const per = usePeriodo(), pAtual = ehAtual(per, st) ? per : '12m';
  const a = st.athlete, ws = filtra(E.sortedWorkouts(), pAtual, st);
  if (!ws.length) {
    return (<>
      <PageHead title="Hoje" sub={todayLabel()} />
      <Card><Empty icon={<IconRoute size={32} stroke={1.75} />}><b>Nenhum treino ainda.</b><br />Importe um .FIT do relógio ou registre à mão — o painel se monta sozinho.</Empty>
        <a className="btn" href={href('importar')}><IconPlus size={18} stroke={2} aria-hidden="true" />Importar treino</a></Card>
    </>);
  }
  const cx = comTreinos(ws, () => E.coachContext(ws, a));
  const rt = readyTone(cx.rd.score);
  // ---- ciclo e plano da semana (mesmas contas do renderHoje) ----
  const race = st.race;
  const blk = race ? E.mBlock(race) : null, phase = blk ? E.mPhase(blk, race) : null;
  const ccRuns = race ? E.cycleRunsInRange(race) : [], ccKm = ccRuns.reduce((s: number, w: any) => s + (w.distKm || 0), 0);
  const info = E.mWeekInfo(0), wk = st.planWeeks && st.planWeeks[info.key];
  const sessions: any[] = wk && wk.sessions ? wk.sessions.slice().sort((x: any, y: any) => (x.dow || 0) - (y.dow || 0)) : [];
  const trainS = sessions.filter((s) => !E.mType(s.type).rest);
  const okN = trainS.filter((s) => { const x = E.mSessStatus(s, info); return x === 'done' || x === 'adapted'; }).length;
  const pct = trainS.length ? Math.round(okN / trainS.length * 100) : 0;
  // ---- último treino (design: o mais recente, de qualquer modalidade) ----
  const last = ws[ws.length - 1];
  // história: a da última corrida (a bike não tem leitura)
  const lastRun = [...ws].reverse().find((x: any) => E.isRun(x)) || null;
  // Como no app antigo: a bike entra na carga (TRIMP), mas fica fora das métricas de corrida (EF, deriva, pace).
  const isBk = E.isBike(last), ef = isBk ? null : E.computeEF(last);
  let dec_: number | null = null; if (!isBk) { try { dec_ = E.computeDecoupling(last); } catch { /* idem app antigo */ } }
  const trimp = E.computeTrimp(last, a);
  const lines: { c: string; t: string }[] = E.hojeCoachLines(cx);
  const dot = (c: string) => (c === 'g' ? 'ok' : c === 'w' ? 'atencao' : 'ciano');
  const alertTxt = noEmoji(a.alert || '');
  const [alertHead, ...alertRest] = alertTxt.split(/\s*·\s*/);

  const ready = (
    <Card className="ready">
      <div className="row" style={{ gap: 16 }}>
        <Kpi doc="readiness" value={cx.rd.score} band={rt.label} className="block" label="Prontidão"><Ring value={cx.rd.score} tone={rt.tone} label="prontidão" lg /></Kpi>
        <div className="stack">
          <StateBadge tone={rt.tone}>{rt.label}</StateBadge>
          <Rich as="p" className="lead" html={E.hojeVerdict(cx)} />
        </div>
      </div>
      <div className="grid-4">
        {cx.tsb != null ? <Stat v={signed(cx.tsb, 0)} l="forma (TSB)" doc="form" band={E.tsbState(cx.tsb)} /> : null}
        {cx.sleepLast ? <Stat v={dec(cx.sleepLast.value, 1) + ' h'} l="sono" doc="readiness" title="Sono" band={'noite de ' + dayMon(cx.sleepLast.date)} /> : null}
        {cx.restTr ? <Stat v={Math.round(cx.restTr.latest)} l="FC de repouso" doc="fcrep" band={cx.restTr.baseline != null ? 'seu normal: ' + Math.round(cx.restTr.baseline) + ' bpm' : undefined} /> : null}
        <Stat v={km(E.week7Km(cx.runs)) + ' km'} l="7 dias" />
      </div>
    </Card>
  );

  const coach = (
    <Card>
      <CardH icon={<IconMessageCircle {...IC} />} title="Leitura do Coach" />
      <ul className="insights">
        {lines.map((l, i) => <li key={i}><span className={'dot ' + dot(l.c)} /><Rich html={l.t} /></li>)}
      </ul>
      <a className="link" href={href('coach')}>Ver leitura completa</a>
    </Card>
  );

  const plan = race ? (
    <Card>
      <div className="row between wrap">
        <div className="stack" style={{ gap: 2 }}>
          <h2 className="lead">Plano da semana</h2>
          {!sessions.length ? <span className="apoio muted">Nenhum treino programado nesta semana.</span>
            : <span className="apoio muted"><b className="tn">{okN} de {trainS.length}</b> cumpridos</span>}
        </div>
        <a className="btn" href={href('mais', 'maratona')}><IconCalendarEvent size={18} stroke={1.75} aria-hidden="true" />{sessions.length ? 'Ver semana' : 'Lançar treinos'}</a>
      </div>
      {sessions.length ? (<>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} aria-label="Sessões da semana">
          {sessions.map((s, i) => {
            const x = E.mSessStatus(s, info), ok = x === 'done' || x === 'adapted';
            const tone = ok ? 'ok' : x === 'missed' ? 'alerta' : 'neutro';
            return <span key={i} className={'badge ' + tone} title={E.mType(s.type).label}>{(E.M_DOW[(s.dow || 1) - 1] || '')} · {E.mType(s.type).label}{ok ? ' · feito' : x === 'missed' ? ' · não feito' : ''}</span>;
          })}
        </div>
        <div className="bar"><i style={{ width: pct + '%' }} /></div>
      </>) : null}
    </Card>
  ) : null;

  const lastCard = (
    <Card as="a" className="lastw" href={href('treino', last.id)} aria-label={'Abrir o último treino: ' + workoutTitle(last)} style={{ color: 'var(--texto)', textDecoration: 'none' }}>
      <div className="row" style={{ alignItems: 'center' }}>
        <MiniRoute w={last} size={64} />
        <div className="stack grow" style={{ gap: 4, flex: 1, minWidth: 0 }}>
          <div className="row between">
            <span className="lead" style={{ fontSize: 15 }}>{workoutTitle(last)}</span>
            <span className="cap">{dayMon(last.date)} · {isBk ? 'bike' : typeName(last.type).toLowerCase()}</span>
          </div>
          <div className="row tn" style={{ gap: 14, flexWrap: 'wrap' }}>
            {last.distKm ? <span className="val" style={{ fontSize: 18 }}>{km(last.distKm)} <small>km</small></span> : null}
            {last.durationSec ? <span className="val" style={{ fontSize: 18 }}>{dur(last.durationSec)}</span> : null}
            {last.hrAvg ? <span className="val" style={{ fontSize: 18 }}>{last.hrAvg} <small>bpm</small></span> : null}
          </div>
          <div className="row tn apoio muted" style={{ gap: 12, flexWrap: 'wrap' }}>
            {!isBk && last.distKm && last.durationSec ? <span>{E.paceStr(last.durationSec / last.distKm)}/km</span> : null}
            {ef != null ? <span>EF {dec(ef * 1000, 1)}</span> : null}
            {dec_ != null ? <span>deriva {dec(dec_, 1)}%</span> : null}
            {trimp != null ? <span>TRIMP {Math.round(trimp)}</span> : null}
            {last.temp != null ? <span>{Math.round(last.temp)} °C</span> : null}
          </div>
        </div>
        <IconChevronRight size={20} stroke={1.75} aria-hidden="true" className="faint" />
      </div>
    </Card>
  );

  const cycle = race ? (
    <Card as="a" href={href('mais', 'maratona')} style={{ color: 'var(--texto)', textDecoration: 'none' }} aria-label={'Abrir ' + (race.name || 'o ciclo de prova')}>
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <h2 className="lead">{noEmoji(race.name || 'Prova')}</h2>
        {blk ? <span className="tn" style={{ color: 'var(--magenta)', fontWeight: 500, fontSize: 15 }}>{blk.days >= 0 ? 'faltam ' + blk.days + ' dias' : 'prova há ' + (-blk.days) + ' dias'}</span> : null}
      </div>
      {phase ? <div className="phases" role="img" aria-label={`Fase ${phase.idx + 1} de 4: ${phase.name}`}>{[0, 1, 2, 3].map((k) => <i key={k} className={k === phase.idx ? 'on' : k < phase.idx ? 'done' : ''} />)}</div> : null}
      <span className="apoio muted">{phase ? phase.name + ' · ' : ''}{blk ? 'semana ' + blk.cur + ' de ' + blk.N : ''}</span>
      <span className="apoio muted"><b className="tn">{ccRuns.length}</b> corrida{ccRuns.length === 1 ? '' : 's'} e <b className="tn">{km(ccKm)} km</b> acumulados no ciclo</span>
    </Card>
  ) : null;
  const planoLinha = race ? <PlanoLinha /> : null;

  const recov = cx.recov ? (
    <Card as="a" href={href('mais', 'recuperacao')} style={{ color: 'var(--texto)', textDecoration: 'none' }} className="only-desk">
      <div className="row between">
        <div className="stack" style={{ gap: 2 }}>
          <h2 className="lead">Recuperação</h2>
          <span className="apoio muted">{recoveryPt(cx.recov.label)}{cx.sleepLast ? ' · sono de ' + dec(cx.sleepLast.value, 1) + ' h' : ''}</span>
        </div>
        <span className="tn" style={{ fontSize: 28, lineHeight: '32px', fontWeight: 500, color: `var(--${recoveryTone(cx.recov.score)})` }}>{cx.recov.score}</span>
      </div>
    </Card>
  ) : null;

  return (<>
    <PageHead title="Hoje" sub={<><span className="only-mob">{todayLabel()}</span><span className="only-desk">{todayLabel(true)}</span></>} right={<PeriodoSel soAtual />} />
    {alertTxt ? (
      <Card className="alert" role="alert">
        <IconAlertTriangle size={20} stroke={1.75} color="var(--alerta)" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
        <div className="stack" style={{ gap: 2 }}>
          <span className="t">{alertHead}</span>
          {alertRest.length ? <span className="apoio muted">{alertRest.join(' · ')}</span> : null}
        </div>
      </Card>
    ) : null}
    <div className="cols">
      <div className="col"><RetroCardHoje /><AvisoEquipCard />{ready}<ParaCompletarCard />{coach}{plan}</div>
      <div className="col">{lastCard}{lastRun ? <HistoriaCard w={lastRun} st={st} titulo={'Último treino · história · ' + dayMon(lastRun.date)} /> : null}<AmanhaCard />{cycle}{planoLinha}{recov}</div>
    </div>
  </>);
}

export function ModalIcon({ w, size = 20 }: { w: any; size?: number }) {
  return E.isBike(w) ? <IconBike size={size} stroke={1.75} aria-hidden="true" /> : <IconRun size={size} stroke={1.75} aria-hidden="true" />;
}
