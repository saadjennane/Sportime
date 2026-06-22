-- ============================================================================
-- F1 Fan Pulse — Hall of Fame. Fans build their all-time Hall of Fame of drivers
-- and (separately) constructors from a curated candidate pool; the app shows the
-- community consensus (% of fans who inducted each). Seeded via the f1-seed-hof
-- edge function (Wikidata photos).
-- ============================================================================

create table if not exists public.f1_hof_candidates (
  id uuid primary key default gen_random_uuid(),
  kind text not null,            -- driver | constructor
  key text not null,
  name text not null,
  image text,
  meta jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  unique (kind, key)
);

create table if not exists public.f1_hof_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null,            -- driver | constructor
  picks jsonb not null default '[]'::jsonb,   -- array of candidate keys
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);

alter table public.f1_hof_candidates enable row level security;
alter table public.f1_hof_entries enable row level security;
drop policy if exists "hof candidates readable" on public.f1_hof_candidates;
create policy "hof candidates readable" on public.f1_hof_candidates for select to authenticated using (true);
drop policy if exists "hof entries own read" on public.f1_hof_entries;
create policy "hof entries own read" on public.f1_hof_entries for select to authenticated using (user_id = auth.uid());

create or replace function public.f1_hof_save(p_kind text, p_picks jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_kind not in ('driver','constructor') then raise exception 'Bad kind'; end if;
  insert into public.f1_hof_entries (user_id, kind, picks, updated_at)
    values (v_user, p_kind, coalesce(p_picks,'[]'::jsonb), now())
  on conflict (user_id, kind) do update set picks = excluded.picks, updated_at = now();
  return jsonb_build_object('ok', true);
end $function$;

-- Consensus: every candidate of the kind with its induction count + % of fans.
create or replace function public.f1_hof_aggregate(p_kind text)
returns jsonb language sql security definer set search_path to 'public' as $function$
  with parts as (select count(*) n from public.f1_hof_entries where kind = p_kind),
  exploded as (select jsonb_array_elements_text(picks) key from public.f1_hof_entries where kind = p_kind),
  counts as (select key, count(*) c from exploded group by key)
  select jsonb_build_object(
    'participants', (select n from parts),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', cand.key, 'name', cand.name, 'image', cand.image,
        'count', coalesce(co.c, 0),
        'pct', case when (select n from parts) > 0 then round(coalesce(co.c,0) * 100.0 / (select n from parts)) else 0 end
      ) order by coalesce(co.c,0) desc, cand.sort_order)
      from public.f1_hof_candidates cand left join counts co on co.key = cand.key
      where cand.kind = p_kind), '[]'::jsonb));
$function$;

grant execute on function public.f1_hof_save(text, jsonb) to authenticated;
grant execute on function public.f1_hof_aggregate(text) to authenticated;
