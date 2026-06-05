# Guide de Déploiement - Edge Function sync-fixture-schedules

## 🎯 Objectif

Déployer l'Edge Function qui synchronise les horaires de fixtures depuis l'API-Football.

## 📋 Prérequis

- Supabase CLI installé : `npm install -g supabase`
- Compte Supabase avec un projet actif
- Clé API-Football active

## 🚀 Méthode 1 : Via Supabase CLI (Recommandé)

### Étape 1 : Authentification

```bash
# Se connecter à Supabase
supabase login

# Lier le projet local
supabase link --project-ref crypuzduplbzbmvefvzr
```

### Étape 2 : Configurer les secrets

```bash
# Ajouter la clé API-Football comme secret
supabase secrets set API_SPORTS_KEY=your-api-football-key-here
```

**Note** : `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont automatiquement disponibles dans les Edge Functions, pas besoin de les configurer.

### Étape 3 : Déployer la fonction

```bash
# Depuis la racine du projet
supabase functions deploy sync-fixture-schedules
```

### Étape 4 : Vérifier le déploiement

```bash
# Voir les logs
supabase functions logs sync-fixture-schedules

# Tester la fonction
curl -X POST 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-fixture-schedules' \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"days_ahead": 14, "update_mode": "manual"}'
```

## 🌐 Méthode 2 : Via Dashboard Supabase

### Étape 1 : Accéder à l'interface

1. Aller sur https://supabase.com/dashboard
2. Sélectionner votre projet
3. Menu latéral : **Edge Functions**

### Étape 2 : Créer la fonction

1. Cliquer sur **"Create a new function"**
2. Nom : `sync-fixture-schedules`
3. Copier/coller le contenu de `supabase/functions/sync-fixture-schedules/index.ts`
4. Cliquer sur **"Deploy function"**

### Étape 3 : Configurer les secrets

1. Dans l'onglet **Settings** de la fonction
2. Section **Secrets**
3. Ajouter : `API_SPORTS_KEY` = votre clé API-Football
4. Sauvegarder

### Étape 4 : Tester

1. Onglet **Invoke**
2. Body :
   ```json
   {
     "days_ahead": 14,
     "update_mode": "manual"
   }
   ```
3. Cliquer sur **"Send request"**
4. Vérifier la réponse

## ✅ Vérification post-déploiement

### 1. Vérifier que la fonction existe

Dans le SQL Editor de Supabase :

```sql
-- Devrait retourner la fonction et sa définition
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'trigger_fixture_sync';
```

### 2. Tester manuellement

Dans le SQL Editor :

```sql
-- Devrait retourner un JSON avec request_id
SELECT public.trigger_fixture_sync(14, 'manual');
```

### 3. Vérifier les requêtes pg_net

```sql
-- Voir les requêtes HTTP en attente/traitées
SELECT id, url, status, created, response_status
FROM net.http_request_queue
ORDER BY created DESC
LIMIT 5;
```

### 4. Vérifier les logs de sync

Après quelques secondes :

```sql
-- Voir les syncs effectuées
SELECT *
FROM public.fixture_sync_log
ORDER BY created_at DESC
LIMIT 5;
```

## 🐛 Dépannage

### Problème : "Function not found"

**Solution** : Vérifier que l'Edge Function est bien déployée :
```bash
supabase functions list
```

### Problème : "API key invalid"

**Solution** : Vérifier le secret `API_SPORTS_KEY` :
```bash
supabase secrets list
```

Pour mettre à jour :
```bash
supabase secrets set API_SPORTS_KEY=your-new-key
```

### Problème : "Timeout"

**Cause** : L'API-Football peut être lente si beaucoup de fixtures
**Solution** :
- Réduire `days_ahead` (tester avec 7 au lieu de 14)
- Vérifier les quotas API-Football

### Problème : "CORS error"

**Cause** : Headers CORS manquants
**Solution** : Vérifier que l'Edge Function retourne bien les headers CORS (déjà implémenté dans le code)

## 📊 Monitoring

### Voir les invocations

Dans le dashboard Supabase > Edge Functions > sync-fixture-schedules :
- Onglet **Metrics** : graphiques d'utilisation
- Onglet **Logs** : logs en temps réel

### Commande CLI

```bash
# Logs en temps réel
supabase functions logs sync-fixture-schedules --follow
```

## 🔄 Mise à jour de la fonction

Si vous modifiez le code :

```bash
# Redéployer
supabase functions deploy sync-fixture-schedules

# Vérifier la nouvelle version
supabase functions logs sync-fixture-schedules --tail 50
```

## 📝 Fichiers concernés

- **Edge Function** : `/supabase/functions/sync-fixture-schedules/index.ts`
- **Migration SQL** : `/supabase/migrations/20251124000000_setup_fixture_sync_cron.sql`
- **Documentation** : `/FIXTURE_SCHEDULE_SYNC.md`
- **Script de test** : `/test_fixture_sync.sql`

## ⚡ Prochaines étapes

Après le déploiement réussi :

1. ✅ Exécuter la migration SQL : `20251124000000_setup_fixture_sync_cron.sql`
2. ✅ Tester manuellement : `SELECT public.trigger_fixture_sync(14, 'manual');`
3. ✅ Vérifier les cron jobs : `SELECT * FROM cron.job;`
4. ✅ Attendre le premier sync automatique (3h UTC)
5. ✅ Monitorer les logs : `SELECT * FROM fixture_sync_log;`

## 🎉 Félicitations !

Une fois déployé, votre système de synchronisation automatique est opérationnel ! Les fixtures seront mises à jour :
- **Quotidiennement** à 3h UTC (14 jours à venir)
- **Toutes les 2h** de 6h à 23h UTC (matchs du jour)

---

**Créé le** : 24 novembre 2025
**Auteur** : Claude AI Assistant
