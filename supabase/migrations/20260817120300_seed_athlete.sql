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
-- ATIVIDADES HISTÓRICAS (15 sessões) — PENDENTE do arquivo de contexto.
-- -----------------------------------------------------------------------------
-- As 15 sessões do diário estão na "seção 6" de `contexto-treinador.md`, que
-- ainda não foi fornecido a esta sessão. Para NÃO inventar dados, o seed das
-- atividades fica pendente. Quando o arquivo chegar, cada sessão vira:
--
--   insert into public.activities (
--     athlete_id, source, data, tipo, distancia_m, duracao_s, pace_medio,
--     fc_media, fc_max, rpe, dor_flag, obs, quality_status, quality_report
--   ) values (
--     'a0000000-0000-4000-8000-000000000001',
--     'manual',            -- histórico validado manualmente
--     '2026-08-15 06:00',  -- data
--     'longao',            -- tipo
--     ...,                 -- distancia_m, duracao_s, pace_medio, fc_media, fc_max, rpe, dor_flag, obs
--     'ok',                -- histórico entra direto como OK (NÃO passa pela conferência)
--     '{"origem": "seed_historico", "splits_indisponiveis": true}'::jsonb
--   );
--
-- Regras acordadas para o histórico:
--   * source = 'manual', quality_status = 'ok' (dados já validados).
--   * NÃO rodar a camada de conferência (não temos streams brutos).
--   * Splits por km só onde o arquivo cita parciais; nos demais, sem splits e
--     quality_report marca {"splits_indisponiveis": true}.
-- =============================================================================
