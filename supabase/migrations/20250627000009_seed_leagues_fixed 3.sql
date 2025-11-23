-- Seed leagues table with proper UUIDs for major competitions
-- This ensures league_id references work correctly in challenge_leagues

-- First, check if we need to add RLS policies for leagues
DROP POLICY IF EXISTS "Allow public read access to leagues" ON public.leagues;
CREATE POLICY "Allow public read access to leagues"
  ON public.leagues
  FOR SELECT
  USING (true);

-- Get the admin user's ID (saadjennane@gmail.com) to use as creator
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id FROM public.users WHERE email = 'saadjennane@gmail.com';

  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found';
  END IF;

  -- Insert football competitions into leagues table using admin as creator
  -- country_id is NULL because we don't have countries set up yet
  INSERT INTO public.leagues (id, name, description, logo, type, api_league_id, created_by, invite_code)
  VALUES
    ('11111111-1111-1111-1111-111111111111', 'Premier League', 'English Premier League', 'https://media.api-sports.io/football/leagues/39.png', 'football_competition', 39, admin_user_id, 'PREMIER_LEAGUE'),
    ('22222222-2222-2222-2222-222222222222', 'La Liga', 'Spanish La Liga', 'https://media.api-sports.io/football/leagues/140.png', 'football_competition', 140, admin_user_id, 'LA_LIGA'),
    ('33333333-3333-3333-3333-333333333333', 'Serie A', 'Italian Serie A', 'https://media.api-sports.io/football/leagues/135.png', 'football_competition', 135, admin_user_id, 'SERIE_A'),
    ('44444444-4444-4444-4444-444444444444', 'Bundesliga', 'German Bundesliga', 'https://media.api-sports.io/football/leagues/78.png', 'football_competition', 78, admin_user_id, 'BUNDESLIGA'),
    ('55555555-5555-5555-5555-555555555555', 'Ligue 1', 'French Ligue 1', 'https://media.api-sports.io/football/leagues/61.png', 'football_competition', 61, admin_user_id, 'LIGUE_1'),
    ('66666666-6666-6666-6666-666666666666', 'UEFA Champions League', 'UEFA Champions League', 'https://media.api-sports.io/football/leagues/2.png', 'football_competition', 2, admin_user_id, 'UCL'),
    ('77777777-7777-7777-7777-777777777777', 'UEFA Europa League', 'UEFA Europa League', 'https://media.api-sports.io/football/leagues/3.png', 'football_competition', 3, admin_user_id, 'UEL')
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    logo = EXCLUDED.logo,
    type = EXCLUDED.type,
    api_league_id = EXCLUDED.api_league_id;
END $$;

-- Show the inserted leagues
SELECT id, name, type, api_league_id FROM public.leagues WHERE type = 'football_competition' ORDER BY name;
