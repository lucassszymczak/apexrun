// Chaves PÚBLICAS do Supabase para a sincronização opcional entre aparelhos.
// O motor (engine.mjs) lê window.__APEX_SB__ ao carregar, como a página antiga — por
// isso este módulo é importado ANTES do motor em main.tsx. A chave anon é pública
// por design (o RLS/RPC protege os dados); sem as variáveis, a sync fica desligada.
declare global {
  interface Window { __APEX_SB__?: { url: string; anon: string } }
}
window.__APEX_SB__ = {
  url: import.meta.env.VITE_SUPABASE_URL || '',
  anon: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
};
export {};
