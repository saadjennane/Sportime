-- Journey: settlement notifications (MC-3 pick settled / AC-2 first win).
-- `notified_at` marks bets whose result push has been sent. Backfill all EXISTING settled
-- bets as already-notified so we only push for NEW settlements (no historical spam).
alter table public.match_bets add column if not exists notified_at timestamptz;

update public.match_bets
  set notified_at = coalesce(settled_at, updated_at, now())
  where status in ('won', 'lost') and notified_at is null;

create index if not exists match_bets_unnotified
  on public.match_bets (settled_at)
  where status in ('won', 'lost') and notified_at is null;
