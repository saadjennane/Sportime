-- ============================================================================
-- Diagnostic: Vérifier les api_id dans fb_teams
-- ============================================================================

-- 1. Vérifier la structure de fb_teams
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'fb_teams'
ORDER BY ordinal_position;

-- 2. Compter les équipes avec/sans api_id
SELECT
  COUNT(*) as total_teams,
  COUNT(api_id) as teams_with_api_id,
  COUNT(*) - COUNT(api_id) as teams_without_api_id,
  COUNT(logo) as teams_with_logo,
  COUNT(*) - COUNT(logo) as teams_without_logo
FROM fb_teams;

-- 3. Échantillon d'équipes avec toutes les colonnes
SELECT
  id,
  name,
  logo,
  api_id,
  country,
  founded,
  national
FROM fb_teams
LIMIT 10;

-- 4. Vérifier les fixtures et leurs équipes avec api_id
SELECT
  f.id as fixture_id,
  f.date,
  f.status,
  f.home_team_id,
  ht.name as home_name,
  ht.logo as home_logo,
  ht.api_id as home_api_id,
  f.away_team_id,
  at.name as away_name,
  at.logo as away_logo,
  at.api_id as away_api_id
FROM fb_fixtures f
LEFT JOIN fb_teams ht ON ht.id = f.home_team_id
LEFT JOIN fb_teams at ON at.id = f.away_team_id
WHERE f.date >= NOW() - INTERVAL '1 day'
  AND f.date <= NOW() + INTERVAL '1 day'
ORDER BY f.date
LIMIT 5;

-- 5. Vérifier les équipes qui n'ont PAS d'api_id (problématique!)
SELECT
  id,
  name,
  logo,
  api_id,
  country
FROM fb_teams
WHERE api_id IS NULL
LIMIT 10;

-- Message de fin
SELECT '✓ Diagnostic api_id terminé. Vérifiez les résultats ci-dessus.' as status;
