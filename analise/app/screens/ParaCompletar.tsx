// "PARA COMPLETAR" (Fase 2 · Etapa 2): treinos que chegaram do Garmin e esperam o que só
// você sabe (RPE, sono e dor). Ficam numa fila no IndexedDB, fora de apex.analise.v1,
// até você tocar em "Salvar treino" (design/telas-fase2/Hoje.dc.html).
import { useEffect, useState } from 'react';
import { IconDeviceWatch, IconChevronRight, IconAlertTriangle, IconRefresh } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { href, go } from '../route';
import { Card } from '../ui';
import { dec, dayMon, typeName } from '../fmt';
import { queueGet, queueDel, type QueueItem } from '../db';
import { useGarminQueue, useGarminSync, avisoChave, resumoTexto, garminLocal } from '../garmin-sync';
import { TreinoForm } from './TreinoForm';

function linha(q: QueueItem): { t: string; n: string } {
  const w = q.w || {};
  const bk = E.isBike(w);
  const t = (bk ? (w.indoor ? 'Bike indoor' : 'Pedal') : 'Corrida') + ' · ' + dayMon(w.date);
  const n: string[] = [];
  if (w.distKm) n.push(dec(w.distKm, 2) + ' km');
  if (!bk && w.distKm && w.durationSec) n.push(E.paceStr(w.durationSec / w.distKm) + '/km');
  else if (w.durationSec) n.push(E.hms(w.durationSec));
  if (w.hrAvg) n.push(w.hrAvg + ' bpm');
  return { t, n: n.slice(0, 3).join(' · ') };
}

// Bloco do Hoje (some quando não há pendências nem aviso)
export function ParaCompletarCard() {
  const fila = useGarminQueue();
  const sync = useGarminSync();
  const aviso = avisoChave();
  const resumo = garminLocal().resumo;
  if (!fila.length && !aviso && !sync.rodando) return null;
  return (<>
    {aviso ? (
      <Card className="alert" role="status">
        <IconAlertTriangle size={20} stroke={1.75} color={`var(--${aviso.tom})`} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span className="grow">{aviso.texto}</span>
        <a className="link" href={href('mais', 'garmin')}>{aviso.tom === 'alerta' ? 'Renovar chave' : 'Ver'}</a>
      </Card>
    ) : null}
    {sync.rodando && sync.total ? <p className="apoio muted row" style={{ gap: 8 }} role="status"><IconRefresh size={16} stroke={1.75} aria-hidden="true" />Baixando do Garmin: {sync.feito} de {sync.total}</p> : null}
    {fila.length ? (
      <Card className="pc" aria-labelledby="pc-titulo">
        <div className="stack" style={{ gap: 2 }}>
          <div className="row" style={{ gap: 8 }}><IconDeviceWatch size={20} stroke={1.75} color="var(--atencao)" aria-hidden="true" /><h2 id="pc-titulo" className="lead">Para completar · {fila.length} do Garmin</h2></div>
          <span className="apoio muted">Falta só o que o relógio não grava: sono e dor. O RPE já veio do Garmin.</span>
        </div>
        <div className="list">
          {fila.slice(0, 5).map((q) => { const l = linha(q); return (
            <a key={q.id} className="item-row pc-item" href={href('completar', q.id)} aria-label={'Completar ' + l.t}>
              <div className="grow stack" style={{ gap: 2 }}><span className="t">{l.t}</span><span className="s tn">{l.n}</span></div>
              <span className="badge atencao">Para completar</span>
              <IconChevronRight size={18} stroke={1.75} className="faint" aria-hidden="true" />
            </a>); })}
        </div>
        {resumo && resumo.novos ? <span className="hint">Última sincronização: {resumoTexto(resumo)}</span> : null}
        <a className="btn-primary" href={href('completar', fila[0].id)}>Completar treino</a>
      </Card>
    ) : null}
  </>);
}

// Tela "Completar" de um treino da fila: o passo 3 do Importar já preenchido
export function Completar({ id }: { id: string }) {
  const [it, setIt] = useState<QueueItem | null | undefined>(undefined);
  useEffect(() => { queueGet(id).then(setIt); }, [id]);
  if (it === undefined) return <Card><p className="apoio muted" aria-busy="true">Abrindo…</p></Card>;
  if (!it) return (<Card><p className="apoio">Este treino já foi completado (talvez no outro aparelho).</p><a className="btn" href={href('hoje')}>Voltar ao Hoje</a></Card>);
  return (
    <TreinoForm key={it.id} prefill={it.w} track={it.track} fromFit hideResumo={false}
      step={'Do Garmin · ' + (E.isBike(it.w) ? 'pedal' : typeName(it.w.type).toLowerCase())}
      decided={{ choice: 'new' }} onCancel={() => go('hoje')}
      onSaved={(wid) => { queueDel(it.id).then(() => go('treino', wid)); }} />
  );
}
