// =============================================================================
// Upload + análise de um arquivo de atividade (.FIT/.TCX/.GPX), 100% no browser.
// Parseia, roda os cálculos + conferência e entrega para a UI de revisão
// (ReviewForm), onde o usuário anota e aprova/rejeita (persistência).
// =============================================================================

import { useCallback, useRef, useState } from 'react';
import type { IngestResult, ParsedActivity } from '@/core/types';
import { ReviewForm } from './ReviewForm';

type State =
  | { status: 'idle' }
  | { status: 'loading'; filename: string }
  | { status: 'error'; filename: string; message: string }
  | { status: 'done'; filename: string; parsed: ParsedActivity; result: IngestResult };

export function UploadAnalyzer({ onSaved }: { onSaved?: () => void }) {
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
      const { parsed, result } = await ingestActivityBytes(file.name, bytes);
      setState({ status: 'done', filename: file.name, parsed, result });
    } catch (err) {
      setState({
        status: 'error',
        filename: file.name,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  if (state.status === 'done') {
    return (
      <ReviewForm
        filename={state.filename}
        parsed={state.parsed}
        result={state.result}
        onReset={reset}
        onSaved={onSaved}
      />
    );
  }

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
          O arquivo é analisado localmente no seu navegador; só é gravado quando você aprova.
        </p>
      </div>

      {state.status === 'loading' && (
        <p className="text-slate-400">Analisando {state.filename}…</p>
      )}

      {state.status === 'error' && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
          <p className="font-medium text-red-300">Erro ao ler {state.filename}</p>
          <p className="text-sm text-red-200/80 mt-1">{state.message}</p>
        </div>
      )}
    </div>
  );
}
