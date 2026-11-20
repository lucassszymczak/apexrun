// LEITURA COMPLETA DO COACH ("Ver leitura completa" no Hoje). Porta de renderCoach +
// coachInsightEl (app antigo): mesma lógica, mesmos limiares e mesma prioridade
// (segurança → recuperação → desempenho). Só os emojis viram ícones/pontos.
import { IconMessageCircle, IconTarget } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { PeriodoSel } from './PeriodoSel';
import { usePeriodo, filtra, ehAtual, comTreinos } from '../periodo';
import { useApex } from '../store';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, CardH, Rich, Empty, Kpi, IC } from '../ui';
import { dec, signed, bandPt, noEmoji } from '../fmt';

type Row = { dot: string; lab: string; val: string; read: string; doc?: string };

// Mesma montagem de coachInsightEl, devolvida como dados.
export function coachReading(ws: any[], a: any, x: any) {
  const runs = E.runsOnly(ws);
  const hydroR = runs.filter(E.hydroHas), lastHy = hydroR.length ? hydroR[hydroR.length - 1] : null, hyRate = lastHy ? E.hydroRateMlH(lastHy) : null, hySt = E.hydroStatus(hyRate);
  const pain = !!(x.last && x.last.pain);
  const sore = x.last && x.last.soreness != null ? x.last.soreness : null;
  const shinAlert = !!(a.alert && /canela|t[íi]bia|protetora|suspensa/i.test(a.alert));
  const acR = x.ac ? x.ac.ratio : null, acZone = x.ac ? x.ac.zone : null;
  const safeDot = (pain || shinAlert || acZone === 'risco') ? 'c' : ((sore != null && sore >= 3) || acZone === 'atenção') ? 'w' : 'g';
  const r2 = (n: number) => n.toFixed(2).replace('.', ',');
  const safeRead = shinAlert ? '<b>Alerta protetor da tíbia ativo</b> — ' + E.esc(noEmoji((a.alert || '').split('·')[0].trim())) + '. Mantenha a corrida suspensa/reduzida até a palpação liberar.'
    : pain ? '<b>Dor articular registrada no último treino.</b> Recuar cedo separa um recuo de dias de uma lesão de meses — priorize reforço e reavalie.'
    : acZone === 'risco' ? '<b>Carga aguda:crônica ' + r2(acR) + ' (risco).</b> Salto de carga é o principal gatilho de sobrecarga na tíbia — descarregue ~10%.'
    : acZone === 'atenção' ? 'Carga aguda:crônica <b>' + r2(acR) + ' (atenção)</b> — subindo rápido; segure o volume esta semana.'
    : (sore != null && sore >= 3) ? 'Dor muscular <b>' + sore + '</b> — ok treinar fácil, evite impacto forte até ceder.'
    : 'Sem sinais de dor; carga sustentável' + (acR != null ? ' (A:C ' + r2(acR) + ')' : '') + '.';
  const rdLow = x.rd && x.rd.score < 60, rdHigh = x.rd && x.rd.score >= 80;
  const needRec = rdLow || (x.recov && x.recov.label === 'Needs Recovery');
  let hl: string, sub: string;
  if (shinAlert || pain) { hl = 'Prioridade: proteger a tíbia.'; sub = 'Segurança antes de desempenho — base aeróbica pela bike e força de quadril/panturrilha enquanto a canela não libera.'; }
  else if (acZone === 'risco') { hl = 'Segure a carga — risco de sobrecarga.'; sub = 'A:C ' + r2(acR) + '. O motor até pede mais, mas a tíbia cobra o salto de carga; descarregue.'; }
  else if (needRec) { hl = 'Recuperar antes de puxar.'; sub = 'Prontidão ' + (x.rd ? x.rd.score : '') + ' — os sinais (sono/HRV/FC repouso) pedem um dia leve antes de qualidade.'; }
  else if (x.pol && x.pol.easyPct < 75) { hl = 'Corra o fácil mais fácil.'; sub = 'Só ' + Math.round(x.pol.easyPct) + '% em Z1–Z2 — a base aeróbica (e o EF) rende quando o fácil é fácil de verdade.'; }
  else if (x.efDelta != null && x.efDelta >= 2) { hl = 'Motor evoluindo — siga o plano.'; sub = 'Economia +' + x.efDelta.toFixed(0) + '% no bloco. Constância no fácil + força rendendo; janela boa para qualidade.'; }
  else if (rdHigh) { hl = 'Verde para uma sessão de qualidade.'; sub = 'Prontidão ' + x.rd.score + ' e sem sinais de risco — corpo pronto; execute com técnica.'; }
  else { hl = 'Base no rumo — constância é a alavanca.'; sub = 'Sem bandeiras vermelhas; puxe o fácil fácil e proteja a recuperação para o motor subir.'; }

  const rows: Row[] = [];
  rows.push({ dot: safeDot, lab: 'Segurança · tíbia', val: '', read: safeRead });
  const motorDot = x.efDelta == null ? 'w' : (x.efDelta >= 1 ? 'g' : x.efDelta <= -2 ? 'c' : 'w');
  const motorRead = x.efDelta == null ? 'Registre rodagens fáceis com FC para medir a economia do motor.'
    : x.efDelta >= 1 ? '<b>Economia +' + x.efDelta.toFixed(0) + '%</b> no bloco — motor rendendo no mesmo esforço.'
    : x.efDelta <= -2 ? '<b>EF caiu ' + x.efDelta.toFixed(0) + '%</b> no bloco — cheque sono, calor e pacing dos fáceis.'
    : 'EF estável no bloco — constância mantém o motor.';
  rows.push({ dot: motorDot, lab: 'Motor · economia', val: x.latestEF != null ? dec(x.latestEF * 1000, 1) + ' pts' : '—', read: motorRead, doc: 'efficiency' });
  if (x.latestDec != null) {
    const rDot = x.latestDec < 5 ? 'g' : x.latestDec <= 8 ? 'w' : 'c';
    const rRead = x.latestDec < 0 ? 'Decoupling negativo — fica <b>mais eficiente no fim</b> (closer comprovado).'
      : x.latestDec < 5 ? 'Deriva baixa — base aeróbica sólida no último longo.'
      : x.latestDec <= 8 ? 'Deriva limítrofe — no limite do sustentável.' : 'Deriva <b>alta</b> — revise combustível/calor/pacing nos longos.';
    rows.push({ dot: rDot, lab: 'Resistência · deriva', val: signed(x.latestDec, 1) + '%', read: rRead, doc: 'decoupling' });
  }
  if (x.latestCad) {
    const mDot = x.latestCad >= a.cadenceTarget ? 'g' : 'w';
    const mRead = x.latestCad >= a.cadenceTarget ? 'Cadência na meta (' + a.cadenceTarget + ') — passada econômica e menos impacto por passo.'
      : 'Rumo à meta ' + a.cadenceTarget + '; subir ~5% reduz o impacto por passada (poupa a tíbia) e tende a baixar a FC.';
    rows.push({ dot: mDot, lab: 'Mecânica · cadência', val: x.latestCad + ' spm', read: mRead, doc: 'cadência' });
  }
  if (x.ac || x.tsb != null) {
    const cDot = acZone ? (acZone === 'sweet spot' ? 'g' : acZone === 'atenção' ? 'w' : acZone === 'risco' ? 'c' : 'w') : 'w';
    const cVal = (acR != null ? 'A:C ' + r2(acR) : '') + (x.tsb != null ? ((acR != null ? ' · ' : '') + 'forma ' + signed(x.tsb, 0)) : '');
    const cRead = (acR != null ? (acZone === 'sweet spot' ? 'Carga sustentável. ' : acZone === 'risco' ? 'Salto de carga — risco. ' : acZone === 'atenção' ? 'Carga subindo rápido. ' : 'Carga baixa. ') : '') + (x.tsb != null ? 'Forma ' + E.tsbState(x.tsb) + '.' : '');
    rows.push({ dot: cDot, lab: 'Carga e forma', val: cVal, read: cRead, doc: 'ac' });
  }
  if (x.rd) {
    const recDot = x.rd.score >= 70 ? 'g' : x.rd.score >= 50 ? 'w' : 'c';
    const bits: string[] = [];
    if (x.sleepLast) bits.push('sono ' + dec(x.sleepLast.value, 1) + ' h');
    if (x.hrvTr && x.hrvTr.deltaPct != null) bits.push('HRV ' + signed(x.hrvTr.deltaPct, 0) + '%');
    if (x.restTr && x.restTr.deltaAbs != null) bits.push('FC repouso ' + (x.restTr.deltaAbs <= 0 ? '↓' : '↑') + Math.abs(x.restTr.deltaAbs).toFixed(0));
    const recRead = (x.rd.score >= 70 ? 'Prontidão boa' : x.rd.score >= 50 ? 'Prontidão moderada' : 'Prontidão baixa') + (bits.length ? ' — ' + bits.join(' · ') + '.' : '.');
    rows.push({ dot: recDot, lab: 'Recuperação', val: x.rd.score + ' · ' + bandPt(x.rd.band), read: recRead, doc: 'readiness' });
  }
  if (hyRate != null) {
    const hDot = hySt.label === 'adequada' ? 'g' : hySt.label === 'baixa' ? 'w' : 'g';
    rows.push({ dot: hDot, lab: 'Hidratação', val: Math.round(hyRate) + ' ml/h', read: hySt.label === 'baixa' ? 'Reposição baixa durante o último treino — segura menos o pace e a deriva.' : hySt.label === 'adequada' ? 'Reposição adequada durante — ajuda a segurar pace e deriva.' : 'Reposição alta — boa no calor.', doc: 'hidratacao' });
  }
  const acts: { p: number; t: string }[] = [];
  if (shinAlert || pain) acts.push({ p: 0, t: '<b>Segurança:</b> manter corrida suspensa/reduzida; priorizar força de quadril e panturrilha + protocolo de canela (Mais › <b>Força e canela</b>). Base aeróbica pela bike.' });
  else if (sore != null && sore >= 3) acts.push({ p: 0, t: '<b>Segurança:</b> treino fácil hoje e sem impacto forte até a dor muscular (' + sore + ') ceder.' });
  if (acZone === 'risco' || acZone === 'atenção') acts.push({ p: 1, t: '<b>Carga:</b> não subir volume; manter ou descarregar ~10% (A:C ' + r2(acR) + ').' });
  if (needRec) acts.push({ p: 1, t: '<b>Recuperação:</b> trocar a próxima qualidade por rodagem fácil ou descanso (prontidão ' + (x.rd ? x.rd.score : '') + ').' });
  if (x.pol && x.pol.easyPct < 75) acts.push({ p: 2, t: '<b>Distribuição:</b> segurar a FC em Z1–Z2 nos fáceis (só ' + Math.round(x.pol.easyPct) + '% em zona fácil hoje).' });
  if (x.latestDec != null && x.latestDec > 8) acts.push({ p: 2, t: '<b>Resistência:</b> revisar combustível e ritmo nos longos (deriva ' + dec(x.latestDec, 1) + '%).' });
  if (hySt && hySt.label === 'baixa') acts.push({ p: 2, t: '<b>Hidratação:</b> subir a água no próximo longo (mire 500–700 ml/h).' });
  if (!(shinAlert || pain) && x.efDelta != null && x.efDelta >= 1 && !needRec) acts.push({ p: 3, t: '<b>Desempenho:</b> motor rendendo — vale puxar uma sessão de qualidade quando a prontidão abrir.' });
  if (!(shinAlert || pain) && x.latestCad && x.latestCad < a.cadenceTarget) acts.push({ p: 3, t: '<b>Mecânica:</b> mirar cadência ' + a.cadenceTarget + ' (~+5%) nos fáceis — poupa a tíbia e baixa a FC.' });
  acts.push({ p: 4, t: 'Manter a base: 2 fáceis + 1 longo + força 2×; programar a semana em Mais › <b>Ciclo de prova</b> e marcar os cumpridos.' });
  acts.sort((m, n) => m.p - n.p);
  return { hl, sub, rows, acts: acts.slice(0, 5) };
}

const DOT: Record<string, string> = { g: 'ok', w: 'atencao', c: 'alerta' };
const DOT_WORD: Record<string, string> = { g: 'ok', w: 'atenção', c: 'alerta' };

export function Coach() {
  const { st } = useApex();
  const per = usePeriodo(), pAtual = ehAtual(per, st) ? per : '12m';
  const a = st.athlete, ws = filtra(E.sortedWorkouts(), pAtual, st);
  if (!ws.length) return (<><PageHead title="Leitura do Coach" back={href('hoje')} right={<PeriodoSel soAtual />} /><Card><Empty>Nenhum treino neste período.</Empty></Card></>);
  const cx = comTreinos(ws, () => E.coachContext(ws, a));
  const r = comTreinos(ws, () => coachReading(ws, a, cx));
  return (<>
    <PageHead title="Leitura do Coach" sub="Prioridade em segurança (tíbia) e desempenho (motor, pace)" back={href('hoje')} right={<PeriodoSel soAtual />} />
    <Card>
      <CardH icon={<IconMessageCircle {...IC} />} title={r.hl} />
      <p className="muted">{r.sub}</p>
    </Card>
    <div className="cols">
      <Card>
        <h2 className="cap">Leitura · diagnóstico</h2>
        <div className="list">
          {r.rows.map((row, i) => (
            <div key={i} className="item-row" style={{ alignItems: 'flex-start' }}>
              <span className={'dot ' + DOT[row.dot]} aria-hidden="true" />
              <div className="grow stack" style={{ gap: 2 }}>
                <div className="row between"><b>{row.lab}</b>{row.val ? (row.doc ? <Kpi doc={row.doc} value={row.val}><span className="tn">{row.val}</span></Kpi> : <span className="tn">{row.val}</span>) : null}</div>
                <Rich as="p" className="apoio muted" html={row.read} />
                <span className="sr-only">Estado: {DOT_WORD[row.dot]}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardH icon={<IconTarget {...IC} />} title="Ação · esta semana" />
        <p className="apoio muted">Prioridade: segurança → desempenho.</p>
        <ul className="insights">{r.acts.map((t, i) => <li key={i}><span className="dot ciano" /><Rich html={t.t} /></li>)}</ul>
      </Card>
    </div>
  </>);
}
