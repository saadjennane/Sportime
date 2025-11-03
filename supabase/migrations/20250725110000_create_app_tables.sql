-- Create the countries table
CREATE TABLE IF NOT EXISTS public.countries (
    id TEXT PRIMARY KEY,
    code TEXT,
    flag TEXT
);

-- Create the leagues table
CREATE TABLE IF NOT EXISTS public.leagues (
    id SERIAL PRIMARY KEY,
    api_league_id BIGINT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    logo TEXT,
    type TEXT,
    season TEXT,
    country_id TEXT REFERENCES public.countries(id)
);

-- Create the teams table
CREATE TABLE IF NOT EXISTS public.teams (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    logo TEXT,
    country_id TEXT REFERENCES public.countries(id)
);

-- Create the players table
CREATE TABLE IF NOT EXISTS public.players (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    age INT,
    nationality TEXT,
    team_id BIGINT REFERENCES public.teams(id),
    photo TEXT,
    position TEXT
);

-- Create the fixtures table
CREATE TABLE IF NOT EXISTS public.fixtures (
    id BIGINT PRIMARY KEY,
    league_id BIGINT,
    home_team_id BIGINT REFERENCES public.teams(id),
    away_team_id BIGINT REFERENCES public.teams(id),
    date TIMESTAMPTZ,
    status TEXT,
    goals_home INT,
    goals_away INT
);

-- Create the odds table
CREATE TABLE IF NOT EXISTS public.odds (
    fixture_id BIGINT PRIMARY KEY REFERENCES public.fixtures(id),
    home_win REAL,
    draw REAL,
    away_win REAL,
    bookmaker_name TEXT,
    last_updated TIMESTAMPTZ DEFAULT now()
);

-- Create the api_sync_config table
CREATE TABLE IF NOT EXISTS public.api_sync_config (
    id TEXT PRIMARY KEY,
    frequency TEXT NOT NULL,
    last_sync_at TIMESTAMPTZ
);
