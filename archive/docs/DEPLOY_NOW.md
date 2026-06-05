# 🚨 DÉPLOIEMENT URGENT - Edge Function sync-fixture-schedules

## ❌ Problème identifié

L'Edge Function **n'est PAS déployée** sur Supabase (erreur 404).

C'est pourquoi :
- ❌ Aucun log dans `fixture_sync_log`
- ❌ Les changements de date ne sont pas détectés
- ❌ La synchronisation automatique ne fonctionne pas

## ✅ Solution : Déployer via le Dashboard Supabase

### Option 1 : Installer Supabase CLI et déployer (RAPIDE)

```bash
# Installer Supabase CLI
npm install -g supabase

# Se connecter
supabase login

# Lier le projet
supabase link --project-ref crypuzduplbzbmvefvzr

# Configurer la clé API
supabase secrets set API_SPORTS_KEY=8487e1b722b62a4e80e07fcb71a99315

# Déployer
supabase functions deploy sync-fixture-schedules
```

### Option 2 : Via Dashboard Supabase (SI CLI ne marche pas)

#### Étape 1 : Accéder à Edge Functions

1. Aller sur https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr
2. Menu latéral gauche → **Edge Functions**
3. Cliquer sur **"New Edge Function"** ou **"Deploy new function"**

#### Étape 2 : Créer la fonction

1. **Nom de la fonction** : `sync-fixture-schedules` (EXACTEMENT ce nom)
2. **Copier le code** depuis `/Users/sj/Desktop/Sportime/supabase/functions/sync-fixture-schedules/index.ts`
3. Coller dans l'éditeur
4. Cliquer sur **"Deploy function"**

#### Étape 3 : Configurer le Secret API

1. Dans la page de la fonction déployée
2. Onglet **Settings** ou **Secrets**
3. Ajouter un nouveau secret :
   - **Nom** : `API_SPORTS_KEY`
   - **Valeur** : `8487e1b722b62a4e80e07fcb71a99315`
4. Sauvegarder

#### Étape 4 : Tester

Dans l'onglet **Invoke** de la fonction :

**Body à envoyer** :
```json
{
  "days_ahead": 14,
  "update_mode": "manual"
}
```

Cliquer sur **"Send request"**

✅ **Réponse attendue** (200 OK) :
```json
{
  "success": true,
  "message": "Fixture schedule sync completed",
  "summary": {
    "total_fixtures_checked": 123,
    "fixtures_with_changes": 1,
    "fixtures_updated": 1,
    "leagues_processed": 1
  }
}
```

## 🔍 Vérification Post-Déploiement

### 1. Tester avec curl (depuis votre terminal)

```bash
/Users/sj/Desktop/Sportime/test_edge_function_direct.sh
```

✅ Vous devriez voir **HTTP/2 200** au lieu de 404

### 2. Vérifier les logs SQL

Dans l'éditeur SQL Supabase :

```sql
-- Devrait maintenant retourner 1 ligne ou plus
SELECT COUNT(*) FROM fixture_sync_log;

-- Voir les détails
SELECT *
FROM fixture_sync_log
ORDER BY created_at DESC
LIMIT 5;
```

### 3. Vérifier que le changement a été détecté

```sql
-- Devrait montrer le changement de date Espanyol vs Sevilla
SELECT * FROM public.get_recent_fixture_changes(7);
```

## 📊 Après le déploiement réussi

Le système sera **100% fonctionnel** :

- ✅ Sync quotidien à 3h UTC (14 jours)
- ✅ Sync toutes les 2h de 6h à 23h (matchs du jour)
- ✅ Détection automatique des reprogrammations
- ✅ Logs dans `fixture_sync_log`
- ✅ Historique des changements dans les logs

## 🎯 Statut actuel

- ✅ Migration SQL exécutée
- ✅ Fonction `trigger_fixture_sync()` créée
- ✅ Jobs cron actifs
- ✅ pg_net fonctionne
- ✅ Code de l'Edge Function créé localement
- ❌ **Edge Function PAS déployée sur Supabase** ← À FAIRE MAINTENANT

---

**Date** : 24 novembre 2025, 01:50 UTC
**Priorité** : 🔴 URGENT
