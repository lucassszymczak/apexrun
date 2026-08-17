import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { UploadAnalyzer } from '@/features/ingest/UploadAnalyzer';

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

/** Decide o que mostrar: configuração faltando → login → app. */
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

function AppShell() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Apex Performance</h1>
            <p className="text-sm text-slate-500">
              Conferência de treinos · upload e análise (.FIT/.TCX/.GPX)
            </p>
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
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <UploadAnalyzer />
      </main>
    </div>
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
