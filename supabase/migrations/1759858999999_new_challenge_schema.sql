DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'game_type_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.game_type_enum AS ENUM ('betting', 'prediction', 'fantasy', 'quiz');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'challenge_format_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.challenge_format_enum AS ENUM ('leaderboard', 'championship', 'elimination');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'sport_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.sport_enum AS ENUM ('football', 'basketball', 'tennis', 'f1', 'nba');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'challenge_status_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.challenge_status_enum AS ENUM ('upcoming', 'active', 'finished');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'match_status_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.match_status_enum AS ENUM ('upcoming', 'live', 'finished', 'postponed', 'cancelled');
  END IF;
END
$$;

-- Create a trigger function for `updated_at`
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table: matches (New dependency for challenge_matches)
-- Stores individual match information.
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    home_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    away_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    league_id UUID REFERENCES public.leagues(id) ON DELETE SET NULL,
    kickoff_time TIMESTAMPTZ NOT NULL,
    status public.match_status_enum DEFAULT 'upcoming',
    score JSONB,
    api_match_id TEXT, -- For mapping to external APIs
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to matches" ON public.matches;
CREATE POLICY "Allow public read access to matches" ON public.matches FOR SELECT USING (true);
DROP TRIGGER IF EXISTS on_matches_update ON public.matches;
CREATE TRIGGER on_matches_update
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Table: challenges
-- The central table for all game modes and challenges.
CREATE TABLE IF NOT EXISTS public.challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    game_type public.game_type_enum NOT NULL,
    format public.challenge_format_enum NOT NULL,
    sport public.sport_enum NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    entry_cost INTEGER DEFAULT 0,
    prizes JSONB,
    rules JSONB,
    status public.challenge_status_enum DEFAULT 'upcoming',
    entry_conditions JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to challenges" ON public.challenges;
CREATE POLICY "Allow public read access to challenges" ON public.challenges FOR SELECT USING (true);
DROP TRIGGER IF EXISTS on_challenges_update ON public.challenges;
CREATE TRIGGER on_challenges_update
  BEFORE UPDATE ON public.challenges
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Table: challenge_leagues
-- Links challenges to specific leagues.
CREATE TABLE IF NOT EXISTS public.challenge_leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(challenge_id, league_id)
);
ALTER TABLE public.challenge_leagues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to challenge_leagues" ON public.challenge_leagues;
CREATE POLICY "Allow public read access to challenge_leagues" ON public.challenge_leagues FOR SELECT USING (true);

-- Table: challenge_matches
-- Links challenges to specific matches.
CREATE TABLE IF NOT EXISTS public.challenge_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(challenge_id, match_id)
);
ALTER TABLE public.challenge_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to challenge_matches" ON public.challenge_matches;
CREATE POLICY "Allow public read access to challenge_matches" ON public.challenge_matches FOR SELECT USING (true);

-- Table: challenge_participants
-- Tracks user participation and progress in challenges.
CREATE TABLE IF NOT EXISTS public.challenge_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    rank INTEGER,
    booster_used BOOLEAN DEFAULT false,
    booster_type TEXT,
    reward JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(challenge_id, user_id)
);
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to see their own participation" ON public.challenge_participants;
CREATE POLICY "Allow users to see their own participation" ON public.challenge_participants FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Allow users to join challenges" ON public.challenge_participants;
CREATE POLICY "Allow users to join challenges" ON public.challenge_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Table: challenge_configs
-- Stores game-type specific configurations for a challenge.
CREATE TABLE IF NOT EXISTS public.challenge_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    config_type TEXT NOT NULL,
    config_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(challenge_id, config_type)
);
ALTER TABLE public.challenge_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to challenge_configs" ON public.challenge_configs;
CREATE POLICY "Allow public read access to challenge_configs" ON public.challenge_configs FOR SELECT USING (true);
