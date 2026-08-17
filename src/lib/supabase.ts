import { createClient } from '@supabase/supabase-js';

// Lê as chaves públicas do Supabase do ambiente Vite (prefixo VITE_).
// Nunca coloque a service_role key aqui — ela é só para Edge Functions.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Erro claro em vez de falha silenciosa (restrição do projeto).
  throw new Error(
    'Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY. ' +
      'Copie .env.example para .env e preencha as chaves.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
