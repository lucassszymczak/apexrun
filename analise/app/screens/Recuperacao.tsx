// RECUPERAÇÃO (Mais). Porta de renderRecuperacao + handleHealthFile + clearHealthData
// (app antigo). Ação principal: registrar o dia. Secundária: trazer do Apple Saúde.
import { useRef, useState } from 'react';
import { IconBolt, IconUpload, IconTrash, IconCalendarPlus } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { useApex, commit, getState, toast } from '../store';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, CardH, Ring, StateBadge, Stat, Kpi, Scale, Bar, IC } from '../ui';
import { LineChart } from '../charts';
import { dec, signed, dayMon, readyTone, recoveryPt, recoveryTone } from '../fmt';

export function Recuperacao() {
  const { st } = useApex();
  const a = st.athlete, daily = E.sortedDaily();
  const wr = E.weeklyReadiness(E.sortedWorkouts(), a);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState({ date: new Date().toISOString().slice(0, 10), sleep: '', rest: '', hrv: '', vo2: '', mood: '' });

  const importHealth = (file: File | undefined | null) => {
    if (!file) return;
    setBusy(true); toast('Lendo ' + file.name + '… (pode levar alguns segundos)');
    E.readHealthFile(file, (rows: any[]) => {
      setBusy(false);
      if (!rows.length) { alert('Não encontrei FC de repouso, sono, HRV ou VO₂máx nesse arquivo. Confirme que é o export.xml do app Saúde.'); return; }
      const res = E.mergeDaily(rows); commit();
      toast('Apple Saúde: ' + res.added + ' dias novos, ' + res.updated + ' atualizados');
    }, (err: any) => { setBusy(false); alert('Falha ao ler o arquivo do Saúde.\n\n' + (err && err.message ? err.message : err)); });
  };
  const clearHealth = () => {
    const s = getState();
    const nDaily = (s.daily || []).length, nSleep = (s.workouts || []).filter((w: any) => w && w.sleepSrc === 'apple').length;
    if (!nDaily && !nSleep) { alert('Não há dados do Apple Saúde para excluir.'); return; }
    if (!confirm('Excluir os dados do Apple Saúde?\n\n• ' + nDaily + ' dia(s) de recuperação (sono, FC repouso, HRV, VO₂)\n• ' + nSleep + ' treino(s) com sono vindo do Apple Saúde (o sono digitado à mão é mantido)\n\nSeus treinos (distância, FC, cadência, splits) NÃO são afetados. Esta ação não pode ser desfeita.')) return;
    s.daily = [];
    (s.workouts || []).forEach((w: any) => { if (w && w.sleepSrc === 'apple') { w.sleepH = null; w.sleepSrc = null; w.updatedAt = new Date().toISOString(); } });
    commit(); toast('Dados do Apple Saúde excluídos');
  };
  const saveDay = () => {
    if (!day.date) { alert('Informe a data.'); return; }
    const row: any = { date: day.date };
    if (day.sleep !== '') row.sleepH = +day.sleep;
    if (day.rest !== '') row.restingHR = +day.rest;
    if (day.hrv !== '') row.hrv = +day.hrv;
    if (day.vo2 !== '') row.vo2 = +day.vo2;
    if (day.mood !== '') row.mood = +day.mood;
    E.mergeDaily([row]); commit(); toast('Dia salvo');
  };
  const delDay = (date: string) => {
    if (!confirm('Excluir o dia ' + dayMon(date) + '?')) return;
    const s = getState(); s.daily = s.daily.filter((x: any) => x.date !== date); commit();
  };

  // estado atual (mesmas contas)
  let estado = null;
  if (daily.length) {
    const refDate = daily[daily.length - 1].date;
    const restTr = E.metricTrend(daily, 'restingHR', refDate), hrvTr = E.metricTrend(daily, 'hrv', refDate), sleepL = E.sleepLatest(null);
    const rec = E.recoveryStatus({ restingDelta: restTr ? restTr.deltaAbs : null, hrvDeltaPct: hrvTr ? hrvTr.deltaPct : null, sleepH: sleepL ? sleepL.value : null });
    const trend = (title: string, key: string, color: string, yfmt: (x: number) => string) => {
      const pts = daily.filter((e: any) => e[key] != null).map((e: any) => ({ label: dayMon(e.date), y: e[key] }));
      return <Card key={key}><CardH title={title} />{pts.length ? <LineChart label={title} series={[{ name: title, points: pts, color }]} yfmt={yfmt} /> : <p className="muted">Sem dados de {title} ainda.</p>}</Card>;
    };
    estado = (<>
      <h2 className="section-title">Estado atual ({dayMon(refDate)})</h2>
      <div className="grid-2 grid-3" style={{ gap: 12 }}>
        <Card><span className="cap">Recuperação</span><Kpi doc="recovery" value={rec.score} band={recoveryPt(rec.label)}><span className="val">{recoveryPt(rec.label)}</span></Kpi><span className="apoio muted tn">score {rec.score}</span><Bar pct={rec.score} color={`var(--${recoveryTone(rec.score)})`} /></Card>
        <Card><span className="cap">Sono (última noite)</span><span className="val">{sleepL ? dec(sleepL.value, 1) : '—'}<small>h</small></span><span className="apoio muted">{sleepL ? dayMon(sleepL.date) : '—'}</span></Card>
        <Card><span className="cap">FC de repouso</span><Kpi doc="fcrep" value={(restTr ? restTr.latest : '—') + ' bpm'}><span className="val">{restTr ? restTr.latest : '—'}<small>bpm</small></span></Kpi>
          <span className="apoio muted tn">{restTr && restTr.deltaAbs != null ? (restTr.deltaAbs <= 0 ? '▼ ' + Math.abs(restTr.deltaAbs).toFixed(0) + ' vs base (bom)' : '▲ ' + restTr.deltaAbs.toFixed(0) + ' vs base') : '—'}</span></Card>
        <Card><span className="cap">HRV (SDNN)</span><Kpi doc="hrv" value={(hrvTr ? hrvTr.latest : '—') + ' ms'}><span className="val">{hrvTr ? hrvTr.latest : '—'}<small>ms</small></span></Kpi>
          <span className="apoio muted tn">{hrvTr && hrvTr.deltaPct != null ? (hrvTr.deltaPct >= 0 ? '▲ ' + hrvTr.deltaPct.toFixed(0) : '▼ ' + Math.abs(hrvTr.deltaPct).toFixed(0)) + '% vs base' : '—'}</span>
          {hrvTr && hrvTr.deltaPct != null ? <Scale min={-30} max={30} val={hrvTr.deltaPct} valText={signed(hrvTr.deltaPct, 0) + '%'} segs={[{ to: -10, label: 'Abaixo', c: 'var(--atencao)' }, { to: 10, label: 'No seu normal', c: 'var(--ok)' }, { to: 30, label: 'Acima', c: 'var(--ciano)' }]} /> : null}</Card>
      </div>
      <p className="hint"><b>FC repouso</b> caindo e <b>HRV</b> subindo ao longo do ciclo = recuperação e base melhorando. <b>HRV</b> abaixo do seu normal + <b>FC repouso</b> acima = sinal de recuar.</p>
      <h2 className="section-title">Tendências</h2>
      <div className="cols">
        <div className="col">{trend('FC repouso', 'restingHR', 'var(--ciano)', (x) => String(Math.round(x)))}{trend('Sono', 'sleepH', 'var(--zona-3)', (x) => dec(x, 1) + ' h')}</div>
        <div className="col">{trend('HRV (SDNN)', 'hrv', 'var(--magenta)', (x) => String(Math.round(x)))}{trend('VO₂máx', 'vo2', 'var(--ok)', (x) => dec(x, 1))}</div>
      </div>
      <h2 className="section-title">Diário</h2>
      <Card style={{ padding: 0 }}>
        <div className="tbl-wrap"><table>
          <thead><tr><th scope="col">Data</th><th scope="col" className="n">Sono</th><th scope="col" className="n">FC rep</th><th scope="col" className="n">HRV</th><th scope="col" className="n">VO₂</th><th scope="col">Ânimo / nota</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>{daily.slice().reverse().map((e: any) => (
            <tr key={e.date}><td>{dayMon(e.date)}</td><td className="n">{e.sleepH != null ? dec(e.sleepH, String(e.sleepH).includes('.') ? 1 : 0) + ' h' : '—'}</td><td className="n">{e.restingHR || '—'}</td><td className="n">{e.hrv || '—'}</td><td className="n">{e.vo2 ? String(e.vo2).replace('.', ',') : '—'}</td>
              <td>{e.mood ? e.mood + ' de 5' : (e.note ? e.note : '—')}</td>
              <td><button className="link" onClick={() => delDay(e.date)} aria-label={'Excluir o dia ' + dayMon(e.date)}>excluir</button></td></tr>
          ))}</tbody>
        </table></div>
      </Card>
    </>);
  }

  const F = (k: keyof typeof day, label: string, props: Record<string, any> = {}) => (
    <div className="field"><label htmlFor={'rec_' + k}>{label}</label><input id={'rec_' + k} value={day[k]} onChange={(e) => setDay({ ...day, [k]: e.target.value })} {...props} /></div>
  );

  return (<>
    <PageHead title="Recuperação" sub="Sono, FC de repouso, HRV e VO₂máx" back={href('mais')} />
    {wr ? (
      <Card>
        <CardH icon={<IconBolt {...IC} />} title="Prontidão da semana" />
        <div className="row" style={{ gap: 16 }}>
          <Ring value={wr.score} tone={readyTone(wr.score).tone} label="de 100" />
          <div className="stack">
            <StateBadge tone={readyTone(wr.score).tone}>{readyTone(wr.score).label}</StateBadge>
            <span className="apoio muted tn">variou {wr.min}–{wr.max} em {wr.n} dia{wr.n === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="grid-4">
          {wr.sleep != null ? <Stat v={dec(wr.sleep, 1) + ' h'} l="sono" /> : null}
          {wr.rhr != null ? <Stat v={wr.rhr} l="FC rep" doc="fcrep" /> : null}
          {wr.hrv != null ? <Stat v={wr.hrv} l="HRV" doc="hrv" /> : null}
          {wr.tsb != null ? <Stat v={signed(wr.tsb, 0)} l="forma" doc="form" /> : null}
        </div>
        <p className="hint">Um número só para a semana: média da <b>prontidão diária</b> (forma TSB + sono + HRV + FC de repouso) dos últimos {wr.n} dias com dado. 90+ pico · 80 pronto · 70 moderada · 60 cautela · abaixo de 60 recuperar.</p>
      </Card>
    ) : null}

    <Card>
      <CardH icon={<IconCalendarPlus {...IC} />} title="Registrar o dia" />
      <div className="form-grid g3">
        {F('date', 'Data', { type: 'date' })}
        {F('sleep', 'Sono (h)', { type: 'number', step: '0.1', inputMode: 'decimal', placeholder: '7,5' })}
        {F('rest', 'FC repouso (bpm)', { type: 'number', inputMode: 'numeric', placeholder: '54' })}
        {F('hrv', 'HRV · SDNN (ms)', { type: 'number', inputMode: 'numeric', placeholder: '60' })}
        {F('vo2', 'VO₂máx (ml/kg)', { type: 'number', step: '0.1', inputMode: 'decimal', placeholder: '41' })}
        {F('mood', 'Ânimo (1–5, opcional)', { type: 'number', min: 1, max: 5, inputMode: 'numeric', placeholder: '4' })}
      </div>
      <button type="button" className="btn-primary" onClick={saveDay}>Salvar dia</button>
    </Card>

    <Card>
      <CardH icon={<IconUpload {...IC} />} title="Trazer do Apple Saúde" />
      <p className="apoio muted">No iPhone: app <b>Saúde</b> → foto de perfil → <b>Exportar todos os dados de saúde</b> → gera um export.zip. Descompacte e escolha o <b>export.xml</b> aqui. Extraio só FC de repouso, sono, HRV (SDNN) e VO₂máx; o resto é ignorado. Nada sai do seu aparelho.</p>
      <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" className="sr-only" id="healthFile" aria-label="Escolher a exportação do Apple Saúde" onChange={(e) => { importHealth(e.target.files && e.target.files[0]); e.target.value = ''; }} />
      <div className="row wrap">
        <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={busy}><IconUpload size={18} stroke={1.75} aria-hidden="true" />{busy ? 'Lendo…' : 'Importar export.xml'}</button>
        <button type="button" className="btn danger" onClick={clearHealth}><IconTrash size={18} stroke={1.75} aria-hidden="true" />Excluir dados do Apple Saúde</button>
      </div>
    </Card>

    {estado || <Card><p className="muted">Nenhum dado de recuperação ainda. Importe o export.xml ou registre um dia.</p></Card>}
  </>);
}
