# Apex Performance

Web app pessoal (1 usuário) que ingere treinos de corrida (Strava / upload de
arquivo), **confere a qualidade dos dados antes de persistir** e monta
dashboards de performance.

- **Frontend:** React + Vite + TypeScript + Tailwind + Recharts
- **Backend:** Supabase (Postgres + Auth + Edge Functions em Deno)
- **Parsing de atividades:** `.FIT` / `.TCX` / `.GPX` (fonte de verdade das
  métricas por km — não dependemos só do JSON da API)

> **Status:** Passo 1 concluído (setup + schema + seed do atleta). Os passos
> 2–5 (parsing, conferência, OAuth Strava, dashboards) vêm a seguir.

---

## Ordem de construção

1. ✅ **Setup do projeto + schema Supabase + migrations** ← você está aqui
2. ⬜ Upload e parsing de `.FIT/.TCX/.GPX` → gerar splits + `quality_report`
3. ⬜ Camada de conferência com UI de revisão (aprovar/rejeitar/anotar)
4. ⬜ OAuth Strava + ingestão via API como fonte alternativa
5. ⬜ Dashboards e gráficos comparativos

---

## Pré-requisitos

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (para rodar o banco
  localmente e aplicar migrations)
- Uma conta no [Supabase](https://supabase.com) (para o ambiente hospedado)

---

## Setup rápido

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
#   edite .env e cole suas chaves (ver seções abaixo)

# 3. Subir o banco local + aplicar TODAS as migrations (schema + seed)
npm run db:start      # supabase start
#   (a Supabase CLI aplica supabase/migrations/* automaticamente)

# 4. Rodar o frontend
npm run dev           # http://localhost:5173
```

Para recriar o banco do zero (reaplica migrations + seed):

```bash
npm run db:reset
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
