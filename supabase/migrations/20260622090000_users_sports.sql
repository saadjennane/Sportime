-- Per-user "sports followed" selector (Profile → Settings). Drives which universe
-- blocks appear in Profile → Stats. Existing users default to both so nothing
-- disappears; the settings toggle lets them refine it.
alter table public.users
  add column if not exists sports text[] not null default '{football,f1}';
