import { useState } from 'react';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { UploadAnalyzer } from '@/features/ingest/UploadAnalyzer';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { PreviewDashboard } from '@/features/dashboard/preview';

export default function App() {
  // Preview de dashboards só em desenvolvimento (eliminado do build de produção,
  // pois o ramo depende de import.meta.env.DEV === false lá).
  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.location.hash === '#preview'
  ) {
    return <PreviewDashboard />;
  }
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate() {
  const { configured, loading, session } = useAuth();
  if (!configured) return <ConfigNeeded />;
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
        Carregando…
      </div>
    );
  }
  if (!session) return <LoginScreen />;
  return <AppShell />;
}

type Tab = 'conferencia' | 'dashboards';

function AppShell() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboards');
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto max-w-5xl px-6 pt-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Apex Performance</h1>
            <p className="text-sm text-slate-500">Conferência e dashboards de treino</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">{user?.email}</div>
            <button
              onClick={() => void signOut()}
              className="text-xs text-slate-400 hover:text-slate-200 underline"
            >
              Sair
            </button>
          </div>
        </div>
        <nav className="mx-auto max-w-5xl px-6 flex gap-1 mt-3">
          <TabButton active={tab === 'dashboards'} onClick={() => setTab('dashboards')}>
            Dashboards
          </TabButton>
          <TabButton active={tab === 'conferencia'} onClick={() => setTab('conferencia')}>
            Conferência
          </TabButton>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        {tab === 'conferencia' ? (
          <UploadAnalyzer
            onSaved={() => {
              setReloadKey((k) => k + 1);
              setTab('dashboards');
            }}
          />
        ) : (
          <Dashboard reloadKey={reloadKey} />
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? 'border-emerald-400 text-slate-100'
          : 'border-transparent text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function ConfigNeeded() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <div className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold">Configuração necessária</h1>
        <p className="text-sm text-slate-400">
          Faltam as chaves do Supabase. Copie <code className="text-slate-200">.env.example</code>{' '}
          para <code className="text-slate-200">.env</code> e preencha{' '}
          <code className="text-slate-200">VITE_SUPABASE_URL</code> e{' '}
          <code className="text-slate-200">VITE_SUPABASE_ANON_KEY</code> (Project Settings → API),
          depois reinicie <code className="text-slate-200">npm run dev</code>.
        </p>
      </div>
    </div>
  );
}
