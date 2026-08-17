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
-- =============================================================================

-- -----------------------------------------------------------------------------
-- athletes
-- -----------------------------------------------------------------------------
alter table public.athletes enable row level security;

create policy "athletes: dono lê"
  on public.athletes for select
  using (user_id = (select auth.uid()));

create policy "athletes: dono insere"
  on public.athletes for insert
  with check (user_id = (select auth.uid()));

create policy "athletes: dono atualiza"
  on public.athletes for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "athletes: dono remove"
  on public.athletes for delete
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- activities — acessível se pertence a um atleta do usuário.
-- -----------------------------------------------------------------------------
alter table public.activities enable row level security;

create policy "activities: dono lê"
  on public.activities for select
  using (
    athlete_id in (
      select id from public.athletes where user_id = (select auth.uid())
    )
  );

create policy "activities: dono insere"
  on public.activities for insert
  with check (
    athlete_id in (
      select id from public.athletes where user_id = (select auth.uid())
    )
  );

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

create policy "athlete_notes: dono lê"
  on public.athlete_notes for select
  using (
    athlete_id in (
      select id from public.athletes where user_id = (select auth.uid())
    )
  );

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
