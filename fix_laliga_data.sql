-- Script pour corriger les données de La Liga
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

-- Désactiver temporairement le trigger updated_at
ALTER TABLE fb_leagues DISABLE TRIGGER ALL;

-- Mettre à jour avec la saison 2025 (saison en cours)
UPDATE fb_leagues
SET season = 2025
WHERE api_league_id = 140
  AND season IS NULL;

-- Réactiver les triggers
ALTER TABLE fb_leagues ENABLE TRIGGER ALL;

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
-- 3. METTRE À JOUR LES API_TEAM_ID SI NÉCESSAIRE
-- ============================================

-- IDs officiels de l'API-Football:
-- Espanyol: 540
-- Sevilla: 536

-- Désactiver temporairement les triggers
ALTER TABLE fb_teams DISABLE TRIGGER ALL;

-- Mettre à jour Espanyol si api_team_id est NULL
UPDATE fb_teams
SET api_team_id = 540
WHERE LOWER(name) LIKE '%espanyol%'
  AND api_team_id IS NULL;

-- Mettre à jour Sevilla si api_team_id est NULL
UPDATE fb_teams
SET api_team_id = 536
WHERE LOWER(name) LIKE '%sevilla%'
  AND api_team_id IS NULL;

-- Réactiver les triggers
ALTER TABLE fb_teams ENABLE TRIGGER ALL;

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

-- Attendre quelques secondes puis vérifier les logs
SELECT * FROM fixture_sync_log ORDER BY created_at DESC LIMIT 3;

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

-- ============================================
-- NOTES
-- ============================================

-- Si après cette correction la synchronisation ne détecte toujours pas
-- le changement, c'est que:
-- 1. Soit la date dans l'API-Football est identique à celle dans la DB
-- 2. Soit l'API retourne une erreur (quota dépassé, clé invalide, etc.)

-- Pour vérifier manuellement sur l'API-Football:
-- https://v3.football.api-sports.io/fixtures?id=1390943
-- Avec le header: x-apisports-key: VOTRE_CLE
