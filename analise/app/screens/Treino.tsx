// BLOCOS do Treino — porta de renderTreinoDetalhe + renderSleepInfo + banner do .FIT
// (app antigo). Mesmos cálculos. A tela (mapa, gaveta, replay) está em TreinoView.tsx;
// estes blocos vão para a gaveta (celular) e para o painel lateral (computador).
import { IconEngine, IconHeartbeat, IconShoe, IconChartBar, IconDroplet, IconCloud, IconMoodCheck, IconDatabase, IconChartLine } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { Card, CardH, Kpi, KV, Stat, StateBadge, IC } from '../ui';
import { LineChart, BarChart, ZONE_COLORS, toneColor } from '../charts';
import { dec, signed, dur, pace, noEmoji, bandPt, readyTone, toneOfVar } from '../fmt';
import { typeBadge } from './Treinos';

export function treinoBlocks(w: any, st: any) {
  const a = st.athlete;
  const bk = E.isBike(w);
  const g0 = !bk && w.distKm ? E.computeGap(w) : null;

  // ---------------- resumo ----------------
  const hero = (
    <Card>
      <div className="row between wrap"><span className="badge neutro">{typeBadge(w)}</span>{w.rpe ? <span className="apoio muted">RPE {w.rpe}/10</span> : null}</div>
      <div className="grid-4">
        {w.distKm ? <Stat v={dec(w.distKm, 2) + ' km'} l={w.gainM ? 'D+ ' + Math.round(w.gainM) + ' m' : 'distância'} /> : null}
        <Stat v={dur(w.durationSec)} l="tempo" />
        {!bk && w.distKm ? <Stat v={pace(w.durationSec / w.distKm) + '/km'} l={g0 && g0.gapPace ? 'GAP ' + pace(g0.gapPace) + '/km' : 'pace'} doc="gap" band={g0 && g0.gapPace ? 'ajustado à inclinação: ' + pace(g0.gapPace) + '/km' : undefined} conf={g0 ? g0.confidence : null} title="Pace e GAP" /> : null}
        {w.hrAvg ? <Stat v={w.hrAvg + ' bpm'} l={w.hrMax ? 'pico ' + w.hrMax : 'FC média'} /> : null}
        {bk && w.kcal ? <Stat v={w.kcal + ' kcal'} l="calorias" /> : null}
      </div>
    </Card>
  );

  // ---------------- splits ----------------
  let splits = null;
  if (w.splits && w.splits.length >= 2) {
    const paces = w.splits.map((s: any) => s.timeSec / (s.distKm || 1));
    const full = w.splits.map((s: any, i: number) => ((s.distKm || 1) >= 0.95 ? i : -1)).filter((i: number) => i >= 0);
    const fastest = full.length ? full.reduce((b: number, i: number) => (paces[i] < paces[b] ? i : b), full[0]) : -1;
    const pts = w.splits.map((s: any, i: number) => ({ label: 'km ' + (i + 1), y: s.timeSec / (s.distKm || 1), extra: s.hrAvg ? s.hrAvg + ' bpm' : '', color: i === fastest ? 'var(--magenta)' : undefined }));
    splits = (
      <Card>
        <CardH icon={<IconChartLine {...IC} />} title="Splits por km" />
        <LineChart label="Pace por km" series={[{ name: 'pace', points: pts }]} yfmt={(x) => E.paceStr(x)} reverseY />
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Km</th><th className="n">Pace</th><th className="n">GAP</th><th className="n">FC</th><th className="n">Δ elev.</th></tr></thead>
            <tbody>
              {w.splits.map((s: any, i: number) => {
                const gp = E.computeGap({ distKm: s.distKm || 1, durationSec: s.timeSec, gainM: s.elevDeltaM > 0 ? s.elevDeltaM : 0, lossM: s.elevDeltaM < 0 ? -s.elevDeltaM : 0 }).gapPace;
                return <tr key={i} className={i === fastest ? 'best' : undefined}>
                  <td>{i + 1}{i === fastest ? <span className="sr-only"> (mais rápido)</span> : null}</td><td className="n">{E.paceStr(paces[i])}</td><td className="n">{gp ? E.paceStr(gp) : '—'}</td>
                  <td className="n">{s.hrAvg || '—'}</td><td className="n">{s.elevDeltaM != null ? (s.elevDeltaM > 0 ? '+' : '') + Math.round(s.elevDeltaM) + ' m' : '—'}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
        <p className="hint">Pace km a km (menor = mais rápido). O <b>GAP</b> ajusta cada km pela inclinação, deixando subidas e descidas comparáveis. Em destaque, o km completo mais rápido.</p>
      </Card>
    );
  }

  // ---------------- sistemas (corrida) ----------------
  let motor = null, resist = null, mec = null;
  if (!bk) {
    const ef = E.computeEF(w);
    const vsBase = ef != null && a.efBaseline ? ((ef - a.efBaseline) / a.efBaseline * 100) : null;
    motor = (
      <Card>
        <CardH icon={<IconEngine {...IC} />} title="Motor · economia" />
        {ef != null ? (<>
          <div><Kpi doc="efficiency" value={dec(ef * 1000, 1) + ' pts'} band={'EF ' + dec(ef, 4) + (vsBase != null ? ' · ' + signed(vsBase, 1) + '% vs. baseline' : '')}><span className="big">{dec(ef * 1000, 1)}<small>pts</small></span></Kpi></div>
          <span className="apoio muted tn">EF {dec(ef, 4)}{vsBase != null ? ' · ' + signed(vsBase, 1) + '% vs. baseline' : ''}</span>
          {w.eff ? <p className="hint">m/batimento <b>{dec(w.eff.mPerBeat, 3)}</b> = {dec(w.eff.stepsPerBeat, 3)} passos/bat × {dec(w.eff.mPerStep, 3)} m/passo. Sobe = motor mais econômico.</p>
            : <p className="hint">Economia do motor nesta sessão. Sobe = mais metros por batimento. Baseline do ciclo: EF {a.efBaseline ? dec(a.efBaseline, 4) : '—'}.</p>}
        </>) : <p className="muted">Sem FC/distância suficientes para o EF.</p>}
      </Card>
    );
    const dc = E.computeDecoupling(w), pac = E.computePacing(w), stab = E.computePaceStability(w);
    const PAC: Record<string, string> = { 'negative split': 'negative split (2ª metade mais rápida)', 'positive split': 'positive split (2ª metade mais lenta)', even: 'ritmo uniforme' };
    resist = (
      <Card>
        <CardH icon={<IconHeartbeat {...IC} />} title="Resistência · fadiga" />
        {dc != null || pac || stab ? (<>
          <div>
            {dc != null ? <KV k="Decoupling" doc="decoupling" band={dc < 5 ? 'abaixo de 5%: base sólida' : dc > 8 ? 'acima de 8%: investigar' : 'entre 5 e 8%: limítrofe'}
              v={<span style={{ color: toneColor(dc < 5 ? 'good' : dc <= 8 ? 'warn' : 'crit') }}>{signed(dc, 1)}%</span>} /> : null}
            {pac ? <KV k="Pacing" doc="pacing" v={(PAC[pac.label] || pac.label) + (pac.closer ? ' · closer' : '')} /> : null}
            {stab ? <KV k="Estabilidade (CV do GAP)" doc="pace stability" v={dec(stab.cvPct, 1) + '%'} /> : null}
          </div>
          <p className="hint">{dc != null ? (dc < 5 ? 'Deriva baixa: base sólida aqui. ' : dc > 8 ? 'Deriva alta: revise combustível, calor e pacing. ' : 'Deriva limítrofe. ') : ''}{pac && pac.closer ? 'Fechou mais forte (closer): arma de prova.' : pac && pac.label === 'positive split' ? 'Abriu rápido e caiu no fim.' : ''}</p>
        </>) : <p className="muted">Precisa de splits por km (2 ou mais) para a resistência.</p>}
      </Card>
    );
    const hp = E.hillPerformance(w);
    mec = (
      <Card>
        <CardH icon={<IconShoe {...IC} />} title="Mecânica e ritmo" />
        {w.cadence || (hp && hp.effVsModel != null) || w.gainM ? (<>
          <div>
            {w.cadence ? <KV k="Cadência" doc="cadência" v={w.cadence + ' spm' + (w.cadence >= a.cadenceTarget ? ' · na meta' : ' · meta ' + a.cadenceTarget)} /> : null}
            {hp && hp.effVsModel != null ? <KV k="Subida" doc="hill" v={(hp.effVsModel * 100).toFixed(0) + '% do modelo · ' + hp.gainM + ' m' + (hp.hrExtra != null ? ' · +' + hp.hrExtra + ' bpm' : '')} />
              : w.gainM ? <KV k="Elevação" v={'D+ ' + Math.round(w.gainM) + ' m' + (w.lossM ? ' · D− ' + Math.round(w.lossM) + ' m' : '')} /> : null}
          </div>
          <p className="hint">Cadência maior no mesmo pace = passada mais econômica. A subida compara sua velocidade ao modelo de Minetti.</p>
        </>) : <p className="muted">Sem cadência ou elevação nesta sessão.</p>}
      </Card>
    );
  }

  // ---------------- carga e zonas ----------------
  const tr = E.computeTrimp(w, a), td = E.trainingDistribution([w], a);
  const carga = (
    <Card>
      <CardH icon={<IconChartBar {...IC} />} title="Carga e zonas" />
      <div>
        {tr != null ? <KV k="Carga (TRIMP)" doc="trimp" v={Math.round(tr)} /> : null}
        {w.rpe ? <KV k="Esforço (RPE)" v={w.rpe + '/10'} /> : null}
        {w.trainingEffect ? <KV k="Training Effect" v={dec(w.trainingEffect, 1)} /> : null}
      </div>
      {td ? <BarChart label="Minutos por zona de FC" bars={td.zones.map((sec: number, i: number) => ({ label: 'Z' + (i + 1), y: Math.round(sec / 60), color: ZONE_COLORS[i] }))} yfmt={(v) => v + '′'} /> : null}
      <p className="hint">A dose fisiológica desta sessão entra na carga semanal, na forma (CTL·ATL·TSB) e no A:C.{td ? ' Zonas pelo tempo real de FC.' : ' Importe o .FIT para o tempo em zona.'}</p>
    </Card>
  );

  // ---------------- hidratação ----------------
  let hidr = null;
  if (E.hydroHas(w)) {
    const rate = E.hydroRateMlH(w), plan = E.hydroPlan(w, a), ds = E.hydroDurStat(rate, plan ? plan.durFloor : 400);
    hidr = (
      <Card>
        <CardH icon={<IconDroplet {...IC} />} title="Hidratação" />
        <div className="row wrap" style={{ alignItems: 'baseline', gap: 10 }}>
          <Kpi doc="hidratacao" value={(rate != null ? Math.round(rate) : '—') + ' ml/h'} band={ds.label}><span className="big">{rate != null ? Math.round(rate) : '—'}<small>ml/h · durante</small></span></Kpi>
          <StateBadge tone={toneOfVar(ds.c)}>{ds.label}</StateBadge>
        </div>
        <span className="apoio muted tn">total {E.hydroTotal(w) || 0} ml</span>
        <div className="grid-4" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          <Stat v={w.waterBefore != null ? w.waterBefore + ' ml' : '—'} l="antes" />
          <Stat v={w.waterDuring != null ? w.waterDuring + ' ml' : '—'} l="durante" />
          <Stat v={w.waterAfter != null ? w.waterAfter + ' ml' : '—'} l="depois" />
        </div>
        <p className="hint">Durante segura o pace e a deriva; antes baixa a FC inicial; depois acelera a recuperação. Leitura completa em Progresso › Hidratação.</p>
      </Card>
    );
  }

  // ---------------- condições e notas ----------------
  const wx = w.weather;
  const cond = (
    <Card>
      <CardH icon={<IconCloud {...IC} />} title="Condições e notas" />
      {wx || w.temp != null || w.notes ? (<>
        <div>
          {wx ? <KV k="Clima" v={(wx.tempC != null ? Math.round(wx.tempC) + ' °C' : '—') + (wx.dewC != null ? ' · orvalho ' + Math.round(wx.dewC) + '°' : '') + (wx.inStandard ? ' · padrão' : ' · fora do padrão')} />
            : w.temp != null ? <KV k="Temperatura" v={Math.round(w.temp) + ' °C'} /> : null}
          {wx && wx.tags && wx.tags.length ? <KV k="Etiquetas" v={wx.tags.join(' · ')} /> : null}
        </div>
        {w.notes ? <p className="apoio muted" style={{ whiteSpace: 'pre-wrap' }}>{noEmoji(w.notes)}</p> : null}
      </>) : <p className="muted">Sem clima ou notas registrados.</p>}
    </Card>
  );

  // ---------------- percepção (RPE, sono, dor, hidratação) ----------------
  const day = (st.daily || []).find((d: any) => d && d.date === w.date);
  const sh = w.sleepH != null && w.sleepH !== '' ? +w.sleepH : day && day.sleepH != null ? +day.sleepH : null;
  const wr = !bk && sh != null ? E.workoutDayReadiness(Object.assign({}, w, { sleepH: sh })) : null;
  const sleeps = (st.daily || []).map((d: any) => d.sleepH).filter((x: any) => x != null);
  const norm = sleeps.length ? E.mean(sleeps) : 7.3, low = sh != null && sh < norm - 0.6;
  const src = w.sleepSrc === 'apple' || (w.sleepH == null && day && day.sleepH != null) ? 'Apple Saúde' : 'você';
  const percep = (
    <Card>
      <CardH icon={<IconMoodCheck {...IC} />} title="Percepção" />
      <div>
        <KV k="Esforço (RPE)" v={w.rpe != null ? w.rpe + '/10' : '—'} />
        <KV k="Sono na véspera" v={sh != null ? dec(sh, 1) + ' h · ' + src : '—'} />
        <KV k="Dor muscular" v={w.soreness != null ? w.soreness + ' de 10' : '—'} />
        <KV k="Dor articular" v={w.pain ? <span style={{ color: 'var(--alerta)' }}>sim — alerta de recuo</span> : 'não'} />
        {E.hydroHas(w) ? <KV k="Hidratação" v={(E.hydroTotal(w) || 0) + ' ml no total'} /> : null}
      </div>
      {!bk && sh != null && wr && wr.rd ? (<>
        <div className="row wrap"><StateBadge tone={readyTone(wr.rd.score).tone}>Prontidão deste dia {wr.rd.score} · {bandPt(wr.rd.band)}</StateBadge></div>
        <p className="hint">{low
          ? <>Você dormiu <b>{dec(sh, 1)} h</b> na véspera deste treino, abaixo do seu normal (~{dec(norm, 1)} h). É <b>contexto</b> para ler o treino com justiça: FC um pouco mais alta e economia menor são esperadas.</>
          : <>Você dormiu <b>{dec(sh, 1)} h</b> na véspera, na média (~{dec(norm, 1)} h). Boa base de recuperação para o esforço do dia.</>}
          {' '}Prontidão deste dia recalculada com este sono{wr.tsb != null ? ' · forma TSB ' + signed(wr.tsb, 0) : ''}.</p>
      </>) : !bk && sh == null ? <p className="hint">Sem dado de sono da véspera. Importe o Apple Saúde (Mais › Recuperação) ou preencha o sono — a prontidão deste dia recalcula sozinha.</p> : null}
    </Card>
  );

  // ---------------- qualidade dos dados (banner de conferência do .FIT) ----------------
  const q = w.quality;
  const hm = (sec: number) => (sec >= 60 ? dec(Math.round(sec / 6) / 10, 1) + ' min' : sec + ' s');
  const quality = q ? (
    <Card>
      <CardH icon={<IconDatabase {...IC} />} title="Qualidade dos dados" right={<StateBadge tone={q.needsConfirm ? 'alerta' : 'ok'}>{q.needsConfirm ? 'Conferir' : 'OK'}</StateBadge>} />
      <p className="apoio">{q.needsConfirm ? <b>Confira: </b> : null}<b className="tn">{dec(q.validMin, 1)} min válidos</b>{q.minInBand != null ? ' · ' + dec(q.minInBand, 1) + ' min na banda 145±3' : ''}{q.medianHrValid != null ? ' · FC mediana ' + q.medianHrValid + ' bpm' : ''}
        {q.smart ? <> · <b style={{ color: 'var(--atencao)' }}>gravação inteligente</b> (confiança −1)</> : null}{!q.hasHR ? <> · <b>sem FC</b></> : null}{!q.hasCad ? <> · <b>sem cadência</b></> : null}{!q.hasAlt ? <> · <b>sem altitude</b></> : null}</p>
      <div>
        <KV k="Pausas" v={hm(q.pauseSec || 0)} />
        <KV k="Lacunas interpoladas" v={hm(q.interpSec || 0)} />
        <KV k="Lacunas inválidas" v={hm(q.invalidGapSec || 0)} />
        <KV k="Primeiros 10 min" v={hm(q.firstMinSec || 0)} />
        <KV k="Excluído dos KPIs" v={dec(q.excludedPct, 1) + '%'} />
      </div>
      {Object.keys(q.reasons || {}).length ? <p className="hint">Excluído: {Object.keys(q.reasons).slice(0, 4).map((rk) => rk + ' (' + q.reasons[rk] + ' s)').join(' · ')}</p> : null}
      {wx ? <p className="hint">Clima: {wx.tempC != null ? Math.round(wx.tempC) + ' °C' : '—'}{wx.dewC != null ? ' · orvalho ' + Math.round(wx.dewC) + '°' : ''}{wx.windKmh != null ? ' · vento ' + Math.round(wx.windKmh) + ' km/h' : ''} · {wx.inStandard ? 'clima padrão' : 'fora do padrão'} ({wx.source || 'open-meteo'}{wx.localTime ? ' · ' + wx.localTime : ''})</p> : null}
    </Card>
  ) : null;

  return { hero, splits, motor: bk ? null : motor, resist, mec, carga, hidr, percep, cond, quality };
}
