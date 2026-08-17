import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lê as chaves públicas do Supabase do ambiente Vite (prefixo VITE_).
// Nunca coloque a service_role key aqui — ela é só para Edge Functions.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true quando as duas chaves públicas estão presentes. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Cria o cliente só se configurado. Se faltar `.env`, o app mostra uma tela de
// configuração em vez de quebrar na importação (erro claro, não silêncio).
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;
