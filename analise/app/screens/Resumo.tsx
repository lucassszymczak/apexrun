// RESUMO PÓS-TREINO (Fase 5 · Etapa 4; design/telas-fase5/Resumo). Abre ao salvar um treino novo.
// Título-conclusão e "O que mudou" pelas regras aprovadas (analise/resumo.mjs), a história do
// treino que já existe, "Ver o treino" (principal) e "Compartilhar". Fechar volta ao Hoje.
import { useMemo } from 'react';
import { IconX, IconCheck, IconArrowRight, IconTrophy, IconRoute, IconActivity, IconShare } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { useApex } from '../store';
import { href } from '../route';
import { Card, Empty } from '../ui';
import { dayMon, dec, typeName } from '../fmt';
import { oQueMudou, titulo, type Item } from '../../resumo.mjs';
import { historia } from '../../leitura.mjs';
import { HistoriaCard, ctxHistoria } from './Leitura';
import { prefsTreino } from '../amanha-app';

const Losango = () => <svg width="12" height="12" viewBox="0 0 8 8" aria-hidden="true"><path d="M4 0 8 4 4 8 0 4Z" fill="currentColor" /></svg>;
function Icone({ it }: { it: Item }) {
  if (it.tipo === 'recorde' || it.tipo === 'seg-melhor') return <span className="res-ic violeta"><Losango /></span>;
  if (it.tipo === 'semana') return <span className="res-ic ok"><IconCheck size={18} stroke={2} aria-hidden="true" /></span>;
  if (it.tipo === 'ciclo') return <span className="res-ic"><IconTrophy size={18} stroke={1.75} aria-hidden="true" /></span>;
  if (it.tipo === 'seg') return <span className="res-ic"><IconRoute size={18} stroke={1.75} aria-hidden="true" /></span>;
  if (it.tipo === 'forma') return <span className="res-ic"><IconActivity size={18} stroke={1.75} aria-hidden="true" /></span>;
  return <span className={'res-ic' + (it.tom === 'atencao' ? ' atencao' : '')}><IconArrowRight size={18} stroke={1.75} aria-hidden="true" /></span>;
}
const rotulo: Record<string, string> = { recorde: 'Recorde pessoal', ciclo: 'Melhor do ciclo', 'seg-melhor': 'Segmento', seg: 'Segmento', semana: 'Consistência', forma: 'Carga e forma', equip: 'Equipamento' };
const destino = (it: Item, wid: string) => (it.tipo === 'recorde' || it.tipo === 'ciclo' ? href('treino', wid)
  : it.segId ? href('progresso', 'segmentos', it.segId) : it.tipo === 'semana' ? href('progresso', 'consistencia') : it.tipo === 'forma' ? href('progresso', 'carga') : href('mais', 'equipamentos'));

export function Resumo({ id }: { id: string }) {
  const { st } = useApex();
  const w = st.workouts.find((x: any) => x.id === id);
  const R = useMemo(() => {
    if (!w) return null;
    const itens = oQueMudou({ w, workouts: st.workouts, athlete: st.athlete, race: st.race, segmentos: (st.athlete && st.athlete.segmentos) || [], metaH: prefsTreino(st.athlete).metaSemanalH });
    let ok: string | null = null;
    if (!E.isBike(w)) { try { const l = historia(w, ctxHistoria(w, st)).find((x: any) => x.tom === 'ok'); ok = l ? l.texto : null; } catch { /* sem história */ } }
    const tipo = E.isBike(w) ? (w.indoor ? 'Pedal indoor' : 'Pedal') : typeName(w.type);
    return { itens, titulo: titulo(itens, { tipoNome: tipo, distKm: w.distKm, historiaOk: ok }), tipo };
  }, [w, st]);
  if (!w || !R) return <Card><Empty>Treino não encontrado.</Empty><a className="btn" href={href('hoje')}>Voltar ao Hoje</a></Card>;
  return (<>
    <header className="res-top">
      <span className="cap">Treino salvo</span>
      <a className="iconbtn" href={href('hoje')} aria-label="Fechar e voltar ao Hoje"><IconX size={22} stroke={1.75} /></a>
    </header>
    <div className="stack" style={{ gap: 4 }}>
      <h1 className="titulo-1 res-tit">{R.titulo}.</h1>
      <span className="apoio muted tn">{R.tipo} · {dayMon(w.date)}{w.distKm ? ' · ' + dec(w.distKm, 2) + ' km' : ''}{w.garminActivityId ? ' · do Garmin' : ''}</span>
    </div>
    <HistoriaCard w={w} st={st} />
    <Card>
      <h2 className="lead">O que mudou</h2>
      {R.itens.length ? (
        <ul className="res-lista">
          {R.itens.map((it, i) => (
            <li key={i}><a href={destino(it, w.id)} className={it.tom === 'atencao' ? 'atencao' : ''}>
              <Icone it={it} />
              <span className="stack grow" style={{ gap: 0 }}><span className="apoio muted">{rotulo[it.tipo]}</span><b>{it.texto}</b></span>
            </a></li>))}
        </ul>
      ) : <p className="apoio">Nada mudou nos seus números com este treino.</p>}
      <span className="hint">Só aparece o que mudou com este treino.</span>
    </Card>
    <div className="res-acoes">
      <a className="btn-primary" href={href('treino', w.id)}>Ver o treino</a>
      <a className="btn quiet" href={href('compartilhar', w.id)}><IconShare size={18} stroke={1.75} aria-hidden="true" />Compartilhar</a>
    </div>
  </>);
}
