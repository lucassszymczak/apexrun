// Formulário de treino — "Completar" (depois do .FIT), registro à mão e edição.
// Mesmos campos e regras do modal do app antigo (openModal/saveModal), no layout
// aprovado (design/telas/Importar.dc.html).
import { useMemo, useRef, useState } from 'react';
import { IconCircleCheck, IconAlertTriangle, IconCloud, IconChevronLeft, IconPhotoPlus, IconX } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { useApex } from '../store';
import { href, go } from '../route';
import { Card, CardH, Sheet, StateBadge } from '../ui';
import { dec, dur, dayMon, typeName } from '../fmt';
import { putPhoto, type PhotoRec } from '../db';
import { preparePhoto, OFF_ROUTE_SEC } from '../photos';
import { privacyOf, privacyLabel, type Privacy } from '../privacy';
import { PrivacySheet, PrivacyIcon } from './Privacidade';
import { CampoEquip } from './Equipamentos';
import { padraoPara } from '../../equipamentos.mjs';
import { RUN_TYPES, BIKE_TYPES, formFrom, extrasOf, buildWorkout, findDuplicate, commitWorkout, type FormVals } from '../actions';

// decided: escolha feita na Conferência quando o arquivo coincide com um treino já salvo
type Props = { id?: string | null; prefill?: any; fromFit?: boolean; onCancel?: () => void; step?: string;
  track?: any; decided?: { choice: 'new' | 'replace' | 'keep'; matchId?: string } | null; onSaved?: (id: string) => void; hideResumo?: boolean; top?: any };

function Field({ id, label, help, children }: { id: string; label: string; help?: string; children: any }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}{help ? <span className="help">{help}</span> : null}</div>;
}

export function TreinoForm({ id = null, prefill = null, fromFit = false, onCancel, step, track = null, decided = null, onSaved, hideResumo, top }: Props) {
  const { st } = useApex();
  const w = id ? st.workouts.find((x: any) => x.id === id) : null;
  const src = w || prefill || null;
  const extras = useMemo(() => extrasOf(src), [src]);
  const [f, setF] = useState<FormVals>(() => formFrom(src));
  const [err, setErr] = useState<string | null>(null);
  const [dup, setDup] = useState<{ w: any; match: any; same: boolean } | null>(null);
  const set = (k: string, v: string | boolean) => setF((o) => ({ ...o, [k]: v }));
  // Fase 5: equipamento (treino salvo: o que já tinha; novo: o padrão da modalidade)
  const [gear, setGear] = useState<string>(() => (w ? w.gearId || '' : (src && src.gearId) || padraoPara(String(formFrom(src).modal), st.athlete && st.athlete.equipamentos, st.workouts) || ''));
  // privacidade (vem do padrão) e fotos do percurso (Etapa 3)
  const [priv, setPriv] = useState<Privacy>(() => privacyOf(src, st.athlete));
  const [privTouched, setPrivTouched] = useState(false);
  const [privOpen, setPrivOpen] = useState(false);
  const [pend, setPend] = useState<(PhotoRec & { url: string })[]>([]);
  const [reading, setReading] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const addPend = async (files: FileList | null) => {
    const list = files ? Array.from(files) : []; if (!list.length) return;
    setReading(true);
    const out: (PhotoRec & { url: string })[] = [];
    for (const file of list) { try { const p = await preparePhoto(file, track || null); out.push({ ...p, url: URL.createObjectURL(p.blob) }); } catch { /* imagem que não abre fica de fora */ } }
    setPend((cur) => [...cur, ...out]); setReading(false);
  };
  const where = (p: PhotoRec) => (p.off || p.i == null ? 'fora do percurso' : track && track.dist[p.i] != null ? 'no km ' + (track.dist[p.i] / 1000).toFixed(1).replace('.', ',') : 'no trajeto');
  const savePhotos = (wid: string) => { pend.forEach(({ url, ...p }) => { URL.revokeObjectURL(url); putPhoto({ ...p, wid }).catch(() => {}); }); };
  const isBk = f.modal === 'bike';
  const types = isBk ? BIKE_TYPES : RUN_TYPES;
  const back = onCancel ? undefined : w ? href('treino', w.id) : href('treinos');

  if (id && !w) return <Card><p className="muted">Treino não encontrado.</p></Card>;

  const save = () => {
    // treino novo: guarda a privacidade escolhida (o padrão, se não mexeu); edição: só se mudou ou já tinha
    const ex0 = !w || privTouched || (w && w.privacy) ? { ...extras, privacy: priv } : extras;
    const gOk = gear && ((st.athlete && st.athlete.equipamentos) || []).some((e: any) => e.id === gear && (e.tipo === 'bike') === (f.modal === 'bike'));
    const ex = { ...ex0, gearId: gOk ? gear : null };
    const r = buildWorkout(f, ex, w ? w.id : null);
    if ('error' in r) { setErr(r.error); return; }
    setErr(null);
    const done = (wid: string) => { savePhotos(wid); return onSaved ? onSaved(wid) : go('treino', wid); };
    if (w) { commitWorkout(r.w, 'edit'); done(r.w.id); return; }
    if (decided) { commitWorkout(r.w, decided.choice, decided.matchId, track); done(r.w.id); return; }
    const d = findDuplicate(r.w);
    if (d) { setDup({ w: r.w, match: d.match, same: d.same }); return; }
    commitWorkout(r.w, 'new', undefined, track); done(r.w.id);
  };
  const pick = (choice: 'replace' | 'keep' | 'cancel') => {
    const d = dup!; setDup(null);
    if (choice === 'cancel') return; // mantém o formulário aberto para ajustes
    commitWorkout(d.w, choice, d.match.id, track); savePhotos(d.w.id); if (onSaved) onSaved(d.w.id); else go('treino', d.w.id);
  };

  const inp = (k: string, props: Record<string, any> = {}) => (
    <input id={'f_' + k} value={String(f[k] ?? '')} onChange={(e) => set(k, e.target.value)} {...props} />
  );

  // ---------------- resumo do arquivo (conferência) ----------------
  const q = src && src.quality;
  const sameDay = prefill ? st.workouts.filter((x: any) => x.date === f.date) : [];
  const resumo = fromFit && prefill && !hideResumo ? (
    <Card>
      <div className="row between"><span className="cap">Arquivo lido</span><span className="cap">{dayMon(prefill.date)} · {E.isBike(prefill) ? 'bike' : 'corrida'}</span></div>
      <div className="grid-4" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        {prefill.distKm ? <div className="stat"><span className="v">{dec(prefill.distKm, 2)}</span><span className="l">km</span></div> : null}
        <div className="stat"><span className="v">{dur(prefill.durationSec)}</span><span className="l">tempo</span></div>
        {prefill.hrAvg ? <div className="stat"><span className="v">{prefill.hrAvg}</span><span className="l">bpm médio</span></div> : null}
      </div>
      <ul className="insights apoio">
        <li><IconCircleCheck size={18} stroke={1.75} color="var(--ok)" aria-hidden="true" /><span>{E.isBike(prefill)
          ? 'Bike lida do .FIT: tempo, FC, zonas e calorias já entraram — vai para a carga (TRIMP) e a forma.'
          : 'Dados do relógio já entraram: distância, FC, cadência, elevação' + (prefill.splits ? ' e ' + prefill.splits.length + ' splits por km' : '') + '.'}</span></li>
        {q ? <li>{q.needsConfirm ? <IconAlertTriangle size={18} stroke={1.75} color="var(--alerta)" aria-hidden="true" /> : <IconCircleCheck size={18} stroke={1.75} color="var(--ok)" aria-hidden="true" />}
          <span>{q.needsConfirm ? <b>Confira: </b> : null}{dec(q.validMin, 1)} min válidos · pausas {Math.round((q.pauseSec || 0) / 6) / 10} min{q.smart ? ' · gravação inteligente (confiança −1)' : ''}{!q.hasHR ? ' · sem FC' : ''}{!q.hasCad ? ' · sem cadência' : ''}{!q.hasAlt ? ' · sem altitude' : ''} · {dec(q.excludedPct, 1)}% excluído dos KPIs</span></li> : null}
        {!E.isBike(prefill) && prefill.geo && prefill.geo.lat != null ? <li><IconCloud size={18} stroke={1.75} color={prefill.weather ? 'var(--ok)' : 'var(--atencao)'} aria-hidden="true" /><span>{prefill.weather
          ? 'Clima do horário buscado: ' + (prefill.weather.tempC != null ? Math.round(prefill.weather.tempC) + ' °C' : '—') + (prefill.weather.dewC != null ? ' · orvalho ' + Math.round(prefill.weather.dewC) + '°' : '') + ' · ' + (prefill.weather.inStandard ? 'clima padrão' : 'fora do padrão')
          : 'Clima não obtido agora (sem conexão?).'}</span></li> : null}
        <li>{sameDay.length ? <IconAlertTriangle size={18} stroke={1.75} color="var(--atencao)" aria-hidden="true" /> : <IconCircleCheck size={18} stroke={1.75} color="var(--ok)" aria-hidden="true" />}
          <span>{sameDay.length ? 'Já existe ' + sameDay.length + ' treino nesta data — ao salvar, você escolhe substituir ou manter os dois.' : 'Nenhum outro treino nesta data'}</span></li>
      </ul>
    </Card>
  ) : null;

  return (<>
    <header className="topbar page">
      <div className="brand">
        {onCancel ? <button className="back" onClick={onCancel} aria-label="Cancelar"><IconChevronLeft size={24} stroke={1.75} /></button>
          : <a className="back" href={back} aria-label="Cancelar"><IconChevronLeft size={24} stroke={1.75} /></a>}
        <div className="stack" style={{ gap: 0 }}><h1>{w ? 'Editar treino' : 'Novo treino'}</h1>{step ? <span className="sub">{step}</span> : null}</div>
      </div>
    </header>
    {top}
    <form className="col" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
      {resumo}
      <Card>
        <CardH title="Tipo de treino" />
        <div className="seg" role="group" aria-label="Modalidade" style={{ alignSelf: 'flex-start' }}>
          {[['corrida', 'Corrida'], ['bike', 'Bike']].map(([k, l]) => <button key={k} type="button" aria-pressed={f.modal === k} onClick={() => { set('modal', k); set('type', k === 'bike' ? 'bike' : 'facil'); setGear(padraoPara(k, st.athlete && st.athlete.equipamentos, st.workouts) || ''); }}>{l}</button>)}
        </div>
        <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="Tipo">
          {types.map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={f.type === k} onClick={() => set('type', k)}>{l}</button>)}
        </div>
        {isBk ? <label className="switch"><span>Bike indoor (sem distância)</span><input type="checkbox" role="switch" checked={!!f.indoor} onChange={(e) => set('indoor', e.target.checked)} /></label> : null}
      </Card>

      <Card>
        <h2 className="lead">Equipamento</h2>
        <CampoEquip modal={f.modal as string} gear={gear} setGear={setGear} distKm={+String(f.dist || '').replace(',', '.') || 0} wid={w ? w.id : null} />
      </Card>

      <Card>
        <div className="stack" style={{ gap: 2 }}><h2 className="lead">Percepção e recuperação</h2><p className="apoio muted">Só você sabe; o relógio não grava.</p></div>
        <div className="field">
          <span className="lab" id="rpe-l">Esforço (RPE)</span>
          <div className="row" style={{ gap: 4, flexWrap: 'wrap' }} role="group" aria-labelledby="rpe-l">
            {Array.from({ length: 11 }, (_, i) => String(i)).map((n) => (
              <button key={n} type="button" className="chip" style={{ minWidth: 44, justifyContent: 'center', padding: '6px 0' }} aria-pressed={f.rpe === n} onClick={() => set('rpe', f.rpe === n ? '' : n)}>{n}</button>
            ))}
          </div>
          <div className="row between help"><span>muito leve</span><span>máximo</span></div>
        </div>
        <div className="form-grid">
          <Field id="f_sleep" label="Sono na véspera (h)">{inp('sleep', { type: 'number', step: '0.5', inputMode: 'decimal', placeholder: 'ex.: 7,5' })}</Field>
          <Field id="f_sore" label="Dor muscular (0–10)">{inp('sore', { type: 'number', min: 0, max: 10, inputMode: 'numeric', placeholder: 'ex.: 2' })}</Field>
        </div>
        <label className="switch"><span className="stack" style={{ gap: 0 }}><span>Dor articular ou suspeita de lesão</span><span className="help">Liga o alerta de recuo no Hoje</span></span>
          <input type="checkbox" role="switch" checked={!!f.pain} onChange={(e) => set('pain', e.target.checked)} /></label>
      </Card>

      <Card>
        <CardH title="Hidratação (ml)" />
        <div className="form-grid g3" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          <Field id="f_waterB" label="Antes">{inp('waterB', { type: 'number', inputMode: 'numeric', placeholder: '0' })}</Field>
          <Field id="f_waterD" label="Durante">{inp('waterD', { type: 'number', inputMode: 'numeric', placeholder: '0' })}</Field>
          <Field id="f_waterA" label="Depois">{inp('waterA', { type: 'number', inputMode: 'numeric', placeholder: '0' })}</Field>
        </div>
      </Card>

      {!w ? (
        <Card>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div className="stack" style={{ gap: 2 }}><h2 className="lead">Fotos do percurso</h2><p className="apoio muted">{track ? 'Encaixadas no mapa pelo horário' : 'Sem trajeto: ficam em Fora do percurso'}</p></div>
            <button type="button" className="btn" style={{ minHeight: 40 }} onClick={() => photoInput.current?.click()} disabled={reading}><IconPhotoPlus size={18} stroke={1.75} aria-hidden="true" />{reading ? 'Lendo…' : 'Adicionar'}</button>
          </div>
          <input ref={photoInput} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { addPend(e.target.files); e.target.value = ''; }} />
          {pend.length ? <div className="photos-row">{pend.map((p, k) => (
            <figure key={p.id} className="photo-fig">
              <button type="button" onClick={() => { URL.revokeObjectURL(p.url); setPend(pend.filter((x) => x.id !== p.id)); }} aria-label={'Tirar a foto ' + (k + 1) + ' (' + where(p) + ')'} style={{ position: 'relative' }}>
                <img src={p.url} alt="" /><IconX size={16} stroke={2} aria-hidden="true" style={{ position: 'absolute', top: 4, right: 4, color: 'var(--texto)', background: 'var(--painel-mapa)', borderRadius: 999 }} />
              </button>
              <figcaption>{where(p)}</figcaption>
            </figure>))}</div> : <p className="hint">Opcional. A hora da foto encontra o ponto do trajeto; fotos a mais de {OFF_ROUTE_SEC / 60} min do treino vão para Fora do percurso.</p>}
        </Card>
      ) : null}

      <Card>
        <Field id="f_notes" label="Notas">{<textarea id="f_notes" value={String(f.notes)} onChange={(e) => set('notes', e.target.value)} placeholder="ex.: corpo aguentava, fôlego cansou" />}</Field>
      </Card>

      <details className="acc" open={!fromFit}>
        <summary>Dados do treino<span className="apoio muted" style={{ fontWeight: 400 }}>{fromFit ? 'vindos do relógio' : ''}</span><span className="chev" aria-hidden="true">›</span></summary>
        <div className="body">
          <div className="form-grid">
            <Field id="f_date" label="Data">{inp('date', { type: 'date' })}</Field>
            <Field id="f_dist" label={isBk ? 'Distância (km) — opcional na indoor' : 'Distância (km)'}>{inp('dist', { type: 'number', step: '0.01', inputMode: 'decimal', placeholder: '8,0' })}</Field>
            <Field id="f_dur" label="Duração" help="mm:ss ou h:mm:ss">{inp('dur', { type: 'text', placeholder: '45:30' })}</Field>
            <Field id="f_hr" label="FC média (bpm)">{inp('hr', { type: 'number', inputMode: 'numeric', placeholder: '150' })}</Field>
            <Field id="f_hrmax" label="FC máxima (bpm)">{inp('hrmax', { type: 'number', inputMode: 'numeric', placeholder: '176' })}</Field>
            {!isBk ? <Field id="f_cad" label="Cadência (spm)">{inp('cad', { type: 'number', inputMode: 'numeric', placeholder: '168' })}</Field>
              : <Field id="f_kcal" label="Calorias (kcal)">{inp('kcal', { type: 'number', inputMode: 'numeric', placeholder: '316' })}</Field>}
            <Field id="f_gain" label="Ganho de elevação (m)">{inp('gain', { type: 'number', inputMode: 'numeric', placeholder: '60' })}</Field>
            <Field id="f_loss" label="Perda de elevação (m)">{inp('loss', { type: 'number', inputMode: 'numeric', placeholder: '55' })}</Field>
            <Field id="f_temp" label="Temperatura (°C)">{inp('temp', { type: 'number', inputMode: 'decimal', placeholder: '18' })}</Field>
            <Field id="f_terrain" label="Terreno">{inp('terrain', { type: 'text', placeholder: 'ondulado' })}</Field>
            {!isBk ? <Field id="f_dec" label="Decoupling (%)" help="se você já tiver">{inp('dec', { type: 'number', step: '0.1', inputMode: 'decimal', placeholder: 'ex.: 5,0' })}</Field> : null}
          </div>
          {!isBk ? <Field id="f_splits" label="Splits por km" help="1 linha por km — tempo[, FC][, Δelev m]. Ex.: 6:36, 168, 12">
            <textarea id="f_splits" value={String(f.splits)} onChange={(e) => set('splits', e.target.value)} placeholder={'6:36, 168, 12\n6:31, 172, -8'} /></Field> : null}
        </div>
      </details>

      <Card className="priv-row">
        <PrivacyIcon p={priv} size={22} />
        <div className="stack grow" style={{ gap: 0 }}><span>Privacidade</span><span className="apoio muted">{privacyLabel(priv)}</span></div>
        <button type="button" className="btn quiet" style={{ minHeight: 40 }} onClick={() => setPrivOpen(true)}>Alterar</button>
      </Card>

      {err ? <Card className="alert" role="alert"><IconAlertTriangle size={20} stroke={1.75} color="var(--alerta)" aria-hidden="true" /><span>{err}</span></Card> : null}
      <button type="submit" className="btn-primary">{isBk ? 'Salvar bike' : 'Salvar treino'}</button>
    </form>

    {privOpen ? <PrivacySheet value={priv} onClose={() => setPrivOpen(false)} onSave={(p) => { setPriv(p); setPrivTouched(true); }} /> : null}
    {dup ? (
      <Sheet title="Treino duplicado?" onClose={() => pick('cancel')}>
        <p>Já existe um treino em <b>{dayMon(dup.w.date)}</b> — {dup.match.distKm ? dec(dup.match.distKm, 2) + ' km · ' : ''}{E.isBike(dup.match) ? (dup.match.indoor ? 'Bike indoor' : 'Bike') : typeName(dup.match.type)}. {dup.same ? <b>Parece ser o mesmo treino.</b> : 'Foi uma segunda sessão no dia?'} O que fazer?</p>
        <div className="row wrap"><StateBadge tone={dup.same ? 'atencao' : 'neutro'}>{dup.same ? 'provável duplicata' : 'mesma data'}</StateBadge></div>
        <button className="btn" onClick={() => pick('replace')}>Substituir</button>
        <button className="btn quiet" onClick={() => pick('keep')}>Manter os dois</button>
        <button className="btn quiet" onClick={() => pick('cancel')}>Cancelar</button>
      </Sheet>
    ) : null}
  </>);
}

