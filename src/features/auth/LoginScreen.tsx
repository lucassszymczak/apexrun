import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthProvider';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    if (error) setError(error);
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Apex Performance</h1>
          <p className="text-sm text-slate-500">Entre com seu email e senha.</p>
        </div>

        <label className="block space-y-1">
          <span className="text-xs text-slate-400">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-slate-400">Senha</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
          />
        </label>

        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {busy ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="text-xs text-slate-600">
          O usuário é criado no painel do Supabase (Authentication → Users).
        </p>
      </form>
    </div>
  );
}
