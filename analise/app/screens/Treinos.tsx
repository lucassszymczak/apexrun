// TREINOS — lista. Porta de renderTreinos (app antigo) com busca, filtros e grupos
// por mês (roteiro da Fase 1). Números por item = os mesmos cálculos de antes.
import { useEffect, useMemo, useRef, useState } from 'react';
import { filterWorkouts, filtrosAtivos, typeBadge, FILTROS_PADRAO, type Modal, type Tipo, type Periodo } from '../treinos-filter';
import { IconSearch, IconChevronRight, IconRoute, IconPlus, IconCalendar, IconChevronDown, IconCheck } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { useApex } from '../store';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, Empty, IC } from '../ui';
import { privacyOf, privacyLabel } from '../privacy';
import { PrivacyIcon } from './Privacidade';
import { dec, signed, km, dur, pace, dayMon, monthYear, workoutTitle, noEmoji } from '../fmt';
import { MiniRoute } from './parts';

export { typeBadge } from '../treinos-filter';

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

  const rows = useMemo(() => filterWorkouts({ q, modal, tipo, per }), [st.workouts, st.updatedAt, q, modal, tipo, per]);
  const ativos = filtrosAtivos({ q, modal, tipo, per });
  const limpar = () => { setQ(FILTROS_PADRAO.q); setModal(FILTROS_PADRAO.modal); setTipo(FILTROS_PADRAO.tipo); setPer(FILTROS_PADRAO.per); };

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

  const sub = st.workouts.length ? (
    <span className="row" style={{ gap: 12 }}>
      <span aria-live="polite">{rows.length} treino{rows.length === 1 ? '' : 's'}</span>
      {ativos ? <button type="button" className="link tf-limpar" onClick={limpar}>Limpar filtros</button> : null}
    </span>
  ) : 'Importe pelo +';

  return (<>
    <PageHead title="Treinos" sub={sub} />
    {!st.workouts.length ? (
      <Card><Empty icon={<IconRoute size={32} stroke={1.75} />}><b>Nenhum treino ainda.</b><br />Importe um ou vários .FIT do relógio, ou registre à mão.</Empty>
        <a className="btn" href={href('importar')}><IconPlus size={18} stroke={2} aria-hidden="true" />Importar treino</a></Card>
    ) : (<>
      <div className="tf" role="search" aria-label="Filtros dos treinos">
        <div className="tf-row1">
          <div className="tf-busca">
            <label htmlFor="busca" className="sr-only">Buscar treinos</label>
            <IconSearch size={18} stroke={1.75} aria-hidden="true" />
            <input id="busca" type="search" placeholder="Buscar por nome, nota ou tipo" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <PeriodoMenu value={per} onChange={setPer} />
        </div>
        <Segmentado value={modal} onChange={setModal} label="Modalidade" options={[['todas', 'Todas'], ['corrida', 'Corrida'], ['bike', 'Bike']]} />
        <div className="tf-tipos">
          <span className="tf-lab" id="tf-tipo-l">Tipo de treino</span>
          <div className="tf-chips" role="group" aria-labelledby="tf-tipo-l">
            {([['todos', 'Todos'], ['facil', 'Fácil'], ['longao', 'Longão'], ['qualidade', 'Qualidade'], ['prova', 'Prova'], ['teste', 'Teste']] as [Tipo, string][]).map(([k, l]) => (
              <button key={k} type="button" className="tf-chip" aria-pressed={tipo === k} onClick={() => setTipo(k)}
                onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })}>{l}</button>))}
          </div>
        </div>
      </div>
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

// Modalidade: seletor segmentado de largura total (radiogroup; setas trocam a opção)
function Segmentado<T extends string>({ value, onChange, label, options }: { value: T; onChange: (v: T) => void; label: string; options: [T, string][] }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, k: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (k + d + options.length) % options.length;
    onChange(options[n][0]); refs.current[n]?.focus();
  };
  return (
    <div className="seg tf-seg" role="radiogroup" aria-label={label}>
      {options.map(([k, l], i) => (
        <button key={k} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={value === k} tabIndex={value === k ? 0 : -1}
          onClick={() => onChange(k)} onKeyDown={(e) => onKey(e, i)}>{l}</button>))}
    </div>
  );
}

// Período: botão compacto que abre um menu com as 4 opções (setas, Enter, Esc)
const PERIODOS: [Periodo, string][] = [['tudo', 'Tudo'], ['30', '30 dias'], ['90', '90 dias'], ['365', '12 meses']];
function PeriodoMenu({ value, onChange }: { value: Periodo; onChange: (v: Periodo) => void }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const cur = PERIODOS.findIndex(([k]) => k === value);
  useEffect(() => {
    if (!open) return;
    items.current[Math.max(0, cur)]?.focus();
    const out = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', out);
    return () => document.removeEventListener('pointerdown', out);
  }, [open]);
  const close = (focus = true) => { setOpen(false); if (focus) btn.current?.focus(); };
  const onKey = (e: React.KeyboardEvent, k: number) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') { close(false); return; }
    const n = e.key === 'ArrowDown' ? k + 1 : e.key === 'ArrowUp' ? k - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? PERIODOS.length - 1 : null;
    if (n == null) return;
    e.preventDefault(); items.current[(n + PERIODOS.length) % PERIODOS.length]?.focus();
  };
  return (
    <div className="tf-per" ref={box}>
      <button ref={btn} type="button" className="tf-per-btn" aria-haspopup="menu" aria-expanded={open} aria-label={'Período: ' + PERIODOS[cur][1]}
        onClick={() => setOpen(!open)} onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}>
        <IconCalendar size={18} stroke={1.75} aria-hidden="true" /><span>{PERIODOS[cur][1]}</span><IconChevronDown size={16} stroke={1.75} aria-hidden="true" />
      </button>
      {open ? (
        <div className="tf-menu" role="menu" aria-label="Período">
          {PERIODOS.map(([k, l], i) => (
            <button key={k} ref={(el) => { items.current[i] = el; }} type="button" role="menuitemradio" aria-checked={value === k} tabIndex={-1}
              onClick={() => { onChange(k); close(); }} onKeyDown={(e) => onKey(e, i)}>
              <span>{l}</span>{value === k ? <IconCheck size={16} stroke={2} aria-hidden="true" /> : null}
            </button>))}
        </div>
      ) : null}
    </div>
  );
}
