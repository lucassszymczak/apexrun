// PROGRESSO — "para onde a sua forma está indo". Porta de renderProgresso/progHub
// (app antigo): perfil, os 6 sistemas (com mini-tendência) e o histórico (recordes e
// linha do tempo). Novo, pedido no roteiro: "Foco atual" (IMP e cadência no ritmo de
// referência), montado só com funções do motor. O Pace-GAP@145 saiu da interface a pedido
// do Lucas (20/11): o motor ainda o calcula (dado salvo e sincronizado), mas não é exibido.
import { IconUser, IconTarget, IconEngine, IconHeartbeat, IconShoe, IconChartBar, IconDroplet, IconMoon, IconTrophy, IconTimeline, IconChevronRight, IconAlertTriangle, IconCalendarCheck, IconFlame, IconLock } from '@tabler/icons-react';
import * as E from '../../engine.mjs';

import { PeriodoSel } from './PeriodoSel';
import { usePeriodo, filtra, rotulo, comTreinos } from '../periodo';
import { useConsistencia } from './Consistencia';
import { useApex } from '../store';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, CardH, Kpi, Empty, IC } from '../ui';
import { dec, signed, km, dur, pace, dayMon, workoutTitle, noEmoji, recoveryPt, typeName } from '../fmt';
import { SysDetail, SYS } from './ProgressoSys';
import { EsforcosProgresso, CurvaSubida } from './Leitura';

// mini-tendência (sparkline) — só desenho, sem número novo
function Spark({ ys, color = 'var(--ciano)' }: { ys: number[]; color?: string }) {
  const v = ys.filter((y) => isFinite(y)).slice(-12);
  if (v.length < 2) return <span style={{ width: 72, height: 28 }} />;
  const lo = Math.min(...v), hi = Math.max(...v), W = 72, H = 28;
  const d = v.map((y, i) => (i ? 'L' : 'M') + ((i / (v.length - 1)) * (W - 4) + 2).toFixed(1) + ' ' + (H - 3 - ((y - lo) / (hi - lo || 1)) * (H - 6)).toFixed(1)).join(' ');
  return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" /></svg>;
}

const BAND_TONE: Record<string, string> = { g: 'var(--ok)', w: 'var(--atencao)', c: 'var(--alerta)', n: 'var(--texto-3)' };
const BAND_WORD: Record<string, string> = { g: 'bom', w: 'atenção', c: 'alerta', n: 'neutro' };

// Recordes — mesmas contas de recordsTable (app antigo)
export function records(ws: any[]) {
  const runs = (ws || []).filter((w: any) => !E.isBike(w) && w.distKm && w.durationSec);
  const sub = (w: any) => workoutTitle(w) + ' · ' + dayMon(w.date);
  let longest: any = null; runs.forEach((w: any) => { if (!longest || w.distKm > longest.distKm) longest = w; });
  let longT: any = null; runs.forEach((w: any) => { if (!longT || w.durationSec > longT.durationSec) longT = w; });
  let fast: any = null; runs.forEach((w: any) => { if (w.distKm >= 3) { const p = w.durationSec / w.distKm; if (!fast || p < fast.p) fast = { w, p }; } });
  let bEF: any = null; runs.forEach((w: any) => { const ef = E.computeEF(w); if (ef != null && (!bEF || ef > bEF.ef)) bEF = { w, ef }; });
  const byWk: Record<string, number> = {}; runs.forEach((w: any) => { const k = E.isoWeekKey(w.date); byWk[k] = (byWk[k] || 0) + (w.distKm || 0); });
  let bWk: any = null; Object.keys(byWk).forEach((k) => { if (!bWk || byWk[k] > bWk.km) bWk = { k, km: byWk[k] }; });
  let bClimb: any = null; runs.forEach((w: any) => { if (w.gainM && (!bClimb || w.gainM > bClimb.gainM)) bClimb = w; });
  return [
    { lab: 'Maior distância', val: longest ? km(longest.distKm) + ' km' : '—', sub: longest ? sub(longest) : 'sem corrida', id: longest?.id },
    { lab: 'Maior duração', val: longT ? dur(longT.durationSec) : '—', sub: longT ? sub(longT) : 'sem corrida', id: longT?.id },
    { lab: 'Pace mais rápido', val: fast ? pace(fast.p) + '/km' : '—', sub: fast ? km(fast.w.distKm) + ' km · ' + dayMon(fast.w.date) : '3 km ou mais', id: fast?.w.id },
    { lab: 'Melhor EF (economia)', val: bEF ? dec(bEF.ef, 4) : '—', sub: bEF ? dayMon(bEF.w.date) : 'sem EF', id: bEF?.w.id, doc: 'efficiency' },
    { lab: 'Maior semana', val: bWk ? km(bWk.km) + ' km' : '—', sub: bWk ? 'semana ' + bWk.k.split('-W')[1] : '—' },
    { lab: 'Maior subida', val: bClimb ? Math.round(bClimb.gainM) + ' m' : '—', sub: bClimb ? 'D+ · ' + dayMon(bClimb.date) : 'sem ganho', id: bClimb?.id },
  ];
}

// ---------------- Recordes no período de análise (pedido do Lucas, 20/11) ----------------
// As contas são as mesmas de records(); o período só escolhe quais treinos entram. Fora de
// "Desde o início", cada recorde mostra ao lado o seu melhor de todos os tempos.
function Recordes({ runs, todasCorridas, recorte }: { runs: any[]; todasCorridas: any[]; recorte: boolean }) {
  const todos = records(todasCorridas), aqui = records(runs);
  const ano = (id: string | undefined) => { const w = id ? todasCorridas.find((x: any) => x.id === id) : null; return w ? String(w.date).slice(0, 4) : ''; };
  return (<>
    <h2 className="lead row" style={{ gap: 8 }}><IconTrophy {...IC} color="var(--ciano)" aria-hidden="true" />Recordes</h2>
    {!runs.length ? <p className="apoio muted">Nenhuma corrida neste período.</p> : null}
    <div className="list">
      {aqui.map((x, i) => {
        const best = todos[i];
        const diff = recorte && best && best.id !== x.id && best.val !== '—';
        const body = <><div className="grow stack" style={{ gap: 0 }}><b style={{ fontWeight: 500 }}>{x.lab}</b><span className="s">{x.sub}</span>
          {diff ? <span className="s">seu melhor: <b className="tn" style={{ fontWeight: 500 }}>{best.val}</b>{ano(best.id) ? ' em ' + ano(best.id) : ''}</span> : null}</div>
          <span className="val" style={{ fontSize: 17 }}>{x.val}</span></>;
        return x.id ? <a key={x.lab} className="item-row" href={href('treino', x.id)}>{body}</a> : <div key={x.lab} className="item-row">{body}</div>;
      })}
    </div>
  </>);
}

// Foco atual: última leitura de cada KPI do motor por amostra (valores guardados no treino).
function focoAtual(runs: any[], a: any, ws: any[]) {
  const byDate = runs.slice().sort((x: any, y: any) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  const lastPg = byDate.filter((w: any) => w.paceGap && w.paceGap.paceSec != null).pop();
  // IMP: só sessões em clima padrão com confiança ≥ Moderada (regra do Livro de fórmulas)
  const qualifies = (w: any) => !!(w.weather && w.weather.inStandard && w.imp && (w.imp.confidence === 'Moderada' || w.imp.confidence === 'Alta'));
  const base = E.impBaseline(ws, qualifies);
  const lastImp = byDate.filter((w: any) => qualifies(w)).pop();
  const imp = lastImp && base.vBaseline ? E.impIndex(lastImp.imp.vPadrao, base.vBaseline) : null;
  const paceRef = E.paceRefSuggest(ws);
  const lastStream = byDate.filter((w: any) => w.stream).pop();
  const cad = lastStream && paceRef != null ? E.cadenceAtPace(E.expandStream(lastStream.stream), { paceRef }) : null;
  return { lastPg, base, lastImp, imp, paceRef, cad, lastStream, a };
}

export function Progresso({ sys }: { sys: string | null }) {
  const { st } = useApex();
  const per = usePeriodo();
  const cst = useConsistencia(st, 26);
  const all = E.sortedWorkouts();
  const ws = filtra(all, per, st);
  if (!all.length) return (<><PageHead title="Progresso" /><Card><Empty>Nenhum treino ainda. Importe um .FIT pelo +.</Empty></Card></>);
  if (!ws.length) return (<><PageHead title="Progresso" right={<PeriodoSel />} /><Card><Empty>Nenhum treino em {rotulo(per, all, st).toLowerCase()}. Escolha outro período.</Empty></Card></>);
  // o motor lê os treinos do estado por dentro: troca só durante a conta (período de análise)
  const c = comTreinos(ws, () => E.progContext());
  if (sys && SYS[sys]) return <SysDetail sys={sys} c={c} />;
  const a = c.a, runs = c.runs, score = c.score, rd = c.rd, trend = c.trend, latestEF = c.latestEF, cons = c.cons;

  // ---- perfil (mesmas regras de progHub) ----
  const closerSess = runs.filter((w: any) => { const p = E.computePacing(w); return p && (p.closer || p.label === 'negative split'); }).length;
  const nWeeks = cons ? cons.weeks : 1; const kmTot = runs.reduce((s: number, w: any) => s + (w.distKm || 0), 0); const kmWk = nWeeks ? kmTot / nWeeks : 0;
  const nivel = kmWk < 15 ? 'iniciante' : kmWk < 45 ? 'intermediário' : 'avançado';
  const decArr = runs.map(E.computeDecoupling).filter((x: any) => x != null);
  const decMean = decArr.length ? E.mean(decArr) : null;
  const ponto = (closerSess >= 2 || (decMean != null && decMean < 3)) ? 'resistência' : (latestEF && a.efBaseline && latestEF > a.efBaseline * 1.03 ? 'economia' : 'em análise');
  const focoMap: Record<string, string> = { 'Eficiência': 'economia (EF)', 'Consistência': 'consistência', 'Resist. fadiga': 'resistência aeróbica', 'Volume': 'volume gradual', 'Recuperação': 'recuperação (sono/HRV)' };
  let worst: string | null = null, wv = 101; if (score && score.parts) for (const kk in score.parts) if (score.parts[kk] < wv) { wv = score.parts[kk]; worst = kk; }
  const foco = (rd && rd.score < 60) ? 'recuperar' : (worst && focoMap[worst]) ? focoMap[worst] : 'base & economia';
  const ARROW: Record<string, string> = { '↗': 'subindo', '↘': 'caindo', '→': 'estável' };

  // ---- resumo dos sistemas (mesmos valores e faixas de progResumoCard) ----
  const dv = c.latestDec, cadv = c.latestCad;
  const hydroRuns = runs.filter(E.hydroHas), lastHydro = hydroRuns.length ? hydroRuns[hydroRuns.length - 1] : null, hydroRate = lastHydro ? E.hydroRateMlH(lastHydro) : null, hSt = E.hydroStatus(hydroRate);
  const cards = [
    { k: 'motor', Ic: IconEngine, name: 'Motor', val: c.latestEF != null ? dec(c.latestEF * 1000, 1) : '—', unit: 'pts EF', doc: 'efficiency',
      sub: (c.efDelta != null ? 'economia ' + signed(c.efDelta, 0) + '% no bloco' : 'registre uma rodagem fácil') + (c.trend ? ' · tendência ' + signed(c.trend.deltaPct, 0) + '%' : ''),
      band: c.trend ? (c.trend.deltaPct > 2 ? 'g' : c.trend.deltaPct < -2 ? 'c' : 'n') : 'n', spark: c.efPts.map((p: any) => p.y) },
    { k: 'resist', Ic: IconHeartbeat, name: 'Resistência', val: dv != null ? dec(dv, 1) : '—', unit: '% deriva', doc: 'decoupling',
      sub: dv == null ? 'sem longo com FC' : dv < 0 ? 'negativo — closer comprovado' : dv < 5 ? 'base sólida' : dv <= 8 ? 'limítrofe' : 'investigar combustível/pacing',
      band: dv == null ? 'n' : dv < 5 ? 'g' : dv <= 8 ? 'w' : 'c', spark: c.decPts.map((p: any) => p.y) },
    { k: 'mec', Ic: IconShoe, name: 'Mecânica e ritmo', val: cadv != null ? String(Math.round(cadv)) : '—', unit: 'spm', doc: 'cadência',
      sub: cadv == null ? 'registre cadência' : cadv >= a.cadenceTarget ? 'na meta ' + a.cadenceTarget : 'meta ' + a.cadenceTarget + ' · faltam ' + (a.cadenceTarget - Math.round(cadv)),
      band: cadv == null ? 'n' : cadv >= a.cadenceTarget ? 'g' : (a.cadenceTarget - cadv <= 5 ? 'w' : 'n'), spark: c.cadPts.map((p: any) => p.y) },
    { k: 'carga', Ic: IconChartBar, name: 'Carga e forma', val: c.tsb != null ? signed(Math.round(c.tsb), 0) : '—', unit: 'forma TSB', doc: 'form',
      sub: (c.tsb != null ? E.tsbState(c.tsb) : 'registre treinos') + (c.ac ? ' · A:C ' + dec(c.ac.ratio, 2) : ''),
      band: c.ac ? (c.ac.zone === 'sweet spot' ? 'g' : c.ac.zone === 'atenção' ? 'w' : c.ac.zone === 'risco' ? 'c' : 'n') : 'n', spark: c.fit.slice(-42).map((f: any) => f.tsb) },
    { k: 'hidr', Ic: IconDroplet, name: 'Hidratação', val: hydroRate != null ? String(Math.round(hydroRate)) : '—', unit: 'ml/h', doc: 'hidratacao',
      sub: hydroRate == null ? 'informe a água no treino' : 'durante · último treino' + (hSt ? ' · ' + hSt.label : ''),
      band: hydroRate == null ? 'n' : (hSt && hSt.label === 'baixa' ? 'w' : 'g'), spark: hydroRuns.map((w: any) => E.hydroTotal(w)) },
    { k: 'recup', Ic: IconMoon, name: 'Recuperação', val: c.recov ? String(c.recov.score) : '—', unit: 'recuperação', doc: 'recovery',
      sub: (c.recov ? recoveryPt(c.recov.label) : 'preencha o diário') + (c.sleepLast ? ' · sono ' + dec(c.sleepLast.value, 1) + ' h' : ''),
      band: c.recov ? (c.recov.score >= 75 ? 'g' : c.recov.score >= 55 ? 'w' : 'c') : 'n', spark: c.dailyArr.filter((d: any) => d.restingHR != null).map((d: any) => -d.restingHR) },
  ];

  const f = focoAtual(runs, a, ws);
  const timeline = ws.slice().sort((x: any, y: any) => (x.date < y.date ? 1 : -1)).slice(0, 6);

  return (<>
    <PageHead title="Progresso" sub="Para onde a sua forma está indo" right={<PeriodoSel />} />
    {a.alert ? <Card className="alert" role="alert"><IconAlertTriangle size={20} stroke={1.75} color="var(--alerta)" aria-hidden="true" /><span className="apoio">{noEmoji(a.alert)}</span></Card> : null}
    <div className="cols">
      <Card>
        <CardH icon={<IconUser {...IC} />} title="Seu perfil" />
        <div className="row wrap" style={{ gap: 6 }}>
          {[['Nível', nivel], ['Ponto forte', ponto], ['Foco', foco], ['Estilo', closerSess >= 2 ? 'closer (negative split)' : 'em análise'], ['Tendência', trend ? ARROW[trend.arrow] || trend.arrow : 'estável']].map(([l, v]) => (
            <span key={l} className="chip" style={{ cursor: 'default' }}>{l} <b style={{ color: 'var(--texto)' }}>{v}</b></span>
          ))}
          <Kpi doc="performance score" value={score.overall} className="chip" label="Score"><span>Score <b style={{ color: 'var(--texto)' }}>{score.overall}</b></span></Kpi>
        </div>
      </Card>
      <Card>
        <CardH icon={<IconTarget {...IC} />} title="Foco atual" />
        <div>
          <div className="kv"><span>IMP · índice do motor</span><b>{f.imp != null ? <Kpi doc="imp" value={dec(f.imp, 1)} band={'baseline 100 = média das 3 primeiras sessões em clima padrão' + (f.lastImp ? ' · última: ' + dayMon(f.lastImp.date) : '')} conf={f.lastImp?.imp?.confidence}>{dec(f.imp, 1)}</Kpi> : <span className="muted">{f.base.n < 3 ? 'faltam ' + (3 - f.base.n) + ' sessão(ões) em clima padrão para o baseline' : '—'}</span>}</b></div>
          <div className="kv"><span>Cadência no ritmo de referência{f.paceRef != null ? ' (' + pace(f.paceRef) + '/km)' : ''}</span><b>{f.cad && f.cad.spm != null ? <Kpi doc="cad-ref" value={f.cad.spm + ' spm'} conf={f.cad.confidence} band={dec(f.cad.minInRange, 1) + ' min no ritmo'}>{f.cad.spm} spm</Kpi> : <span className="muted">{f.paceRef == null ? 'precisa de 2 corridas com stream do .FIT' : 'poucos minutos no ritmo'}</span>}</b></div>
        </div>
      </Card>
    </div>

    <a className="card" href={href('progresso', 'consistencia')} style={{ color: 'var(--texto)', textDecoration: 'none', gap: 6 }}>
      <div className="row between">
        <span className="row" style={{ gap: 8 }}><IconCalendarCheck size={20} stroke={1.75} color="var(--ciano)" aria-hidden="true" /><b className="lead" style={{ fontSize: 15 }}>Consistência</b></span>
        <IconChevronRight size={18} stroke={1.75} className="faint" aria-hidden="true" />
      </div>
      <span className="lead">{cst.atual > 0 ? cst.atual + (cst.atual === 1 ? ' semana consistente' : ' semanas consistentes seguidas') : 'Nenhuma semana consistente seguida agora'}</span>
      <span className="apoio muted">{cst.consistentes} das últimas {cst.de} semanas · maior sequência {cst.maior}</span>
    </a>

    <a className="card" href={href('progresso', 'calor')} style={{ color: 'var(--texto)', textDecoration: 'none', gap: 6 }}>
      <div className="row between">
        <span className="row" style={{ gap: 8 }}><IconFlame size={20} stroke={1.75} color="var(--ciano)" aria-hidden="true" /><b className="lead" style={{ fontSize: 15 }}>Mapa de calor</b></span>
        <span className="row" style={{ gap: 6 }}><span className="mc-priv" style={{ margin: 0 }}><IconLock size={14} stroke={1.75} aria-hidden="true" />Só você vê</span><IconChevronRight size={18} stroke={1.75} className="faint" aria-hidden="true" /></span>
      </div>
      <span className="apoio muted">As ruas por onde você treinou, pela frequência</span>
    </a>

    <h2 className="section-title">Sistemas</h2>
    <div className="grid-2 grid-3" style={{ gap: 12 }}>
      {cards.map((s) => (
        <a key={s.k} className="card" href={href('progresso', s.k)} style={{ color: 'var(--texto)', textDecoration: 'none', gap: 6 }} aria-label={`${s.name}: ${s.val} ${s.unit}, ${BAND_WORD[s.band]}. Abrir detalhe`}>
          <div className="row between">
            <span className="row" style={{ gap: 8 }}><s.Ic size={20} stroke={1.75} color="var(--ciano)" aria-hidden="true" /><b className="lead" style={{ fontSize: 15 }}>{s.name}</b></span>
            <IconChevronRight size={18} stroke={1.75} className="faint" aria-hidden="true" />
          </div>
          <div className="row between" style={{ alignItems: 'flex-end' }}>
            <span className="val">{s.val}<small>{s.unit}</small></span>
            <Spark ys={s.spark} color={BAND_TONE[s.band] === 'var(--texto-3)' ? 'var(--ciano)' : BAND_TONE[s.band]} />
          </div>
          <span className="apoio muted"><span className="dot" style={{ display: 'inline-block', margin: '0 6px 1px 0', background: BAND_TONE[s.band] }} aria-hidden="true" />{s.sub}</span>
        </a>
      ))}
    </div>

    <h2 className="section-title">Histórico</h2>
    <div className="cols">
      <Card>
        <Recordes runs={runs} todasCorridas={E.runsOnly(all)} recorte={per !== 'tudo'} />
      </Card>
      <Card>
        <EsforcosProgresso runs={runs} todas={E.runsOnly(all)} recorte={per !== 'tudo'} st={st} />
      </Card>
      <Card>
        <CurvaSubida runs={runs} />
      </Card>
      <Card>
        <CardH icon={<IconTimeline {...IC} />} title="Linha do tempo · destaques" />
        <div className="list">
          {timeline.map((w: any) => {
            const bk = E.isBike(w);
            const metric = w.distKm ? dec(w.distKm, 1) + ' km' : (bk ? dur(w.durationSec) : '—');
            const right = bk ? dur(w.durationSec) : E.paceStr(w.durationSec / w.distKm);
            return (
              <a key={w.id} className="item-row" href={href('treino', w.id)}>
                <div className="grow stack" style={{ gap: 0 }}>
                  <span className="t">{noEmoji((w.notes || '').split('·')[0]) || (bk ? (w.indoor ? 'Bike indoor' : 'Bike') : typeName(w.type))}</span>
                  <span className="s">{dayMon(w.date)} · {metric}{w.rpe ? ' · RPE ' + w.rpe : ''}{w.temp ? ' · ' + w.temp + ' °C' : ''}</span>
                </div>
                <div className="stack" style={{ gap: 0, alignItems: 'flex-end' }}><b className="tn">{right}</b><span className="s tn">{w.hrAvg ? w.hrAvg + (w.hrMax ? ' · ' + w.hrMax : '') + ' bpm' : ''}</span></div>
              </a>
            );
          })}
        </div>
      </Card>
    </div>
  </>);
}
