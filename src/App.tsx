import { UploadAnalyzer } from '@/features/ingest/UploadAnalyzer';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <h1 className="text-xl font-semibold">Apex Performance</h1>
          <p className="text-sm text-slate-500">
            Conferência de treinos · upload e análise de arquivo (.FIT/.TCX/.GPX)
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <UploadAnalyzer />
      </main>
    </div>
  );
}
