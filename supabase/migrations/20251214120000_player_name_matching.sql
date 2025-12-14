-- Migration: Player Name Matching Functions (Improved)
-- Purpose: Enable matching API player names to DB players with fuzzy matching
-- Handles: accents (Güler → Guler), initials (J. Bellingham → Jude Bellingham), suffixes (Jr. → Junior)

-- Function to normalize player names (remove accents, lowercase)
CREATE OR REPLACE FUNCTION normalize_name(name TEXT)
RETURNS TEXT AS $$
  SELECT LOWER(
    translate(name,
      'ÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇŠŽáàâäãåéèêëíìîïóòôöõúùûüñçšžíúóü',
      'AAAAAAEEEEIIIIOOOOOUUUUNCSZaaaaaaeeeeiiiiooooouuuunsziuou'
    )
  );
$$ LANGUAGE SQL IMMUTABLE;

-- Helper: Remove common suffixes (Jr., Junior, III, etc.)
CREATE OR REPLACE FUNCTION remove_name_suffixes(name TEXT)
RETURNS TEXT AS $$
  SELECT TRIM(regexp_replace(
    regexp_replace(name, '\s+(Jr\.?|Junior|Sr\.?|Senior|III|II|IV)$', '', 'i'),
    '\.$', '' -- Remove trailing dots
  ));
$$ LANGUAGE SQL IMMUTABLE;

-- Helper: Extract last name (last word after removing suffixes)
CREATE OR REPLACE FUNCTION extract_last_name(name TEXT)
RETURNS TEXT AS $$
  SELECT (regexp_matches(remove_name_suffixes(normalize_name(name)), '(\S+)$'))[1];
$$ LANGUAGE SQL IMMUTABLE;

-- Helper: Extract first initial
CREATE OR REPLACE FUNCTION extract_first_initial(name TEXT)
RETURNS TEXT AS $$
  SELECT LOWER(LEFT(TRIM(normalize_name(name)), 1));
$$ LANGUAGE SQL IMMUTABLE;

-- Updated matching function with fuzzy matching
-- Basic version (no team filtering) - kept for backwards compatibility
CREATE OR REPLACE FUNCTION match_players_by_name(p_names TEXT[])
RETURNS TABLE (
  original_name TEXT,
  player_id UUID,
  player_name TEXT,
  photo_url TEXT,
  team_id UUID,
  team_name TEXT
) AS $$
  SELECT * FROM match_players_by_name_for_teams(p_names, NULL);
$$ LANGUAGE SQL;

-- Version with team filtering - prioritizes players from specified teams
-- p_team_ids: array of team UUIDs to prioritize (typically home + away team)
CREATE OR REPLACE FUNCTION match_players_by_name_for_teams(p_names TEXT[], p_team_ids UUID[])
RETURNS TABLE (
  original_name TEXT,
  player_id UUID,
  player_name TEXT,
  photo_url TEXT,
  team_id UUID,
  team_name TEXT
) AS $$
  WITH input_names AS (
    SELECT unnest(p_names) AS orig
  ),
  candidates AS (
    SELECT
      i.orig,
      p.id AS player_id,
      p.name AS player_name,
      p.photo AS photo_url,
      pta.team_id,
      t.name AS team_name,
      -- Score: higher = better match
      CASE
        -- Exact match after normalization (best)
        WHEN normalize_name(p.name) = normalize_name(i.orig) THEN 100
        -- Last name matches + first initial matches
        WHEN extract_last_name(p.name) = extract_last_name(i.orig)
         AND extract_first_initial(p.name) = extract_first_initial(i.orig) THEN 90
        -- Last name matches only
        WHEN extract_last_name(p.name) = extract_last_name(i.orig) THEN 80
        ELSE 0
      END AS match_score,
      -- Team priority: players from match teams get priority
      CASE
        WHEN p_team_ids IS NOT NULL AND pta.team_id = ANY(p_team_ids) THEN 1
        ELSE 0
      END AS team_priority
    FROM input_names i
    JOIN fb_players p ON extract_last_name(p.name) = extract_last_name(i.orig)
    LEFT JOIN fb_player_team_association pta ON pta.player_id = p.id AND pta.end_date IS NULL
    LEFT JOIN fb_teams t ON t.id = pta.team_id
    WHERE extract_last_name(p.name) IS NOT NULL
  )
  SELECT DISTINCT ON (orig)
    orig AS original_name,
    player_id,
    player_name,
    photo_url,
    team_id,
    team_name
  FROM candidates
  WHERE match_score >= 80
  ORDER BY orig, team_priority DESC, match_score DESC, team_id NULLS LAST;
$$ LANGUAGE SQL;

-- Create index on extracted last name for better performance
DROP INDEX IF EXISTS idx_fb_players_normalized_name;
CREATE INDEX IF NOT EXISTS idx_fb_players_last_name
ON fb_players (extract_last_name(name));

COMMENT ON FUNCTION normalize_name(TEXT) IS 'Removes accents and converts to lowercase for name matching';
COMMENT ON FUNCTION remove_name_suffixes(TEXT) IS 'Removes common suffixes like Jr., Senior, III from names';
COMMENT ON FUNCTION extract_last_name(TEXT) IS 'Extracts the last name (last word) from a player name';
COMMENT ON FUNCTION extract_first_initial(TEXT) IS 'Extracts the first initial from a player name';
COMMENT ON FUNCTION match_players_by_name(TEXT[]) IS 'Finds players by fuzzy name matching, returns photo and team info';
