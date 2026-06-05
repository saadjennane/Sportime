#!/bin/bash

# Script simplifié pour vérifier le match Espanyol vs Sevilla sur API-Football
API_KEY="8487e1b722b62a4e80e07fcb71a99315"

echo "=== VÉRIFICATION MATCH ESPANYOL VS SEVILLA ==="
echo ""

echo "📊 Requête 1: Par fixture ID (1390943)"
echo "URL: https://v3.football.api-sports.io/fixtures?id=1390943"
echo ""

curl -s "https://v3.football.api-sports.io/fixtures?id=1390943" \
  -H "x-apisports-key: $API_KEY"

echo ""
echo ""
echo "📊 Requête 2: Matchs de La Liga du 23-25 novembre 2025"
echo ""

curl -s "https://v3.football.api-sports.io/fixtures?league=140&from=2025-11-23&to=2025-11-25&season=2025" \
  -H "x-apisports-key: $API_KEY"

echo ""
echo ""
echo "✅ Vérification terminée"
