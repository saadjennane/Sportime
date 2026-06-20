-- Jersey number per player-team (shown in Fan Pulse Dream "Players to sell").
alter table public.fb_player_team_association add column if not exists shirt_number int;
