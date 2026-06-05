#!/bin/bash

# Script pour vérifier le match Espanyol vs Sevilla sur API-Football
# Usage: ./check_api_football.sh VOTRE_CLE_API

API_KEY="${1:-8487e1b722b62a4e80e07fcb71a99315}"

if [ -z "$API_KEY" ]; then
  echo "❌ Erreur: Clé API manquante"
  echo "Usage: ./check_api_football.sh VOTRE_CLE_API"
  echo "Ou: export API_SPORTS_KEY=votre-clé && ./check_api_football.sh"
  exit 1
fi

echo "=== VÉRIFICATION MATCH ESPANYOL VS SEVILLA ==="
echo ""

# Vérifier le match spécifique par ID
echo "📊 Requête 1: Par fixture ID (1390943)"
echo "URL: https://v3.football.api-sports.io/fixtures?id=1390943"
echo ""

curl -s "https://v3.football.api-sports.io/fixtures?id=1390943" \
  -H "x-apisports-key: $API_KEY" \
  | jq '{
      fixture_id: .response[0].fixture.id,
      date: .response[0].fixture.date,
      timestamp: .response[0].fixture.timestamp,
      timezone: .response[0].fixture.timezone,
      status: .response[0].fixture.status.short,
      home_team: .response[0].teams.home.name,
      away_team: .response[0].teams.away.name,
      league: .response[0].league.name,
      season: .response[0].league.season
    }'

echo ""
echo "📊 Requête 2: Matchs de La Liga du 23-25 novembre 2025"
echo ""

curl -s "https://v3.football.api-sports.io/fixtures?league=140&from=2025-11-23&to=2025-11-25&season=2025" \
  -H "x-apisports-key: $API_KEY" \
  | jq '.response[] | {
      fixture_id: .fixture.id,
      date: .fixture.date,
      home: .teams.home.name,
      away: .teams.away.name,
      status: .fixture.status.short
    }'

echo ""
echo "✅ Vérification terminée"
