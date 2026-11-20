# Fase 2 · Etapa 0 — Descoberta e desenho técnico

Nada no app mudou nesta etapa. Este documento responde às perguntas do roteiro, mostra o que existe nos seus .FIT e propõe o SQL e a função `garmin`. **Nada foi aplicado no Supabase**: espera o seu OK.

## 1. API pessoal do Garmin (documentação oficial)

Fontes, lidas em 20/11/2026:
- **[S]** Swagger da API pessoal: https://developer.garmin.com/gc-developer-program/personal/swagger-docs/. A página carrega a especificação OpenAPI 3.0.1 "Garmin Connect Personal API 1.0.0"; li a própria especificação.
- **[F]** FAQ: https://developer.garmin.com/gc-developer-program/personal/personal-faq/
- **[P]** Cliente oficial em Python: https://github.com/garmin/connect-personal-api-python (`auth.py`, `client.py`, `downloads.py`, `constants.py`).

Para ler a documentação, liberei `developer.garmin.com` na rede do ambiente de trabalho "apexrun". Isso não afeta o app.

### Token
- `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token`, com o cabeçalho `Authorization: ApiKey <chave>` e sem corpo. **[F] [P]**
- **A resposta é o token puro, em texto (um JWT), não um JSON.** O vencimento vem dentro do próprio token, no campo `exp`. **[P]** (`auth.py` lê o `exp` do JWT.)
- **Validade:** "Access tokens are valid for 24 hours or until the Personal API key expires, whichever occurs first." Não há token de renovação: basta pedir outro com a chave. **[F]**
- As chamadas de dados usam `Authorization: Bearer <token>`. **[P]**
- Servidores: `personal.connectapi.garmin.com` (e `.cn` na China). **[S]**

### Listar atividades
- `GET /activitylist-service/activities/search/activities` **[S]**
- **Paginação:** `start` (posição inicial, padrão 0) e `limit` (padrão 99). A especificação não diz o máximo por página.
- **Datas:** `startDate` e `endDate` (`AAAA-MM-DD`, inclusivos, pela hora local de início).
- **Filtros úteis:**
  - `activityType`: tipo pai (`running`, `cycling`);
  - `sortOrder` (asc ou desc);
  - `excludeChildren` (padrão true).
- **Resposta:** uma lista. Cada item é um `SummarizedActivityDTO` com 230 campos, entre eles:
  - `activityId`: id, inteiro de 64 bits;
  - `startTimeLocal` e `startTimeGMT`: `aaaa-MM-dd HH:mm:ss`;
  - `beginTimestamp`: em ms;
  - `activityType.typeKey` e `parentTypeId`;
  - `duration`, `movingDuration` e `elapsedDuration`: em segundos;
  - `distance`: em metros;
  - `averageHR`;
  - `lapCount`;
  - `hasPolyline`.
- **Erros:** 400 (tipo ou subtipo inválido), 401 (autenticação), 403 (sem permissão), 500.

### Baixar o .FIT
- `GET /download-service/files/activity/{activityId}`: "Download an activity file in its original format." **[S]**
- **A resposta é um ZIP** (`application/x-zip-compressed`), não o .FIT direto. **[S] [P]**
- A função vai descompactar e entregar ao app só o .FIT.

### Até quando dá para buscar
- **Não há limite de histórico documentado** para atividades. **[S]**
- Os limites de 28, 31 e 364 dias da especificação valem para outros dados: passos, estresse, sono, peso. Não valem para atividades.
- Então "Todo o histórico" pode ficar no formulário: a busca vai em páginas e por blocos de datas, com pausa.

### Limites de uso (rate limit)
- **Não documentados** na especificação, no FAQ nem no cliente oficial, que também não repete chamadas.
- **Proposta prudente:**
  - no máximo uma listagem a cada 15 min;
  - downloads um de cada vez, com 1 s entre eles;
  - se o Garmin responder 429 ou 5xx, a próxima tentativa espera mais (1, 5, 15, 60 min).

### A API informa a validade da chave?
- **Não.** Não existe endpoint de status da chave **[S]**. A validade aparece só no Garmin Connect Web **[F]**.
- **As opções ao criar a chave:** 30 dias, 90 dias, 180 dias ou 1 ano. O Garmin manda e-mail cerca de uma semana antes de vencer. **[F]**
- **Consequência:**
  - O formulário de conexão ganha o campo **"Validade que você escolheu no Garmin"**, com 30, 90 ou 180 dias, ou 1 ano; o padrão é 1 ano. Com ele, o app calcula "vence em dd/mm/aaaa" e o aviso de 30 dias antes. **Esse campo não está na tela aprovada: confirme.**
  - Conferência extra: quando o token novo vence antes de 24 h, a chave está nas últimas horas. Nesse caso, a função grava a data exata.

### Tipos de atividade
- `GET /activity-service/activity/activityTypes/simple` devolve `{ key, parent }` **[S]**. O tipo pai tem `parent` nulo; no resumo da atividade, `parentTypeId = 17` marca tipo pai.
- **Proposta:**
  - **Corrida:** tipo pai `running` e todos os subtipos dele (rua, esteira, trilha, pista…).
  - **Bike:** tipo pai `cycling` e todos os subtipos (estrada, indoor, mountain bike, virtual…).
  - **Resto** (natação, caminhada, força): fica de fora nesta fase.
  - Na Etapa 1, a função lê a lista real uma vez e grava em cache, para confirmar os nomes dos tipos.

### Termos
- **[F]** "intended for individual Garmin users who want programmatic access to their own data. It is not intended for commercial applications serving multiple end users."
- **[F]** Apagar a chave no Garmin Connect Web invalida a chave e todos os tokens dela.
- Nada sobre chamar pelo navegador. A chamada fica só na função, como pede o roteiro.

## 2. O que existe nos seus .FIT (`fixtures/privado/`)

Lidos com o leitor `@garmin/fitsdk`, o mesmo que o app usa desde a Fase 1. O roteiro cita o `fit-file-parser`, mas o app trocou para o leitor oficial do Garmin. Ele lê voltas (`lap`) e passos de treino (`workout_step`). **Proposta: manter o leitor oficial, sem dependência nova.**

| Arquivo | Treino | Voltas | Como cada volta foi criada (`lap_trigger`) | Treino estruturado |
|---|---|---|---|---|
| 25074758427 | 14/11, 11,0 km | 2 | `time` (80 min) + `session_end` (21 s) | não |
| 25106458116 | 17/11, 5,28 km | 1 | `time` (40 min) | não |
| 25128573610 | 19/11, 6,09 km | 14 | `time`: 15 min, seis pares de 90 s e 60 s, depois 12 min | não |
| 24159622528 | 29/08, **Meia de Floripa**, 21,21 km | 22 | `distance`: 21 voltas de 1 km (o km automático) + `session_end` (208 m) | não |

- **Campos das voltas:**
  - início e fim (hora e posição);
  - tempo total e tempo em movimento;
  - distância e velocidade média e máxima;
  - FC média e máxima, cadência, subida e descida;
  - tempo em cada zona de FC.
- **Não existem** nos 3 arquivos:
  - `intensity`, o campo que marca volta ativa ou de descanso;
  - `wkt_step_index`;
  - mensagens `workout` e `workout_step`.
- **Achado importante para os tiros:** o treino de 19/11 é claramente intervalado (6 × 90 s rápidos com 60 s de recuperação). Mesmo assim, as voltas dele vêm marcadas como `time`, por tempo, e não como manuais nem de treino estruturado.
  - Pela regra do roteiro, "voltas automáticas por tempo não são tiros", esse treino **não** teria tiros.
  - Isso precisa entrar na regra da Etapa 4. Por exemplo: voltas por tempo que alternam curtas e longas, com ritmo bem diferente, contam como tiros.
- **A Meia de Floripa** (recebida em 20/11):
  - as voltas são o km automático do relógio (`distance`), que **não** vira tiro;
  - foi gravada no modo "inteligente": 1.216 pontos em 2h43, cerca de 1 a cada 8 s;
  - fuso −3 h.
- **Ainda faltam** um treino estruturado do relógio e um com voltas apertadas à mão. Sem eles, o critério 13 é testado com arquivos sintéticos.

## 3. Tamanho da versão leve do trajeto

- **Formato proposto (JSON):**
  - trajeto simplificado, até 400 pontos, com latitude e longitude em inteiros (×10⁵, cerca de 1 m) e em diferenças;
  - séries a cada 10 s: tempo, distância (m), FC, velocidade (×100), altitude (m) e inclinação (×10), em inteiros.

| Treino | Pontos (1 Hz) | Trajeto leve | Amostras de 10 s | Tamanho | Compactado* |
|---|---|---|---|---|---|
| **Meia de Floripa real (21,21 km, 2h43)** | 1.216 (gravação inteligente) | 216 pontos | 760 | **18,9 KB** | — |
| Meia sintética (21,2 km, 2h42, 1 ponto/s) | 9.721 | 129 pontos | 973 | 25,1 KB | 6,3 KB |
| 14/11 (11,0 km) | 4.821 | 191 pontos | 483 | 13,3 KB | 4,0 KB |
| 17/11 (5,28 km) | 2.401 | 121 pontos | 241 | 6,8 KB | 2,0 KB |
| 19/11 (6,09 km) | 2.521 | 92 pontos | 253 | 6,9 KB | 2,2 KB |

\*Compactado é o que trafega pela internet; o limite de 30 KB vale para o tamanho sem compactar.

- **A meta é de até 30 KB por meia maratona: ok.** A Meia real ficou com 18,9 KB.
- **Decisão do Lucas (20/11): acima de 30 KB, o app avisa, mas importa e sincroniza normalmente.** Uma maratona deve ficar perto de 40 a 50 KB.
- O limite técnico do servidor é 64 KB. Se um treino muito longo passar disso, o app aumenta sozinho o intervalo das séries (de 10 s para 15 s, 20 s…) até caber. O aviso diz isso.

## 4. SQL das 2 migrações (proposta; nada aplicado)

Seguem o modelo de `analise_sync`:
- tabela sem policy;
- acesso só por funções `security definer`;
- chave = hash do código de sincronização. É o mesmo `sync_id` de hoje: SHA-256 de `apexv1:` + código, 64 caracteres.

### `supabase/migrations/2026112xxxxxxx_analise_garmin.sql`

```sql
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
  updated_at       timestamptz not null default now()
);
alter table public.analise_garmin enable row level security;
-- Sem policies e sem funções públicas: só a função "garmin" (service role) lê e grava.
revoke all on table public.analise_garmin from anon, authenticated;
```

### `supabase/migrations/2026112xxxxxxx_analise_tracks.sql`

```sql
create table if not exists public.analise_tracks (
  sync_id    text not null,
  workout_id text not null,
  payload    jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (sync_id, workout_id)
);
alter table public.analise_tracks enable row level security;
revoke all on table public.analise_tracks from anon, authenticated;

create or replace function public.analise_tracks_index(p_sync_id text)
returns table (workout_id text, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select t.workout_id, t.updated_at from public.analise_tracks t where t.sync_id = p_sync_id;
$$;

create or replace function public.analise_tracks_get(p_sync_id text, p_ids text[])
returns table (workout_id text, payload jsonb, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select t.workout_id, t.payload, t.updated_at from public.analise_tracks t
  where t.sync_id = p_sync_id and t.workout_id = any(p_ids[1:20]);   -- até 20 por chamada
$$;

create or replace function public.analise_tracks_put(p_sync_id text, p_workout_id text, p_payload jsonb)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_ts timestamptz;
begin
  if p_sync_id is null or length(p_sync_id) < 16 then raise exception 'sync_id inválido'; end if;
  if p_workout_id is null or length(p_workout_id) > 64 then raise exception 'workout_id inválido'; end if;
  if octet_length(p_payload::text) > 65536 then raise exception 'trajeto maior que 64 KB'; end if;
  insert into public.analise_tracks as t (sync_id, workout_id, payload, updated_at)
  values (p_sync_id, p_workout_id, p_payload, now())
  on conflict (sync_id, workout_id) do update set payload = excluded.payload, updated_at = now()
  returning t.updated_at into v_ts;
  return v_ts;
end; $$;

create or replace function public.analise_tracks_delete(p_sync_id text, p_workout_id text)
returns void
language sql security definer set search_path = public as $$
  delete from public.analise_tracks where sync_id = p_sync_id and workout_id = p_workout_id;
$$;

revoke all on function public.analise_tracks_index(text) from public;
revoke all on function public.analise_tracks_get(text, text[]) from public;
revoke all on function public.analise_tracks_put(text, text, jsonb) from public;
revoke all on function public.analise_tracks_delete(text, text) from public;
grant execute on function public.analise_tracks_index(text) to anon, authenticated;
grant execute on function public.analise_tracks_get(text, text[]) to anon, authenticated;
grant execute on function public.analise_tracks_put(text, text, jsonb) to anon, authenticated;
grant execute on function public.analise_tracks_delete(text, text) to anon, authenticated;
```

## 5. Desenho da função `garmin` (Supabase Edge Function, Deno)

- **Endereço:** um só, `POST /functions/v1/garmin`, com corpo JSON `{ action, syncId, ... }`. O cabeçalho `apikey` é a chave pública do Supabase que o app já usa.
- **Antes de tudo:**
  - **CORS:** só `https://lucassszymczak.github.io` e o endereço local (`http://localhost:5173`). Qualquer outra origem recebe 403, sem os cabeçalhos CORS.
  - **`syncId`:** precisa estar no secret `GARMIN_ALLOWED_SYNC_IDS`. Fora da lista: 403.
  - **Tempo:** limite de 20 s por chamada.

| `action` | Entrada | O que faz | Resposta |
|---|---|---|---|
| `connect` | `apiKey`, `since`, `validadeDias` | Pede um token ao Garmin para validar a chave. Se der certo, cifra e grava a chave e o token. | `{ ok, keyExpiresAt }`. Se a chave for inválida: 400 `chave_invalida`, e nada é gravado |
| `status` | — | Lê a linha | `{ conectado, keyExpiresAt, status, since, filtros, lastListAt }` |
| `list` | `since?` | Usa o token, ou pede outro se faltar menos de 1 h para vencer. Lista em páginas de 100, só corrida e bike. | `{ atividades: [{ id, inicio, inicioLocal, tipo, subtipo, duracaoS, distanciaM }] }` |
| `fit` | `activityId` | Baixa o ZIP e devolve o primeiro `.fit` de dentro | O .FIT, como `application/octet-stream` |
| `settings` | `filtros?`, `since?` | Atualiza "o que trazer" e "desde" | `{ ok }` |
| `disconnect` | — | Apaga a linha inteira (chave e token) | `{ ok }` |

- **Erros**, sempre `{ erro: código, mensagem }`, com mensagem em português:
  - `nao_autorizado` (403);
  - `chave_invalida` (Garmin 401 na troca pelo token);
  - `chave_vencida`;
  - `garmin_fora` (5xx ou timeout, com `retryAt`);
  - `limite` (429, com `retryAt`);
  - `nao_conectado`;
  - `entrada_invalida`.
- **Logs:** só `action`, os 8 primeiros caracteres do `syncId`, o código de status e o tempo. Nunca cabeçalhos, corpo, chave, token nem resposta do Garmin.
- **Teste automático:** varre todas as respostas simuladas da função e confirma que a chave não aparece em nenhuma.
- **Cifra:** AES-GCM do WebCrypto, com IV aleatório de 12 bytes por gravação. A chave-mestra é o secret `GARMIN_ENC_KEY` (32 bytes em base64), gerado na Etapa 1 no seu computador. Ninguém precisa vê-lo.
- **ZIP:** a função descompacta com `fflate` (pequena, sem nada de cifra), importada pelo Deno.
- **Secrets** (configurados na Etapa 1, com você no `supabase login`):
  - `GARMIN_ENC_KEY`;
  - `GARMIN_ALLOWED_SYNC_IDS`;
  - `SUPABASE_SERVICE_ROLE_KEY` (o Supabase já fornece).

## 6. Decisões do Lucas (20/11)

1. **Validade da chave:** sim. O formulário ganha "Validade que você escolheu no Garmin", com padrão de 1 ano.
2. **Tiros em voltas por tempo:** sim. Voltas por tempo que alternam rápido e lento contam como tiros. A regra exata vai para a Etapa 4. O km automático por distância continua não sendo tiro.
3. **Leitor de .FIT:** fica o `@garmin/fitsdk`, o leitor oficial do Garmin, que é o mais completo e o app já usa. Não entra o `fit-file-parser`.
4. **Branch:** muda só o nome. O trabalho segue na `claude/new-session-842fjl`, a única em que esta sessão pode enviar, e chega à `main` por pull request, como na Fase 1.
5. **Arquivos:** a Meia de Floripa chegou (`fixtures/privado/24159622528.fit`, fora do git). Acima de 30 KB: aviso, mas importa (seção 3).
6. **SQL e função:** aprovados, para aplicar na Etapa 1.
