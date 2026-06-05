-- Script simple pour mettre à jour les données (APRÈS suppression des triggers)

-- ============================================
-- 1. METTRE À JOUR LA SAISON DE LA LIGA
-- ============================================

UPDATE fb_leagues
SET season = 2025
WHERE api_league_id = 140;

-- Vérifier
SELECT id, name, api_league_id, season
FROM fb_leagues
WHERE api_league_id = 140;

-- ============================================
-- 2. METTRE À JOUR LES API_TEAM_ID
-- ============================================

UPDATE fb_teams
SET api_team_id = 540
WHERE LOWER(name) LIKE '%espanyol%';

UPDATE fb_teams
SET api_team_id = 536
WHERE LOWER(name) LIKE '%sevilla%';

-- Vérifier
SELECT id, name, api_team_id
FROM fb_teams
WHERE LOWER(name) LIKE '%espanyol%' OR LOWER(name) LIKE '%sevilla%';

-- ============================================
-- 3. VÉRIFIER LE MATCH COMPLET
-- ============================================

SELECT
  f.id,
  f.api_id,
  f.date,
  f.status,
  ht.name as home_team,
  ht.api_team_id as home_api_id,
  at.name as away_team,
  at.api_team_id as away_api_id,
  l.name as league,
  l.season
FROM fb_fixtures f
JOIN fb_teams ht ON f.home_team_id = ht.id
JOIN fb_teams at ON f.away_team_id = at.id
JOIN fb_leagues l ON f.league_id = l.id
WHERE f.api_id = 1390943;

-- ============================================
-- 4. LANCER LA SYNCHRONISATION
-- ============================================

SELECT public.trigger_fixture_sync(14, 'manual');

-- ATTENDRE 10 SECONDES avant d'exécuter la suite

-- ============================================
-- 5. VÉRIFIER LES RÉSULTATS
-- ============================================

-- Logs de sync
SELECT
  sync_type,
  checked,
  updated,
  schedule_changes,
  created_at
FROM fixture_sync_log
ORDER BY created_at DESC
LIMIT 3;

-- État final du match
SELECT
  f.date,
  f.status,
  ht.name as home_team,
  at.name as away_team
FROM fb_fixtures f
JOIN fb_teams ht ON f.home_team_id = ht.id
JOIN fb_teams at ON f.away_team_id = at.id
WHERE f.api_id = 1390943;
