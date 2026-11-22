// MARATONA / CICLO (Mais). Porta de renderMaratona + mBuildForm/mHarvest + OCR + ciclos
// anteriores (app antigo). Mesmos cálculos; ação principal: lançar os treinos da semana.
import { useEffect, useState } from 'react';
import { IconSettings, IconChevronLeft, IconChevronRight, IconPlus, IconCheck, IconPencil, IconTrash, IconCamera, IconClipboardText, IconArchive, IconCopy, IconDownload, IconFlag, IconRoute, IconHistory } from '@tabler/icons-react';
import { FONTE_ROTULO, resumo } from '../course';
import { metaTxt } from './Ciclo';
import { useFaixaHoje } from './Simulador';
import * as E from '../../engine.mjs';
import { useApex, commit, getState, toast } from '../store';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, CardH, Bar, StateBadge, Kpi, IC } from '../ui';
import { BarChart, ZONE_COLORS } from '../charts';
import { dec, km, workoutTitle, noEmoji } from '../fmt';
import { records } from './Progresso';

const ZI = (z: string) => Math.max(0, E.M_ZONES.indexOf(z));
const zColor = (z: string) => (E.M_ZONES.indexOf(z) >= 0 ? ZONE_COLORS[ZI(z)] : 'var(--texto-3)');
const dateBR = (iso: string | null | undefined) => (iso ? E.mDateBR(iso).replace(/^(\d+) ([A-Z]+)/, (_: string, d: string, m: string) => d + ' ' + m.toLowerCase()) : '—');

function download(name: string, txt: string) {
  const b = new Blob([txt], { type: 'text/plain' }); const u = URL.createObjectURL(b);
  const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
  toast('Resumo baixado');
}
function copyText(txt: string) {
  try { navigator.clipboard.writeText(txt).then(() => toast('Resumo copiado'), () => prompt('Copie o resumo do ciclo:', txt)); } catch { prompt('Copie o resumo do ciclo:', txt); }
}

// ---------------- OCR (Tesseract, carregado sob demanda — precisa de internet) ----------------
let tessP: Promise<any> | null = null;
function loadTess(): Promise<any> {
  const w = window as any;
  if (w.Tesseract) return Promise.resolve(w.Tesseract);
  if (tessP) return tessP;
  tessP = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4.1.1/dist/tesseract.min.js'; s.async = true;
    s.onload = () => (w.Tesseract ? res(w.Tesseract) : rej(new Error('OCR indisponível')));
    s.onerror = () => { tessP = null; rej(new Error('Falha ao carregar o leitor (precisa de internet).')); };
    document.head.appendChild(s);
  });
  return tessP;
}

// ---------------- formulário de sessão do plano ----------------
type Draft = any;
function SessForm({ mode, draft: d0, onSave, onCancel }: { mode: 'add' | 'edit'; draft: Draft; onSave: (d: Draft) => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(() => JSON.parse(JSON.stringify(d0)));
  const [paste, setPaste] = useState(false);
  const [txt, setTxt] = useState('');
  const [status, setStatus] = useState<{ msg: string; err?: boolean } | null>(null);
  const t = E.mType(d.type), struct = !!t.structured, rest = !!t.rest;
  const upd = (patch: any) => setD((x: Draft) => ({ ...x, ...patch }));
  const steps: any[] = d.steps || [];
  const setSteps = (s: any[]) => upd({ steps: s });
  const applyParse = (text: string) => {
    const p = E.mParsePlan(text);
    if (!p.type) { toast('Não consegui entender o treino. Revise e edite à mão.'); return; }
    const nd = { ...d, type: p.type };
    if (p.steps && p.steps.length) nd.steps = p.steps;
    if (!E.mType(nd.type).structured) { if (p.zone) nd.zone = p.zone; if (p.durMin != null) nd.durMin = Math.round(p.durMin); if (p.distKm != null) nd.distKm = Math.round(p.distKm * 10) / 10; }
    setD(nd);
    toast('Lido: ' + (E.mType(nd.type).structured ? nd.steps.length : 1) + ' passo(s) — revise e salve');
  };
  const ocr = (file: File | undefined | null) => {
    if (!file) return;
    setStatus({ msg: 'Carregando leitor…' });
    loadTess().then((T: any) => { setStatus({ msg: 'Lendo a imagem… 0%' }); return T.recognize(file, 'por', { logger: (m: any) => { if (m && m.status === 'recognizing text') setStatus({ msg: 'Lendo a imagem… ' + Math.round((m.progress || 0) * 100) + '%' }); } }); })
      .then((r: any) => { const tx = (r && r.data && r.data.text) || ''; if (!tx.trim()) { setStatus({ msg: 'Não consegui ler texto da imagem. Tente uma foto mais nítida ou cole o texto.', err: true }); return; } setStatus(null); applyParse(tx); })
      .catch((e: any) => setStatus({ msg: (e && e.message) || 'Falha no OCR. Cole o texto como alternativa.', err: true }));
  };
  const clock = (s: number | null) => E.mClock(s);
  const segRow = (g: any, onChange: (g: any) => void, onRemove?: () => void, key?: string) => (
    <div key={key} className="form-grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) auto', gap: 6, alignItems: 'end' }}>
      <div className="field"><label>Segmento</label><input value={g.label || ''} onChange={(e) => onChange({ ...g, label: e.target.value })} placeholder="Ex.: Forte" /></div>
      <div className="field"><label>mm:ss</label><input defaultValue={clock(g.durSec)} onBlur={(e) => onChange({ ...g, durSec: E.mParseClock(e.target.value) })} inputMode="numeric" /></div>
      <div className="field"><label>km</label><input type="number" step="0.1" value={g.distKm != null ? g.distKm : ''} onChange={(e) => { const k = parseFloat(e.target.value); onChange({ ...g, distKm: isNaN(k) ? null : k }); }} /></div>
      <div className="field"><label>Zona</label><select value={g.zone || ''} onChange={(e) => onChange({ ...g, zone: e.target.value })}><option value="">—</option>{E.M_ZONES.map((z: string) => <option key={z} value={z}>{z}</option>)}</select></div>
      {onRemove ? <button type="button" className="iconbtn" onClick={onRemove} aria-label="Remover"><IconTrash size={18} stroke={1.75} /></button> : <span />}
    </div>
  );
  const save = () => {
    if (struct && !(steps && steps.length)) { alert('Adicione ao menos um passo ao treino.'); return; }
    onSave(d);
  };
  return (
    <div className="card" style={{ background: 'var(--superficie-2)' }}>
      {mode === 'add' ? (
        <div className="stack">
          <div className="row wrap">
            <label className="btn quiet"><IconCamera size={18} stroke={1.75} aria-hidden="true" />Importar print<input type="file" accept="image/*" className="sr-only" onChange={(e) => { ocr(e.target.files && e.target.files[0]); e.target.value = ''; }} /></label>
            <button type="button" className="btn quiet" onClick={() => setPaste(!paste)}><IconClipboardText size={18} stroke={1.75} aria-hidden="true" />Colar texto</button>
          </div>
          {paste ? (<>
            <div className="field"><label htmlFor="mImpText">Texto do treino</label><textarea id="mImpText" rows={4} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Ex.: Aquecimento 20min @Z2 · Repetir 5× 2min @Z4 / 1min @Z2 · Desaquecimento 10min @Z2" /></div>
            <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => { if (txt.trim()) applyParse(txt); else setStatus({ msg: 'Cole o texto do treino antes de ler.', err: true }); }}>Ler texto</button>
          </>) : null}
          {status ? <p className="apoio" role="status" style={{ color: status.err ? 'var(--alerta)' : 'var(--texto-2)' }}>{status.msg}</p> : null}
        </div>
      ) : null}
      <div className="form-grid g3">
        <div className="field"><label htmlFor="msDay">Dia</label><select id="msDay" value={d.dow} onChange={(e) => upd({ dow: parseInt(e.target.value, 10) || 1 })}>{E.M_DOW.map((x: string, i: number) => <option key={x} value={i + 1}>{x}</option>)}</select></div>
        <div className="field"><label htmlFor="msType">Tipo de treino</label><select id="msType" value={d.type} onChange={(e) => { const nt = e.target.value; const nd: any = { type: nt }; if (E.mType(nt).structured && !(d.steps && d.steps.length)) nd.steps = E.mSeedSteps(); upd(nd); }}>{E.M_TYPES.map((x: any) => <option key={x.k} value={x.k}>{x.label}</option>)}</select></div>
        <div className="field"><label htmlFor="msTitle">Observação (opcional)</label><input id="msTitle" value={d.title || ''} onChange={(e) => upd({ title: e.target.value })} placeholder="Ex.: pista, progressivo, foco técnica" /></div>
      </div>
      {struct ? (
        <div className="stack">
          <span className="cap">Estrutura do treino</span>
          {steps.map((st: any, i: number) => st.rep ? (
            <div key={i} className="card" style={{ padding: 12 }}>
              <div className="row between"><div className="field" style={{ width: 120 }}><label>Repetir (vezes)</label><input type="number" min={1} value={st.times || 1} onChange={(e) => { const s = steps.slice(); s[i] = { ...st, times: parseInt(e.target.value, 10) || 1 }; setSteps(s); }} /></div>
                <button type="button" className="iconbtn" onClick={() => setSteps(steps.filter((_: any, j: number) => j !== i))} aria-label="Remover bloco"><IconTrash size={18} stroke={1.75} /></button></div>
              {(st.segs || []).map((g: any, j: number) => segRow(g, (ng) => { const s = steps.slice(); const segs = st.segs.slice(); segs[j] = ng; s[i] = { ...st, segs }; setSteps(s); }, st.segs.length > 1 ? () => { const s = steps.slice(); s[i] = { ...st, segs: st.segs.filter((_: any, k: number) => k !== j) }; setSteps(s); } : undefined, i + '-' + j))}
              <button type="button" className="link" onClick={() => { const s = steps.slice(); s[i] = { ...st, segs: [...(st.segs || []), { label: '', durSec: null, distKm: null, zone: 'Z2' }] }; setSteps(s); }}>+ segmento</button>
            </div>
          ) : segRow(st, (ng) => { const s = steps.slice(); s[i] = { ...ng, rep: false }; setSteps(s); }, () => setSteps(steps.filter((_: any, j: number) => j !== i)), String(i)))}
          <div className="row wrap">
            <button type="button" className="btn quiet" onClick={() => setSteps([...steps, { rep: false, label: '', durSec: null, distKm: null, zone: 'Z2' }])}>+ passo</button>
            <button type="button" className="btn quiet" onClick={() => setSteps([...steps, { rep: true, times: 5, segs: [{ label: 'Forte', durSec: null, distKm: null, zone: 'Z4' }, { label: 'Recuperação', durSec: null, distKm: null, zone: 'Z2' }] }])}>+ bloco repetir</button>
          </div>
        </div>
      ) : !rest ? (
        <div className="form-grid g3">
          <div className="field"><label htmlFor="msZone">Zona de FC</label><select id="msZone" value={d.zone || ''} onChange={(e) => upd({ zone: e.target.value })}><option value="">—</option>{E.M_ZONES.map((z: string) => <option key={z} value={z}>{z} · {E.M_ZDESC[z]}</option>)}</select></div>
          <div className="field"><label htmlFor="msMin">Duração (min)</label><input id="msMin" type="number" step="5" value={d.durMin != null ? d.durMin : ''} onChange={(e) => { const m = parseFloat(e.target.value); upd({ durMin: isNaN(m) ? null : m }); }} /></div>
          <div className="field"><label htmlFor="msKm">Distância (km)</label><input id="msKm" type="number" step="0.5" value={d.distKm != null ? d.distKm : ''} onChange={(e) => { const k = parseFloat(e.target.value); upd({ distKm: isNaN(k) ? null : k }); }} /></div>
        </div>
      ) : null}
      <div className="form-grid">
        <div className="field"><label htmlFor="msAdapt">Alteração (clima/local)</label><select id="msAdapt" value={d.adapt && d.adapt.modal ? d.adapt.modal : ''} onChange={(e) => upd({ adapt: e.target.value ? { modal: e.target.value, note: (d.adapt && d.adapt.note) || '' } : null })}><option value="">— não alterado —</option>{E.M_ADAPT.map((x: any) => <option key={x.k} value={x.k}>{x.label}</option>)}</select></div>
        <div className="field"><label htmlFor="msAdaptNote">Nota da alteração</label><input id="msAdaptNote" value={d.adapt && d.adapt.note ? d.adapt.note : ''} onChange={(e) => upd({ adapt: d.adapt && d.adapt.modal ? { modal: d.adapt.modal, note: e.target.value } : d.adapt })} placeholder="Ex.: chuva → esteira" /></div>
      </div>
      <div className="row"><button type="button" className="btn" onClick={save}>{mode === 'edit' ? 'Salvar' : 'Adicionar'}</button><button type="button" className="btn quiet" onClick={onCancel}>Cancelar</button></div>
    </div>
  );
}

// ---------------- ciclos anteriores ----------------
function Anteriores() {
  const st = getState(); const arr = st.races || [];
  if (!arr.length) return null;
  return (
    <Card>
      <CardH title="Ciclos anteriores" />
      <div className="list">
        {arr.map((it: any, idx: number) => {
          const r = it.race || {}, s = it.summary || {}, t = E.RACE_TYPES[E.raceTypeOf(r)];
          return (
            <div key={idx} className="stack" style={{ padding: '12px 0', gap: 6 }}>
              <div className="row between wrap"><b>{noEmoji(r.name || 'Ciclo')}</b><span className="badge neutro">{t ? t.label : 'Prova'}</span></div>
              <span className="apoio muted">{dateBR(r.startDate)} → {dateBR(r.date)} · {km(r.distKm)} km{r.objective ? ' · objetivo: ' + noEmoji(r.objective) : ''}</span>
              <div className="row wrap tn apoio" style={{ gap: 14 }}>
                <span>Volume <b>{km(s.totalKm || 0)} km</b></span><span>Longão <b>{km(s.maxLong || 0)} km</b></span>
                {s.efDelta != null ? <span>EF <b>{(s.efDelta >= 0 ? '+' : '') + Math.round(s.efDelta)}%</b></span> : null}
                {s.ctlEnd != null ? <span>Forma <b>{Math.round(s.ctlEnd)}</b></span> : null}
                {s.adesao != null ? <span>Adesão <b>{s.adesao}%</b></span> : null}
              </div>
              <div className="row wrap">
                <button type="button" className="btn quiet" onClick={() => copyText(noEmoji(E.cycleSummaryText(it.race, it.summary)))}><IconCopy size={18} stroke={1.75} aria-hidden="true" />Copiar</button>
                <button type="button" className="btn quiet" onClick={() => download('ciclo-' + ((r.name || 'prova').toLowerCase().replace(/[^a-z0-9]+/g, '-')) + '.txt', noEmoji(E.cycleSummaryText(it.race, it.summary)))}><IconDownload size={18} stroke={1.75} aria-hidden="true" />.txt</button>
                <button type="button" className="iconbtn" aria-label={'Remover ciclo ' + (r.name || '')} onClick={() => { if (confirm('Remover este ciclo arquivado?')) { getState().races.splice(idx, 1); commit(); } }}><IconTrash size={18} stroke={1.75} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function Maratona() {
  const { st } = useApex();
  const race = st.race, a = st.athlete, ws = E.sortedWorkouts(), runs = E.runsOnly(ws);
  const [offset, setOffset] = useState(0);
  const faixa = useFaixaHoje(st);
  const [form, setForm] = useState<{ mode: 'add' | 'edit'; id?: string; draft: any } | null>(null);
  const blk = race ? E.mBlock(race) : null;
  // limita a navegação ao bloco
  let off = offset;
  if (blk) { const minOff = 1 - blk.cur, maxOff = blk.N - blk.cur; if (off < minOff) off = minOff; if (off > maxOff) off = maxOff; }
  const info = E.mWeekInfo(off);
  const wk = st.planWeeks && st.planWeeks[info.key];
  const linked = !!(wk && E.mLinkWeek(info, wk.sessions)); // vincula treinos importados aos programados (por dia)
  useEffect(() => { if (linked) E.save(); });

  if (!race) return (<>
    <PageHead title="Ciclo de prova" back={href('mais')} />
    <Card><CardH icon={<IconFlag {...IC} />} title="Nenhum ciclo ativo" />
      <p className="apoio muted">Comece um novo ciclo de prova em Configurações › Novo ciclo de prova (maratona, meia ou personalizada). O app monta as fases automaticamente e acompanha o bloco até o dia da prova.</p>
      <a className="btn" href={href('mais', 'config')} style={{ alignSelf: 'flex-start' }}>Ir para Configurações</a></Card>
    <Anteriores />
  </>);

  const phase = blk ? E.mPhase(blk, race) : null;
  const cRuns = E.cycleRunsInRange(race);
  const cStart = race.startDate, cEnd = race.date;
  const cycleWk = ws.filter((w: any) => (!cStart || w.date >= cStart) && (!cEnd || w.date <= cEnd));
  const cycleAgeDays = cStart ? Math.round((Date.now() - new Date(cStart + 'T00:00:00').getTime()) / 86400000) : 999;
  let fit: any[] = []; try { fit = E.fitnessSeries(cycleWk, a) || []; } catch { /* idem */ }
  const ctl = fit.length ? fit[fit.length - 1].ctl : null;
  const ctlPrev = fit.length > 7 ? fit[fit.length - 8].ctl : (fit.length ? fit[0].ctl : null);
  const ctlArrow = ctl != null && ctlPrev != null ? (ctl > ctlPrev + 0.5 ? 'subindo' : ctl < ctlPrev - 0.5 ? 'caindo' : 'estável') : '';
  let ac: any = null; try { ac = E.acuteChronic(cycleWk, a); } catch { /* idem */ }
  const acR = ac ? ac.ratio : null, acProv = cycleAgeDays < 28;
  const acBand = acR == null ? null : (acProv ? ['Formando', 'atencao'] : (acR < 0.8 ? ['Destreino', 'alerta'] : acR <= 1.3 ? ['Seguro', 'ok'] : acR <= 1.5 ? ['Atenção', 'atencao'] : ['Risco', 'alerta']));
  let maxLong = 0; cRuns.forEach((w: any) => { if ((w.distKm || 0) > maxLong) maxLong = w.distKm || 0; });
  const curKey = E.mWeekInfo(0).key;
  const curKm = cRuns.filter((w: any) => E.isoWeekKey(w.date) === curKey).reduce((s: number, w: any) => s + (w.distKm || 0), 0);
  const longTarget = race.longRunTargetKm || 30, peakTarget = race.peakKmTarget || 50;
  const totalKm = cRuns.reduce((s: number, w: any) => s + (w.distKm || 0), 0);
  const nTrein = cRuns.length, nBike = E.bikesOnly(cycleWk).length;
  const wkElapsed = blk ? blk.cur : 1, avgWk = wkElapsed ? totalKm / wkElapsed : 0;
  // ritmo por zona
  const pzCycle = cRuns.filter((w: any) => !E.isBike(w) && w.hrAvg && (w.distKm || 0) >= 2 && w.durationSec);
  const pzFromCycle = pzCycle.length >= 3;
  const pz = E.mPaceByZone(pzFromCycle ? cRuns : runs, a);
  const z2 = pz ? pz.zones.filter((z: any) => z.z === 'Z2')[0] : null, z3 = pz ? pz.zones.filter((z: any) => z.z === 'Z3')[0] : null;
  const sug = z2 && z2.pace && z3 && z3.pace ? E.paceStr(z3.pace) + '–' + E.paceStr(z2.pace) + '/km' : null;
  // semana
  const sessions: any[] = wk && wk.sessions ? wk.sessions.slice().sort((x: any, y: any) => (x.dow || 0) - (y.dow || 0)) : [];
  const viewWkNum = blk ? blk.cur + off : null;
  const canPrev = !blk || blk.cur + off > 1, canNext = !blk || blk.cur + off < blk.N;
  const trainS = sessions.filter((s) => !E.mType(s.type).rest);
  const okN = trainS.filter((s) => { const x = E.mSessStatus(s, info); return x === 'done' || x === 'adapted'; }).length;
  const pct = trainS.length ? Math.round(okN / trainS.length * 100) : 0;
  const wkRuns = runs.filter((w: any) => E.isoWeekKey(w.date) === info.key);
  const realKm = wkRuns.reduce((s: number, w: any) => s + (w.distKm || 0), 0);
  const mix = E.mZoneMix(sessions);
  const kmByWk: Record<string, number> = {}; cRuns.forEach((w: any) => { const k = E.isoWeekKey(w.date); kmByWk[k] = (kmByWk[k] || 0) + (w.distKm || 0); });
  const bars = Object.keys(kmByWk).sort().slice(-16).map((k) => ({ label: k.replace(/^\d+-/, ''), y: Math.round(kmByWk[k] * 10) / 10 }));
  // estimativa
  const estAnchorCycle = E.bestAnchor(cRuns), estAnchor = estAnchorCycle || E.bestAnchor(runs);
  // (a faixa vem de useFaixaHoje, chamado no topo do componente)
  const cycleLab = E.raceTypeOf(race) === 'custom' && race.name ? race.name : ((E.RACE_TYPES[E.raceTypeOf(race)] || {}).label || 'Ciclo atual');
  const cand = [{ d: 21.0975, lab: 'Meia maratona' }, { d: race.distKm, lab: cycleLab }, { d: 42.195, lab: 'Maratona' }];
  const seen: Record<number, number> = {}, list: { d: number; lab: string }[] = [];
  cand.forEach((c) => { if (!c.d || c.d <= 0) return; const k = Math.round(c.d * 10); if (seen[k]) return; seen[k] = 1; list.push(c); });
  list.sort((x, y) => x.d - y.d);

  const ensureWk = (key: string) => { const S = getState(); if (!S.planWeeks) S.planWeeks = {}; if (!S.planWeeks[key]) S.planWeeks[key] = { week: key, sessions: [], updatedAt: new Date().toISOString() }; return S.planWeeks[key]; };
  const touchWk = (w2: any) => { w2.updatedAt = new Date().toISOString(); commit(); };
  const saveSess = (d: any) => {
    const t = E.mType(d.type), w2 = ensureWk(info.key);
    const pay: any = { dow: d.dow, type: d.type, title: (d.title || '').trim(), zone: (t.structured || t.rest) ? '' : (d.zone || ''), durMin: (t.structured || t.rest) ? null : d.durMin, distKm: (t.structured || t.rest) ? null : d.distKm, steps: t.structured ? d.steps : [], adapt: d.adapt && d.adapt.modal ? { modal: d.adapt.modal, note: d.adapt.note || '' } : null };
    if (form && form.mode === 'edit') { const s0 = w2.sessions.filter((s: any) => s.id === form.id)[0]; if (s0) Object.assign(s0, pay); }
    else { pay.id = E.uid(); pay.done = false; pay.linkedWorkoutId = null; w2.sessions.push(pay); }
    touchWk(w2); setForm(null);
  };
  const newDraft = () => ({ dow: off === 0 ? E.mDowToday() : 2, type: 'rodagem', title: '', zone: 'Z2', durMin: null, distKm: null, steps: [], adapt: null });

  const archive = () => { if (confirm('Arquivar "' + (race.name || 'a prova') + '" com resumo automático? Ele vai para Ciclos anteriores e o app fica sem ciclo ativo (comece o próximo em Configurações).')) { E.archiveCycle(race); getState().race = null; commit(); toast('Ciclo arquivado'); } };

  const stDot: Record<string, string> = { done: 'ok', adapted: 'ciano', missed: 'alerta', planned: 'neutro' };
  return (<>
    <PageHead title={noEmoji(race.name || 'Ciclo de prova')} sub={(E.RACE_TYPES[E.raceTypeOf(race)] || {}).label || 'Prova'} back={href('mais')}
      right={<a className="iconbtn" aria-label="Editar ciclo" href={href('mais', 'ciclo')}><IconSettings size={22} stroke={1.75} /></a>} />
    <Card>
      <span className="cap">Missão · {noEmoji(race.name || 'Prova')}</span>
      <div className="row" style={{ alignItems: 'baseline', gap: 8 }}><span className="big" style={{ fontSize: 48, lineHeight: '52px', color: 'var(--magenta)' }}>{blk ? (blk.days >= 0 ? blk.days : 0) : '—'}</span><span className="lead">{blk && blk.days < 0 ? 'prova encerrada' : 'dias'}</span></div>
      <span className="apoio muted">{blk ? blk.wkToGo + ' semanas · ' : ''}<b>{dateBR(race.date)}</b> · {km(race.distKm)} km</span>
      <div className="row wrap" style={{ gap: 6 }}><span className="badge ciano">{race.goal === 'time' && race.targetSec ? 'Tempo-alvo ' + metaTxt(race.targetSec) : race.goal === 'finish' || !race.goal ? 'Terminar bem' : race.goal}</span>{race.goal !== 'time' ? <span className="badge neutro">por zonas de FC</span> : null}{race.strategy ? <span className="badge neutro">{race.strategy === 'negativa' ? 'segunda metade mais rápida' : 'esforço constante'}</span> : null}{race.startTime ? <span className="badge neutro">largada {race.startTime}</span> : null}</div>
      <a className="item-row opcao-link" href={href('mais', race.course ? 'percurso' : 'ciclo')}><IconRoute size={20} stroke={1.75} color="var(--ciano)" aria-hidden="true" /><span className="grow">{race.course ? 'Percurso: ' + FONTE_ROTULO[race.course.fonte].toLowerCase() + ' · D+ ' + resumo(race.course).dMais + ' m' : 'Sem percurso: adicione em Editar ciclo'}</span><span className="link">{race.course ? 'Ver' : 'Editar'}</span></a>
      <a className="item-row opcao-link" href={href('mais', 'retrospectiva')}><IconHistory size={20} stroke={1.75} color="var(--ciano)" aria-hidden="true" /><span className="grow">{blk && blk.days < 0 ? 'Retrospectiva do ciclo' : 'Retrospectiva até agora'}</span><span className="link">Ver</span></a>
      <a className="btn" href={href('mais', 'plano')} style={{ alignSelf: 'flex-start' }}>Ver plano de prova</a>
    </Card>
    {blk && blk.days < 0 ? (
      <Card className="alert" style={{ flexDirection: 'column' }}><b>Ciclo encerrado</b>
        <p className="apoio">{race.name || 'A prova'} foi há {Math.abs(blk.days)} dia{Math.abs(blk.days) === 1 ? '' : 's'}. Arquive o ciclo para guardar o resumo (volume, longão, EF do início ao fim, forma, adesão) e começar o próximo em Configurações › Novo ciclo.</p>
        <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={archive}><IconArchive size={18} stroke={1.75} aria-hidden="true" />Arquivar ciclo com resumo</button></Card>
    ) : null}
    {blk && phase ? (
      <Card>
        <div className="row between"><h2 className="lead">Fase atual</h2><span className="apoio tn">Semana <b>{blk.cur}</b> de {blk.N}</span></div>
        <div className="row" style={{ gap: 4 }} role="img" aria-label={`Fase ${phase.idx + 1} de 4: ${phase.name}`}>
          {['Base', 'Construção', 'Pico', 'Taper'].map((n, i) => <div key={n} style={{ flex: Math.max(1, Math.round(phase.fracs[i] * 100)), minWidth: 0 }} className="stack"><i style={{ display: 'block', height: 6, borderRadius: 3, background: i === phase.idx ? 'var(--magenta)' : i < phase.idx ? 'var(--texto-3)' : 'var(--superficie-2)' }} /><span className="cap" style={{ fontSize: 11, color: i === phase.idx ? 'var(--texto)' : undefined }}>{n} · ~{Math.max(1, Math.round(phase.fracs[i] * blk.N))} sem</span></div>)}
        </div>
        <p className="apoio"><b>{phase.name}</b> — {phase.desc}</p>
      </Card>
    ) : null}
    <Card>
      <CardH title="Resumo do ciclo" right={<span className="badge neutro">acumulado</span>} />
      <div className="grid-4">
        <div className="stat"><span className="v">{nTrein}</span><span className="l">corrida{nTrein === 1 ? '' : 's'}{nBike ? ' + ' + nBike + ' bike' : ''}</span></div>
        <div className="stat"><span className="v">{km(totalKm)} km</span><span className="l">volume total</span></div>
        <div className="stat"><span className="v">{wkElapsed}/{blk ? blk.N : '—'}</span><span className="l">semanas</span></div>
        <div className="stat"><span className="v">{km(avgWk)} km</span><span className="l">média/semana</span></div>
      </div>
      <p className="hint">Soma de <b>tudo que você já registrou neste ciclo</b> ({dateBR(race.startDate)} → hoje) — não zera a cada semana. O volume desta semana, abaixo, é só a semana corrente, para comparar com a meta de pico.</p>
    </Card>
    <div className="grid-2" style={{ gap: 12 }}>
      <Card><span className="cap">Longão</span><span className="val">{km(maxLong)}<small>km</small></span><Bar pct={maxLong / longTarget * 100} /><span className="apoio muted">meta <b>{longTarget} km</b></span></Card>
      <Card><span className="cap">Volume · esta semana</span><span className="val">{km(curKm)}<small>km</small></span><Bar pct={curKm / peakTarget * 100} /><span className="apoio muted">pico <b>~{peakTarget} km</b>/sem</span></Card>
      <Card><span className="cap">Forma (CTL)</span><Kpi doc="form" value={ctl != null ? Math.round(ctl) : '—'}><span className="val">{ctl != null ? Math.round(ctl) : '—'}{ctlArrow ? <small>{ctlArrow}</small> : null}</span></Kpi><span className="apoio muted">{cycleAgeDays < 42 ? 'deste ciclo · ainda formando' : 'condicionamento deste ciclo'}</span></Card>
      <Card><span className="cap">Salto de carga</span><Kpi doc="ac" value={acR != null ? dec(acR, 2) : '—'}><span className="val">{acR != null ? dec(acR, 2) : '—'}</span></Kpi><span className="apoio muted">{acProv ? 'A:C deste ciclo · crônica formando' : 'A:C deste ciclo · aguda ÷ crônica'}</span>{acBand ? <StateBadge tone={acBand[1] as any}>{acBand[0]}</StateBadge> : null}</Card>
    </div>

    <Card>
      <div className="row between wrap">
        <h2 className="lead">Treinos da semana</h2>
        <div className="row" style={{ gap: 4 }}>
          <button type="button" className="iconbtn" disabled={!canPrev} onClick={() => { setOffset(off - 1); setForm(null); }} aria-label="Semana anterior"><IconChevronLeft size={22} stroke={1.75} /></button>
          <div className="stack" style={{ gap: 0, alignItems: 'center', minWidth: 140 }}><b className="tn">{viewWkNum != null ? 'Semana ' + viewWkNum + ' de ' + blk!.N : 'Semana'}</b><span className="apoio muted">{E.mWeekRange(info)}{off === 0 ? ' · esta semana' : ''}</span></div>
          <button type="button" className="iconbtn" disabled={!canNext} onClick={() => { setOffset(off + 1); setForm(null); }} aria-label="Próxima semana"><IconChevronRight size={22} stroke={1.75} /></button>
        </div>
      </div>
      {trainS.length ? <><Bar pct={pct} color={pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--ciano)' : 'var(--texto-3)'} /><span className="apoio muted tn">{pct}% · {okN} de {trainS.length} cumpridos</span></> : null}
      {sessions.length ? (
        <div className="list">
          {sessions.map((s, si) => {
            const t = E.mType(s.type), pzz = E.mPeakZone(s) || s.zone, sum = E.mSessSummary(s), an = E.mAnalyze(s, info), stt = E.mSessStatus(s, info);
            const done = stt === 'done' || stt === 'adapted';
            return (
              <div key={s.id || si} className="item-row" style={{ alignItems: 'flex-start' }}>
                <span className="tn" style={{ width: 32, fontWeight: 500 }}>{E.M_DOW[(s.dow || 1) - 1] || ''}</span>
                <div className="grow stack" style={{ gap: 2 }}>
                  <b style={{ fontWeight: 500 }}>{t.label}{s.title ? ' · ' + s.title : ''}</b>
                  {sum ? <span className="s">{sum}</span> : null}
                  {an ? <span className="s"><span className={'dot ' + (an.cls === 'done' ? 'ok' : an.cls === 'adapt' ? 'ciano' : an.cls === 'miss' ? 'alerta' : an.cls === 'partial' ? 'atencao' : '')} style={{ display: 'inline-block', margin: '0 6px 1px 0' }} />{noEmoji(an.label)}{an.txt ? ' — ' + an.txt : ''}</span> : null}
                  <span className="sr-only">Estado: {stt}</span>
                </div>
                <span className="badge" style={{ color: 'var(--texto)', borderColor: zColor(pzz) }}>{E.M_ZONES.indexOf(pzz) >= 0 ? pzz : (t.structured ? 'estruturado' : '—')}</span>
                <div className="row" style={{ gap: 0 }}>
                  {!t.noRun ? <button type="button" className="iconbtn" aria-pressed={done} aria-label={done ? 'Desmarcar como feito' : 'Marcar como feito'} style={{ color: done ? 'var(--ok)' : undefined }} onClick={() => { const w2 = getState().planWeeks[info.key]; const s0 = w2 && w2.sessions.filter((x: any) => x.id === s.id)[0]; if (s0) { s0.done = !s0.done; touchWk(w2); } }}><IconCheck size={20} stroke={1.75} /></button> : null}
                  <button type="button" className="iconbtn" aria-label="Editar ou adaptar" onClick={() => setForm({ mode: 'edit', id: s.id, draft: Object.assign({ steps: [] }, E.mCloneSession(s)) })}><IconPencil size={20} stroke={1.75} /></button>
                  <button type="button" className="iconbtn" aria-label="Remover" onClick={() => { const w2 = getState().planWeeks[info.key]; if (w2) { w2.sessions = w2.sessions.filter((x: any) => x.id !== s.id); touchWk(w2); } }}><IconTrash size={20} stroke={1.75} /></button>
                </div>
              </div>
            );
          })}
        </div>
      ) : <p className="apoio muted">Nenhum treino lançado nesta semana. Lance o que foi programado no seu app.</p>}
      {form ? <SessForm key={form.id || 'new'} mode={form.mode} draft={form.draft} onSave={saveSess} onCancel={() => setForm(null)} />
        : <button type="button" className="btn-primary" onClick={() => setForm({ mode: 'add', draft: newDraft() })}><IconPlus size={18} stroke={2.25} aria-hidden="true" />Lançar treinos da semana</button>}
      <p className="hint">Realizado nesta semana (importado): <b>{wkRuns.length}</b> corrida(s) · <b>{km(realKm)} km</b>. Ao importar, o app vincula ao treino do mesmo dia e analisa a adesão.</p>
      <div className="legend">{Object.keys(stDot).map((k) => <span key={k}><span className={'dot ' + stDot[k]} style={{ display: 'inline-block', margin: '0 4px 1px 0' }} />{({ done: 'cumprido', adapted: 'adaptado', missed: 'não cumprido', planned: 'programado' } as any)[k]}</span>)}</div>
    </Card>

    <div className="cols">
      <Card>
        <CardH title="Ritmo de prova por zona de FC" />
        {pz ? (<>
          <div className="list">
            {pz.zones.filter((z: any) => z.z !== 'Z1' && z.z !== 'Z5').map((z: any) => (
              <div key={z.z} className="item-row" style={{ minHeight: 44 }}>
                <span className="badge" style={{ color: 'var(--texto)', borderColor: zColor(z.z) }}>{z.z}</span>
                <span className="grow tn apoio">{z.lo}–{z.hi} bpm</span>
                <b className="tn">{z.pace ? E.paceStr(z.pace) + '/km' : '—'}{z.extrap ? <small className="muted"> ~est</small> : null}</b>
                <span className="apoio muted" style={{ width: 52, textAlign: 'right' }}>{z.z === 'Z2' || z.z === 'Z3' ? 'prova' : z.z === 'Z4' ? 'limiar' : ''}</span>
              </div>
            ))}
          </div>
          {sug ? <p className="apoio">Dia da prova (terminar bem): segure a FC na faixa <b>Z2–Z3</b> → ritmo estimado <b className="tn">{sug}</b>. Nas primeiras horas fique no lado leve (Z2); se sobrar perna no fim, suba para Z3.</p> : null}
          <p className="hint">Estimado da sua relação <b>FC × ritmo</b> de {pz.n} corridas {pzFromCycle ? <b>deste ciclo</b> : <>do <b>histórico</b> (ainda com menos de 3 corridas no ciclo)</>} (regressão linear). É referência de treino por zonas — não um tempo-alvo.</p>
        </>) : <p className="hint">Registre ao menos 3 corridas com FC média e distância para estimar o ritmo por zona.</p>}
      </Card>
      <Card>
        <CardH title="Zonas de FC da semana" />
        {mix ? (<>
          <div className="row" style={{ gap: 2, height: 10, borderRadius: 5, overflow: 'hidden' }} role="img" aria-label={E.M_ZONES.map((z: string) => z + ' ' + mix[z] + '%').join(', ')}>
            {E.M_ZONES.map((z: string) => mix[z] > 0 ? <span key={z} style={{ flex: mix[z], background: zColor(z), height: '100%' }} /> : null)}
          </div>
          <div className="list">{E.M_ZONES.map((z: string) => <div key={z} className="item-row" style={{ minHeight: 36, padding: '6px 0' }}><i style={{ width: 10, height: 10, borderRadius: 2, background: zColor(z) }} /><span className="grow apoio"><b>{z}</b> · {E.M_ZDESC[z]}</span><b className="tn">{mix[z]}%</b></div>)}</div>
          <p className="hint">Calculado a partir dos treinos que você lançou, ponderado pela duração.</p>
        </>) : <p className="hint">Lance treinos com zona de FC na semana para ver a distribuição aqui.</p>}
      </Card>
    </div>

    <div className="cols">
      <Card>
        <CardH title="Evolução do volume" />
        {bars.length ? <><BarChart label="Volume semanal de corrida neste ciclo" bars={bars} yfmt={(x) => String(Math.round(x))} threshold={{ y: peakTarget, label: 'pico ' + peakTarget + ' km' }} />
          <p className="hint">Volume semanal de corrida (km) <b>real deste ciclo</b>, por semana ISO. A linha tracejada é a meta de pico.</p></> : <p className="hint">Registre corridas neste ciclo para ver a evolução do volume.</p>}
      </Card>
      <Card>
        <CardH title="Tempo realista" right={<span className="badge neutro">Riegel</span>} />
        {faixa ? (
          <a className="item-row opcao-link" href={href('mais', 'simulador')}>
            <span className="grow stack" style={{ gap: 0 }}><span className="s">Hoje, seu tempo realista é de</span><b className="tn" style={{ fontWeight: 500, fontSize: 20 }}>{metaTxt(faixa.rapidoS)} a {metaTxt(faixa.lentoS)}</b></span>
            <span className="link">Simular meta</span>
          </a>
        ) : null}
        {estAnchor ? (<>
          <div className="tbl-wrap"><table><thead><tr><th scope="col">Trecho</th><th scope="col" className="n">Tempo</th><th scope="col" className="n">Pace</th></tr></thead>
            <tbody>{list.map((c) => { const t = E.riegel(estAnchor.distKm, estAnchor.durationSec, c.d); const isRace = Math.abs(c.d - race.distKm) < 0.3;
              return <tr key={c.lab + c.d} className={isRace ? 'best' : undefined}><td>{c.lab} <span className="muted">{km(c.d)} km</span>{isRace ? <span className="sr-only"> (sua prova)</span> : null}</td><td className="n"><Kpi doc="race prediction" value={E.hms(t)}>{E.hms(t)}</Kpi></td><td className="n">{E.paceStr(t / c.d)}/km</td></tr>; })}</tbody></table></div>
          <p className="hint">Projeção de Riegel a partir do seu melhor esforço {estAnchorCycle ? <b>deste ciclo</b> : 'recente (ainda sem teste/prova no ciclo)'} ({workoutTitle(estAnchor)} · {km(estAnchor.distKm)} km em {E.hms(estAnchor.durationSec)}). Estimativa, não garantia — o foco é <b>terminar bem</b>.</p>
        </>) : <p className="hint">Registre um teste ou prova neste ciclo para projetar os tempos de meia, do ciclo atual e da maratona.</p>}
      </Card>
    </div>

    <Card>
      <CardH title="Recordes do ciclo" />
      <div className="list">{records(cRuns).map((r) => <div key={r.lab} className="item-row"><div className="grow stack" style={{ gap: 0 }}><b style={{ fontWeight: 500 }}>{r.lab}</b><span className="s">{r.sub}</span></div><span className="val" style={{ fontSize: 17 }}>{r.val}</span></div>)}</div>
      <p className="hint">Melhores marcas <b>deste ciclo</b> ({dateBR(race.startDate)} → {dateBR(race.date)}). Preenche automaticamente conforme você registra as atividades.</p>
    </Card>
    <Anteriores />
  </>);
}
