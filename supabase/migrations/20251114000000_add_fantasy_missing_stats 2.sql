/*
  Add Missing Fantasy Scoring Fields

  This migration adds critical fields required for Fantasy game scoring
  calculations to the player_match_stats and player_season_stats tables.

  Missing fields identified:
  - clean_sheet (CRITICAL: +4pts for GK/DEF)
  - penalties_saved (CRITICAL: +5pts)
  - penalties_missed (CRITICAL: -2pts)
  - interceptions (MEDIUM: +1pt)
  - passes_key (MEDIUM: +1pt) - only for match stats
  - duels_lost (MEDIUM: for completeness)
*/

-- ============================================================================
-- Add missing Fantasy scoring fields to player_match_stats
-- ============================================================================

ALTER TABLE player_match_stats
  ADD COLUMN IF NOT EXISTS clean_sheet BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS penalties_saved INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalties_missed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interceptions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passes_key INTEGER DEFAULT 0;

COMMENT ON COLUMN player_match_stats.clean_sheet IS
  'Whether player kept a clean sheet (no goals conceded while playing). GK/DEF: +4pts in Fantasy';

COMMENT ON COLUMN player_match_stats.penalties_saved IS
  'Number of penalties saved. +5pts each in Fantasy';

COMMENT ON COLUMN player_match_stats.penalties_missed IS
  'Number of penalties missed. -2pts each in Fantasy';

COMMENT ON COLUMN player_match_stats.interceptions IS
  'Number of interceptions made. +1pt each in Fantasy';

COMMENT ON COLUMN player_match_stats.passes_key IS
  'Number of key passes (passes leading to shots). +1pt each in Fantasy';

-- ============================================================================
-- Add missing Fantasy scoring fields to player_season_stats
-- ============================================================================

ALTER TABLE player_season_stats
  ADD COLUMN IF NOT EXISTS penalties_saved INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalties_missed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duels_lost INTEGER DEFAULT 0;

COMMENT ON COLUMN player_season_stats.penalties_saved IS
  'Total penalties saved in season';

COMMENT ON COLUMN player_season_stats.penalties_missed IS
  'Total penalties missed in season';

COMMENT ON COLUMN player_season_stats.duels_lost IS
  'Total duels lost in season';

-- ============================================================================
-- Create index for clean_sheet queries (frequently queried for GK/DEF)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_player_match_stats_clean_sheet
  ON player_match_stats(clean_sheet)
  WHERE clean_sheet = true;

-- ============================================================================
-- Note: Advanced stats NOT included (unavailable in API-Sports)
-- ============================================================================

-- The following stats from Fantasy engine are not tracked:
-- - own_goal (-5pts) - Rare event, not reliably available from API
-- - big_chance_missed (-2pts) - Not available in API-Sports free tier
-- - error_lead_to_goal (-3pts) - Not available in API-Sports free tier
--
-- These will be ignored in Fantasy scoring calculations for MVP.
