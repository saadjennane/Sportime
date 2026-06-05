-- Vérification du problème de synchronisation Espanyol vs Sevilla

-- ============================================
-- 1. DATE ACTUELLE DANS LA BASE DE DONNÉES
-- ============================================

SELECT
  f.id,
  f.api_id,
  f.date as db_date,
  f.status,
  ht.name as home_team,
  ht.api_team_id as home_api_id,
  at.name as away_team,
  at.api_team_id as away_api_id,
  l.season
FROM fb_fixtures f
JOIN fb_teams ht ON f.home_team_id = ht.id
JOIN fb_teams at ON f.away_team_id = at.id
JOIN fb_leagues l ON f.league_id = l.id
WHERE f.api_id = 1390943;

-- ============================================
-- 2. DATE SELON L'API-FOOTBALL
-- ============================================

-- API dit: 2025-11-24T20:00:00+00:00 (24 novembre à 20h00 UTC)
-- DB dit:  2025-11-23 22:21:02.261+00 (23 novembre à 22h21 UTC)
--
-- DIFFÉRENCE DÉTECTÉE: Le match a été reprogrammé du 23 au 24 novembre !

-- ============================================
-- 3. VÉRIFIER LES LOGS DE SYNCHRONISATION
-- ============================================

SELECT
  id,
  sync_type,
  checked,
  updated,
  schedule_changes,
  created_at
FROM fixture_sync_log
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- 4. VÉRIFIER LES CHANGEMENTS DÉTECTÉS
-- ============================================

SELECT * FROM public.get_recent_fixture_changes(7);

-- ============================================
-- 5. CORRIGER MANUELLEMENT LA DATE
-- ============================================

-- Mettre à jour avec la bonne date de l'API
UPDATE fb_fixtures
SET date = '2025-11-24T20:00:00+00:00'::timestamptz
WHERE api_id = 1390943;

-- Vérifier la correction
SELECT
  api_id,
  date,
  status,
  updated_at
FROM fb_fixtures
WHERE api_id = 1390943;
