-- A legend can play multiple positions -> one row per (player, bucket) sharing a
-- stable player_key (wikidata id) so aggregation counts the player once.
alter table public.fan_pulse_legends add column if not exists player_key text;
create index if not exists idx_fan_pulse_legends_pk on public.fan_pulse_legends(team_id, player_key);
