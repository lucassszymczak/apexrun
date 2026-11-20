// IMPORTAR (botão "+"): 1 Arquivo (um ou vários .FIT; arrastar e soltar no computador)
// → 2 Conferência (o que foi lido, achados e duplicata) → 3 Completar → abre o Treino.
// Mesmo leitor e mesmas regras do app antigo; o trajeto vai junto para o IndexedDB.
import { useRef, useState } from 'react';
import { IconFileUpload, IconPencil, IconLoader2, IconCircleCheck, IconAlertTriangle, IconCloud, IconRoute, IconCopy, IconX } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { PageHead } from '../Shell';
import { Card, CardH, IC } from '../ui';
import { readFit, findDuplicate, type FitRead } from '../actions';
import { TreinoForm } from './TreinoForm';
import { href, go } from '../route';
import { dec, dur, dayMon, typeName } from '../fmt';

type Choice = 'new' | 'replace' | 'keep' | 'skip';

function Steps({ n }: { n: 1 | 2 | 3 }) {
  const L = ['Arquivo', 'Conferência', 'Completar'];
  return (
    <div className="row" style={{ gap: 6 }} role="img" aria-label={`Passo ${n} de 3: ${L[n - 1]}`}>
      {L.map((l, i) => (
        <div key={l} className="stack grow" style={{ gap: 4 }}>
          <i style={{ display: 'block', height: 4, borderRadius: 2, background: i < n ? 'var(--ciano)' : 'var(--superficie-2)' }} />
          <span className="cap" style={{ color: i === n - 1 ? 'var(--texto)' : undefined }}>{l}</span>
        </div>
      ))}
    </div>
  );
}

function Finding({ ok, warn, icon, children }: { ok?: boolean; warn?: boolean; icon?: any; children: any }) {
  const I = icon || (warn ? IconAlertTriangle : IconCircleCheck);
  return <li><I size={18} stroke={1.75} color={warn ? 'var(--atencao)' : ok === false ? 'var(--texto-3)' : 'var(--ok)'} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} /><span>{children}</span></li>;
}

// Conferência de um arquivo: o que foi lido, achados e duplicata
function Conferencia({ r, idx, total, onNext, onSkip }: { r: FitRead; idx: number; total: number; onNext: (c: { choice: Choice; matchId?: string }) => void; onSkip: () => void }) {
  const w = r.w, q = w.quality, tr = r.track;
  const dup = findDuplicate(w);
  const [choice, setChoice] = useState<Choice>(dup ? (dup.same ? 'replace' : 'keep') : 'new');
  const hm = (sec: number) => (sec >= 60 ? dec(Math.round(sec / 6) / 10, 1) + ' min' : Math.round(sec) + ' s');
  return (<>
    <PageHead title="Conferência" sub={`Passo 2 de 3${total > 1 ? ` · arquivo ${idx + 1} de ${total}` : ''}`} back={href('hoje')} right={null} />
    <Steps n={2} />
    <Card>
      <div className="row between"><span className="cap">{r.name}</span><span className="cap">{dayMon(w.date)} · {E.isBike(w) ? 'bike' + (w.indoor ? ' indoor' : '') : 'corrida'}</span></div>
      <div className="grid-4" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        {w.distKm ? <div className="stat"><span className="v">{dec(w.distKm, 2)}</span><span className="l">km</span></div> : null}
        <div className="stat"><span className="v">{dur(w.durationSec)}</span><span className="l">tempo</span></div>
        {w.hrAvg ? <div className="stat"><span className="v">{w.hrAvg}</span><span className="l">bpm médio</span></div> : null}
      </div>
    </Card>
    <Card>
      <CardH title="O que foi lido" />
      <ul className="insights apoio">
        <Finding>{[w.hrAvg ? 'FC' : null, w.cadence ? 'cadência' : null, w.gainM != null ? 'elevação' : null, tr && tr.hasGps ? 'trajeto' : null, w.splits ? w.splits.length + ' splits por km' : null, w.kcal ? 'calorias' : null].filter(Boolean).join(', ') || 'tempo'}</Finding>
        <Finding icon={IconRoute} ok={!!(tr && tr.hasGps)}>{tr && tr.hasGps ? 'Trajeto com GPS: vai para o mapa e o replay' : 'Sem GPS (esteira / bike indoor): o Treino mostra o gráfico no lugar do mapa'}</Finding>
      </ul>
    </Card>
    {q ? (
      <Card>
        <CardH title="Achados" />
        <ul className="insights apoio">
          <Finding warn={q.pauseSec > 0}>{q.pauseSec > 0 ? 'Pausas de ' + hm(q.pauseSec) + ' descontadas do tempo em movimento' : 'Sem pausas'}</Finding>
          <Finding warn={(q.interpSec || 0) + (q.invalidGapSec || 0) > 0}>{(q.interpSec || 0) + (q.invalidGapSec || 0) > 0 ? 'Lacunas de gravação: ' + hm(q.interpSec || 0) + ' interpoladas · ' + hm(q.invalidGapSec || 0) + ' inválidas' : 'Sem lacunas de gravação'}</Finding>
          <Finding warn={q.smart}>{q.smart ? 'Gravação inteligente (1 ponto a cada ' + dec(q.medianDt, 1) + ' s): confiança dos KPIs por amostra −1' : 'Gravação a cada segundo'}</Finding>
          {!q.hasHR || !q.hasCad || !q.hasAlt ? <Finding warn>{['FC', 'cadência', 'altitude'].filter((_, i) => ![q.hasHR, q.hasCad, q.hasAlt][i]).join(', ')} ausente(s) no arquivo</Finding> : null}
          <Finding warn={q.needsConfirm}>{dec(q.validMin, 1)} min válidos · {dec(q.excludedPct, 1)}% excluído dos KPIs{q.needsConfirm ? ' — confira antes de salvar' : ''}</Finding>
          {w.geo && w.geo.lat != null ? <Finding icon={IconCloud} warn={!w.weather}>{w.weather ? 'Clima do horário buscado: ' + (w.weather.tempC != null ? Math.round(w.weather.tempC) + ' °C' : '—') + (w.weather.dewC != null ? ' · orvalho ' + Math.round(w.weather.dewC) + '°' : '') + ' · ' + (w.weather.inStandard ? 'clima padrão' : 'fora do padrão') : 'Clima não obtido agora (sem conexão?)'}</Finding> : null}
        </ul>
      </Card>
    ) : null}
    <Card>
      <CardH icon={<IconCopy {...IC} />} title={dup ? (dup.same ? 'Parece ser um treino já salvo' : 'Já existe um treino nesta data') : 'Nenhum outro treino nesta data'} />
      {dup ? (<>
        <p className="apoio muted">{dayMon(dup.match.date)} · {dup.match.distKm ? dec(dup.match.distKm, 2) + ' km · ' : ''}{E.isBike(dup.match) ? 'Bike' : typeName(dup.match.type)} · {dur(dup.match.durationSec)}</p>
        <div className="seg" role="group" aria-label="O que fazer" style={{ flexWrap: 'wrap', alignSelf: 'flex-start' }}>
          {([['replace', 'Substituir'], ['keep', 'Manter os dois'], ['skip', 'Cancelar este arquivo']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={choice === k} onClick={() => setChoice(k)}>{l}</button>)}
        </div>
        {choice === 'replace' ? <p className="hint">O treino salvo será trocado por este (RPE, notas e o resto vêm do que você preencher a seguir). Para só ver o mapa de um treino antigo, use <b>Reimportar .FIT</b> no próprio treino — ele não muda nada.</p> : null}
      </>) : <p className="apoio muted">Este arquivo vira um treino novo.</p>}
    </Card>
    <div className="row wrap">
      <button type="button" className="btn-primary grow" onClick={() => (choice === 'skip' ? onSkip() : onNext({ choice, matchId: dup ? dup.match.id : undefined }))}>{choice === 'skip' ? (idx + 1 < total ? 'Pular para o próximo' : 'Concluir') : 'Continuar'}</button>
      {choice !== 'skip' && total > 1 ? <button type="button" className="btn quiet" onClick={onSkip}><IconX size={18} stroke={1.75} aria-hidden="true" />Pular</button> : null}
    </div>
  </>);
}

export function Importar() {
  const [queue, setQueue] = useState<FitRead[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'pick' | 'conf' | 'form' | 'manual'>('pick');
  const [decided, setDecided] = useState<{ choice: Choice; matchId?: string } | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const readAll = async (list: FileList | File[] | null) => {
    const files = Array.from(list || []).filter((f) => /\.fit$/i.test(f.name) || f.type === 'application/octet-stream' || !f.type);
    if (!files.length) return;
    const ok: FitRead[] = [], bad: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setBusy('Lendo ' + files[i].name + (files.length > 1 ? ` (${i + 1} de ${files.length})` : '') + '…');
      try { ok.push(await readFit(files[i])); } catch (e: any) { bad.push(files[i].name + ': ' + (e && e.message ? e.message : String(e))); }
    }
    setBusy(null); setFailed(bad);
    if (ok.length) { ok.sort((a, b) => (a.w.date < b.w.date ? -1 : 1)); setQueue(ok); setIdx(0); setSavedIds([]); setPhase('conf'); }
  };
  const next = (saved?: string) => {
    const ids = saved ? [...savedIds, saved] : savedIds;
    setSavedIds(ids); setDecided(null);
    if (idx + 1 < queue.length) { setIdx(idx + 1); setPhase('conf'); window.scrollTo(0, 0); return; }
    // fim da fila: abre o Treino (o último salvo) ou volta para a lista
    setQueue([]); setPhase('pick');
    if (ids.length === 1) go('treino', ids[0]); else if (ids.length) go('treinos'); else go('hoje');
  };

  if (phase === 'manual') return <TreinoForm step="Registro à mão" onCancel={() => setPhase('pick')} />;
  if (phase === 'conf' && queue[idx]) return <Conferencia key={idx} r={queue[idx]} idx={idx} total={queue.length} onNext={(c) => { setDecided(c); setPhase('form'); window.scrollTo(0, 0); }} onSkip={() => next()} />;
  if (phase === 'form' && queue[idx]) {
    const r = queue[idx];
    return (<>
      <TreinoForm key={idx} top={<Steps n={3} />} prefill={r.w} track={r.track} fromFit step={`Passo 3 de 3 · completar${queue.length > 1 ? ` · arquivo ${idx + 1} de ${queue.length}` : ''}`}
        decided={decided && decided.choice !== 'skip' ? (decided as any) : null} onCancel={() => setPhase('conf')} onSaved={(id) => next(id)} />
    </>);
  }

  return (<>
    <PageHead title="Importar treino" sub="Passo 1 de 3 · arquivo" back={href('hoje')} right={null} />
    <Steps n={1} />
    <Card
      onDragOver={(e: any) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e: any) => { e.preventDefault(); setDrag(false); readAll(e.dataTransfer.files); }}
      style={{ border: '1px dashed ' + (drag ? 'var(--ciano)' : 'var(--linha)'), alignItems: 'center', textAlign: 'center', padding: '32px 16px' }}>
      <IconFileUpload size={36} stroke={1.5} color="var(--ciano)" aria-hidden="true" />
      <h2 className="lead">Escolha um ou vários .FIT do relógio</h2>
      <p className="apoio muted">Distância, FC, cadência, elevação, splits, trajeto e a análise por amostra entram sozinhos.<span className="only-desk"> Você também pode arrastar os arquivos para cá.</span></p>
      <input ref={input} type="file" multiple accept=".fit,.FIT,application/octet-stream" className="sr-only" id="fitFile" onChange={(e) => { readAll(e.target.files); e.target.value = ''; }} />
      <button type="button" className="btn-primary" onClick={() => input.current?.click()} disabled={!!busy}>
        {busy ? <IconLoader2 {...IC} aria-hidden="true" /> : <IconFileUpload {...IC} aria-hidden="true" />}{busy ? 'Lendo…' : 'Escolher .FIT'}
      </button>
      <div role="status" aria-live="polite" className="apoio muted">{busy || ''}</div>
      {failed.length ? <div role="alert" className="apoio" style={{ color: 'var(--alerta)' }}>{failed.map((f) => <p key={f}>Não foi possível ler {f}</p>)}<p className="muted">Você ainda pode registrar à mão.</p></div> : null}
    </Card>
    <Card>
      <CardH icon={<IconPencil {...IC} />} title="Sem arquivo?" />
      <p className="apoio muted">Registre o treino à mão: distância, tempo, FC e, se tiver, os splits por km.</p>
      <button type="button" className="btn quiet" onClick={() => setPhase('manual')} style={{ alignSelf: 'flex-start' }}>Registrar à mão</button>
    </Card>
  </>);
}
