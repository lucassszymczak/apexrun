-- ============================================================================
-- Sincronização entre aparelhos da página analise/ (sem login).
--
-- Modelo: cada "código de sincronização" (alta entropia, gerado no cliente) tem
-- seu hash SHA-256 usado como chave (sync_id) de uma linha JSON. O código cru
-- nunca chega ao servidor — só o hash. O acesso do papel anon é EXCLUSIVO via
-- duas funções RPC (security definer) que só tocam a linha do sync_id informado;
-- a tabela não tem policy de acesso direto, então não dá para enumerar/baixar
-- todas as linhas. Quem não tem o código (logo, o hash) não alcança os dados.
--
-- A chave anon é pública por design; a proteção real é o segredo (o código).
-- ============================================================================

create table if not exists public.analise_sync (
  sync_id    text primary key,
  payload    jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.analise_sync enable row level security;
-- Sem policies: nenhum acesso direto pelo papel anon/authenticated.
-- Todo acesso passa pelas funções security definer abaixo.

-- Lê a linha de um sync_id (ou nada, se não existir).
create or replace function public.analise_sync_get(p_sync_id text)
returns table (payload jsonb, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select s.payload, s.updated_at
  from public.analise_sync s
  where s.sync_id = p_sync_id;
$$;

-- Cria/atualiza a linha de um sync_id e devolve o updated_at resultante.
create or replace function public.analise_sync_put(p_sync_id text, p_payload jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ts timestamptz;
begin
  if p_sync_id is null or length(p_sync_id) < 16 then
    raise exception 'sync_id inválido';
  end if;
  insert into public.analise_sync as s (sync_id, payload, updated_at)
  values (p_sync_id, p_payload, now())
  on conflict (sync_id)
    do update set payload = excluded.payload, updated_at = now()
  returning s.updated_at into v_ts;
  return v_ts;
end;
$$;

-- Só as funções são expostas ao papel público/anon (não a tabela).
revoke all on function public.analise_sync_get(text) from public;
revoke all on function public.analise_sync_put(text, jsonb) from public;
grant execute on function public.analise_sync_get(text) to anon, authenticated;
grant execute on function public.analise_sync_put(text, jsonb) to anon, authenticated;
