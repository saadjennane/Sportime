-- ============================================================================
-- CHECK UNIQUE CONSTRAINTS ON LEAGUES, TEAMS, AND PLAYERS
-- ============================================================================

-- Check leagues table constraints
SELECT
  'leagues' as table_name,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'leagues'::regclass
ORDER BY conname;

-- Check teams table constraints
SELECT
  'teams' as table_name,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'teams'::regclass
ORDER BY conname;

-- Check players table constraints
SELECT
  'players' as table_name,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'players'::regclass
ORDER BY conname;

-- Check for duplicate api_ids in leagues
SELECT api_id, COUNT(*) as count
FROM leagues
WHERE api_id IS NOT NULL
GROUP BY api_id
HAVING COUNT(*) > 1;

-- Check for duplicate api_ids in teams
SELECT api_id, COUNT(*) as count
FROM teams
WHERE api_id IS NOT NULL
GROUP BY api_id
HAVING COUNT(*) > 1;

-- Check for duplicate api_ids in players
SELECT api_id, COUNT(*) as count
FROM players
WHERE api_id IS NOT NULL
GROUP BY api_id
HAVING COUNT(*) > 1;
