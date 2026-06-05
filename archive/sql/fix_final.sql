-- Script final pour corriger le problème et mettre à jour les données

-- ============================================
-- 1. SUPPRIMER LE TRIGGER DÉFECTUEUX
-- ============================================

-- Supprimer le trigger on_teams_update qui cause l'erreur
DROP TRIGGER IF EXISTS on_teams_update ON fb_teams;

-- Vérifier aussi sur fb_leagues
DROP TRIGGER IF EXISTS on_teams_update ON fb_leagues;
DROP TRIGGER IF EXISTS on_leagues_update ON fb_leagues;

-- Supprimer la fonction défectueuse handle_updated_at si elle existe
DROP FUNCTION IF EXISTS handle_updated_at() CASCADE;

-- Vérifier que les triggers sont bien supprimés
SELECT
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('fb_teams', 'fb_leagues');

-- ============================================
-- 2. METTRE À JOUR LA SAISON DE LA LIGA
-- ============================================

UPDATE fb_leagues
SET season = 2025
WHERE api_league_id = 140;

-- Vérifier
SELECT id, name, api_league_id, season
FROM fb_leagues
WHERE api_league_id = 140;

-- ============================================
-- 3. METTRE À JOUR LES API_TEAM_ID
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
-- 4. VÉRIFIER LE MATCH COMPLET
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
-- 5. LANCER LA SYNCHRONISATION
-- ============================================

SELECT public.trigger_fixture_sync(14, 'manual');

-- ⏱️  ATTENDRE 10 SECONDES avant d'exécuter la suite

-- ============================================
-- 6. VÉRIFIER LES RÉSULTATS (après 10 secondes)
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

-- Vérifier les changements détectés
SELECT * FROM public.get_recent_fixture_changes(7);
