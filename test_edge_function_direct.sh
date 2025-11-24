#!/bin/bash

# Script pour tester directement l'Edge Function sync-fixture-schedules
# Cela simule ce que fait trigger_fixture_sync()

EDGE_FUNCTION_URL="https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-fixture-schedules"

echo "=== TEST DIRECT DE L'EDGE FUNCTION ==="
echo ""
echo "URL: $EDGE_FUNCTION_URL"
echo ""

# Appel avec les mêmes paramètres que trigger_fixture_sync
curl -i -X POST "$EDGE_FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ" \
  -d '{
    "days_ahead": 14,
    "update_mode": "manual"
  }'

echo ""
echo ""
echo "✅ Test terminé"
echo ""
echo "Si vous voyez un code 200 OK, l'Edge Function fonctionne."
echo "Vérifiez ensuite la table fixture_sync_log dans Supabase pour voir si un log a été créé."
