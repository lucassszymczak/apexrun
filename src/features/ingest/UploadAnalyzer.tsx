// =============================================================================
// Upload + análise de um arquivo de atividade (.FIT/.TCX/.GPX), 100% no browser.
// Parseia, roda os cálculos por km e a camada de conferência, e mostra o
// resultado. Persistência + aprovar/rejeitar/anotar ficam para o Passo 3.
// =============================================================================

import { useCallback, useRef, useState } from 'react';
import type { IngestResult, QualityIssue } from '@/core/types';
import { formatDuration, formatKm, formatPace } from '@/lib/format';

type State =
  | { status: 'idle' }
  | { status: 'loading'; filename: string }
  | { status: 'error'; filename: string; message: string }
  | { status: 'done'; filename: string; result: IngestResult };

export function UploadAnalyzer() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const analyze = useCallback(async (file: File) => {
    setState({ status: 'loading', filename: file.name });
    try {
      const bytes = await file.arrayBuffer();
      // Import dinâmico: o parser .FIT é pesado (perfil Garmin) e só é
      // necessário quando há um arquivo — fica fora do bundle inicial.
      const { ingestActivityBytes } = await import('@/core/ingest');
      const { result } = await ingestActivityBytes(file.name, bytes);
      setState({ status: 'done', filename: file.name, result });
    } catch (err) {
      setState({
        status: 'error',
        filename: file.name,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void analyze(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? 'border-emerald-400 bg-emerald-400/5'
            : 'border-slate-700 hover:border-slate-500'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".fit,.gpx,.tcx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void analyze(file);
          }}
        />
        <p className="text-slate-200 font-medium">
          Arraste um arquivo .FIT / .TCX / .GPX ou clique para escolher
        </p>
        <p className="text-slate-500 text-sm mt-1">
          O arquivo é analisado localmente no seu navegador — nada é enviado ainda.
        </p>
      </div>

      {state.status === 'loading' && (
        <p className="text-slate-400">Analisando {state.filename}…</p>
      )}

      {state.status === 'error' && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
          <p className="font-medium text-red-300">
            Erro ao ler {state.filename}
          </p>
          <p className="text-sm text-red-200/80 mt-1">{state.message}</p>
        </div>
      )}

      {state.status === 'done' && (
        <ResultView filename={state.filename} result={state.result} />
      )}
    </div>
  );
}

function ResultView({ filename, result }: { filename: string; result: IngestResult }) {
  const { metrics, report, device } = result;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <StatusBadge status={report.status} />
        <span className="text-slate-300 text-sm">{filename}</span>
        <span className="text-slate-500 text-sm">
          fonte: {report.source_format.toUpperCase()}
          {device.sport ? ` · ${device.sport}` : ''}
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
    </div>
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
      <p className="text-sm text-emerald-300">
        Nenhum problema detectado na conferência.
      </p>
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
