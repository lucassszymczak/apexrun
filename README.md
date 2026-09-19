# Apex Performance

Web app pessoal (1 usuário) que ingere treinos de corrida (Strava / upload de
arquivo), **confere a qualidade dos dados antes de persistir** e monta
dashboards de performance.

- **Frontend:** React + Vite + TypeScript + Tailwind + Recharts
- **Backend:** Supabase (Postgres + Auth + Edge Functions em Deno)
- **Parsing de atividades:** `.FIT` / `.TCX` / `.GPX` (fonte de verdade das
  métricas por km — não dependemos só do JSON da API)

> **Status:** Passos 1–3 e 5 concluídos (setup + schema + seed; motor de
> ingestão; UI de revisão + persistência; dashboards). Falta o Passo 4 (Strava).

---

## `analise/` — página de análise autônoma (sem backend)

Página **HTML autônoma** (`analise/index.html`) onde o atleta **registra os
treinos** — importando um `.FIT` ou digitando — e recebe a análise conforme o
Livro de Fórmulas. Abra o arquivo no navegador (duplo-clique) ou pelo GitHub
Pages — não precisa de build, servidor nem login. Os dados ficam no
`localStorage` do navegador; há **exportar/importar JSON** para backup.

**Publicada no GitHub Pages** junto do app: uma vez na `main`, fica em
`https://<usuario>.github.io/apexrun/analise/` (o `postbuild` copia a página
para dentro do `dist/` do Vite — ver `scripts/copy-analise.mjs`).

Implementa o **Livro de Fórmulas Apex** direto no front, com o visual
*Run Performance // HEAT* (tema claro/escuro):

- **Importar `.FIT`:** leia o arquivo do relógio e todos os campos entram
  sozinhos — distância, tempo, FC média/máx, cadência (já ×2), ganho/perda de
  elevação, temperatura e **splits por km com FC e Δelevação**. Abre um modal de
  revisão com um bloco em destaque **"Percepção & recuperação"** para o que o
  relógio não grava (**esforço/RPE 0–10, sono, dor**) antes de salvar. O leitor
  `.FIT` é o `@garmin/fitsdk`, carregado sob demanda via CDN
  (`cdn.jsdelivr.net`); tudo roda no navegador, nada sobe para servidor.
- **Aviso de duplicata:** ao salvar um treino numa data que já tem registro, a
  página pergunta **substituir / manter os dois / cancelar** (evita contar o
  mesmo treino duas vezes na carga, na A:C e nos recordes).
- **Recálculo automático:** ao salvar/editar/excluir, o painel inteiro recomputa
  a partir do histórico completo (nenhum KPI fica desatualizado) e persiste no
  `localStorage`.
- **Zonas reais de FC:** o `.FIT` guarda um histograma de FC (bpm→s), então
  **Aderência 80/20** e **Training Distribution** (fácil/moderado/forte) usam
  tempo REAL em zona, e **Hill / Climb Performance** sai dos splits com
  Δelevação (eficiência de subida vs. Minetti, perda de velocidade por rampa).
- **Bike & cross-training (outdoor + indoor):** treinos de ciclismo entram pelo
  mesmo `.FIT` (detectados por `sport`) ou à mão, com seletor de **modalidade**.
  A bike **alimenta a carga** — TRIMP, **Fitness/Fatigue/Form (CTL·ATL·TSB)**,
  razão aguda:crônica e zonas de FC (via FC, que independe da modalidade) — mas
  **fica de fora das métricas de corrida** (EF, GAP, pace, cadência, decoupling,
  km semanais, recordes, Race Prediction), que continuam puras. Uma seção
  **🚴 Bike & cross-training** no painel resume sessões, tempo, carga (TRIMP),
  FC, calorias, zonas e indoor/outdoor; o relatório semanal e o Coach Insight
  passam a contar a bike. Bike indoor não exige distância (só duração + FC).
- **Sincronização entre aparelhos (opcional, sem login):** em **Config →
  Sincronizar**, o app gera um **código de alta entropia** (`apex-xxxx-xxxx-xxxx`);
  digitando o mesmo código no outro aparelho, os treinos passam a aparecer nos
  dois (celular e notebook). Sincroniza via Supabase: o **hash SHA-256** do
  código (o código cru nunca sai do dispositivo) é a chave de uma linha JSON,
  acessada só por **RPC `security definer`** (papel `anon`, sem enumeração). O
  merge é **união por id** (o que você importa num aparelho aparece no outro),
  "o mais novo vence" em conflitos, com **tombstones** para propagar exclusões.
  Requer aplicar a migração `supabase/migrations/*_analise_sync.sql` uma vez.
  Sem as chaves públicas no build, a sync fica desligada e tudo roda local.
- **Recuperação (Apple Watch):** aba dedicada com **Diário** (sono, FC de
  repouso, HRV/SDNN, VO₂máx, ânimo) — preenchido à mão ou **importando o
  `export.xml` do app Saúde** (lido em pedaços no navegador; extrai só essas 4
  métricas). Alimenta **Running Readiness** (agora com sono/HRV/FC de repouso vs.
  baseline), ativa **Recovery Status** (good/moderate/needs recovery), torna
  **VO₂máx** e **FC de repouso** semi-automáticos e mostra suas tendências.
- **Registro manual:** data, tipo, distância, duração, FC média/máx, cadência,
  ganho/perda de elevação, RPE, temperatura, sono, dor, e **splits por km**
  (`tempo, FC, Δelev`) opcionais.
- **KPIs calculados** (fiéis ao livro): GAP (Minetti assimétrico km a km),
  Efficiency Factor, Decoupling, Cadência, Velocidade-GAP, Custo cardíaco/km,
  TRIMP, Carga semanal, **Fitness/Fatigue/Form (CTL·ATL·TSB)**, razão
  aguda:crônica, aderência 80/20, Pacing Strategy, Pace Stability, Performance
  Trend, **Race Prediction (Riegel)**, Athlete Performance Score, Running
  Readiness, Consistency, VO₂máx e Athlete Profile — cada um com badge de
  confiança, como no livro.
- **Painel** (tiles + gráficos SVG de evolução: EF, decoupling, cadência,
  GAP, carga, CTL/ATL), **Relatório semanal** (um card por semana), **referência
  de KPIs** e **configuração do atleta** (FCrep, FCmáx, VO₂, metas).
- Vem **semeada com os dados reais do baseline** (5K de 07/09, calibração
  Floripa, Meia de 29/08) para já abrir com o painel montado.

O motor de KPIs e a leitura de `.FIT` têm módulos de referência espelhados,
validados por testes standalone (a página embute a mesma lógica):

```bash
node analise/kpi.test.mjs        # 37 casos — GAP, EF, TRIMP, CTL/ATL, A:C, Riegel, bike/modalidade…
node analise/fit.test.mjs        # 36 casos — encode→decode→map (@garmin/fitsdk), corrida + bike indoor
node analise/recovery.test.mjs   # 23 casos — zonas/80-20, Hill, recovery + export.xml do Saúde
node analise/sync.test.mjs       # 17 casos — merge entre aparelhos (união por id, tombstones, código)
```

Complementa — não substitui — o pipeline de ingestão de `.FIT` do app React acima.

---

## Ordem de construção

1. ✅ **Setup do projeto + schema Supabase + migrations**
2. ✅ **Upload e parsing de `.FIT/.TCX/.GPX` → splits + `quality_report`**
3. ✅ **Camada de conferência com UI de revisão + persistência**
4. ⬜ OAuth Strava + ingestão via API como fonte alternativa
5. ✅ **Dashboards e gráficos comparativos** ← aqui

### Dashboards (Passo 5)

`src/features/dashboard/` — lê dados JÁ persistidos (não recalcula splits no front):

- **Diário filtrável** (tipo / status / dor) — funciona com o histórico do seed.
- **Tendência semanal** — pace médio, FC média e eficiência (pace/FC) por semana,
  em *small multiples* (nunca eixo duplo).
- **Comparativo por km** — longões entre si e qualidade entre si, sobrepostos, com
  o treino mais recente em destaque e os antigos em opacidade menor (automático).
  Preenche conforme você registra `.FIT` marcados como longão/qualidade.
- **Tempo nas zonas de FC** — a partir dos streams (FC por segundo) dos treinos
  registrados por arquivo, usando as zonas do atleta.

Transformações puras e testadas em `transform.ts`; em desenvolvimento há um
preview dos gráficos em `http://localhost:5173/#preview` (dados de exemplo).

### Revisão e persistência (Passo 3)

Fluxo: upload → o motor analisa → **você revisa** (métricas + splits + achados da
conferência), **anota** (data, tipo, RPE, dor, obs) e **aprova ou rejeita**.
Nada é gravado antes da sua confirmação (regra do treinador).

- Aprovar → grava `activities` + `splits` + `data_issues` com o veredito
  automático (`ok`/`warning`) e `confirmed_at` (oficial).
- Rejeitar → grava marcado como `rejected` (não oficial), para não reprocessar.
- Persistência direto do browser autenticado, **sob RLS** (`src/features/ingest/
  persist.ts`). A lista "Últimos treinos registrados" mostra o histórico do seed
  + o que você acabou de aprovar.

### Motor de ingestão (Passo 2)

Núcleo determinístico e runtime-agnóstico em `src/core/` (roda no browser para
preview e, depois, numa Edge Function para persistir):

- `parse/` — parsers `.FIT` (fit-file-parser), `.GPX` e `.TCX` → streams
  normalizados.
- `metrics/gap.ts` — GAP (Grade Adjusted Pace) via polinômio de Minetti (2002),
  com fonte documentada no código.
- `metrics/splits.ts` — splits por km (corte interpolado a cada 1000m; último km
  parcial sinalizado, nunca misturado).
- `metrics/aggregate.ts` — métricas agregadas + cardiac drift (1ª vs 2ª metade
  a pace estável).
- `quality/checks.ts` — camada de conferência: GPS gaps, pausas/auto-pause, FC
  ausente/travada/spike, distância divergente, elevação ruidosa, splits
  incompletos. Nunca conserta em silêncio — só reporta.

Rodar os testes do motor: `npm test` (Vitest, dados sintéticos). A UI de upload
(`src/features/ingest/`) analisa o arquivo 100% no navegador e mostra splits +
relatório de conferência (persistência entra no Passo 3).

---

## Pré-requisitos

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (para rodar o banco
  localmente e aplicar migrations)
- Uma conta no [Supabase](https://supabase.com) (para o ambiente hospedado)

---

## Setup rápido (projeto Supabase hospedado)

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
#   edite .env e cole VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
#   (Supabase → Project Settings → API)

# 3. Aplicar as migrations (schema + seed) no seu projeto hospedado
npm run db:login                          # abre o browser p/ autenticar a CLI
npm run db:link -- --project-ref <REF>    # <REF> = subdomínio da Project URL
npm run db:push                           # aplica supabase/migrations/* (pede a senha do banco)

# 4. Criar o seu usuário (dispara o seed do atleta)
#   Painel → Authentication → Users → Add user (email + senha, auto-confirm).
#   Um trigger reivindica o perfil do atleta do seed automaticamente.

# 5. Rodar o frontend e entrar com esse email/senha
npm run dev           # http://localhost:5173
```

> `<REF>` é o identificador do projeto: em `https://abcd1234.supabase.co`, o REF
> é `abcd1234`. Você também pode rodar os comandos direto: `npx supabase link
> --project-ref <REF>` e `npx supabase db push`.

### Alternativa: banco local (precisa de Docker)

```bash
npm run db:start      # sobe Postgres local + aplica migrations
npm run db:reset      # recria do zero (reaplica migrations + seed)
```

---

## Onde colar as chaves

Todas as chaves ficam em `.env` (nunca commitado). Veja `.env.example`.

| Variável                   | Onde obter                                             | Lado        |
| -------------------------- | ------------------------------------------------------ | ----------- |
| `VITE_SUPABASE_URL`        | Supabase → Project Settings → API → Project URL        | frontend    |
| `VITE_SUPABASE_ANON_KEY`   | Supabase → Project Settings → API → anon public key    | frontend    |
| `SUPABASE_SERVICE_ROLE_KEY`| Supabase → Project Settings → API → service_role key   | backend/Edge |
| `VITE_STRAVA_CLIENT_ID`    | Strava → Settings → API                                | frontend    |
| `STRAVA_CLIENT_SECRET`     | Strava → Settings → API                                | backend/Edge |
| `STRAVA_REDIRECT_URI`      | você define; deve bater com o app do Strava            | ambos       |

> ⚠️ O `service_role` do Supabase e o `client_secret` do Strava **nunca** vão
> para o frontend. Eles só são usados em Edge Functions (backend).

---

## Passo a passo do OAuth Strava

Necessário só a partir do **Passo 4**. Deixado documentado aqui para referência.

1. Acesse <https://www.strava.com/settings/api> e crie um app ("Create & Manage
   Your App").
2. Preencha:
   - **Application Name:** Apex Performance (ou o que preferir)
   - **Category:** Training / Data importer
   - **Website:** `http://localhost:5173` (dev)
   - **Authorization Callback Domain:** `localhost` (só o domínio, sem `http://`
     e sem porta)
3. Após criar, o Strava mostra:
   - **Client ID** → cole em `VITE_STRAVA_CLIENT_ID`
   - **Client Secret** → cole em `STRAVA_CLIENT_SECRET`
4. No `.env`, defina o callback completo que a app usa:
   `STRAVA_REDIRECT_URI=http://localhost:5173/auth/strava/callback`
5. **Escopos (scopes)** necessários para ler atividades e streams:
   `read,activity:read_all`
6. Fluxo (implementado no Passo 4):
   - Frontend redireciona para
     `https://www.strava.com/oauth/authorize?client_id=...&response_type=code&redirect_uri=...&scope=read,activity:read_all&approval_prompt=auto`
   - O Strava volta para o `redirect_uri` com um `code`.
   - Uma **Edge Function** troca o `code` por `access_token` +
     `refresh_token` usando o `STRAVA_CLIENT_SECRET` (server-side) e persiste
     os tokens com segurança.
   - Depois, a Edge Function chama
     `GET /activities/{id}/streams?keys=time,distance,heartrate,altitude,latlng`
     para puxar os streams.

> **Nota de ingestão:** a API do Strava não entrega FC por km nem GAP de forma
> confiável. Por isso o arquivo `.FIT` (upload) tem prioridade nos cálculos por
> km; a API complementa metadados (nome, tipo, data).

---

## Estrutura do projeto

```
apexrun/
├─ src/
│  ├─ lib/supabase.ts        # cliente Supabase (frontend)
│  ├─ types/database.ts      # tipos TS espelhando o schema
│  ├─ App.tsx                # shell da UI
│  └─ main.tsx
├─ supabase/
│  ├─ config.toml
│  └─ migrations/
│     ├─ 20260817120000_initial_schema.sql   # tabelas, enums, índices, triggers
│     ├─ 20260817120100_rls_policies.sql     # Row Level Security
│     ├─ 20260817120200_auth_claim_trigger.sql # liga atleta ao 1º usuário Auth
│     └─ 20260817120300_seed_athlete.sql     # seed do atleta + insights
├─ .env.example
└─ package.json
```

---

## Modelo de dados (resumo)

- **athletes** — perfil (demografia, `fc_max_estimada`, `zonas_fc`,
  `pace_calibracao`, `meta_prova`, `flags_clinicas`). 1 por usuário Auth.
- **athlete_notes** — "insights conhecidos" (cardiac drift, negative split,
  lesão, cadência) exibidos sem reprocessar.
- **activities** — cada sessão de treino: metadados + métricas agregadas +
  `quality_status` + `quality_report` + `raw_streams`.
- **splits** — métricas por km (pace, FC, elevação, GAP); último km parcial é
  sinalizado (`parcial = true`), nunca misturado.
- **data_issues** — problemas detectados na conferência (tipo, severidade,
  descrição, resolvido).

### Histórico vs. novos treinos (dois fluxos)

- **Histórico (seed):** `source = 'manual'`, `quality_status = 'ok'`. Confiável
  por definição — **não** passa pela camada de conferência.
- **Novos (Strava/FIT):** sempre passam pela camada de conferência antes de
  virarem oficiais (`confirmed_at`).

---

## Segurança

- RLS habilitado em todas as tabelas; tudo escopado por `athletes.user_id =
  auth.uid()`.
- O perfil do atleta é criado pelo seed com `user_id = NULL` e é
  **reivindicado** automaticamente no primeiro cadastro no Supabase Auth
  (trigger em `auth.users`).
