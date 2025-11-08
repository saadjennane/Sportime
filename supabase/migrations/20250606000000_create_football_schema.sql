/*
          # [Function] Create handle_updated_at function
          Creates a trigger function to automatically update the `updated_at` timestamp on any row modification.

          ## Query Description: This function ensures that the `updated_at` column is always current, which is essential for tracking data changes, caching, and debugging. It will be attached to all new tables.
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Creates a new function `public.handle_updated_at`.
          
          ## Security Implications:
          - RLS Status: Not Applicable
          - Policy Changes: No
          - Auth Requirements: None
          
          ## Performance Impact:
          - Triggers: This function is intended to be used in triggers.
          - Estimated Impact: Negligible performance impact on write operations.
          */
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

/*
          # [Table] Create Leagues table
          Stores information about different football leagues and tournaments.

          ## Query Description: This operation creates a new table to hold league data. It is a foundational table and does not affect existing data.
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Table: `public.Leagues`
          - Columns: `id`, `name`, `country_or_region`, `logo_url`, `created_at`, `updated_at`
          
          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes (Adds a policy for public read access)
          - Auth Requirements: None for reading
          
          ## Performance Impact:
          - Indexes: Primary key index on `id`.
          - Triggers: `on_update` trigger for `updated_at`.
          - Estimated Impact: None.
          */
CREATE TABLE public.leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    country_or_region TEXT NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access to leagues"
ON public.leagues
FOR SELECT
USING (true);

-- Add updated_at trigger
CREATE TRIGGER on_leagues_update
BEFORE UPDATE ON public.leagues
FOR EACH ROW
EXECUTE PROCEDURE public.handle_updated_at();

/*
          # [Table] Create Teams table
          Stores information about individual football teams.

          ## Query Description: This operation creates a new table for team data. It is a foundational table and does not affect existing data.
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Table: `public.Teams`
          - Columns: `id`, `name`, `logo_url`, `country`, `created_at`, `updated_at`
          
          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes (Adds a policy for public read access)
          - Auth Requirements: None for reading
          
          ## Performance Impact:
          - Indexes: Primary key index on `id`.
          - Triggers: `on_update` trigger for `updated_at`.
          - Estimated Impact: None.
          */
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    logo_url TEXT NOT NULL,
    country TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access to teams"
ON public.teams
FOR SELECT
USING (true);

-- Add updated_at trigger
CREATE TRIGGER on_teams_update
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE PROCEDURE public.handle_updated_at();

/*
          # [Table] Create Team_League_Participation table
          A join table to track which teams participate in which leagues for a given season.

          ## Query Description: This operation creates a new join table. It establishes a many-to-many relationship between teams and leagues.
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Table: `public.team_league_participation`
          - Columns: `id`, `team_id`, `league_id`, `season`, `group`, `created_at`, `updated_at`
          - Foreign Keys: to `teams(id)` and `leagues(id)`.
          
          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes (Adds a policy for public read access)
          - Auth Requirements: None for reading
          
          ## Performance Impact:
          - Indexes: Primary key on `id`, and foreign key indexes on `team_id` and `league_id`.
          - Triggers: `on_update` trigger for `updated_at`.
          - Estimated Impact: None.
          */
CREATE TABLE public.team_league_participation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    season TEXT NOT NULL,
    "group" TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_league_participation ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access to team participations"
ON public.team_league_participation
FOR SELECT
USING (true);

-- Add indexes for foreign keys
CREATE INDEX ON public.team_league_participation (team_id);
CREATE INDEX ON public.team_league_participation (league_id);

-- Add updated_at trigger
CREATE TRIGGER on_team_league_participation_update
BEFORE UPDATE ON public.team_league_participation
FOR EACH ROW
EXECUTE PROCEDURE public.handle_updated_at();


/*
          # [Table] Create Players table
          Stores detailed information about individual players.

          ## Query Description: This operation creates a new table for player data. It is a foundational table and does not affect existing data.
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Table: `public.Players`
          - Columns: `id`, `first_name`, `last_name`, `photo_url`, `nationality`, `birthdate`, `position`, `height_cm`, `weight_kg`, `created_at`, `updated_at`
          
          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes (Adds a policy for public read access)
          - Auth Requirements: None for reading
          
          ## Performance Impact:
          - Indexes: Primary key index on `id`.
          - Triggers: `on_update` trigger for `updated_at`.
          - Estimated Impact: None.
          */
CREATE TABLE public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    nationality TEXT NOT NULL,
    birthdate DATE NOT NULL,
    "position" TEXT NOT NULL,
    height_cm INTEGER,
    weight_kg INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access to players"
ON public.players
FOR SELECT
USING (true);

-- Add updated_at trigger
CREATE TRIGGER on_players_update
BEFORE UPDATE ON public.players
FOR EACH ROW
EXECUTE PROCEDURE public.handle_updated_at();


/*
          # [Table] Create Player_Team_Association table
          A join table to track a player's history with different teams over time.

          ## Query Description: This operation creates a new join table to establish a many-to-many relationship between players and teams, tracking their career history.
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Table: `public.player_team_association`
          - Columns: `id`, `player_id`, `team_id`, `start_date`, `end_date`, `created_at`, `updated_at`
          - Foreign Keys: to `players(id)` and `teams(id)`.
          
          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes (Adds a policy for public read access)
          - Auth Requirements: None for reading
          
          ## Performance Impact:
          - Indexes: Primary key on `id`, and foreign key indexes on `player_id` and `team_id`.
          - Triggers: `on_update` trigger for `updated_at`.
          - Estimated Impact: None.
          */
CREATE TABLE public.player_team_association (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.player_team_association ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access to player associations"
ON public.player_team_association
FOR SELECT
USING (true);

-- Add indexes for foreign keys
CREATE INDEX ON public.player_team_association (player_id);
CREATE INDEX ON public.player_team_association (team_id);

-- Add updated_at trigger
CREATE TRIGGER on_player_team_association_update
BEFORE UPDATE ON public.player_team_association
FOR EACH ROW
EXECUTE PROCEDURE public.handle_updated_at();
