-- Script pour corriger les données de La Liga (Version 2)
-- Problèmes identifiés:
-- 1. La saison de La Liga est NULL
-- 2. Les api_team_id des équipes ne sont pas renseignés

-- ============================================
-- 1. METTRE À JOUR LA SAISON DE LA LIGA
-- ============================================

-- Vérifier la saison actuelle
SELECT id, name, api_league_id, season
FROM fb_leagues
WHERE api_league_id = 140;

-- Mettre à jour avec la saison 2025 (saison en cours)
-- Note: Si le trigger updated_at pose problème, on l'ignore
UPDATE fb_leagues
SET season = 2025
WHERE api_league_id = 140;

-- Vérifier la mise à jour
SELECT id, name, api_league_id, season
FROM fb_leagues
WHERE api_league_id = 140;

-- ============================================
-- 2. VÉRIFIER LES ÉQUIPES ESPANYOL ET SEVILLA
-- ============================================

-- Rechercher Espanyol
SELECT id, name, api_team_id, logo
FROM fb_teams
WHERE LOWER(name) LIKE '%espanyol%';

-- Rechercher Sevilla
SELECT id, name, api_team_id, logo
FROM fb_teams
WHERE LOWER(name) LIKE '%sevilla%';

-- ============================================
-- 3. METTRE À JOUR LES API_TEAM_ID
-- ============================================

-- IDs officiels de l'API-Football:
-- Espanyol: 540
-- Sevilla: 536

-- Mettre à jour Espanyol
UPDATE fb_teams
SET api_team_id = 540
WHERE LOWER(name) LIKE '%espanyol%';

-- Mettre à jour Sevilla
UPDATE fb_teams
SET api_team_id = 536
WHERE LOWER(name) LIKE '%sevilla%';

-- Vérifier les mises à jour
SELECT id, name, api_team_id, logo
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
  l.name as league
FROM fb_fixtures f
JOIN fb_teams ht ON f.home_team_id = ht.id
JOIN fb_teams at ON f.away_team_id = at.id
JOIN fb_leagues l ON f.league_id = l.id
WHERE f.api_id = 1390943;

-- ============================================
-- 5. FORCER UNE NOUVELLE SYNCHRONISATION
-- ============================================

-- Après avoir corrigé les données, lancer une nouvelle sync
SELECT public.trigger_fixture_sync(14, 'manual');

-- Attendre 10 secondes puis vérifier les logs
-- (Attendez avant d'exécuter la suite)

-- ============================================
-- 6. VÉRIFIER LES RÉSULTATS DE LA SYNC
-- ============================================

-- Vérifier les logs de synchronisation
SELECT
  id,
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

-- Vérifier tous les changements récents
SELECT * FROM public.get_recent_fixture_changes(7);

-- ============================================
-- NOTES
-- ============================================

-- Si après cette correction la synchronisation ne détecte toujours pas
-- le changement, c'est que:
-- 1. La date dans l'API-Football est identique à celle dans la DB (2025-11-23T22:21:02Z)
-- 2. L'API retourne une erreur (vérifier les logs de l'Edge Function)

-- Pour vérifier manuellement l'Edge Function:
-- 1. Aller dans Supabase Dashboard > Edge Functions > sync-fixture-schedules
-- 2. Cliquer sur "Logs" pour voir les erreurs éventuelles
