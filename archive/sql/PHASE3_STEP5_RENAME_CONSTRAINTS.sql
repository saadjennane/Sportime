-- ============================================================================
-- PHASE 3 STEP 5: RENAME CONSTRAINTS FOR CONSISTENCY
-- ============================================================================
-- After fixing foreign keys, the constraint names still use old prefixes
-- (e.g., fixtures_league_id_fkey instead of fb_fixtures_league_id_fkey)
--
-- This is optional but improves consistency and maintainability

-- ============================================================================
-- Rename fb_fixtures foreign key constraints
-- ============================================================================

-- Rename league_id FK
ALTER TABLE fb_fixtures
  RENAME CONSTRAINT fixtures_league_id_fkey
  TO fb_fixtures_league_id_fkey;

-- Rename home_team_id FK
ALTER TABLE fb_fixtures
  RENAME CONSTRAINT fixtures_home_team_id_fkey
  TO fb_fixtures_home_team_id_fkey;

-- Rename away_team_id FK
ALTER TABLE fb_fixtures
  RENAME CONSTRAINT fixtures_away_team_id_fkey
  TO fb_fixtures_away_team_id_fkey;

-- ============================================================================
-- Verify renamed constraints
-- ============================================================================

SELECT
  '=== RENAMED FB_FIXTURES CONSTRAINTS ===' as section,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS references_table,
  ccu.column_name AS references_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'fb_fixtures'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY kcu.column_name;
