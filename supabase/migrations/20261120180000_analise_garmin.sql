-- ============================================================================
-- Fase 2 · Garmin: chave pessoal e token, criptografados (AES-GCM) pela função
-- "garmin". Sem policy e sem função pública: só a função (service role) acessa.
-- Aprovado pelo Lucas em 20/11/2026 (docs/fase2-etapa0.md).
-- ============================================================================
create table if not exists public.analise_garmin (
  sync_id          text primary key,
  key_enc          text        not null,        -- chave do Garmin, AES-GCM (base64: iv + texto cifrado)
  key_expires_at   timestamptz,                 -- calculada pela validade escolhida (ou exata, se o token revelar)
  token_enc        text,                        -- token de acesso, AES-GCM
  token_expires_at timestamptz,
  filtros          jsonb       not null default '{"corrida":true,"bike":true}',
  since            date,                        -- "trazer treinos desde"
  last_list_at     timestamptz,
  status           text        not null default 'ok', -- ok | chave_invalida | chave_vencida | garmin_fora
  retry_at         timestamptz,                 -- próxima tentativa depois de erro do Garmin
  fails            integer     not null default 0, -- erros seguidos do Garmin (espera 1, 5, 15, 60 min)
  updated_at       timestamptz not null default now()
);
alter table public.analise_garmin enable row level security;
-- Sem policies e sem funções públicas: só a função "garmin" (service role) lê e grava.
revoke all on table public.analise_garmin from anon, authenticated;
