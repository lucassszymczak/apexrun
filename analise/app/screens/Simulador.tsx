// SIMULADOR DE META (Fase 4 · Etapa 4; design/telas-fase4/Simulador). Mostra a faixa do tempo
// realista passo a passo (Riegel pela âncora, correção para maratona ou margem, percurso, clima),
// testa uma meta contra ela e grava "Usar como meta". Estimativa, não garantia.
import { useMemo, useState } from 'react';
import { IconMinus, IconPlus, IconCircleCheck, IconAlertTriangle } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { useApex, commit, getState, toast } from '../store';
import { href, go } from '../route';
import { PageHead } from '../Shell';
import { Card, Empty, Kpi, Conf } from '../ui';
import { dec, noEmoji, workoutTitle } from '../fmt';
import { passos, veredito, arredonda5, climaQuentePct, QUENTE, PASSO_ALVO_S } from '../../simulador.mjs';
import { montaPlano, modoClima, aberturaPrevisao, MARATONA_EXTRA_S } from '../../plano.mjs';
import { resumoCourse } from '../../percurso.mjs';
import { ancoraDoCiclo, usePrevisaoProva } from '../plano-app';
import { metaTxt } from './Ciclo';

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dataCurta = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return d + ' ' + MES[m - 1]; };
const mais = (s: number) => (s >= 0 ? '+' : '−') + (Math.abs(s) >= 3600 ? metaTxt(Math.abs(s)) : Math.round(Math.abs(s) / 60) + ' min');
type Clima = 'padrao' | 'quente' | 'previsao';

// faixa realista a partir do ciclo (sem controles): usada no card do ciclo e em Editar ciclo
export function useFaixaHoje(st: any) {
  const race = st.race;
  return useMemo(() => {
    if (!race || !(race.distKm > 0)) return null;
    const kms = race.course ? resumoCourse(race.course).kms : null;
    return passos({ anchor: ancoraDoCiclo(race), distKm: race.distKm, kmsPercurso: kms });
  }, [race, st.workouts]);
}

export function Simulador() {
  const { st } = useApex();
  const race = st.race;
  const prev = usePrevisaoProva(race);
  const temPercurso = !!(race && race.course);
  const [clima, setClima] = useState<Clima>('padrao');
  const [perc, setPerc] = useState<'real' | 'plano'>(temPercurso ? 'real' : 'plano');
  const anchor = race ? ancoraDoCiclo(race) : null;
  const mc = race ? modoClima(race.date, new Date(), prev.horas) : null;
  const previsaoOk = !!(mc && mc.modo === 'previsao');
  const kms = useMemo(() => (race && race.course && perc === 'real' ? resumoCourse(race.course).kms : null), [race, perc]);

  // correção do clima escolhido (%)
  const climaPct = useMemo(() => {
    if (!race || !anchor) return 0;
    if (clima === 'quente') return climaQuentePct();
    if (clima === 'previsao' && previsaoOk) {
      const R = E.riegel(anchor.distKm, anchor.durationSec, race.distKm);
      const p = montaPlano({ distKm: race.distKm, kmsPercurso: kms, alvoSec: R, startTime: race.startTime || '06:00', horas: prev.horas, athlete: st.athlete, clima: { modo: 'previsao' } });
      return (p.totalS / R - 1) * 100;
    }
    return 0;
  }, [clima, race, anchor, kms, prev.horas, previsaoOk]);
  const sim = useMemo(() => (race ? passos({ anchor, distKm: race.distKm, kmsPercurso: kms, climaPct }) : null), [anchor, race, kms, climaPct]);
  const inicial = race && race.goal === 'time' && race.targetSec ? race.targetSec : sim ? arredonda5((sim.rapidoS + sim.lentoS) / 2) : 0;
  const [alvo, setAlvo] = useState<number>(inicial);
  if (!race) return (<><PageHead title="Simulador de meta" back={href('mais', 'maratona')} /><Card><Empty>Nenhum ciclo ativo.</Empty></Card></>);
  if (!sim) return (<><PageHead title="Simulador de meta" back={href('mais', 'maratona')} /><Card><Empty>Registre um treino com distância e tempo para o app calcular o seu tempo realista.</Empty></Card></>);
  const v = veredito(alvo, sim)!;
  const r = sim.realista;

  // régua: faixa em --ciano a 22% com borda, marcador da meta em --texto
  const lo = Math.min(sim.rapidoS, alvo) - 15 * 60, hi = Math.max(sim.lentoS, alvo) + 15 * 60;
  const X = (s: number) => ((s - lo) / (hi - lo)) * 100;
  const usar = () => {
    const S = getState(); const rc: any = S.race; if (!rc) return;
    rc.goal = 'time'; rc.targetSec = alvo; rc.updatedAt = new Date().toISOString(); commit();
    toast('Meta de ' + metaTxt(alvo) + ' gravada no ciclo'); go('mais', 'maratona');
  };
  const ROT: Record<string, [string, string]> = {
    riegel: ['Riegel pelo seu melhor esforço', workoutTitle(anchor) + ' · ' + dec(anchor.distKm, 2) + ' km em ' + E.hms(anchor.durationSec) + ' · ' + dataCurta(anchor.date)],
    maratona: ['Correção para maratona', 'Riegel costuma ser otimista em provas longas (Vickers e Vertosick, 2016)'],
    margem: ['Margem de ±2,5%', 'Abaixo de 30 km, o Riegel acerta bem; a margem mostra que é estimativa'],
    percurso: ['Percurso', kms ? 'Subidas e descidas do percurso (' + (r.percursoPct >= 0 ? '+' : '−') + dec(Math.abs(r.percursoPct), 1) + '%)' : 'Percurso plano'],
    clima: ['Clima', clima === 'quente' ? 'Quente e úmido: ' + QUENTE.tempC + ' °C, orvalho ' + QUENTE.dewC + ' °C (+' + dec(climaPct, 2).replace(/,?0+$/, '') + '%)' : clima === 'previsao' && previsaoOk ? 'Previsão para as ' + (race.startTime || '06:00') + ', hora a hora (+' + dec(climaPct, 1) + '%)' : 'Clima padrão (sem ajuste)'],
  };
  const m0 = (x: number) => (Math.round(x / 60) === 0 ? '0' : mais(x));
  const delta = (p: any) => p.id === 'riegel' ? metaTxt(p.rapido) : Math.round(p.rapido / 60) === 0 && Math.round(p.lento / 60) === 0 ? 'sem ajuste' : Math.round(p.rapido / 60) === Math.round(p.lento / 60) ? mais(p.rapido) : m0(p.rapido) + ' a ' + mais(p.lento);
  return (<>
    <PageHead title="Simulador de meta" sub={noEmoji(race.name || 'Prova') + ' · ' + dec(race.distKm, 3).replace(/,?0+$/, '') + ' km'} back={href('mais', 'maratona')} />
    <Card>
      <span className="cap">Hoje, seu tempo realista é de</span>
      <div className="big tn" style={{ fontSize: 40, lineHeight: '44px' }}>{metaTxt(sim.rapidoS)} a {metaTxt(sim.lentoS)}</div>
      <div className="regua" role="img" aria-label={'Faixa realista de ' + metaTxt(sim.rapidoS) + ' a ' + metaTxt(sim.lentoS) + '; meta de ' + metaTxt(alvo)}>
        <i className="faixa" style={{ left: X(sim.rapidoS) + '%', width: X(sim.lentoS) - X(sim.rapidoS) + '%' }} />
        <i className="meta" style={{ left: X(alvo) + '%' }} />
        <span className="meta-l tn" style={{ left: X(alvo) + '%' }}>meta {metaTxt(alvo)}</span>
      </div>
      <p className="veredito" aria-live="polite" style={{ color: `var(--${v.tom})` }}>{v.tom === 'ok' ? <IconCircleCheck size={20} stroke={1.75} aria-hidden="true" /> : <IconAlertTriangle size={20} stroke={1.75} aria-hidden="true" />}<span>{v.texto}</span></p>
      <div className="row wrap" style={{ gap: 8 }}><Conf level={r.confianca} />{r.ancora.type !== 'prova' && r.ancora.type !== 'teste' ? <span className="apoio muted">Sem prova ou teste marcado: a base é o seu treino mais recente.</span> : null}</div>
    </Card>

    <fieldset className="grupo">
      <legend>Tempo-alvo</legend>
      <div className="stepper">
        <button type="button" className="iconbtn bordered" aria-label="Menos 5 minutos" onClick={() => setAlvo(Math.max(PASSO_ALVO_S, alvo - PASSO_ALVO_S))}><IconMinus size={20} stroke={1.75} /></button>
        <output className="tn" aria-live="polite">{metaTxt(alvo)}</output>
        <button type="button" className="iconbtn bordered" aria-label="Mais 5 minutos" onClick={() => setAlvo(alvo + PASSO_ALVO_S)}><IconPlus size={20} stroke={1.75} /></button>
        <span className="apoio muted tn">{E.paceStr(alvo / race.distKm)}/km</span>
      </div>
    </fieldset>
    <fieldset className="grupo">
      <legend>Clima no dia</legend>
      <div className="seg full" role="radiogroup" aria-label="Clima no dia">
        {([['padrao', 'Padrão'], ['quente', 'Quente e úmido'], ['previsao', 'Previsão']] as [Clima, string][]).map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={clima === k} disabled={k === 'previsao' && !previsaoOk} onClick={() => setClima(k)}>{l}</button>))}
      </div>
      {!previsaoOk ? <span className="hint">{mc && mc.motivo === 'longe' ? 'A previsão abre 16 dias antes da prova, em ' + dataCurta(aberturaPrevisao(race.date)) + '.' : !race.course || !race.course.perfil.rota ? 'Para usar a previsão, adicione um percurso com mapa: é dele que vem o local da largada.' : 'Sem previsão agora (sem internet ou o serviço não respondeu).'}</span> : null}
    </fieldset>
    {temPercurso ? (
      <fieldset className="grupo">
        <legend>Percurso</legend>
        <div className="seg full" role="radiogroup" aria-label="Percurso">
          {([['real', 'Real'], ['plano', 'Plano']] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={perc === k} onClick={() => setPerc(k)}>{l}</button>)}
        </div>
      </fieldset>
    ) : null}

    <Card>
      <h2 className="lead">Como chegamos a essa faixa</h2>
      <ol className="passos">
        {sim.passos.map((p) => (
          <li key={p.id}>
            <span className="stack grow" style={{ gap: 0 }}><b style={{ fontWeight: 500 }}>{ROT[p.id][0]}</b><span className="s">{ROT[p.id][1]}</span></span>
            <b className="tn">{delta(p)}</b>
          </li>))}
        <li className="total"><b>Faixa realista</b><b className="tn">{metaTxt(sim.rapidoS)} a {metaTxt(sim.lentoS)}</b></li>
      </ol>
      <Kpi doc="tempo-realista" className="link-kpi" label="Como o tempo realista é calculado">Como o tempo realista é calculado</Kpi>
      {r.maratona ? <p className="hint">Na maratona, a ponta lenta soma {MARATONA_EXTRA_S / 60} min: num estudo com 2.303 corredores amadores, 3 em cada 4 terminaram até 20 min acima do Riegel.</p> : null}
    </Card>

    <button type="button" className="btn-primary" onClick={usar}>Usar {metaTxt(alvo)} como meta</button>
    <p className="hint">Estimativa, não garantia. O simulador não prevê ganho de treino.</p>
  </>);
}
