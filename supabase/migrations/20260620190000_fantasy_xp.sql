-- Expected fantasy points per game (xP) for the projected-score model.
alter table public.fantasy_league_players add column if not exists xp numeric;
