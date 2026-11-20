// TREINOS — lista. Porta de renderTreinos (app antigo) com busca, filtros e grupos
// por mês (roteiro da Fase 1). Números por item = os mesmos cálculos de antes.
import { useMemo, useState } from 'react';
import { IconSearch, IconChevronRight, IconRoute, IconPlus } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { useApex } from '../store';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, Empty, IC } from '../ui';
import { privacyOf, privacyLabel } from '../privacy';
import { PrivacyIcon } from './Privacidade';
import { dec, signed, km, dur, pace, dayMon, monthYear, workoutTitle, noEmoji, typeName } from '../fmt';
import { MiniRoute } from './parts';

type Modal = 'todas' | 'corrida' | 'bike';
type Tipo = 'todos' | 'facil' | 'longao' | 'qualidade' | 'prova' | 'teste';
type Periodo = 'tudo' | '30' | '90' | '365';
const TIPO_OF: Record<string, Tipo> = { facil: 'facil', regenerativo: 'facil', 'longão': 'longao', tempo: 'qualidade', limiar: 'qualidade', intervalado: 'qualidade', bike_int: 'qualidade', prova: 'prova', teste: 'teste', teste_motor: 'teste' };

export function typeBadge(w: any): string {
  return E.isBike(w) ? (w.indoor ? 'Bike indoor' : 'Bike') : typeName(w.type);
}

// 3 números do item (corrida: distância · pace · FC; bike: tempo · distância/FC · TRIMP)
export function threeNumbers(w: any, a: any): { v: string; u: string; l: string }[] {
  const out: { v: string; u: string; l: string }[] = [];
  if (E.isBike(w)) {
    out.push({ v: dur(w.durationSec), u: '', l: 'tempo' });
    if (w.distKm) out.push({ v: dec(w.distKm, 1), u: 'km', l: 'distância' });
    if (w.hrAvg) out.push({ v: String(w.hrAvg), u: 'bpm', l: 'FC média' });
    const tr = E.computeTrimp(w, a);
    if (out.length < 3 && tr != null) out.push({ v: String(Math.round(tr)), u: '', l: 'TRIMP' });
  } else {
    if (w.distKm) out.push({ v: dec(w.distKm, 2), u: 'km', l: 'distância' });
    if (w.distKm && w.durationSec) out.push({ v: pace(w.durationSec / w.distKm), u: '/km', l: 'pace' });
    else out.push({ v: dur(w.durationSec), u: '', l: 'tempo' });
    if (w.hrAvg) out.push({ v: String(w.hrAvg), u: 'bpm', l: 'FC média' });
    else out.push({ v: dur(w.durationSec), u: '', l: 'tempo' });
  }
  return out.slice(0, 3);
}

export function Treinos() {
  const { st } = useApex();
  const a = st.athlete;
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<Modal>('todas');
  const [tipo, setTipo] = useState<Tipo>('todos');
  const [per, setPer] = useState<Periodo>('tudo');

  const rows = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const qq = q.trim().toLowerCase();
    return E.sortedWorkouts().slice().reverse().filter((w: any) => {
      if (modal === 'bike' && !E.isBike(w)) return false;
      if (modal === 'corrida' && E.isBike(w)) return false;
      if (tipo !== 'todos' && TIPO_OF[w.type] !== tipo) return false;
      if (per !== 'tudo') { const d = Math.round((today.getTime() - new Date(w.date + 'T00:00:00').getTime()) / 86400000); if (d > +per) return false; }
      if (qq) { const hay = (workoutTitle(w) + ' ' + (w.notes || '') + ' ' + typeBadge(w) + ' ' + (w.terrain || '') + ' ' + dayMon(w.date)).toLowerCase(); if (!hay.includes(qq)) return false; }
      return true;
    });
  }, [st.workouts, st.updatedAt, q, modal, tipo, per]);

  // grupos por mês com totais (n, km, tempo)
  const groups: { key: string; ws: any[]; km: number; sec: number }[] = [];
  for (const w of rows) {
    const k = (w.date || '').slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== k) { g = { key: k, ws: [], km: 0, sec: 0 }; groups.push(g); }
    g.ws.push(w); g.km += w.distKm || 0; g.sec += w.durationSec || 0;
  }

  // total do ano (como o cabeçalho de ano da lista antiga), mostrado no 1º mês de cada ano
  const yearAgg: Record<string, { n: number; km: number }> = {};
  rows.forEach((w: any) => { const y = (w.date || '').slice(0, 4); if (!yearAgg[y]) yearAgg[y] = { n: 0, km: 0 }; yearAgg[y].n++; yearAgg[y].km += w.distKm || 0; });
  const yearOpen: Record<string, boolean> = {}; const seenY: Record<string, boolean> = {};
  groups.forEach((g) => { const y = g.key.slice(0, 4); if (!seenY[y]) { seenY[y] = true; yearOpen[g.key] = true; } });

  const chips = <T extends string>(val: T, set: (v: T) => void, opts: [T, string][], label: string) => (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label={label}>
      {opts.map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={val === k} onClick={() => set(k)}>{l}</button>)}
    </div>
  );

  return (<>
    <PageHead title="Treinos" sub={st.workouts.length + ' registrado' + (st.workouts.length === 1 ? '' : 's') + ' · importar .FIT pelo +'} />
    {!st.workouts.length ? (
      <Card><Empty icon={<IconRoute size={32} stroke={1.75} />}><b>Nenhum treino ainda.</b><br />Importe um ou vários .FIT do relógio, ou registre à mão.</Empty>
        <a className="btn" href={href('importar')}><IconPlus size={18} stroke={2} aria-hidden="true" />Importar treino</a></Card>
    ) : (<>
      <Card>
        <div className="field">
          <label htmlFor="busca" className="sr-only">Buscar treinos</label>
          <div style={{ position: 'relative' }}>
            <IconSearch size={18} stroke={1.75} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--texto-3)' }} aria-hidden="true" />
            <input id="busca" type="search" placeholder="Buscar por nome, nota ou tipo" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 38 }} />
          </div>
        </div>
        {chips(modal, setModal, [['todas', 'Todas'], ['corrida', 'Corrida'], ['bike', 'Bike']], 'Modalidade')}
        {chips(tipo, setTipo, [['todos', 'Todos os tipos'], ['facil', 'Fácil'], ['longao', 'Longão'], ['qualidade', 'Qualidade'], ['prova', 'Prova'], ['teste', 'Teste']], 'Tipo')}
        {chips(per, setPer, [['tudo', 'Tudo'], ['30', '30 dias'], ['90', '90 dias'], ['365', '12 meses']], 'Período')}
      </Card>
      {!rows.length ? <Card><p className="muted">Nenhum treino com esses filtros.</p></Card> : null}
      {groups.map((g) => (
        <section key={g.key} aria-label={monthYear(g.key + '-01')}>
          <div className="row between" style={{ padding: '8px 4px' }}>
            <h2 className="lead">{monthYear(g.key + '-01')}</h2>
            <span className="apoio muted tn">{g.ws.length} treino{g.ws.length > 1 ? 's' : ''} · {km(g.km)} km · {dur(g.sec)}</span>
          </div>
          {yearOpen[g.key] ? <p className="apoio muted tn" style={{ padding: '0 4px 8px' }}>{g.key.slice(0, 4)}: {yearAgg[g.key.slice(0, 4)].n} treino{yearAgg[g.key.slice(0, 4)].n > 1 ? 's' : ''} · {dec(yearAgg[g.key.slice(0, 4)].km, 1)} km no ano</p> : null}
          <Card style={{ paddingTop: 4, paddingBottom: 4 }}>
            <div className="list">
              {g.ws.map((w) => {
                const nums = threeNumbers(w, a);
                const dc = E.isBike(w) ? null : E.computeDecoupling(w);
                const ef = E.isBike(w) ? null : E.computeEF(w), tr = E.computeTrimp(w, a);
                const pv = privacyOf(w, a);
                return (
                  <a key={w.id} className="item-row" href={href('treino', w.id)} aria-label={`${workoutTitle(w)}, ${dayMon(w.date)}. Privacidade: ${privacyLabel(pv)}`}>
                    <MiniRoute w={w} size={56} />
                    <div className="grow stack" style={{ gap: 4 }}>
                      <div className="row between" style={{ gap: 8 }}>
                        <span className="t">{workoutTitle(w)}</span>
                        <span className="row" style={{ gap: 6, flexShrink: 0 }}><span className="faint" title={privacyLabel(pv)} style={{ display: 'inline-flex' }}><PrivacyIcon p={pv} size={18} /></span><span className="badge neutro">{typeBadge(w)}</span></span>
                      </div>
                      <span className="s">{dayMon(w.date)}{w.terrain ? ' · ' + noEmoji(w.terrain) : ''}{w.temp != null ? ' · ' + Math.round(w.temp) + ' °C' : ''}</span>
                      <span className="s tn">{dur(w.durationSec)}{ef != null ? ' · EF ' + dec(ef * 1000, 1) : ''}{dc != null ? ' · deriva ' + signed(dc, 1) + '%' : ''}{E.isBike(w) && tr != null ? ' · TRIMP ' + Math.round(tr) : ''}</span>
                      <div className="row tn" style={{ gap: 14 }}>
                        {nums.map((n, i) => <span key={i} title={n.l}><b style={{ fontWeight: 500, fontSize: 16 }}>{n.v}</b>{n.u ? <small className="muted"> {n.u}</small> : null}</span>)}
                      </div>
                    </div>
                    <IconChevronRight {...IC} className="faint" aria-hidden="true" />
                  </a>
                );
              })}
            </div>
          </Card>
        </section>
      ))}
    </>)}
  </>);
}
