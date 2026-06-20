-- Injury flag for players (used by Fan Pulse "Upcoming match" — injured players stay
-- selectable but are marked with a cross). Synced daily from API-Football /injuries
-- (a player flagged as missing an upcoming fixture).
alter table public.fb_players add column if not exists injured boolean not null default false;
