-- ============================================================================
-- Manual Phase 2.5 Sync - Force sync from staging to production
-- This bypasses the Edge Function and does the sync directly in SQL
-- ============================================================================

-- STEP 0: Sync Leagues (fb_leagues → leagues) - CRITICAL FOR PHASE 3
-- This will INSERT new leagues or UPDATE existing ones based on api_id
INSERT INTO public.leagues (api_id, name, invite_code, created_by, logo, type, season, created_at)
SELECT
  fb.api_league_id as api_id,
  fb.name,
  'AUTO-' || fb.api_league_id::text as invite_code, -- Generate unique invite code
  (SELECT id FROM public.users ORDER BY created_at ASC LIMIT 1) as created_by, -- Use first user in DB
  fb.logo,
  fb.type,
  fb.season::text,
  NOW() as created_at
FROM fb_leagues fb
ON CONFLICT (api_id)
DO UPDATE SET
  name = EXCLUDED.name,
  logo = EXCLUDED.logo,
  type = EXCLUDED.type,
  season = EXCLUDED.season;

-- Show leagues sync result
SELECT
  'Leagues Sync Result' as info,
  COUNT(*) as total_leagues_synced
FROM leagues
WHERE api_id IS NOT NULL;

-- STEP 1: Sync Teams (fb_teams → teams)
-- This will INSERT new teams or UPDATE existing ones based on api_id
INSERT INTO public.teams (api_id, name, code, logo_url, country, created_at, updated_at)
SELECT
  fb.id as api_id,
  fb.name,
  fb.code,
  COALESCE(fb.logo, 'https://via.placeholder.com/150') as logo_url, -- Use logo field, fallback to placeholder
  fb.country,
  NOW() as created_at,
  NOW() as updated_at
FROM fb_teams fb
ON CONFLICT (api_id)
DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  logo_url = EXCLUDED.logo_url,
  country = EXCLUDED.country,
  updated_at = NOW();

-- Show teams sync result
SELECT
  'Teams Sync Result' as info,
  COUNT(*) as total_teams_synced
FROM teams
WHERE api_id IS NOT NULL;

-- STEP 2: Sync Players (fb_players → players)
-- This will INSERT new players or UPDATE existing ones based on api_id
INSERT INTO public.players (api_id, first_name, last_name, photo_url, position, nationality, birthdate, created_at, updated_at)
SELECT
  fb.id as api_id,
  COALESCE(fb.firstname, SPLIT_PART(fb.name, ' ', 1), 'Unknown') as first_name, -- Use firstname or extract from name
  COALESCE(fb.lastname, SPLIT_PART(fb.name, ' ', 2), 'Player') as last_name, -- Use lastname or extract from name
  COALESCE(fb.photo, 'https://via.placeholder.com/150') as photo_url, -- Map photo to photo_url
  COALESCE(fb.position, 'Unknown') as position,
  COALESCE(fb.nationality, 'Unknown') as nationality,
  COALESCE(fb.birth_date, '2000-01-01'::date) as birthdate, -- Use birth_date or default to 2000-01-01
  NOW() as created_at,
  NOW() as updated_at
FROM fb_players fb
ON CONFLICT (api_id)
DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  photo_url = EXCLUDED.photo_url,
  position = EXCLUDED.position,
  nationality = EXCLUDED.nationality,
  birthdate = EXCLUDED.birthdate,
  updated_at = NOW();

-- Show players sync result
SELECT
  'Players Sync Result' as info,
  COUNT(*) as total_players_synced
FROM players
WHERE api_id IS NOT NULL;

-- STEP 3: Verify sync
SELECT
  '✅ SYNC VERIFICATION' as status,
  (SELECT COUNT(*) FROM teams WHERE api_id IS NOT NULL) as teams_synced,
  (SELECT COUNT(*) FROM players WHERE api_id IS NOT NULL) as players_synced,
  (SELECT COUNT(*) FROM fb_teams) as teams_in_staging,
  (SELECT COUNT(*) FROM fb_players) as players_in_staging;

-- Show success message
SELECT '🎉 Phase 2.5 sync completed manually!' as message;
