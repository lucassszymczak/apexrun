-- ============================================================================
-- Fase 2 · Trajeto leve nos dois aparelhos. Mesmo modelo de analise_sync: tabela
-- sem policy; acesso só pelas funções security definer, pelo sync_id (hash).
-- Aprovado pelo Lucas em 20/11/2026 (docs/fase2-etapa0.md).
-- ============================================================================
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
