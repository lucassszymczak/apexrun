-- =============================================================================
-- Apex Performance — Migration 0003: reivindicação do perfil no primeiro login
-- -----------------------------------------------------------------------------
-- Problema: o seed (migration 0004) cria o perfil do atleta ANTES de existir
-- qualquer usuário no Supabase Auth, então athletes.user_id nasce NULL.
--
-- Solução (padrão de app pessoal de 1 usuário): quando o primeiro usuário se
-- cadastra no Auth, um trigger "reivindica" o atleta órfão mais antigo e liga
-- user_id a ele. A partir daí o RLS passa a enxergar as linhas normalmente.
--
-- SECURITY DEFINER: o trigger roda com privilégios do dono da função para poder
-- atualizar public.athletes independentemente do RLS. search_path fixo evita
-- sequestro de resolução de nomes.
-- =============================================================================

create or replace function public.claim_unassigned_athlete()
returns trigger
language plpgsql
security definer
set search_path = public
as '
begin
  update public.athletes
     set user_id = new.id
   where id = (
     select id
       from public.athletes
      where user_id is null
      order by created_at
      limit 1
   );
  return new;
end;
';

create trigger on_auth_user_created_claim_athlete
  after insert on auth.users
  for each row execute function public.claim_unassigned_athlete();

-- =============================================================================
-- Fim da migration 0003.
-- =============================================================================
