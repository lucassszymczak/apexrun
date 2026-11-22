// DETALHE DO SISTEMA (Progresso). Porta fiel de progMotor, progResist, progMec,
// progCarga, progHidr e progRecup (app antigo): mesmos cálculos e mesmos textos de
// leitura; emojis viraram ícones e as cores antigas viraram os estados novos.
import { useState } from 'react';
import { IconRefresh } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { PeriodoSel } from './PeriodoSel';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, CardH, Kpi, Conf, Scale, StateBadge, Stat, Rich, Bar } from '../ui';
import { LineChart, BarChart, ZONE_COLORS, toneColor } from '../charts';
import { dec, signed, dur, dayMon, noEmoji, bandPt, recoveryPt, readyTone, toneOfVar } from '../fmt';
import { recalcKpis } from '../actions';
import { toast } from '../store';

export const SYS: Record<string, string> = { motor: 'Motor', resist: 'Resistência', mec: 'Mecânica e ritmo', carga: 'Carga e forma', hidr: 'Hidratação', recup: 'Recuperação' };
const CONF: Record<string, string> = { Alta: 'alta', Moderada: 'média', Baixa: 'baixa', 'Dados insuficientes': 'sem dados' };
const dd = (iso: string) => dayMon(iso);

export function SysDetail({ sys, c }: { sys: string; c: any }) {
  const Body = { motor: Motor, resist: Resist, mec: Mec, carga: Carga, hidr: Hidr, recup: Recup }[sys] as (p: { c: any }) => any;
  return (<>
    <PageHead title={SYS[sys]} sub="Progresso" back={href('progresso')} right={<PeriodoSel />} />
    {c.a.alert ? <p className="apoio muted">{noEmoji(c.a.alert)}</p> : null}
    <Body c={c} />
  </>);
}

// ======================= MOTOR =======================
function Motor({ c }: { c: any }) {
  const a = c.a, efPts = c.efPts, latestEF = c.latestEF, efDelta = c.efDelta, efTarget = c.efTarget, trend = c.trend, vo2Eff = c.vo2Eff, vo2Last = c.vo2Last, score = c.score, effHist = c.effHist;
  const pts = efPts.map((p: any) => ({ label: dd(p.w.date), y: p.y, extra: 'FC ' + p.w.hrAvg }));
  let tree: any = null, curEff: any = null;
  if (effHist.length) {
    curEff = effHist[effHist.length - 1].eff;
    const prevE = effHist.slice(-4, -1).map((w: any) => w.eff);
    const m = (k: string) => E.mean(prevE.map((e: any) => e[k]));
    const prevAvg = prevE.length ? { mPerBeat: m('mPerBeat'), stepsPerBeat: m('stepsPerBeat'), mPerStep: m('mPerStep'), spmMean: m('spmMean'), hrMean: m('hrMean'), vgapMean: m('vgapMean') } : null;
    tree = E.effTree(curEff, prevAvg);
  }
  const vb = E.vo2Band(vo2Eff);
  const motorRuns = c.runs.filter((w: any) => w.type === 'teste_motor' && w.stream).sort(c.byDateAsc);
  const stages = (a.motorStages || []).filter((s: any) => s);
  const lastMt = motorRuns.length ? motorRuns[motorRuns.length - 1] : null;
  const mt = lastMt ? E.motorTest(E.expandStream(lastMt.stream), stages) : null;
  const targetStages = stages.filter((s: any) => s.targetHr != null);
  return (<>
    <div className="cols">
      <Card>
        <CardH title="Efficiency Factor · economia do motor" right={<Conf level="alta" />} />
        {latestEF != null ? <div><Kpi doc="efficiency" value={dec(latestEF * 1000, 1) + ' pts'} band={'EF ' + dec(latestEF, 4)}><span className="big">{dec(latestEF * 1000, 1)}<small>pts</small></span></Kpi>
          <div className="apoio muted tn">economia {efDelta != null ? signed(efDelta, 1) + '% vs. o 1º' : '—'} · EF {dec(latestEF, 4)}</div></div> : null}
        <LineChart label="EF em pontos por rodagem fácil" series={[{ name: 'Pontos', points: pts }]} yfmt={(v) => dec(v * 1000, 1)} target={a.efBaseline ? { y: efTarget, label: 'meta ' + dec(efTarget * 1000, 1) + ' pts' } : null} />
        <p className="hint"><b>Pontos = o EF ×1000</b> (sem os zeros). Sobe = motor mais econômico. A régua é você mesmo: hoje vs. 6 semanas atrás.{trend ? ' Tendência ' + signed(trend.deltaPct, 1) + '%.' : ''}</p>
      </Card>
      {curEff ? (
        <Card>
          <CardH title="Árvore da Eficiência · decomposição do EF" right={<Conf level="média" />} />
          <p className="tn"><b style={{ fontSize: 17 }}>{dec(curEff.mPerBeat, 3)}</b> m/batimento = <b>{dec(curEff.stepsPerBeat, 3)}</b> passos/bat × <b>{dec(curEff.mPerStep, 3)}</b> m/passo</p>
          <p className="apoio muted tn">EF = {dec(curEff.mPerBeat / 60, 4)} · cadência {Math.round(curEff.spmMean)} spm · FC {Math.round(curEff.hrMean)} bpm</p>
          {tree && tree.dln ? (<>
            <span className="badge ciano">{tree.label}</span>
            <BarChart label="Contribuição para a variação do EF" bars={[
              { label: 'passos/bat', y: Math.round(tree.contribPct.stepsPerBeat * 10) / 10, color: tree.contribPct.stepsPerBeat >= 0 ? 'var(--ok)' : 'var(--alerta)' },
              { label: 'm/passo', y: Math.round(tree.contribPct.mPerStep * 10) / 10, color: tree.contribPct.mPerStep >= 0 ? 'var(--ok)' : 'var(--alerta)' },
            ]} yfmt={(v) => v.toFixed(0) + '%'} zeroLine />
            <p className="hint">Quanto cada parte contribuiu para a variação do EF vs. as 3 anteriores. Cadência <b>{signed(tree.cadDeltaPct, 1)}%</b> · EF <b>{signed(tree.efDeltaPct, 1)}%</b>. A identidade é exata; a leitura é exploratória.</p>
          </>) : (<>
            <LineChart label="Metros por batimento" series={[{ name: 'm/batimento', points: effHist.map((w: any) => ({ label: dd(w.date), y: w.eff.mPerBeat, extra: 'EF ' + dec(w.eff.mPerBeat / 60, 4) })) }]} yfmt={(v) => dec(v, 3)} />
            <p className="hint">m/batimento = (passos/bat) × (m/passo). Sobe = mais metros por batimento. Precisa de ao menos uma sessão anterior com stream para decompor a variação.</p>
          </>)}
        </Card>
      ) : null}
    </div>
    <div className="cols">
      <Card>
        <CardH title="VO₂máx" />
        <Kpi doc="vo2" value={(vo2Eff || '—') + ' ml/kg'} band={vb ? vb + (vo2Last ? ' · Apple Watch ' + dd(vo2Last.date) : ' (homem 30–39)') : undefined}><span className="big">{vo2Eff != null ? dec(vo2Eff, String(vo2Eff).includes('.') ? 1 : 0) : '—'}<small>ml/kg</small></span></Kpi>
        {vb ? <span className="apoio muted">{vb}{vo2Last ? ' · Apple Watch ' + dd(vo2Last.date) : ' (homem 30–39)'}</span> : null}
        {vo2Eff != null ? <Scale min={30} max={55} val={vo2Eff} valText={String(vo2Eff).replace('.', ',')} segs={[{ to: 36, label: 'Abaixo', c: 'var(--atencao)' }, { to: 42, label: 'Bom', c: 'var(--ok)' }, { to: 52, label: 'Excelente', c: 'var(--ciano)' }, { to: 55, label: 'Elite', c: 'var(--zona-3)' }]} /> : null}
        <p className="hint">Bom 36–42 · excelente 43–52. É o tamanho do motor; o EF é o quanto você aproveita dele.</p>
      </Card>
      <Card>
        <CardH title="Performance Trend" />
        <Kpi doc="performance trend" value={trend ? signed(trend.deltaPct, 1) + '%' : '—'}><span className="big">{trend ? signed(trend.deltaPct, 1) + '%' : '—'}</span></Kpi>
        <span className="apoio muted">{trend ? (trend.arrow === '↗' ? 'subindo' : trend.arrow === '↘' ? 'caindo' : 'estável') + ' · ' + (trend.enough ? 'janela de 4 sessões' : 'provisório · menos de 3 sessões/janela') : '3 sessões ou mais por janela'}</span>
        <p className="hint">Direção da forma: subindo acima de +2% · estável · caindo abaixo de −2%.</p>
      </Card>
    </div>
    <Card>
      <CardH title="Athlete Performance Score" right={<span className="badge neutro">provisório</span>} />
      <div className="row wrap" style={{ gap: 20, alignItems: 'center' }}>
        <Kpi doc="performance score" value={score.overall}><span className="big">{score.overall}</span></Kpi>
        <div className="stack grow" style={{ minWidth: 220 }}>
          {Object.keys(score.parts).map((k) => <div key={k} className="subbar"><span>{k}</span><Bar pct={score.parts[k]} /><b>{score.parts[k]}</b></div>)}
        </div>
      </div>
      <p className="hint">Média ponderada transparente: 26% eficiência · 22% consistência · 22% resistência à fadiga · 15% volume · <b>15% recuperação</b> (sono + HRV + FC repouso). Nunca decida treino só pelo score — abra os componentes.</p>
    </Card>
    {lastMt && mt ? (
      <Card>
        <CardH title={'Teste do Motor — ' + dd(lastMt.date)} right={<Conf level={lastMt.weather && lastMt.weather.inStandard ? 'alta' : 'média'} />} />
        {lastMt.weather ? <p className="apoio muted">{Math.round(lastMt.weather.tempC)} °C · orvalho {lastMt.weather.dewC != null ? Math.round(lastMt.weather.dewC) + '°' : '—'} · {lastMt.weather.inStandard ? <b>clima padrão</b> : <b style={{ color: 'var(--atencao)' }}>fora do padrão</b>}{lastMt.weather.tags && lastMt.weather.tags.length ? ' · ' + lastMt.weather.tags.join(' · ') : ''}</p> : null}
        <div className="tbl-wrap"><table>
          <thead><tr><th scope="col">Estágio</th><th scope="col" className="n">Alvo FC</th><th scope="col" className="n">Veloc.</th><th scope="col" className="n">Pace</th><th scope="col" className="n">FC real</th></tr></thead>
          <tbody>{mt.map((r: any, i: number) => <tr key={i}><td>{r.name}{r.flagged ? <span style={{ color: 'var(--alerta)' }}> · fora do alvo</span> : null}</td><td className="n">{r.targetHr != null ? r.targetHr + ' bpm' : '—'}</td><td className="n">{r.speed != null ? dec(r.speed, 2) + ' m/s' : '—'}</td><td className="n">{r.pace != null ? E.paceStr(r.pace) + '/km' : '—'}</td><td className="n">{r.hrMean != null ? r.hrMean + ' bpm' : '—'}</td></tr>)}</tbody>
        </table></div>
        {motorRuns.length > 1 && targetStages.length ? <LineChart label="Velocidade por estágio" series={targetStages.map((st: any) => ({ name: st.name, points: motorRuns.map((w: any) => { const r = E.motorTest(E.expandStream(w.stream), stages).filter((x: any) => x.name === st.name)[0]; return r && r.speed != null ? { label: dd(w.date), y: r.speed, extra: st.name + (r.flagged ? ' · fora do alvo' : '') } : null; }).filter(Boolean) })).filter((s: any) => s.points.length)} yfmt={(v) => dec(v, 2) + ' m/s'} /> : null}
        <p className="hint">Mesmo circuito plano e horário, por estágio de FC-alvo. <b>Velocidade = mediana dos últimos 3 min</b> de cada estágio; se a FC média sair de ±3 bpm do alvo, o estágio é <b>marcado</b>. Mais rápido no mesmo alvo = motor melhor. Estágios acima de 145 liberam quando a tíbia permitir. Próximo teste sugerido: {(() => { const n = new Date(lastMt.date + 'T00:00:00'); n.setDate(n.getDate() + 14); return E.mIsoLocal(n).split('-').reverse().slice(0, 2).join('/'); })()}. Fonte: Vesterinen et al., 2017.</p>
      </Card>
    ) : null}
  </>);
}

// ======================= RESISTÊNCIA =======================
function Resist({ c }: { c: any }) {
  const a = c.a, decPts = c.decPts, mechHist = c.mechHist, lagLow = c.lagLow;
  // meta vazia (quem é novo e não definiu): sem linha de alvo
  const tgt = a.decouplingTarget || (a.novo ? null : 7);
  const last = decPts && decPts.length ? decPts[decPts.length - 1].y : null;
  let mechBlock = null;
  if (mechHist.length) {
    const lm = mechHist[mechHist.length - 1], cardiac = E.computeDecoupling(lm), mechPct = lm.mech.pct;
    const mechConf = lagLow ? E.downgradeConf(lm.mech.confidence) : lm.mech.confidence;
    const matrix = cardiac != null ? E.decoupleMatrix(cardiac, mechPct) : null;
    mechBlock = (
      <Card>
        <CardH title="Decoupling · cardíaco e mecânico" right={<Conf level={CONF[mechConf] || 'média'} />} />
        <div className="row wrap" style={{ gap: 24 }}>
          <div className="stack" style={{ gap: 0 }}><span className="cap">cardíaco (pace:FC)</span><span className="big" style={{ fontSize: 28 }}>{cardiac != null ? dec(cardiac, 1) + '%' : '—'}</span></div>
          <div className="stack" style={{ gap: 0 }}><span className="cap">mecânico (passada)</span><Kpi doc="decoupling-mec" value={mechPct != null ? signed(mechPct, 1) + '%' : '—'}><span className="big" style={{ fontSize: 28, color: mechPct > 2 ? 'var(--alerta)' : mechPct < -2 ? 'var(--ok)' : undefined }}>{mechPct != null ? signed(mechPct, 1) + '%' : '—'}</span></Kpi></div>
        </div>
        {matrix ? <span className="badge ciano">{matrix}</span> : null}
        {mechHist.length > 1 ? <BarChart label="Decoupling mecânico por sessão" bars={mechHist.map((w: any) => ({ label: dd(w.date), y: w.mech.pct, extra: w.type, color: w.mech.pct > 2 ? 'var(--alerta)' : w.mech.pct < -2 ? 'var(--ok)' : 'var(--atencao)' }))} yfmt={(v) => signed(v, 1) + '%'} zeroLine /> : null}
        <p className="hint">Mecânico = Δ% da passada-GAP (m/passo) entre a 2ª e a 1ª metade (só sessões de 40 min ou mais). <b>Positivo = passada caiu no fim.</b> Cruzado com o cardíaco: FC sobe + passada estável → deriva cardiovascular; ambos cedem → fadiga global.{lagLow ? ' Confiança rebaixada (defasagem de FC com menos de 3 sessões).' : ''}</p>
      </Card>
    );
  }
  const anchor = E.bestAnchor(c.runs);
  const preds = anchor ? E.racePredictions(anchor.distKm, anchor.durationSec) : null;
  return (<>
    <div className="cols">
      <Card>
        <CardH title="Decoupling · resistência aeróbica" right={<Conf level="alta" />} />
        <BarChart label="Decoupling por treino" bars={decPts.map((p: any) => ({ label: p.label, y: p.y, extra: p.extra, color: toneColor(p.color) }))} yfmt={(v) => dec(v, 1) + '%'} threshold={tgt ? { y: tgt, label: 'seu alvo ' + tgt + '%' } : null} zeroLine />
        {last != null ? <Scale min={0} max={12} val={Math.max(0, last)} valText={dec(last, 1) + '%'} segs={[{ to: 5, label: 'Sólido', c: 'var(--ok)' }, { to: 8, label: 'Limítrofe', c: 'var(--atencao)' }, { to: 12, label: 'Investigar', c: 'var(--alerta)' }]} /> : null}
        <p className="hint">Decoupling negativo nos longões = closer comprovado (fica mais eficiente na 2ª metade). Abaixo de 5% = base sólida; acima de 8% = investigar.</p>
      </Card>
      {mechBlock}
    </div>
    <Card>
      <CardH title="Previsão de prova" right={<span className="badge neutro">Riegel</span>} />
      {anchor && preds ? (<>
        <div className="tbl-wrap"><table><thead><tr><th scope="col">Distância</th><th scope="col" className="n">Tempo</th><th scope="col" className="n">Pace</th></tr></thead>
          <tbody>{preds.map((p: any) => <tr key={p.name}><td>{p.name}</td><td className="n"><Kpi doc="race prediction" value={E.hms(p.timeSec)} band={E.paceStr(p.paceSec) + '/km'}>{E.hms(p.timeSec)}</Kpi></td><td className="n">{E.paceStr(p.paceSec)}/km</td></tr>)}</tbody></table></div>
        <p className="hint">Âncora: {noEmoji(anchor.notes || anchor.type)} ({dec(anchor.distKm, 2)} km em {E.hms(anchor.durationSec)}). Estimativa, não garantia — melhora com uma prova recente.</p>
      </>) : <p className="muted">Registre um teste ou prova para ancorar as projeções.</p>}
    </Card>
  </>);
}

// ======================= MECÂNICA & RITMO =======================
function Mec({ c }: { c: any }) {
  const a = c.a, cadPts = c.cadPts, latestCad = c.latestCad, gapPts = c.gapPts, hillAgg = c.hillAgg, ml = c.ml;
  const easyStream = E.easyRuns(c.runs).filter((w: any) => w.stream).sort(c.byDateAsc);
  const gp = easyStream.length >= 2 ? E.gradeProfile(easyStream.slice(-6).map((w: any) => E.expandStream(w.stream)), { lagSec: ml.lagSec }) : null;
  const shown = gp && gp.ok ? gp.rows.filter((r: any) => r.show) : [];
  const hc = E.hrGradeCost(c.runs);
  const up = hc ? hc.upCost : null, dn = hc ? hc.downDev : null;
  let read = '';
  if (hc) {
    if (up != null && up > 1) read += 'Nas <b>subidas</b> sua FC roda <b>+' + up.toFixed(0) + ' bpm</b> acima do que o pace prevê — treinando por zona, segure (ou caminhe) nos trechos íngremes para não estourar o teto. ';
    else if (up != null && Math.abs(up) <= 1) read += 'Nas subidas sua FC acompanha o previsto — o GAP está bem calibrado para você. ';
    if (dn != null && dn < -1) read += 'Nas <b>descidas</b> a FC fica <b>' + dn.toFixed(0) + ' bpm abaixo</b> do previsto: ela <b>subestima o impacto excêntrico</b> — cuidado com a tíbia, a carga mecânica existe mesmo com FC baixa.';
  }
  return (<>
    <div className="cols">
      <Card>
        <CardH title="Cadência" right={<Conf level="alta" />} />
        {latestCad ? <div><Kpi doc="cadência" value={Math.round(latestCad) + ' spm'}><span className="big">{Math.round(latestCad)}<small>spm</small></span></Kpi>
          <div className="apoio muted">{a.cadenceTarget ? 'meta ' + a.cadenceTarget + (Math.round(latestCad) < a.cadenceTarget ? ' · faltam ' + (a.cadenceTarget - Math.round(latestCad)) : ' · na meta') : 'sem meta definida'}</div></div> : null}
        <LineChart label="Cadência por treino" series={[{ name: 'Cadência', points: cadPts.map((p: any) => ({ label: p.label, y: p.y, extra: p.extra })) }]} yfmt={(v) => String(Math.round(v))} target={a.cadenceTarget ? { y: a.cadenceTarget, label: 'meta ' + a.cadenceTarget } : null} />
        <p className="hint">A alavanca de maior retorno: subir ~5% já traz ganho. Sinal de ouro: mesmo pace, cadência maior, FC menor.</p>
      </Card>
      <Card>
        <CardH title="Ritmo ajustado à inclinação" right={<Conf level="alta" />} />
        <LineChart label="Pace ajustado (GAP) por treino" series={[{ name: 'Ritmo ajustado', points: gapPts.map((p: any) => ({ label: p.label, y: p.y, extra: p.extra })) }]} yfmt={(v) => E.paceStr(v)} reverseY />
        <p className="hint">Pace ajustado à inclinação km a km (subida +3,5%/1%, descida −1,5%/1%). Torna sessões em relevos diferentes comparáveis. Menor = mais rápido.</p>
      </Card>
    </div>
    <Card>
      <CardH title="Desempenho em subida" right={<Conf level="baixa" />} />
      {hillAgg ? (<>
        <Kpi doc="hill" value={(hillAgg.effVsModel * 100).toFixed(0) + '% do modelo'}><span className="big">{(hillAgg.effVsModel * 100).toFixed(0)}<small>% do modelo</small></span></Kpi>
        <span className="apoio muted">{hillAgg.totalClimbM} m de subida no ciclo · {hillAgg.sessions} sessão(ões) com rampa</span>
        <p className="hint">{hillAgg.effVsModel >= 1 ? <>Você sobe <b>melhor</b> que o previsto pelo Minetti</> : 'Você perde um pouco mais que o previsto nas subidas'} — perda média ~{dec(hillAgg.speedLossPctPerGrade, 1)}% de velocidade por +1% de rampa. Menor perda + recuperar rápido no topo = força de subida melhorando.</p>
      </>) : <p className="muted">Registre corridas com subida (splits com Δelevação) para ativar.</p>}
    </Card>
    {gp && gp.ok && shown.length ? (
      <Card>
        <CardH title="Perfil de inclinação · resíduo de FC por faixa" right={<span className="badge neutro">exploratório</span>} />
        <p className="apoio"><span className="badge ciano">{gp.label.replace('.', ',')}</span> <span className="muted tn">modelo FC = {gp.fit.a.toFixed(0)} + {dec(gp.fit.b, 1)}·v_GAP · R² {dec(gp.fit.r2, 2)} · {gp.nSessions} sessões fáceis</span></p>
        <BarChart label="Resíduo de FC por faixa de inclinação" bars={shown.map((r: any) => ({ label: r.band, y: r.residual, extra: (r.spm ? r.spm + ' spm · ' : '') + r.minutes + ' min', color: r.residual > 1 ? 'var(--alerta)' : r.residual < -1 ? 'var(--ok)' : 'var(--atencao)' }))} yfmt={(v) => signed(v, 1) + ' bpm'} zeroLine />
        <div className="tbl-wrap"><table><thead><tr><th scope="col">Faixa</th><th scope="col" className="n">Resíduo</th><th scope="col" className="n">Cadência</th><th scope="col" className="n">Passada</th><th scope="col" className="n">Min</th></tr></thead>
          <tbody>{shown.map((r: any) => <tr key={r.band}><td>{r.band}</td><td className="n" style={{ color: r.residual > 1 ? 'var(--alerta)' : r.residual < -1 ? 'var(--ok)' : undefined }}>{signed(r.residual, 1)} bpm</td><td className="n">{r.spm || '—'}</td><td className="n">{r.mPerStep != null ? dec(r.mPerStep, 3) + ' m' : '—'}</td><td className="n">{dec(r.minutes, 1)}</td></tr>)}</tbody></table></div>
        <p className="hint">Modelo pessoal FC ~ velocidade-GAP ajustado nas <b>amostras planas</b> (|inclinação| até 2%) das últimas 6 sessões fáceis. O resíduo é quanto sua FC real (defasada) fica <b>acima (+)</b> ou <b>abaixo (−)</b> do que o GAP prevê, por faixa de inclinação. <b>Exploratório</b> — nunca mexe nos coeficientes do GAP, só reporta. Faixas com menos de 3 min não aparecem.</p>
      </Card>
    ) : null}
    {hc ? (
      <Card>
        <CardH title="Custo de FC do morro" right={<span className="badge neutro">exploratório</span>} />
        <Kpi doc="fc-morro" value={(up != null ? signed(up, 0) : '—') + ' bpm'}><span className="big">{up != null ? signed(up, 0) : '—'}<small>bpm</small></span></Kpi>
        <Rich as="p" className="apoio muted" html={up == null ? 'sem subidas suficientes' : (Math.abs(up) < 1 ? 'subir custa <b>~o previsto</b> (GAP calibrado)' : 'subir custa <b>' + signed(up, 0) + ' bpm</b> acima do previsto pelo seu pace')} />
        <div className="tbl-wrap"><table><thead><tr><th scope="col">Inclinação</th><th scope="col" className="n">Resíduo FC</th><th scope="col" className="n">Tempo</th></tr></thead>
          <tbody>{hc.bands.filter((bd: any) => !(bd.min < 2 || bd.resid == null)).map((bd: any) => <tr key={bd.lab}><td>{bd.lab}</td><td className="n" style={{ color: bd.resid > 1 ? 'var(--atencao)' : bd.resid < -1 ? 'var(--ciano)' : undefined }}>{signed(bd.resid, 1)} bpm</td><td className="n">{Math.round(bd.min)} min</td></tr>)}</tbody></table></div>
        {read ? <Rich as="p" className="apoio" html={read} /> : null}
        <p className="hint">Análise exploratória de <b>{hc.nRuns} corrida(s)</b> fáceis com splits (FC + Δelev). Mede o <i>seu</i> desvio de FC vs. o que o pace prevê — <b>não</b> altera o GAP, nem a FC/zonas no TRIMP.</p>
      </Card>
    ) : null}
  </>);
}

// ======================= CARGA & FORMA =======================
function Carga({ c }: { c: any }) {
  const a = c.a, bikes = c.bikes, bike = c.bike, fit = c.fit, tsb = c.tsb, ac = c.ac, pol = c.pol, cons = c.cons, td = c.td, ml = c.ml, lagLow = c.lagLow;
  const [msg, setMsg] = useState<string | null>(null);
  const ZONE_PT: Record<string, string> = { baixa: 'baixa', 'sweet spot': 'sweet spot', 'atenção': 'atenção', risco: 'risco' };
  const acTone = ac ? (ac.zone === 'sweet spot' ? 'ok' : ac.zone === 'atenção' ? 'atencao' : ac.zone === 'risco' ? 'alerta' : 'neutro') : 'neutro';
  const bLoadWk: Record<string, number> = {}; bikes.forEach((w: any) => { const t = E.computeTrimp(w, a); if (t == null) return; const k = E.isoWeekKey(w.date); bLoadWk[k] = (bLoadWk[k] || 0) + t; });
  const bLoadBars = Object.keys(bLoadWk).sort().map((k) => ({ label: k.replace(/^\d+-/, ''), y: Math.round(bLoadWk[k]) }));
  const bTd = bikes.length ? E.trainingDistribution(bikes, a) : null;
  const aud = c.runs.filter((w: any) => w.quality).sort((x: any, y: any) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  const zbars = (t: any) => t.zones.map((sec: number, i: number) => ({ label: 'Z' + (i + 1), y: Math.round(sec / 60), color: ZONE_COLORS[i] }));
  return (<>
    <div className="grid-2 grid-3" style={{ gap: 12 }}>
      <Card><span className="cap">Volume 7 dias</span><span className="val">{c.weeklyKm ? Math.round(c.weeklyKm) : '—'}<small>{c.weeklyKm ? 'km' : ''}</small></span><span className="apoio muted">média 4 sem {c.avgWeeklyKm ? Math.round(c.avgWeeklyKm) + ' km' : '—'}</span></Card>
      <Card><span className="cap">Razão aguda:crônica</span>
        <Kpi doc="ac" value={ac ? dec(ac.ratio, 2) : '—'} band={ac ? ZONE_PT[ac.zone] : 'acumula ~4 semanas'}><span className="val">{ac ? dec(ac.ratio, 2) : '—'}</span></Kpi>
        {ac ? <StateBadge tone={acTone as any}>{ZONE_PT[ac.zone]}</StateBadge> : <span className="apoio muted">acumula ~4 semanas</span>}
        {ac ? <Scale min={0.5} max={2} val={ac.ratio} valText={dec(ac.ratio, 2)} segs={[{ to: 0.8, label: 'Destreino', c: 'var(--texto-3)' }, { to: 1.3, label: 'Seguro', c: 'var(--ok)' }, { to: 1.5, label: 'Atenção', c: 'var(--atencao)' }, { to: 2, label: 'Risco', c: 'var(--alerta)' }]} /> : null}
        {ac ? <p className="hint">Sweet spot 0,8–1,3 = carga sustentável. Toque no número para ver o que fazer.</p> : null}
      </Card>
      <Card><span className="cap">Aderência 80/20</span>
        <Kpi doc="polarizado" value={pol ? Math.round(pol.easyPct) + '% fácil' : '—'}><span className="val">{pol ? Math.round(pol.easyPct) : '—'}<small>% fácil</small></span></Kpi>
        <span className="apoio muted">alvo ~80% em Z1–Z2 · tempo real em zona</span>
        {pol ? <><Bar pct={Math.round(pol.easyPct)} color={pol.easyPct >= 75 ? 'var(--ok)' : 'var(--atencao)'} /><p className="hint">{pol.easyPct < 75 ? 'Abaixo de 75% = treinando forte demais no volume.' : 'Boa distribuição polarizada.'}</p></> : null}
      </Card>
      <Card><span className="cap">Consistência</span>
        <Kpi doc="consistency" value={cons ? Math.round(cons.adherencePct) + '%' : '—'}><span className="val">{cons ? Math.round(cons.adherencePct) : '—'}<small>%</small></span></Kpi>
        <span className="apoio muted">{cons ? cons.weeks + ' semanas · ' + cons.activeDays + ' dias ativos' : '—'}</span>
        <p className="hint">Consistência &gt; heroísmo — maior preditor de evolução. Alvo 85% ou mais.</p>
      </Card>
    </div>
    <div className="cols">
      <Card>
        <CardH title="Carga interna semanal · TRIMP" right={<Conf level="alta" />} />
        <BarChart label="TRIMP por semana" bars={c.loadBars} yfmt={(v) => String(Math.round(v))} />
        <p className="hint">Dose fisiológica via FC — <b>corrida + bike juntas</b>. O padrão certo é ondulado: sobe ~10%/semana, com descarga a cada 3–4 semanas.{bike ? <> A bike responde por <b>{Math.round(bike.totalTrimp / Math.max(1, fit.reduce((s: number, f: any) => s + f.load, 0)) * 100)}%</b> da carga do período.</> : null}</p>
      </Card>
      <Card>
        <CardH title="Fitness / Fatigue / Form · CTL·ATL·TSB" right={<Conf level="média" />} />
        <LineChart label="Fitness (CTL) e Fatigue (ATL)" series={[
          { name: 'Fitness (CTL)', points: fit.map((f: any) => ({ label: E.fmtDate(f.date), y: f.ctl })), color: 'var(--ciano)' },
          { name: 'Fatigue (ATL)', points: fit.map((f: any) => ({ label: E.fmtDate(f.date), y: f.atl })), color: 'var(--magenta)' },
        ]} yfmt={(v) => String(Math.round(v))} />
        {tsb != null ? <Scale min={-30} max={15} val={tsb} valText={signed(tsb, 0)} segs={[{ to: -10, label: 'Treino pesado', c: 'var(--atencao)' }, { to: 5, label: 'Equilibrado', c: 'var(--ok)' }, { to: 15, label: 'Fresco', c: 'var(--ciano)' }]} /> : null}
        <p className="hint">Form (TSB) atual: <b>{tsb != null ? signed(tsb, 1) : '—'}</b> — {E.tsbState(tsb)}. Fitness = capacidade adquirida; Fatigue = cansaço; Form = frescor resultante.</p>
      </Card>
    </div>
    <Card>
      <CardH title="Distribuição por intensidade" right={<Conf level="alta" />} />
      {td ? <><BarChart label="Minutos por zona" bars={zbars(td)} yfmt={(v) => v + '′'} />
        <p className="hint">Tempo REAL em cada zona (do histograma de FC do .FIT). Fácil (Z1–Z2) <b>{Math.round(td.pct.facil)}%</b> · moderado (Z3) {Math.round(td.pct.moderado)}% · forte (Z4–Z5) {Math.round(td.pct.forte)}%. Base ideal: maioria fácil + uma fatia de qualidade.</p></>
        : <p className="muted">Importe um .FIT para ver o tempo real em zona.</p>}
    </Card>
    <h2 className="section-title">Bike e cross-training</h2>
    <p className="apoio muted">A bike sustenta a base aeróbica sem impacto na canela. Entra na <b>carga (TRIMP), na forma (CTL·ATL·TSB), no A:C e nas zonas de FC</b> — mas fica de fora do EF, GAP, pace e cadência, que são de corrida.</p>
    {!bike ? <Card><p className="muted">Nenhuma bike registrada ainda. Importe um .FIT de bike (é detectado sozinho) ou registre à mão com Modalidade → Bike.</p></Card> : (<>
      <div className="grid-4">
        <Stat v={bike.sessions} l={bike.indoor + ' indoor · ' + bike.outdoor + ' outdoor'} />
        <Stat v={dur(bike.totalSec)} l="tempo na bike" />
        <Stat v={bike.totalTrimp + ' TRIMP'} l="carga da bike" doc="trimp" />
        <Stat v={(bike.avgHr || '—') + ' bpm'} l={(bike.totalKcal ? bike.totalKcal + ' kcal' : '') + (bike.outdoor && bike.totalKm ? ' · ' + bike.totalKm.toFixed(0) + ' km outdoor' : '')} />
      </div>
      <div className="cols">
        <Card>
          <CardH title="Carga da bike por semana · TRIMP" right={<Conf level="alta" />} />
          {bLoadBars.length ? <BarChart label="TRIMP da bike por semana" bars={bLoadBars} yfmt={(v) => String(Math.round(v))} /> : <p className="muted">Importe um .FIT de bike para ver a carga.</p>}
          <p className="hint">Quanta dose fisiológica veio da bike a cada semana — o quanto o cross-training está segurando o pé aeróbico.</p>
        </Card>
        <Card>
          <CardH title="Zonas de FC na bike" right={<Conf level="alta" />} />
          {bTd ? <><BarChart label="Minutos por zona na bike" bars={zbars(bTd)} yfmt={(v) => v + '′'} />
            <p className="hint">Onde a bike trabalha: fácil (Z1–Z2) <b>{Math.round(bTd.pct.facil)}%</b> · moderado (Z3) {Math.round(bTd.pct.moderado)}% · forte (Z4–Z5) {Math.round(bTd.pct.forte)}%. {a.bikeZones ? 'Zonas do seu Garmin (FCmáx ' + (a.bikeFcMax || 186) + '). ' : ''}Rodízio de base fica na Z2; tiros na bike sobem para Z4–Z5 sem castigar a tíbia.</p></>
            : <p className="muted">Sem FC nos treinos de bike ainda.</p>}
        </Card>
      </div>
    </>)}
    {aud.length ? (
      <details className="acc">
        <summary>Auditoria das sessões (.FIT)<span className="chev" aria-hidden="true">›</span></summary>
        <div className="body">
          <div className="tbl-wrap"><table>
            <thead><tr><th scope="col">Data</th><th scope="col" className="n">Válidos</th><th scope="col" className="n">Excl.</th><th scope="col" className="n">Defas.</th><th scope="col" className="n">Mec.</th><th scope="col">Clima</th><th scope="col">Motivos</th></tr></thead>
            <tbody>{aud.slice(0, 16).map((w: any) => { const q = w.quality, mot = Object.keys(q.reasons || {});
              return <tr key={w.id}><td>{dd(w.date)}</td><td className="n">{dec(q.validMin, 1)} min</td><td className="n" style={{ color: q.excludedPct > 20 ? 'var(--alerta)' : undefined }}>{dec(q.excludedPct, 1)}%</td>
                <td className="n">{w.hrLagSec != null ? w.hrLagSec + ' s' : '—'}{w.streamPruned ? ' (resumido)' : ''}</td>
                <td className="n" style={{ color: w.mech && w.mech.pct > 2 ? 'var(--alerta)' : undefined }}>{w.mech && w.mech.pct != null ? signed(w.mech.pct, 1) + '%' : '—'}</td>
                <td>{w.weather ? Math.round(w.weather.tempC) + '° ' + (w.weather.inStandard ? 'padrão' : 'fora') : (w.geo && w.geo.lat != null ? '—' : 'sem GPS')}</td>
                <td className="muted">{mot.slice(0, 3).join(' · ') || '—'}</td></tr>; })}</tbody>
          </table></div>
          <p className="hint">Minutos válidos, % excluído, defasagem de FC usada e decoupling mecânico por sessão. Mais de 20% excluído (e passada caindo mais de 2%) aparecem em vermelho. Defasagem de FC do ciclo: <b>{ml.lagSec} s</b> (mediana de {ml.n} sessão(ões) válida(s)){lagLow ? ' — menos de 3 sessões, decoupling mecânico com confiança rebaixada.' : '.'} Sessões antigas podem aparecer como (resumido).</p>
          <button type="button" className="btn quiet" style={{ alignSelf: 'flex-start' }} onClick={() => { const m = recalcKpis(); setMsg(m); toast('KPIs recalculados'); }}><IconRefresh size={18} stroke={1.75} aria-hidden="true" />Recalcular KPIs</button>
          {msg ? <p className="apoio" role="status">{msg}</p> : null}
        </div>
      </details>
    ) : null}
  </>);
}

// ======================= HIDRATAÇÃO =======================
function Hidr({ c }: { c: any }) {
  const a = c.a, runs = c.runs;
  const hydroRuns = runs.filter(E.hydroHas), lastHydro = hydroRuns.length ? hydroRuns[hydroRuns.length - 1] : null, hydroRate = lastHydro ? E.hydroRateMlH(lastHydro) : null;
  if (!hydroRuns.length) return <Card><p className="muted">Nenhum treino com hidratação registrada. Informe a água antes/durante/depois ao salvar um treino.</p></Card>;
  const hp = E.hydroPlan(lastHydro, a);
  const durStat = E.hydroDurStat(hydroRate, hp ? hp.durFloor : 400);
  const durRead = hydroRate == null ? 'Informe a água <b>durante</b> e a duração para calcular a taxa (ml/h) — é a métrica que segura o <b>pace e a deriva cardíaca</b>.'
    : (durStat.label === 'adequada' ? 'Reposição no esforço <b>adequada</b> — ajuda a manter o pace e a segurar a deriva cardíaca.'
      : durStat.label === 'baixa' ? ('Reposição <b>baixa</b> pro esforço' + (hp && hp.durMin < 60 && hp.temp < 18 ? ' — mas em treino curto e frio, beber na sede costuma bastar.' : ' — em longo/quente, suba a água durante pra conter a deriva.'))
        : 'Reposição <b>alta</b> — ótima no calor; só cuide do desconforto gástrico.');
  let antes = null, depois = null;
  if (hp) {
    const aStat = E.hydroPhaseStat(hp.antes, hp.antesTarget);
    let dc: number | null = null; try { if (!E.isBike(lastHydro)) dc = E.computeDecoupling(lastHydro); } catch { /* idem */ }
    let aRead = 'Meta ~' + hp.antesTarget + ' ml (' + (hp.antesTarget / hp.kg).toFixed(0) + ' ml/kg, ajustada ao treino). Chegar hidratado <b>baixa a FC inicial e segura a deriva</b>.';
    if (hp.antes != null && hp.antes < hp.antesTarget * 0.6 && dc != null && dc > 7) aRead = 'Pouca água antes (' + hp.antes + ' ml) e deriva <b>alta</b> (' + dec(dc, 1) + '%) — provável <b>largada desidratada</b>. Reforce o pré nos longos/quentes.';
    else if (hp.antes != null && hp.antes >= hp.antesTarget * 0.85 && dc != null && dc < 5) aRead = 'Chegou bem hidratado (' + hp.antes + ' ml) e a deriva ficou <b>baixa</b> (' + dec(dc, 1) + '%) — largada hidratada.';
    else if (hp.antes != null && hp.antes < hp.antesTarget * 0.5) aRead = 'Pouco antes (' + hp.antes + ' ml) pra meta ~' + hp.antesTarget + ' ml — larga em leve déficit. Chegar hidratado reduz a deriva.';
    antes = { stat: aStat, read: aRead };
    const pStat = E.hydroPhaseStat(hp.depois, hp.depoisTarget);
    const nd = E.hydroNextDayRecovery(lastHydro);
    let pRead = 'Meta ~' + hp.depoisTarget + ' ml pra repor o déficit estimado (' + hp.deficit + ' ml de suor − durante). Reidratar <b>acelera a recuperação</b> e protege a próxima sessão.';
    if (hp.depois != null && hp.depois < hp.depoisTarget * 0.6 && nd && nd.restingDelta != null && nd.restingDelta > 2) pRead = 'Pouco depois (' + hp.depois + ' ml) e a <b>FC de repouso subiu +' + nd.restingDelta.toFixed(0) + ' bpm</b> no dia seguinte — reidratar melhor acelera a recuperação.';
    else if (hp.depois != null && hp.depois >= hp.depoisTarget * 0.85 && nd && ((nd.restingDelta != null && nd.restingDelta <= 0) || (nd.hrvDeltaPct != null && nd.hrvDeltaPct >= 0))) pRead = 'Boa reidratação (' + hp.depois + ' ml) — a recuperação no dia seguinte veio bem' + (nd.restingDelta != null ? ' (FC repouso ' + (nd.restingDelta <= 0 ? 'estável/menor' : '+' + nd.restingDelta.toFixed(0) + ' bpm') + ')' : '') + '.';
    else if (hp.depois != null && hp.depois < hp.depoisTarget * 0.6) pRead = 'Pouco depois (' + hp.depois + ' ml) pra um déficit estimado de ' + hp.deficit + ' ml — reponha mais na recuperação, principalmente após longo/quente.';
    depois = { stat: pStat, read: pRead };
  }
  const phase = (title: string, val: number | null, target: number, p: any) => (
    <div className="stack" style={{ gap: 4, padding: '10px 0', borderTop: '1px solid var(--linha)' }}>
      <div className="row between wrap"><b>{title}</b><span className="tn">{val != null ? val + ' ml' : '—'}<span className="muted"> / meta ~{target}</span></span><StateBadge tone={toneOfVar(p.stat.c)}>{p.stat.label}</StateBadge></div>
      <Rich as="p" className="apoio muted" html={p.read} />
    </div>
  );
  const hpts = hydroRuns.map((w: any) => { const t = E.hydroTotal(w); return t != null ? { label: dd(w.date), y: t, extra: w.temp != null ? Math.round(w.temp) + ' °C' : '' } : null; }).filter(Boolean) as any[];
  return (
    <Card>
      <CardH title="Hidratação do treino" right={<Conf level="média" />} />
      <Kpi doc="hidratacao" value={(hydroRate != null ? Math.round(hydroRate) : '—') + ' ml/h'} band={durStat.label}><span className="big">{hydroRate != null ? Math.round(hydroRate) : '—'}<small>ml/h · durante</small></span></Kpi>
      <span className="apoio muted">último treino{hp && hp.tempKnown ? ' · ' + Math.round(hp.temp) + ' °C' : ''}{hp ? ' · ' + Math.round(hp.durMin) + ' min' : ''} · <b style={{ color: toneColor(durStat.c) }}>{durStat.label}</b></span>
      {hydroRate != null ? <Scale min={0} max={1200} val={hydroRate} valText={Math.round(hydroRate) + ' ml/h'} segs={[{ to: hp ? hp.durFloor : 400, label: 'Baixa', c: 'var(--atencao)' }, { to: 900, label: 'Adequada', c: 'var(--ok)' }, { to: 1200, label: 'Alta', c: 'var(--ciano)' }]} /> : null}
      <Rich as="p" className="hint" html={durRead} />
      {hp && antes ? phase('Antes · largada', hp.antes, hp.antesTarget, antes) : null}
      {hp && depois ? phase('Depois · recuperação', hp.depois, hp.depoisTarget, depois) : null}
      <div className="grid-4" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        {[['antes · méd', E.hydroPhaseAvg(hydroRuns, 'waterBefore')], ['durante · méd', E.hydroPhaseAvg(hydroRuns, 'waterDuring')], ['depois · méd', E.hydroPhaseAvg(hydroRuns, 'waterAfter')]].map(([l, v]: any) => <Stat key={l} v={v != null ? v + ' ml' : '—'} l={l} />)}
      </div>
      {hpts.length > 1 ? <LineChart label="Água total por treino" series={[{ name: 'total ml', points: hpts }]} yfmt={(v) => String(Math.round(v))} /> : null}
      <p className="hint">Metas pessoais pelo seu <b>peso ({(a && a.weight) || 72} kg)</b> e ajustadas por <b>duração e calor</b>. Antes/depois são estimativas de apoio — não substituem a sede nem orientação individual.</p>
    </Card>
  );
}

// ======================= RECUPERAÇÃO =======================
function Recup({ c }: { c: any }) {
  const a = c.a, ac = c.ac, tsb = c.tsb, rd = c.rd, recov = c.recov, dailyArr = c.dailyArr, restTr = c.restTr, hrvTr = c.hrvTr, sleepLast = c.sleepLast, fcRepEff = c.fcRepEff, last = c.last, dctx = c.dctx;
  const shinProtect = !!(a.alert && /canela|t[íi]bia|protetora|suspensa/i.test(a.alert)) || !!(last && last.pain);
  const sug = E.nextWorkoutSuggestion(rd, tsb, ac, shinProtect);
  const rt = readyTone(rd.score);
  return (<>
    <Card>
      <CardH title="Prévia do próximo treino" right={<span className="badge neutro">sugestão</span>} />
      <div className="row wrap" style={{ gap: 16 }}>
        <Kpi doc="readiness" value={rd.score} band={bandPt(rd.band)}><span className="big" style={{ color: `var(--${rt.tone})` }}>{rd.score}</span></Kpi>
        <div className="stack grow">
          <span className="lead" style={{ color: toneColor(sug.c) }}>{sug.type}</span>
          <span className="apoio muted">{sug.detail}</span>
          <div className="row wrap" style={{ gap: 6 }}>
            <StateBadge tone={rt.tone}>{rd.score} · {bandPt(rd.band)}</StateBadge>
            {dctx.sleepH != null ? <span className="badge neutro">sono {dec(dctx.sleepH, 1)} h</span> : null}
            {tsb != null ? <span className="badge neutro">forma {signed(tsb, 0)}</span> : null}
            {ac ? <span className="badge neutro">A:C {dec(ac.ratio, 2)}</span> : null}
            <span className={'badge ' + (shinProtect ? 'atencao' : 'ok')}>{shinProtect ? 'canela sensível' : 'canela ok'}</span>
          </div>
        </div>
      </div>
      <Rich as="p" html={sug.read} />
      <p className="hint">Sugestão esportiva a partir dos seus dados — você decide. Não é prescrição médica.</p>
    </Card>
    <div className="grid-2 grid-3" style={{ gap: 12 }}>
      <Card><span className="cap">Recuperação</span><Kpi doc="recovery" value={recov.score} band={recoveryPt(recov.label)}><span className="val">{recoveryPt(recov.label)}</span></Kpi>
        <span className="apoio muted tn">score {recov.score} · sono/FC repouso/HRV</span><Bar pct={recov.score} color={recov.score >= 75 ? 'var(--ok)' : recov.score >= 55 ? 'var(--atencao)' : 'var(--alerta)'} />
        <p className="hint">{dailyArr.length ? 'Do diário/Apple Watch.' : 'Preencha o diário para ativar.'}</p></Card>
      <Card><span className="cap">FC de repouso</span><Kpi doc="fcrep" value={fcRepEff + ' bpm'}><span className="val">{fcRepEff}<small>bpm</small></span></Kpi>
        <span className="apoio muted tn">{restTr && restTr.baseline != null ? (restTr.deltaAbs <= 0 ? '▼ ' + Math.abs(restTr.deltaAbs).toFixed(0) : '▲ ' + restTr.deltaAbs.toFixed(0)) + ' vs base · do Apple Watch' : 'reserva ' + (a.fcMax - a.fcRep) + ' bpm' + (a.fcMaxProv ? ' · FCmáx prov.' : '')}</span></Card>
      <Card><span className="cap">Sono (última noite)</span><span className="val">{sleepLast ? dec(sleepLast.value, 1) : '—'}<small>h</small></span><span className="apoio muted">{sleepLast ? dd(sleepLast.date) : 'registre no diário'}</span></Card>
      <Card><span className="cap">HRV (SDNN)</span><Kpi doc="hrv" value={(hrvTr ? hrvTr.latest : '—') + ' ms'}><span className="val">{hrvTr ? hrvTr.latest : '—'}<small>ms</small></span></Kpi>
        <span className="apoio muted tn">{hrvTr && hrvTr.deltaPct != null ? (hrvTr.deltaPct >= 0 ? '▲ ' + hrvTr.deltaPct.toFixed(0) : '▼ ' + Math.abs(hrvTr.deltaPct).toFixed(0)) + '% vs base' : '—'}</span></Card>
    </div>
    <a className="card" href={href('mais', 'recuperacao')} style={{ color: 'var(--texto)', textDecoration: 'none' }}>
      <b>Diário completo de recuperação</b>
      <span className="apoio muted">Tendências de sono, FC repouso, HRV e VO₂máx · importar do Apple Saúde · prontidão da semana</span>
    </a>
  </>);
}

