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
create type activity_source as enum ('strava', 'fit_upload', 'manual');

-- Veredito determinístico da camada de conferência.
--   pending  -> extraído do arquivo/API, ainda NÃO revisado pelo usuário.
--   ok       -> passou nas validações sem ressalvas.
--   warning  -> passou, mas com pontos que exigem atenção do usuário.
--   rejected -> problemas graves; não deve entrar como treino oficial.
-- Observação: 'pending' é uma EXTENSÃO da enum da spec (ok|warning|rejected).
-- Ele representa o estado "extraído mas aguardando confirmação do treinador",
-- que é central para a regra de conferência antes de persistir como oficial.
create type quality_status as enum ('pending', 'ok', 'warning', 'rejected');

-- Severidade de um problema detectado na conferência.
create type issue_severity as enum ('info', 'warning', 'error');

-- -----------------------------------------------------------------------------
-- Função utilitária: mantém updated_at sempre atualizado em UPDATEs.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tabela: athletes
-- Perfil do atleta (1 por usuário do Supabase Auth neste app pessoal).
-- -----------------------------------------------------------------------------
create table public.athletes (
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
create table public.athlete_notes (
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

create index idx_athlete_notes_athlete
  on public.athlete_notes (athlete_id);

-- -----------------------------------------------------------------------------
-- Tabela: activities
-- Uma sessão de treino. Guarda tanto metadados (API) quanto métricas derivadas
-- do arquivo de atividade (.FIT/.TCX/.GPX), mais o relatório de conferência.
-- -----------------------------------------------------------------------------
create table public.activities (
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
create unique index uq_activities_source_external
  on public.activities (source, external_id)
  where external_id is not null;

-- Consulta mais comum: treinos de um atleta em ordem cronológica reversa.
create index idx_activities_athlete_data
  on public.activities (athlete_id, data desc);

-- Filtro por status de conferência (fila de revisão).
create index idx_activities_quality_status
  on public.activities (quality_status);

create trigger trg_activities_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Tabela: splits
-- Métricas determinísticas por km, calculadas no backend a partir dos streams.
-- O último km costuma ser parcial: ele é SINALIZADO (parcial = true), nunca
-- misturado com os kms completos.
-- -----------------------------------------------------------------------------
create table public.splits (
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

create index idx_splits_activity
  on public.splits (activity_id, km_index);

-- -----------------------------------------------------------------------------
-- Tabela: data_issues
-- Problemas detectados na conferência (um registro por achado). Permite listar,
-- anotar e marcar como resolvido sem sobrescrever o quality_report agregado.
-- -----------------------------------------------------------------------------
create table public.data_issues (
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

create index idx_data_issues_activity
  on public.data_issues (activity_id);

create index idx_data_issues_abertos
  on public.data_issues (activity_id)
  where resolvido = false;

-- =============================================================================
-- Fim da migration 0001.
-- =============================================================================
