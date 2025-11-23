-- ============================================================================
-- Populate Player Positions from player_match_stats
-- Updates the position column in players table using most common position
-- ============================================================================

-- Update players.position with the most common position from player_match_stats
UPDATE players p
SET position = (
  SELECT pms.position
  FROM player_match_stats pms
  WHERE pms.player_id = p.id
    AND pms.position IS NOT NULL
    AND pms.position != 'Unknown'
  GROUP BY pms.position
  ORDER BY COUNT(*) DESC
  LIMIT 1
)
WHERE p.position IS NULL OR p.position = 'Unknown';

-- Verify the update
SELECT
  position,
  COUNT(*) as player_count
FROM players
GROUP BY position
ORDER BY player_count DESC;

-- Message de confirmation
SELECT 'Player positions populated successfully!' as status;
