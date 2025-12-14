-- Migration: Improved Player Name Matching Functions
-- Purpose: Enable fuzzy matching for player names (handles initials, suffixes, accents)

-- Helper: Remove common suffixes (Jr., Junior, III, etc.)
CREATE OR REPLACE FUNCTION remove_name_suffixes(name TEXT)
RETURNS TEXT AS $$
  SELECT TRIM(regexp_replace(
    regexp_replace(name, '\s+(Jr\.?|Junior|Sr\.?|Senior|III|II|IV)$', '', 'i'),
    '\.$', ''
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
CREATE OR REPLACE FUNCTION match_players_by_name(p_names TEXT[])
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
      CASE
        WHEN normalize_name(p.name) = normalize_name(i.orig) THEN 100
        WHEN extract_last_name(p.name) = extract_last_name(i.orig)
         AND extract_first_initial(p.name) = extract_first_initial(i.orig) THEN 90
        WHEN extract_last_name(p.name) = extract_last_name(i.orig) THEN 80
        ELSE 0
      END AS match_score
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
  ORDER BY orig, match_score DESC, team_id NULLS LAST;
$$ LANGUAGE SQL;
