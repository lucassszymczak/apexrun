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
