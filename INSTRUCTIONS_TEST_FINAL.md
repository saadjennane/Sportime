# Test Final - Validation du Système de Synchronisation

## 🎯 Objectif

Vérifier que l'Edge Function détecte et corrige automatiquement les changements de date.

## ✅ État actuel

- ✅ Edge Function déployée
- ✅ Teste avec succès via Dashboard (checked: 23)
- ❌ Date incorrecte dans la DB : `2025-11-23 22:21:02.261+00`
- ✅ Date correcte sur l'API : `2025-11-24 20:00:00+00`

## 📋 Test à effectuer

### Option 1 : Via le Dashboard Supabase (RECOMMANDÉ)

1. **Allez dans** : Edge Functions > sync-fixture-schedules > Invoke
2. **Collez ce JSON** :
   ```json
   {
     "days_ahead": 14,
     "update_mode": "manual"
   }
   ```
3. **Cliquez sur** "Send request"

### Résultat attendu

Vous devriez voir une réponse **200 OK** avec :

```json
{
  "success": true,
  "checked": 23,
  "inserted": 0,
  "updated": 1,  ← Devrait être 1 maintenant
  "schedule_changes": [
    {
      "fixture_id": "1390943",
      "old_date": "2025-11-23T22:21:02.261+00:00",
      "new_date": "2025-11-24T20:00:00+00:00",
      "home_team": "Espanyol",
      "away_team": "Sevilla",
      "league": "La Liga"
    }
  ]
}
```

### Vérification SQL

Ensuite, dans l'éditeur SQL :

```sql
-- 1. Vérifier que la date a été corrigée
SELECT api_id, date, status, updated_at
FROM fb_fixtures
WHERE api_id = 1390943;
-- Devrait montrer: 2025-11-24 20:00:00+00

-- 2. Vérifier qu'un log a été créé
SELECT *
FROM fixture_sync_log
ORDER BY created_at DESC
LIMIT 1;
-- Devrait montrer: updated = 1, schedule_changes avec le détail

-- 3. Voir les changements récents
SELECT * FROM public.get_recent_fixture_changes(7);
```

## 🔍 Si ça ne fonctionne toujours pas

### Vérifier les logs de l'Edge Function

1. Dans le Dashboard > Edge Functions > sync-fixture-schedules
2. Onglet **Logs**
3. Cherchez les messages d'erreur

### Problèmes possibles

**Problème 1** : L'API key n'est pas configurée
- Solution : Vérifier que `API_SPORTS_KEY` est dans les Secrets

**Problème 2** : La league n'a pas de `season`
- Solution : Déjà corrigé (season = 2025)

**Problème 3** : Les équipes n'ont pas d'`api_team_id`
- Solution : Déjà corrigé (Espanyol = 540, Sevilla = 536)

## 🚨 Note sur pg_net

**pg_net est asynchrone** - les requêtes HTTP via `trigger_fixture_sync()` sont mises en queue et traitées en arrière-plan par Supabase.

Le délai peut être de :
- **5-30 secondes** en temps normal
- **1-5 minutes** si la queue est chargée

C'est pourquoi je recommande de tester **directement via le Dashboard** pour avoir un résultat immédiat.

## ✅ Validation finale

Une fois le test réussi :

1. ✅ La date d'Espanyol vs Sevilla sera correcte
2. ✅ Un log sera créé dans `fixture_sync_log`
3. ✅ Les cron jobs fonctionneront automatiquement :
   - Chaque jour à 3h UTC (14 jours)
   - Toutes les 2h de 6h à 23h (matchs du jour)

Le système sera **100% opérationnel** ! 🎉
