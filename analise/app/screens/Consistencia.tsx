// CONSISTÊNCIA (Fase 3 · Etapa 2; design/telas-fase3/Consistencia). Grade de semanas (26 no
// celular, 52 no computador), sequência atual e maior, e o detalhe de cada semana com os 7 dias.
// A semana conta de segunda a domingo; o descanso conta a favor; a semana atual não quebra a sequência.
import { useMemo, useState } from 'react';
import { IconCheck, IconCircleHalf, IconMinus, IconClock, IconRun, IconBike, IconBarbell, IconMoon } from '@tabler/icons-react';
import { useApex } from '../store';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, Kpi } from '../ui';
import { semanas, resumo, hojeEm, PCT_META } from '../../consistencia.mjs';
import { prefsTreino } from '../amanha-app';

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesAno = (iso: string, ano: boolean) => MES[+iso.slice(5, 7) - 1] + (ano ? '/' + iso.slice(2, 4) : '');
const DIA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const ddmm = (iso: string) => iso.slice(8) + '/' + iso.slice(5, 7);
const hTxt = (h: number) => { const m = Math.round(h * 60); return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); };
const ROT: Record<string, string> = { consistente: 'consistente', parcial: 'parcial', sem: 'sem treino', andamento: 'em andamento' };
const ICO: Record<string, any> = { consistente: IconCheck, parcial: IconCircleHalf, sem: IconMinus, andamento: IconClock };

export function useConsistencia(st: any, n = 26) {
  const meta = prefsTreino(st.athlete).metaSemanalH;
  return useMemo(() => {
    const lista = semanas(st.workouts, { hoje: hojeEm(), n: Math.max(n, 30), metaH: meta });
    return { lista: lista.slice(-n), todas: lista, ...resumo(lista, 12) };
  }, [st.workouts, meta, n]);
}

export function Consistencia() {
  const { st } = useApex();
  const desk = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches;
  const C = useConsistencia(st, desk ? 52 : 26);
  const [sel, setSel] = useState<number | null>(null);
  const s = sel != null ? C.lista[sel] : null;
  const ini = C.lista[0].seg, fim = C.lista[C.lista.length - 1].seg;
  const titulo = C.consistentes + ' das últimas ' + C.de + ' semanas foram consistentes';
  return (<>
    <PageHead title="Consistência" back={href('progresso')} />
    <Card>
      <h2 className="titulo-2">{titulo}.</h2>
      <div className="grid-4" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
        <div className="stat"><span className="v tn">{C.atual} {C.atual === 1 ? 'semana' : 'semanas'}</span><span className="l">sequência atual</span></div>
        <div className="stat"><span className="v tn">{C.maior} {C.maior === 1 ? 'semana' : 'semanas'}</span><span className="l">sua maior sequência</span></div>
      </div>
    </Card>
    <Card>
      <div className="row between" style={{ alignItems: 'baseline' }}><h2 className="lead">Últimas {C.lista.length} semanas</h2><span className="apoio muted">{mesAno(ini, ini.slice(0, 4) !== fim.slice(0, 4))} → {mesAno(fim, ini.slice(0, 4) !== fim.slice(0, 4))}</span></div>
      <div className="semanas" role="group" aria-label="Semanas">
        {C.lista.map((w, i) => { const I = ICO[w.estado]; return (
          <button key={w.seg} type="button" className={'csw ' + w.estado + (sel === i ? ' on' : '')} aria-pressed={sel === i} aria-label={'Semana de ' + ddmm(w.seg) + ': ' + ROT[w.estado]} onClick={() => setSel(sel === i ? null : i)}>
            <I size={18} stroke={2} aria-hidden="true" />
          </button>); })}
      </div>
      <div className="legenda-sem" aria-hidden="true">
        {(['consistente', 'parcial', 'sem', 'andamento'] as const).map((k) => { const I = ICO[k]; return <span key={k} className="item"><i className={'csw mini ' + k}><I size={12} stroke={2} /></i>{ROT[k]}</span>; })}
      </div>
      <p className="hint">Semana consistente: pelo menos {Math.round(PCT_META * 100)}% das horas da meta e pelo menos 1 dia de descanso.</p>
    </Card>
    {s ? (
      <Card aria-live="polite" className="cs-detalhe">
        <div className="row between" style={{ alignItems: 'baseline' }}>
          <h2 className="lead">Semana de {ddmm(s.seg)} a {ddmm(s.dom)}</h2>
          <span className={'est ' + s.estado}>{(() => { const I = ICO[s.estado]; return <I size={16} stroke={2} aria-hidden="true" />; })()}{ROT[s.estado]}</span>
        </div>
        <ul className="dias">
          {s.dias.map((d, j) => (
            <li key={d.iso} className={d.futuro ? 'futuro' : ''}>
              <span className="dd">{DIA[j]} {ddmm(d.iso)}</span>
              <span className="tt">{d.futuro ? '—' : d.descanso ? <><IconMoon size={16} stroke={1.75} aria-hidden="true" />descanso</> : d.tipos.map((t) => t === 'corrida' ? <span key={t}><IconRun size={16} stroke={1.75} aria-hidden="true" />corrida</span> : t === 'pedal' ? <span key={t}><IconBike size={16} stroke={1.75} aria-hidden="true" />pedal</span> : <span key={t}><IconBarbell size={16} stroke={1.75} aria-hidden="true" />força</span>)}</span>
            </li>))}
        </ul>
        <div className="grid-4" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
          <div className="stat"><span className="v tn">{hTxt(s.horas)} de {hTxt(s.meta)}</span><span className="l">{Math.round(s.pct * 100)}% da meta{s.metaOrigem === 'padrao' ? ' (padrão)' : ''}</span></div>
          <div className="stat"><span className="v tn">{s.descansos}</span><span className="l">{s.descansos === 1 ? 'dia de descanso' : 'dias de descanso'}</span></div>
        </div>
        <p className="apoio">{s.estado === 'andamento' ? 'Semana em andamento: ela só entra na conta quando terminar, e não quebra a sua sequência.'
          : s.estado === 'consistente' ? 'Consistente: ' + Math.round(s.pct * 100) + '% da meta e ' + s.descansos + (s.descansos === 1 ? ' dia' : ' dias') + ' de descanso.'
          : s.estado === 'sem' ? 'Sem treino nesta semana.'
          : 'Parcial: ' + (s.pct < PCT_META ? Math.round(s.pct * 100) + '% da meta (precisa de ' + Math.round(PCT_META * 100) + '%)' : '') + (s.pct < PCT_META && s.descansos < 1 ? ' e ' : '') + (s.descansos < 1 ? 'nenhum dia de descanso' : '') + '.'}</p>
        <p className="hint">Regra: pelo menos {Math.round(PCT_META * 100)}% das horas da meta e pelo menos 1 dia de descanso. {s.metaOrigem === 'padrao' ? 'Sem meta definida, a meta é a média das 4 semanas anteriores com treino (mínimo de 1 h). ' : ''}<a className="link" href={href('mais', 'treino')}>{s.metaOrigem === 'padrao' ? 'Definir a sua meta' : 'Mudar a meta'}</a></p>
        <Kpi doc="semana-consistente" className="link-kpi" label="Sobre a semana consistente">Como a consistência é calculada</Kpi>
      </Card>
    ) : <p className="hint">Toque numa semana para ver os 7 dias.</p>}
  </>);
}

// Linha do Relatório semanal: "Semana consistente · N seguidas"
export function linhaRelatorio(todas: any[], seg: string): { texto: string; tom: string } | null {
  const i = todas.findIndex((w) => w.seg === seg); if (i < 0) return null;
  const w = todas[i];
  if (w.estado === 'consistente') { let n = 0; for (let k = i; k >= 0 && todas[k].estado === 'consistente'; k--) n++; return { texto: 'Semana consistente · ' + n + (n === 1 ? ' seguida' : ' seguidas'), tom: 'ok' }; }
  if (w.estado === 'andamento') return { texto: 'Semana em andamento', tom: 'ciano' };
  if (w.estado === 'parcial') return { texto: 'Semana parcial · ' + Math.round(w.pct * 100) + '% da meta' + (w.descansos < 1 ? ', sem descanso' : ''), tom: 'atencao' };
  return null;
}
