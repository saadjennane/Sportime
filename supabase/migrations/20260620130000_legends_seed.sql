-- Unique key for on-demand legends seeding (seed-legends edge function upserts here).
create unique index if not exists fan_pulse_legends_team_player_uq on public.fan_pulse_legends(team_id, player_key);
