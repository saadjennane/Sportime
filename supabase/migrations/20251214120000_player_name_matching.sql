-- Migration: Player Name Matching Functions
-- Purpose: Enable matching API player names (without accents) to DB players (with accents)
-- Example: "Inaki Williams" → "Iñaki Williams"

-- Function to normalize player names (remove accents, lowercase)
CREATE OR REPLACE FUNCTION normalize_name(name TEXT)
RETURNS TEXT AS $$
  SELECT LOWER(
    translate(name,
      'ÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇŠŽáàâäãåéèêëíìîïóòôöõúùûüñçšž',
      'AAAAAAEEEEIIIIOOOOOUUUUNCSZaaaaaaeeeeiiiiooooouuuuncsz'
    )
  );
$$ LANGUAGE SQL IMMUTABLE;

-- Function to find players by normalized name with team info
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
  )
  SELECT DISTINCT ON (i.orig)
    i.orig AS original_name,
    p.id AS player_id,
    p.name AS player_name,
    p.photo AS photo_url,
    pta.team_id,
    t.name AS team_name
  FROM input_names i
  JOIN fb_players p ON normalize_name(p.name) = normalize_name(i.orig)
  LEFT JOIN fb_player_team_association pta ON pta.player_id = p.id AND pta.end_date IS NULL
  LEFT JOIN fb_teams t ON t.id = pta.team_id
  ORDER BY i.orig, pta.start_date DESC NULLS LAST;
$$ LANGUAGE SQL;

-- Create index on normalized name for better performance
CREATE INDEX IF NOT EXISTS idx_fb_players_normalized_name
ON fb_players (normalize_name(name));

COMMENT ON FUNCTION normalize_name(TEXT) IS 'Removes accents and converts to lowercase for name matching';
COMMENT ON FUNCTION match_players_by_name(TEXT[]) IS 'Finds players by normalized name, returns photo and team info';
