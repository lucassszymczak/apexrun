// =============================================================================
// UI de revisão de uma atividade analisada: mostra métricas + conferência +
// splits, deixa o usuário ANOTAR (data, tipo, RPE, dor, obs) e então
// APROVAR (registra oficial) ou REJEITAR (guarda como 'rejected').
// Regra do treinador: nada é gravado até a confirmação explícita.
// =============================================================================

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { IngestResult, ParsedActivity, QualityIssue } from '@/core/types';
import { formatDuration, formatKm, formatPace } from '@/lib/format';
import { persistIngest, type ReviewInput } from './persist';

const TIPOS = [
  'longao',
  'qualidade',
  'rodagem',
  'regenerativo',
  'fartlek',
  'intervalado',
  'tempo',
  'bike',
  'forca',
  'mobilidade',
  'outro',
];

type Save =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'error'; message: string }
  | { status: 'saved'; official: boolean; replaced: number };

export function ReviewForm({
  filename,
  parsed,
  result,
  onReset,
  onSaved,
}: {
  filename: string;
  parsed: ParsedActivity;
  result: IngestResult;
  onReset: () => void;
  onSaved?: () => void;
}) {
  const { metrics, report } = result;

  const [data, setData] = useState(() => toLocalInput(parsed.device.start_time));
  const [tipo, setTipo] = useState('');
  const [rpe, setRpe] = useState('');
  const [dorFlag, setDorFlag] = useState(false);
  const [dorDesc, setDorDesc] = useState('');
  const [obs, setObs] = useState('');
  const [save, setSave] = useState<Save>({ status: 'idle' });

  const input: ReviewInput = useMemo(
    () => ({
      data: fromLocalInput(data),
      tipo: tipo || null,
      rpe: rpe ? Number(rpe) : null,
      dor_flag: dorFlag,
      dor_desc: dorFlag ? dorDesc.trim() || null : null,
      obs: obs.trim() || null,
    }),
    [data, tipo, rpe, dorFlag, dorDesc, obs],
  );

  async function persist(official: boolean) {
    if (!supabase) {
      setSave({ status: 'error', message: 'Supabase não configurado.' });
      return;
    }
    setSave({ status: 'saving' });
    try {
      const { replaced } = await persistIngest(supabase, { parsed, result, input, official });
      setSave({ status: 'saved', official, replaced });
      onSaved?.();
    } catch (err) {
      setSave({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (save.status === 'saved') {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-5 space-y-3">
        <p className="font-medium text-emerald-200">
          {save.official
            ? 'Atividade registrada como oficial.'
            : 'Atividade guardada como rejeitada (não oficial).'}
        </p>
        {save.replaced > 0 && (
          <p className="text-sm text-emerald-200/80">
            Substituiu {save.replaced} treino(s) do histórico na mesma data.
          </p>
        )}
        <button
          onClick={onReset}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
        >
          Analisar outro arquivo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <StatusBadge status={report.status} />
        <span className="text-slate-300 text-sm">{filename}</span>
        <span className="text-slate-500 text-sm">
          fonte: {report.source_format.toUpperCase()}
          {parsed.device.sport ? ` · ${parsed.device.sport}` : ''}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Distância" value={formatKm(metrics.distancia_total_m)} />
        <Stat label="Tempo (mov.)" value={formatDuration(metrics.duracao_movel_s)} />
        <Stat label="Pace médio" value={`${formatPace(metrics.pace_medio_s_por_km)}/km`} />
        <Stat label="GAP médio" value={`${formatPace(metrics.gap_medio_s_por_km)}/km`} />
        <Stat
          label="FC méd/máx"
          value={metrics.fc_media != null ? `${metrics.fc_media}/${metrics.fc_max}` : '—'}
        />
        <Stat
          label="Ganho elev."
          value={metrics.elevacao_ganho_m != null ? `${metrics.elevacao_ganho_m} m` : '—'}
        />
      </div>

      {metrics.cardiac_drift && metrics.cardiac_drift.delta_bpm != null && (
        <p className="text-sm text-slate-400">
          Deriva cardíaca: FC {metrics.cardiac_drift.fc_media_1a_metade}→
          {metrics.cardiac_drift.fc_media_2a_metade} bpm (Δ {metrics.cardiac_drift.delta_bpm}),{' '}
          {metrics.cardiac_drift.pace_estavel
            ? 'com pace estável (drift por fadiga)'
            : 'mas com pace variável (efeito de esforço, não drift puro)'}
          .
        </p>
      )}

      <IssuesPanel issues={report.issues} />
      <SplitsTable result={result} />

      {/* --- Anotações do usuário --- */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
        <h3 className="text-sm font-medium text-slate-300">Revisão e anotações</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Data/hora">
            <input
              type="datetime-local"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Tipo de treino">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input">
              <option value="">— selecione —</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="RPE (1–10)">
            <input
              type="number"
              min={1}
              max={10}
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Dor?">
            <label className="flex items-center gap-2 text-sm text-slate-300 h-[38px]">
              <input
                type="checkbox"
                checked={dorFlag}
                onChange={(e) => setDorFlag(e.target.checked)}
              />
              houve dor / desconforto
            </label>
          </Field>
          {dorFlag && (
            <Field label="Descrição da dor" full>
              <input
                type="text"
                value={dorDesc}
                onChange={(e) => setDorDesc(e.target.value)}
                placeholder="local, quando piora, inchaço…"
                className="input"
              />
            </Field>
          )}
          <Field label="Observações" full>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              className="input resize-none"
            />
          </Field>
        </div>

        {save.status === 'error' && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {save.message}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => void persist(true)}
            disabled={save.status === 'saving'}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {save.status === 'saving' ? 'Salvando…' : 'Aprovar e registrar'}
          </button>
          <button
            onClick={() => void persist(false)}
            disabled={save.status === 'saving'}
            className="rounded-lg border border-red-500/50 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-60"
          >
            Rejeitar
          </button>
          <button
            onClick={onReset}
            disabled={save.status === 'saving'}
            className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-60"
          >
            Descartar
          </button>
        </div>
        <p className="text-xs text-slate-600">
          Aprovar grava como oficial (com o veredito {report.status}). Rejeitar guarda o
          registro marcado como não oficial, para não reprocessar depois.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block space-y-1 ${full ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function SplitsTable({ result }: { result: IngestResult }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-slate-400">
          <tr>
            {['Km', 'Distância', 'Pace', 'FC méd', 'FC máx', 'Elev.+', 'GAP', ''].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.splits.map((s) => (
            <tr key={s.km_index} className="border-t border-slate-800">
              <td className="px-3 py-2 text-slate-300">{s.km_index}</td>
              <td className="px-3 py-2 text-slate-400">
                {s.parcial ? `${Math.round(s.distancia_m)} m` : '1,00 km'}
              </td>
              <td className="px-3 py-2 text-slate-200">{formatPace(s.pace_s_por_km)}</td>
              <td className="px-3 py-2 text-slate-300">{s.fc_media ?? '—'}</td>
              <td className="px-3 py-2 text-slate-300">{s.fc_max ?? '—'}</td>
              <td className="px-3 py-2 text-slate-400">
                {s.elevacao_ganho_m != null ? `${s.elevacao_ganho_m} m` : '—'}
              </td>
              <td className="px-3 py-2 text-slate-200">{formatPace(s.gap_s_por_km)}</td>
              <td className="px-3 py-2">
                {s.parcial && (
                  <span className="rounded bg-amber-400/15 text-amber-300 text-xs px-2 py-0.5">
                    parcial
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IssuesPanel({ issues }: { issues: QualityIssue[] }) {
  if (issues.length === 0) {
    return (
      <p className="text-sm text-emerald-300">Nenhum problema detectado na conferência.</p>
    );
  }
  const color: Record<QualityIssue['severidade'], string> = {
    info: 'border-slate-700 bg-slate-800/50 text-slate-300',
    warning: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    error: 'border-red-500/40 bg-red-500/10 text-red-200',
  };
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-slate-300">Conferência</h3>
      {issues.map((i, idx) => (
        <div key={idx} className={`rounded-lg border px-3 py-2 text-sm ${color[i.severidade]}`}>
          <span className="font-mono text-xs uppercase opacity-70">{i.severidade}</span>{' '}
          <span className="font-medium">{i.tipo}</span>
          {i.km_index != null ? ` (km ${i.km_index})` : ''}: {i.descricao}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: IngestResult['report']['status'] }) {
  const map = {
    ok: { label: 'OK', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
    warning: { label: 'ATENÇÃO', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
    rejected: { label: 'REJEITADO', cls: 'bg-red-500/15 text-red-300 border-red-500/40' },
  }[status];
  return (
    <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${map.cls}`}>
      {map.label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-slate-100 font-semibold">{value}</div>
    </div>
  );
}

// --- datetime-local <-> ISO --------------------------------------------------
function toLocalInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}
