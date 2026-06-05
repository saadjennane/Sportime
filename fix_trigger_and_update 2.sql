-- Script pour corriger le trigger défectueux et mettre à jour les données

-- ============================================
-- 1. SUPPRIMER LE TRIGGER DÉFECTUEUX
-- ============================================

-- Vérifier les triggers existants sur fb_leagues
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'fb_leagues';

-- Supprimer le trigger handle_updated_at s'il existe
DROP TRIGGER IF EXISTS handle_updated_at ON fb_leagues;
DROP TRIGGER IF EXISTS set_updated_at ON fb_leagues;

-- Faire de même pour fb_teams
DROP TRIGGER IF EXISTS handle_updated_at ON fb_teams;
DROP TRIGGER IF EXISTS set_updated_at ON fb_teams;

-- ============================================
-- 2. METTRE À JOUR LA SAISON DE LA LIGA
-- ============================================

-- Vérifier la saison actuelle
SELECT id, name, api_league_id, season
FROM fb_leagues
WHERE api_league_id = 140;

-- Mettre à jour avec la saison 2025
UPDATE fb_leagues
SET season = 2025
WHERE api_league_id = 140;

-- Vérifier la mise à jour
SELECT id, name, api_league_id, season
FROM fb_leagues
WHERE api_league_id = 140;

-- ============================================
-- 3. METTRE À JOUR LES API_TEAM_ID
-- ============================================

-- Vérifier Espanyol
SELECT id, name, api_team_id
FROM fb_teams
WHERE LOWER(name) LIKE '%espanyol%';

-- Vérifier Sevilla
SELECT id, name, api_team_id
FROM fb_teams
WHERE LOWER(name) LIKE '%sevilla%';

-- Mettre à jour Espanyol (ID officiel: 540)
UPDATE fb_teams
SET api_team_id = 540
WHERE LOWER(name) LIKE '%espanyol%';

-- Mettre à jour Sevilla (ID officiel: 536)
UPDATE fb_teams
SET api_team_id = 536
WHERE LOWER(name) LIKE '%sevilla%';

-- Vérifier les mises à jour
SELECT id, name, api_team_id
FROM fb_teams
WHERE LOWER(name) LIKE '%espanyol%' OR LOWER(name) LIKE '%sevilla%';

-- ============================================
-- 4. VÉRIFIER LE MATCH ESPANYOL VS SEVILLA
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

-- ============================================
-- 6. ATTENDRE 10 SECONDES PUIS VÉRIFIER
-- ============================================

-- Vérifier les logs (à exécuter après 10 secondes)
SELECT
  sync_type,
  checked,
  updated,
  schedule_changes,
  created_at
FROM fixture_sync_log
ORDER BY created_at DESC
LIMIT 3;

-- Vérifier si le match a été mis à jour
SELECT
  f.date,
  f.status,
  ht.name as home_team,
  at.name as away_team
FROM fb_fixtures f
JOIN fb_teams ht ON f.home_team_id = ht.id
JOIN fb_teams at ON f.away_team_id = at.id
WHERE f.api_id = 1390943;
