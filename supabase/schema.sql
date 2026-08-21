-- =============================================================================
-- Apex Performance — schema consolidado (setup sem CLI, via SQL Editor)
-- -----------------------------------------------------------------------------
-- Junta, EM ORDEM, as 4 migrations de supabase/migrations/:
--   0001 schema inicial · 0002 RLS · 0003 trigger de claim · 0004 seed
-- Cole TODO o conteúdo no SQL Editor do Supabase e clique em Run.
-- RE-EXECUTÁVEL: pode rodar mais de uma vez, mesmo após uma tentativa que
-- falhou no meio (usa IF NOT EXISTS / DROP ... IF EXISTS e seed idempotente).
-- =============================================================================


-- =============================================================================
-- Apex Performance — Migration 0001: schema inicial
-- -----------------------------------------------------------------------------
-- App pessoal (1 usuário) de conferência e dashboards de treino de corrida.
-- Este arquivo cria os tipos, tabelas, índices e triggers base.
-- As políticas de segurança (RLS) ficam na migration 0002 para manter este
-- arquivo focado apenas na estrutura de dados.
--
-- Convenções:
--   * Nomes de colunas em português, seguindo a especificação do projeto.
--   * `_m`  = metros, `_s` = segundos, `_s_por_km` = segundos por km (pace).
--   * NULL numa métrica significa DELIBERADAMENTE "dados insuficientes".
--     Nunca gravamos um valor inventado só para preencher a coluna.
-- =============================================================================

-- gen_random_uuid() vem do pgcrypto. No Supabase já costuma estar habilitado,
-- mas garantimos aqui para o schema ser reprodutível em qualquer instância.
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------

-- Fonte da atividade. A arquitetura de ingestão é plugável: para adicionar a
-- Garmin Health API no futuro basta:
--   ALTER TYPE activity_source ADD VALUE 'garmin';
-- Idempotente (não há CREATE TYPE IF NOT EXISTS): só cria se ainda não existir.
do '
begin
  if not exists (select 1 from pg_type where typname = ''activity_source'') then
    create type activity_source as enum (''strava'', ''fit_upload'', ''manual'');
  end if;
end
';

-- Veredito determinístico da camada de conferência.
--   pending  -> extraído do arquivo/API, ainda NÃO revisado pelo usuário.
--   ok       -> passou nas validações sem ressalvas.
--   warning  -> passou, mas com pontos que exigem atenção do usuário.
--   rejected -> problemas graves; não deve entrar como treino oficial.
-- Observação: 'pending' é uma EXTENSÃO da enum da spec (ok|warning|rejected).
-- Ele representa o estado "extraído mas aguardando confirmação do treinador",
-- que é central para a regra de conferência antes de persistir como oficial.
do '
begin
  if not exists (select 1 from pg_type where typname = ''quality_status'') then
    create type quality_status as enum (''pending'', ''ok'', ''warning'', ''rejected'');
  end if;
end
';

-- Severidade de um problema detectado na conferência.
do '
begin
  if not exists (select 1 from pg_type where typname = ''issue_severity'') then
    create type issue_severity as enum (''info'', ''warning'', ''error'');
  end if;
end
';

-- -----------------------------------------------------------------------------
-- Função utilitária: mantém updated_at sempre atualizado em UPDATEs.
-- -----------------------------------------------------------------------------
-- Corpo entre aspas simples (em vez de dollar-quoting) para ser robusto a
-- copiar/colar no SQL Editor. O corpo não tem aspas simples, então é seguro.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as '
begin
  new.updated_at = now();
  return new;
end;
';

-- -----------------------------------------------------------------------------
-- Tabela: athletes
-- Perfil do atleta (1 por usuário do Supabase Auth neste app pessoal).
-- -----------------------------------------------------------------------------
create table if not exists public.athletes (
  id                uuid primary key default gen_random_uuid(),

  -- Liga o atleta ao usuário autenticado (Supabase Auth). Base do RLS.
  -- NULLABLE de propósito: o seed cria o perfil ANTES de existir um usuário Auth.
  -- No primeiro login, um trigger (migration 0003) "reivindica" o perfil órfão
  -- e preenche este user_id. UNIQUE garante 1 atleta por usuário.
  user_id           uuid unique references auth.users (id) on delete cascade,

  -- Identificação e dados demográficos.
  nome              text not null,
  idade             integer check (idade is null or idade between 0 and 120),
  sexo              text,                          -- 'masculino' | 'feminino' | outro (texto livre)
  altura_cm         integer check (altura_cm is null or altura_cm between 100 and 250),
  peso_inicial_kg   numeric(5,2),                  -- peso de referência; log de peso pode virar tabela própria depois
  cidade            text,

  -- FC máxima estimada (bpm). Usada como referência para zonas e validações.
  fc_max_estimada   integer check (fc_max_estimada is null or fc_max_estimada between 120 and 240),

  -- Zonas de FC. Formato esperado (exemplo):
  -- [
  --   { "zona": 1, "nome": "Z1", "fc_min": 119, "fc_max": 139 },
  --   { "zona": 2, "nome": "Z2", "fc_min": 139, "fc_max": 158 },
  --   ...
  -- ]
  zonas_fc          jsonb not null default '[]'::jsonb,

  -- Calibração de pace / parâmetros fisiológicos. Formato flexível, ex:
  -- { "confortavel_s_km": 450, "faixa_ok_min_s_km": 420, "alvo_prova_min_s_km": 405, ... }
  pace_calibracao   jsonb not null default '{}'::jsonb,

  -- Meta de prova alvo, ex:
  -- { "nome": "Meia de Floripa", "distancia_km": 21.097, "data": "2026-08-29", "objetivo": "..." }
  meta_prova        jsonb not null default '{}'::jsonb,

  -- Sinalizações clínicas / de saúde a monitorar, ex:
  -- { "medicacao": "...", "lesao_previa": "canelite 2026", "monitorar": "joelho esquerdo" }
  flags_clinicas    jsonb not null default '{}'::jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_athletes_updated_at on public.athletes;
create trigger trg_athletes_updated_at
  before update on public.athletes
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Tabela: athlete_notes
-- "Insights conhecidos" sobre o atleta — padrões já identificados que o
-- dashboard exibe SEM reprocessar (ex: cardiac drift confirmado, negative
-- split recorrente, episódio de lesão resolvido, cadência abaixo da meta).
-- Ficam numa tabela própria (em vez de um jsonb no atleta) para o dashboard
-- listar/filtrar facilmente e para podermos referenciar atividades específicas.
-- -----------------------------------------------------------------------------
create table if not exists public.athlete_notes (
  id                uuid primary key default gen_random_uuid(),
  athlete_id        uuid not null references public.athletes (id) on delete cascade,

  -- Categoria do insight, ex: 'cardiac_drift', 'negative_split', 'lesao',
  -- 'cadencia', 'geral'.
  categoria         text not null,
  titulo            text not null,
  descricao         text,
  -- Detalhes estruturados: valores, datas de atividades relacionadas, etc.
  -- ex: { "atividades": ["2026-08-08","2026-08-15"], "cadencia_spm": [164,167] }
  dados             jsonb not null default '{}'::jsonb,

  created_at        timestamptz not null default now()
);

create index if not exists idx_athlete_notes_athlete
  on public.athlete_notes (athlete_id);

-- -----------------------------------------------------------------------------
-- Tabela: activities
-- Uma sessão de treino. Guarda tanto metadados (API) quanto métricas derivadas
-- do arquivo de atividade (.FIT/.TCX/.GPX), mais o relatório de conferência.
-- -----------------------------------------------------------------------------
create table if not exists public.activities (
  id                uuid primary key default gen_random_uuid(),
  athlete_id        uuid not null references public.athletes (id) on delete cascade,

  -- Identificador na fonte externa (ex: id da atividade no Strava). Pode ser
  -- NULL para uploads puramente manuais.
  external_id       text,
  source            activity_source not null,

  -- Metadados da sessão.
  data              timestamptz not null,          -- data/hora de início do treino
  tipo              text,                          -- ex: 'longao', 'qualidade', 'regenerativo'

  -- Métricas agregadas. Quando um arquivo .FIT existe, ele é a fonte de verdade;
  -- a API só complementa metadados (nome, tipo, data).
  distancia_m       numeric(10,2),                 -- distância total em metros
  duracao_s         integer,                       -- duração em movimento (segundos)
  pace_medio        numeric(7,2),                  -- pace médio em s/km
  fc_media          integer,
  fc_max            integer,
  elevacao_ganho_m  numeric(8,2),                  -- ganho de elevação acumulado (m)

  -- Percepção subjetiva e sinais de lesão (entrada manual do atleta).
  rpe               integer check (rpe is null or rpe between 1 and 10),
  dor_flag          boolean not null default false,
  dor_desc          text,
  obs               text,

  -- Camada de conferência.
  quality_status    quality_status not null default 'pending',
  quality_report    jsonb not null default '{}'::jsonb,   -- resumo estruturado das checagens
  -- Timestamp de quando o usuário confirmou a atividade como OFICIAL.
  -- NULL = ainda não confirmada (regra do treinador: confirmar antes de registrar).
  confirmed_at      timestamptz,

  -- Streams brutos usados nos cálculos (time, distance, heartrate, altitude,
  -- latlng). Guardamos para poder reprocessar sem re-baixar/re-parsear.
  raw_streams       jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Evita duplicar a mesma atividade externa ao repuxar da API.
-- (Índice único parcial: só vale quando external_id existe.)
create unique index if not exists uq_activities_source_external
  on public.activities (source, external_id)
  where external_id is not null;

-- Consulta mais comum: treinos de um atleta em ordem cronológica reversa.
create index if not exists idx_activities_athlete_data
  on public.activities (athlete_id, data desc);

-- Filtro por status de conferência (fila de revisão).
create index if not exists idx_activities_quality_status
  on public.activities (quality_status);

drop trigger if exists trg_activities_updated_at on public.activities;
create trigger trg_activities_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Tabela: splits
-- Métricas determinísticas por km, calculadas no backend a partir dos streams.
-- O último km costuma ser parcial: ele é SINALIZADO (parcial = true), nunca
-- misturado com os kms completos.
-- -----------------------------------------------------------------------------
create table if not exists public.splits (
  id                uuid primary key default gen_random_uuid(),
  activity_id       uuid not null references public.activities (id) on delete cascade,

  km_index          integer not null,              -- 1 = primeiro km, 2 = segundo...

  -- Distância real coberta neste segmento. Para kms completos ~1000m; para o
  -- último km parcial guarda o valor real (ex: 640m).
  distancia_m       numeric(10,2) not null,
  parcial           boolean not null default false,-- true = km incompleto (último trecho)

  duracao_s         integer,                       -- tempo gasto neste km
  pace_s_por_km     numeric(7,2),                  -- pace normalizado para s/km
  fc_media          integer,
  fc_max            integer,
  elevacao_ganho_m  numeric(8,2),
  -- GAP (Grade Adjusted Pace) em s/km, aproximação de Minetti.
  -- NULL quando não há dados de elevação suficientes para estimar.
  gap_s_por_km      numeric(7,2),

  created_at        timestamptz not null default now(),

  unique (activity_id, km_index)
);

create index if not exists idx_splits_activity
  on public.splits (activity_id, km_index);

-- -----------------------------------------------------------------------------
-- Tabela: data_issues
-- Problemas detectados na conferência (um registro por achado). Permite listar,
-- anotar e marcar como resolvido sem sobrescrever o quality_report agregado.
-- -----------------------------------------------------------------------------
create table if not exists public.data_issues (
  id                uuid primary key default gen_random_uuid(),
  activity_id       uuid not null references public.activities (id) on delete cascade,

  -- Categoria do problema, ex: 'gps_gap', 'auto_pause', 'fc_travada',
  -- 'fc_spike', 'distancia_divergente', 'elevacao_ruidosa', 'split_incompleto'.
  tipo              text not null,
  severidade        issue_severity not null default 'warning',
  descricao         text not null,
  -- Opcional: km específico ao qual o problema se refere.
  km_index          integer,
  resolvido         boolean not null default false,

  created_at        timestamptz not null default now()
);

create index if not exists idx_data_issues_activity
  on public.data_issues (activity_id);

create index if not exists idx_data_issues_abertos
  on public.data_issues (activity_id)
  where resolvido = false;

-- =============================================================================
-- Fim da migration 0001.
-- =============================================================================


-- =============================================================================
-- Apex Performance — Migration 0002: Row Level Security (RLS)
-- -----------------------------------------------------------------------------
-- Mesmo sendo um app de 1 usuário, usamos Supabase Auth + RLS por boa prática:
-- nenhuma linha é acessível sem um usuário autenticado dono do atleta.
--
-- Cadeia de posse:
--   auth.users ──< athletes ──< activities ──< splits
--                                          └──< data_issues
-- Tudo é escopado por athletes.user_id = auth.uid().
--
-- Idempotente: cada policy tem um DROP ... IF EXISTS antes do CREATE, então
-- este arquivo pode ser rodado mais de uma vez (setup via SQL Editor).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- athletes
-- -----------------------------------------------------------------------------
alter table public.athletes enable row level security;

drop policy if exists "athletes: dono lê" on public.athletes;
create policy "athletes: dono lê"
  on public.athletes for select
  using (user_id = (select auth.uid()));

drop policy if exists "athletes: dono insere" on public.athletes;
create policy "athletes: dono insere"
  on public.athletes for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "athletes: dono atualiza" on public.athletes;
create policy "athletes: dono atualiza"
  on public.athletes for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "athletes: dono remove" on public.athletes;
create policy "athletes: dono remove"
  on public.athletes for delete
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- activities — acessível se pertence a um atleta do usuário.
-- -----------------------------------------------------------------------------
alter table public.activities enable row level security;

drop policy if exists "activities: dono lê" on public.activities;
create policy "activities: dono lê"
  on public.activities for select
  using (
    athlete_id in (
      select id from public.athletes where user_id = (select auth.uid())
    )
  );

drop policy if exists "activities: dono insere" on public.activities;
create policy "activities: dono insere"
  on public.activities for insert
  with check (
    athlete_id in (
      select id from public.athletes where user_id = (select auth.uid())
    )
  );

drop policy if exists "activities: dono atualiza" on public.activities;
create policy "activities: dono atualiza"
  on public.activities for update
  using (
    athlete_id in (
      select id from public.athletes where user_id = (select auth.uid())
    )
  )
  with check (
    athlete_id in (
      select id from public.athletes where user_id = (select auth.uid())
    )
  );

drop policy if exists "activities: dono remove" on public.activities;
create policy "activities: dono remove"
  on public.activities for delete
  using (
    athlete_id in (
      select id from public.athletes where user_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- splits — acessível via a atividade dona.
-- -----------------------------------------------------------------------------
alter table public.splits enable row level security;

drop policy if exists "splits: dono lê" on public.splits;
create policy "splits: dono lê"
  on public.splits for select
  using (
    activity_id in (
      select a.id
      from public.activities a
      join public.athletes at on at.id = a.athlete_id
      where at.user_id = (select auth.uid())
    )
  );

drop policy if exists "splits: dono escreve" on public.splits;
create policy "splits: dono escreve"
  on public.splits for all
  using (
    activity_id in (
      select a.id
      from public.activities a
      join public.athletes at on at.id = a.athlete_id
      where at.user_id = (select auth.uid())
    )
  )
  with check (
    activity_id in (
      select a.id
      from public.activities a
      join public.athletes at on at.id = a.athlete_id
      where at.user_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- data_issues — acessível via a atividade dona.
-- -----------------------------------------------------------------------------
alter table public.data_issues enable row level security;

drop policy if exists "data_issues: dono lê" on public.data_issues;
create policy "data_issues: dono lê"
  on public.data_issues for select
  using (
    activity_id in (
      select a.id
      from public.activities a
      join public.athletes at on at.id = a.athlete_id
      where at.user_id = (select auth.uid())
    )
  );

drop policy if exists "data_issues: dono escreve" on public.data_issues;
create policy "data_issues: dono escreve"
  on public.data_issues for all
  using (
    activity_id in (
      select a.id
      from public.activities a
      join public.athletes at on at.id = a.athlete_id
      where at.user_id = (select auth.uid())
    )
  )
  with check (
    activity_id in (
      select a.id
      from public.activities a
      join public.athletes at on at.id = a.athlete_id
      where at.user_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- athlete_notes — acessível via o atleta dono.
-- -----------------------------------------------------------------------------
alter table public.athlete_notes enable row level security;

drop policy if exists "athlete_notes: dono lê" on public.athlete_notes;
create policy "athlete_notes: dono lê"
  on public.athlete_notes for select
  using (
    athlete_id in (
      select id from public.athletes where user_id = (select auth.uid())
    )
  );

drop policy if exists "athlete_notes: dono escreve" on public.athlete_notes;
create policy "athlete_notes: dono escreve"
  on public.athlete_notes for all
  using (
    athlete_id in (
      select id from public.athletes where user_id = (select auth.uid())
    )
  )
  with check (
    athlete_id in (
      select id from public.athletes where user_id = (select auth.uid())
    )
  );

-- =============================================================================
-- Fim da migration 0002.
-- =============================================================================


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

drop trigger if exists on_auth_user_created_claim_athlete on auth.users;
create trigger on_auth_user_created_claim_athlete
  after insert on auth.users
  for each row execute function public.claim_unassigned_athlete();

-- =============================================================================
-- Fim da migration 0003.
-- =============================================================================


-- =============================================================================
-- Apex Performance — Migration 0004: SEED do contexto do atleta
-- -----------------------------------------------------------------------------
-- Pré-carrega o contexto conhecido do atleta (perfil + insights já
-- identificados). Idempotente: pode rodar mais de uma vez sem duplicar.
--
-- Fonte dos valores: mensagem do projeto (seção "SEED INICIAL DO BANCO").
-- O nome real e as 15 atividades históricas vêm do arquivo
-- `contexto-treinador.md` (seção 6), que AINDA NÃO foi fornecido — ver o bloco
-- comentado no final. Nada é inventado aqui.
-- =============================================================================

-- ID fixo do atleta para permitir referências estáveis (athlete_notes, etc.).
-- Perfil "órfão" (user_id NULL) até o primeiro login — ver migration 0003.
insert into public.athletes (
  id,
  user_id,
  nome,
  idade,
  sexo,
  altura_cm,
  peso_inicial_kg,
  cidade,
  fc_max_estimada,
  zonas_fc,
  pace_calibracao,
  meta_prova,
  flags_clinicas
) values (
  'a0000000-0000-4000-8000-000000000001',
  null,
  'Atleta',                          -- TODO: nome real está no contexto-treinador.md
  34,
  'masculino',
  169,
  82.5,
  'Guarapuava, PR',
  198,                               -- fc_max_estimada (2ª revisão 08/08; provisória, sem teste real)
  -- zonas_fc base 198 bpm
  '[
    {"zona": 1, "nome": "Z1", "fc_min": 119, "fc_max": 139},
    {"zona": 2, "nome": "Z2", "fc_min": 139, "fc_max": 158},
    {"zona": 3, "nome": "Z3", "fc_min": 158, "fc_max": 172},
    {"zona": 4, "nome": "Z4", "fc_min": 172, "fc_max": 182},
    {"zona": 5, "nome": "Z5", "fc_min": 182, "fc_max": 198}
  ]'::jsonb,
  -- pace_calibracao (todos em segundos por km)
  '{
    "confortavel_s_km": 450,
    "faixa_ok_min_s_km": 420,
    "faixa_ok_max_s_km": 480,
    "alvo_prova_min_s_km": 405,
    "alvo_prova_max_s_km": 425
  }'::jsonb,
  -- meta_prova
  '{
    "nome": "Meia Maratona de Florianópolis",
    "distancia_km": 21.097,
    "data": "2026-08-29",
    "objetivo": "completar sem sofrer; FC média < Z3; sem dor na canela nos 7 dias seguintes"
  }'::jsonb,
  -- flags_clinicas
  '{
    "medicacao": "Pantoprazol 1x/dia — cautela com anti-inflamatórios",
    "lesao_previa": "canelite início 2026",
    "monitorar": "joelho esquerdo (desconforto transitório 12/08, sem recorrência)"
  }'::jsonb
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Insights conhecidos (athlete_notes) — exibidos no dashboard sem reprocessar.
-- -----------------------------------------------------------------------------
insert into public.athlete_notes (athlete_id, categoria, titulo, descricao, dados)
select
  'a0000000-0000-4000-8000-000000000001',
  v.categoria, v.titulo, v.descricao, v.dados::jsonb
from (values
  (
    'cardiac_drift',
    'Cardiac drift confirmado',
    'Deriva cardíaca observada em 2 longões a pace estável.',
    '{"atividades": ["2026-08-08", "2026-08-15"]}'
  ),
  (
    'negative_split',
    'Negative split recorrente',
    'Negative split real em 3 longões consecutivos — os últimos km foram os mais rápidos.',
    '{"atividades": ["2026-08-02", "2026-08-08", "2026-08-15"]}'
  ),
  (
    'lesao',
    'Dor plantar resolvida',
    'Episódio de dor plantar entre 08/08 e 12/08, já resolvido.',
    '{"periodo_inicio": "2026-08-08", "periodo_fim": "2026-08-12", "status": "resolvido"}'
  ),
  (
    'cadencia',
    'Cadência abaixo da meta',
    'Cadência ~164-167 spm, abaixo da meta de 170-180 spm. Monitorar.',
    '{"cadencia_spm_min": 164, "cadencia_spm_max": 167, "meta_spm_min": 170, "meta_spm_max": 180, "status": "monitorar"}'
  )
) as v(categoria, titulo, descricao, dados)
-- Só insere os insights se ainda não existir nenhum para o atleta (idempotência).
where not exists (
  select 1 from public.athlete_notes
  where athlete_id = 'a0000000-0000-4000-8000-000000000001'
);

-- =============================================================================
-- ATIVIDADES HISTÓRICAS (15 sessões) — diário completo até 16/08 (seção 6).
-- -----------------------------------------------------------------------------
-- Regras acordadas (dados históricos, NÃO passam pela camada de conferência):
--   * source = 'manual', quality_status = 'ok' (já validados manualmente).
--   * SEM splits por km: o diário só cita drift em faixas de km, nunca uma
--     tabela de parciais (pace/FC/elevação por km). Para não inventar, todas
--     ficam sem splits e com quality_report."splits_indisponiveis" = true.
--     O drift e o GAP médio citados no arquivo são preservados no
--     quality_report (não recalculados).
--   * duracao_s fica NULL: não há duração medida no diário e derivá-la do pace
--     arredondado seria precisão inventada.
--   * data usa 00:00 no fuso -03 (Guarapuava/BR): só a DATA foi registrada, não
--     a hora. Casas de FC/RPE dadas como faixa (ex: "2-3", "80-124") viram NULL
--     no campo numérico e o texto original vai para obs.
--
-- As 15 sessões = as 18 linhas do diário menos os 3 dias SEM atividade
-- (09/08 dor/sem treino, 14/08 e 16/08 descanso). Os 8 treinos de corrida
-- somam ~68 km, batendo com o total do arquivo.
--
-- Nota: o arquivo diz "13/15 sem dor (2 exceções)" contando 08/08 + o dia de
-- dor 09/08; como 09/08 não é uma sessão de treino, aqui só 08/08 fica com
-- dor_flag = true entre as 15.
-- -----------------------------------------------------------------------------
insert into public.activities (
  athlete_id, source, data, tipo, distancia_m, pace_medio,
  fc_media, fc_max, rpe, dor_flag, dor_desc, obs, quality_status, quality_report
)
select
  'a0000000-0000-4000-8000-000000000001',
  'manual',
  v.data::timestamptz,
  v.tipo,
  v.distancia_m,
  v.pace_medio,
  v.fc_media,
  v.fc_max,
  v.rpe,
  v.dor_flag,
  v.dor_desc,
  v.obs,
  'ok',
  v.quality_report::jsonb
from (values
  -- data (-03)                 | tipo            | dist_m        | pace_s/km   | fcm      | fcx | rpe      | dor   | dor_desc                                             | obs
  ('2026-07-27 00:00:00-03', 'mobilidade',    null::numeric, null::numeric, null::int, 124,  null::int, false, null::text,                                            'Mobilidade. Início do plano. FC 80-124 (faixa; sem média registrada).',
    '{"origem":"seed_historico","splits_indisponiveis":true}'),
  ('2026-07-28 00:00:00-03', 'rodagem',       5390,          514,           156,       176,  5,         false, null,                                                  'Rodagem teste (1º pós-retomada). Pace 8:34 bruto c/ caminhada.',
    '{"origem":"seed_historico","splits_indisponiveis":true}'),
  ('2026-07-29 00:00:00-03', 'fortalecimento',null,          null,          null,      null, null,      false, null,                                                  'Fortalecimento. Falha muscular no final (estímulo adequado).',
    '{"origem":"seed_historico","splits_indisponiveis":true}'),
  ('2026-07-30 00:00:00-03', 'rodagem',       6000,          472,           163,       180,  5,         false, null,                                                  'Rodagem. 192m de subida.',
    '{"origem":"seed_historico","splits_indisponiveis":true}'),
  ('2026-08-02 00:00:00-03', 'longao',        9160,          438,           163,       185,  5,         false, null,                                                  'Longão 1 (reagendado). 9,16km inclui +750m de aquec/desaquec além dos 8,41km cronometrados. Drift 152→171bpm nos splits.',
    '{"origem":"seed_historico","splits_indisponiveis":true,"drift_reportado":{"fc_inicio":152,"fc_fim":171,"escopo":"splits"}}'),
  ('2026-08-03 00:00:00-03', 'bike',          null,          null,          106,       113,  null,      false, null,                                                  'Bike (substituindo regenerativo). RPE 2-3.',
    '{"origem":"seed_historico","splits_indisponiveis":true}'),
  ('2026-08-04 00:00:00-03', 'qualidade',     5050,          477,           151,       177,  7,         false, null,                                                  'Fartlek leve. Fade nos tiros (5:43→6:49).',
    '{"origem":"seed_historico","splits_indisponiveis":true}'),
  ('2026-08-05 00:00:00-03', 'fortalecimento',null,          null,          112,       149,  3,         false, null,                                                  'Fortalecimento.',
    '{"origem":"seed_historico","splits_indisponiveis":true}'),
  ('2026-08-06 00:00:00-03', 'rodagem',       7010,          459,           165,       177,  4,         false, null,                                                  'Rodagem. Gatilho da 1ª revisão de FC máx (→193bpm).',
    '{"origem":"seed_historico","splits_indisponiveis":true}'),
  ('2026-08-08 00:00:00-03', 'longao',        12010,         497,           173,       195,  7,         true,  'Dor plantar bilateral (retroativa ao Longão 2; noturna, exigiu anti-inflamatório).', 'Longão 2. GAP 8:14. Drift km9-12: 174→186bpm; gatilho da 2ª revisão de FC máx (→198bpm).',
    '{"origem":"seed_historico","splits_indisponiveis":true,"gap_medio_s_km":494,"drift_reportado":{"km_inicio":9,"km_fim":12,"fc_inicio":174,"fc_fim":186}}'),
  ('2026-08-10 00:00:00-03', 'bike',          null,          null,          117,       126,  null,      false, null,                                                  'Bike (substituindo regenerativo). RPE 2-3.',
    '{"origem":"seed_historico","splits_indisponiveis":true}'),
  ('2026-08-11 00:00:00-03', 'bike',          null,          null,          116,       126,  null,      false, null,                                                  'Bike (substituindo rodagem; frio). RPE 3-4.',
    '{"origem":"seed_historico","splits_indisponiveis":true}'),
  ('2026-08-12 00:00:00-03', 'rodagem',       6010,          456,           165,       182,  5,         false, null,                                                  'Rodagem leve (teste de tolerância pós-dor plantar) — aprovado sem dor. GAP ~7:27. Joelho esq.: desconforto transitório, sem recorrência.',
    '{"origem":"seed_historico","splits_indisponiveis":true,"gap_medio_s_km":447}'),
  ('2026-08-13 00:00:00-03', 'fortalecimento',null,          null,          null,      null, null,      false, null,                                                  'Fortalecimento (substituindo subida; subida da semana cancelada por precaução).',
    '{"origem":"seed_historico","splits_indisponiveis":true}'),
  ('2026-08-15 00:00:00-03', 'longao',        17000,         465,           166,       190,  6,         false, null,                                                  'Longão 3 (pico). GAP ~7:33. PR 10 milhas 2026; drift km7-10: 164→174bpm; TE 5.0 (Garmin).',
    '{"origem":"seed_historico","splits_indisponiveis":true,"gap_medio_s_km":453,"drift_reportado":{"km_inicio":7,"km_fim":10,"fc_inicio":164,"fc_fim":174}}')
) as v(data, tipo, distancia_m, pace_medio, fc_media, fc_max, rpe, dor_flag, dor_desc, obs, quality_report)
-- Idempotência: só insere se ainda não houver atividades de seed para o atleta.
where not exists (
  select 1 from public.activities
  where athlete_id = 'a0000000-0000-4000-8000-000000000001'
    and quality_report->>'origem' = 'seed_historico'
);

-- =============================================================================
-- Fim da migration 0004.
-- =============================================================================

