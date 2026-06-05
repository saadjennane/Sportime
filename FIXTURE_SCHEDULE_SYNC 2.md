# Fixture Schedule Synchronization System

## 📋 Vue d'ensemble

Ce système maintient les horaires des matchs à jour en synchronisant régulièrement avec l'API-Football. Il détecte et applique automatiquement les changements de calendrier (reprogrammations, annulations, changements d'heure).

## 🎯 Problème résolu

**Avant** : Les calendriers de football changent fréquemment (droits TV, météo, conflits), mais les fixtures en base de données conservaient les horaires initiaux. Résultat : les utilisateurs voyaient des heures de match incorrectes.

**Après** : Synchronisation automatique régulière qui détecte les changements de calendrier et met à jour la base de données en conséquence.

## 🏗️ Architecture

### Composants

1. **Edge Function** : `supabase/functions/sync-fixture-schedules/index.ts`
   - Récupère les fixtures depuis l'API-Football
   - Compare avec la base de données
   - Applique les changements détectés
   - Log tous les changements

2. **Migration SQL** : `supabase/migrations/20251124000000_setup_fixture_sync_cron.sql`
   - Table `fixture_sync_log` pour tracker les syncs
   - Jobs pg_cron (si disponible)
   - Fonctions helper et vues de monitoring

3. **GitHub Actions** : `.github/workflows/sync-fixtures.yml`
   - Alternative si pg_cron n'est pas disponible
   - Cron quotidien + refresh fréquent

4. **Interface Admin** : `apps/admin/src/components/DataSyncAdmin.tsx`
   - Boutons de sync manuelle
   - Affichage des résultats
   - Log en temps réel

### Système à 3 niveaux

```
┌─────────────────────────────────────────────────────┐
│  NIVEAU 1: Sync Quotidien (3h UTC)                │
│  • Cible : Fixtures des 14 prochains jours        │
│  • But : Capturer reprogrammations et annulations │
│  • Fréquence : 1x par jour                         │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  NIVEAU 2: Refresh du Jour (toutes les 2h)        │
│  • Cible : Matchs du jour même                    │
│  • But : Changements de dernière minute           │
│  • Fréquence : Toutes les 2h (6h-23h UTC)         │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  NIVEAU 3: Live Updates (toutes les 5 min)        │
│  • Cible : Matchs en cours                        │
│  • But : Scores et statuts en temps réel          │
│  • Note : Déjà existant (sync_today_matches.js)   │
└─────────────────────────────────────────────────────┘
```

## 📦 Fichiers créés

### 1. Edge Function
**Fichier** : `supabase/functions/sync-fixture-schedules/index.ts`

```typescript
// Fonction Deno qui:
// 1. Récupère les fixtures de l'API-Football
// 2. Compare avec la DB
// 3. Insère/met à jour selon les changements
// 4. Retourne statistiques + changements détectés
```

**Environnement requis** :
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `API_SPORTS_KEY`

### 2. Migration SQL
**Fichier** : `supabase/migrations/20251124000000_setup_fixture_sync_cron.sql`

**Contient** :
- Table `fixture_sync_log`
- Fonction `trigger_fixture_sync()`
- Jobs pg_cron (si extension disponible)
- Vue `fixture_sync_summary`
- Fonction `get_recent_fixture_changes()`

### 3. Workflow GitHub Actions
**Fichier** : `.github/workflows/sync-fixtures.yml`

**Déclencheurs** :
- Cron quotidien : `0 3 * * *` (3h UTC)
- Cron toutes les 2h : `0 6,8,10,12,14,16,18,20,22 * * *`
- Manuel via GitHub UI

**Secrets requis** :
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 4. Script Diagnostic
**Fichier** : `check_espanyol_sevilla_detailed.js`

Diagnostic script pour investiguer les matchs spécifiques et comprendre les problèmes de timezone.

## 🚀 Déploiement

### Étape 1 : Déployer l'Edge Function

```bash
# Via Supabase CLI
supabase functions deploy sync-fixture-schedules

# Ou via le dashboard Supabase
# Edge Functions > Create new function > Upload index.ts
```

### Étape 2 : Exécuter la migration

```bash
# Via Supabase CLI
supabase db push

# Ou via le dashboard Supabase
# SQL Editor > Copier/coller le contenu de la migration > Run
```

### Étape 3 : Configurer l'automatisation

**Option A : pg_cron (si disponible)**
```sql
-- Vérifier si pg_cron est actif
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Voir les jobs planifiés
SELECT * FROM cron.job;
```

Si pg_cron n'est pas disponible, passez à l'Option B.

**Option B : GitHub Actions**

1. Aller dans `Settings > Secrets and variables > Actions`
2. Ajouter les secrets :
   - `SUPABASE_URL` : https://votre-projet.supabase.co
   - `SUPABASE_SERVICE_ROLE_KEY` : votre clé service_role

3. Le workflow se déclenchera automatiquement selon le cron configuré

### Étape 4 : Tester via Admin Panel

1. Ouvrir le panneau admin : `http://localhost:5173` (ou votre URL)
2. Aller dans "Data Sync"
3. Section "Fixture Schedule Updates"
4. Cliquer sur "Next 14 Days"
5. Observer les logs pour vérifier le fonctionnement

## 📊 Monitoring

### Via SQL

```sql
-- Voir les derniers syncs
SELECT * FROM fixture_sync_log
ORDER BY created_at DESC
LIMIT 10;

-- Résumé par jour
SELECT * FROM fixture_sync_summary
ORDER BY sync_date DESC
LIMIT 7;

-- Changements des 7 derniers jours
SELECT * FROM get_recent_fixture_changes(7);
```

### Via Admin Panel

- Section "Fixture Schedule Updates"
- Bouton "Sync" affiche les résultats en temps réel
- Log détaillé des changements détectés

### Via GitHub Actions

- Onglet "Actions" du repo
- Workflow "Sync Fixture Schedules"
- Créé automatiquement des issues si des changements sont détectés

## 🔧 Configuration

### Paramètres de sync

```typescript
// Dans l'appel à l'Edge Function
{
  days_ahead: 14,        // Nombre de jours à synchroniser
  update_mode: 'manual'  // 'manual', 'scheduled', 'today'
}
```

### Fréquences recommandées

| Type | Fréquence | Cible | Justification |
|------|-----------|-------|---------------|
| Sync quotidien | 1x/jour (3h UTC) | 14 jours | Capture reprogrammations |
| Refresh du jour | 2h | Jour même | Changements dernière minute |
| Live updates | 5 min | En cours | Scores temps réel |

## 📝 Cas d'usage

### Exemple 1 : Match reprogrammé

**Avant** :
```
Espanyol vs Sevilla
Date DB : 2025-11-23 22:21:02 UTC
Status  : NS
```

**API-Football retourne** :
```
Date API : 2025-11-24 18:00:00 UTC (match déplacé)
Status   : NS
```

**Après sync** :
```
Date DB mise à jour : 2025-11-24 18:00:00 UTC
Log changement      : Detecté et enregistré
Notification        : Issue GitHub créée (si activé)
```

### Exemple 2 : Match annulé

**API-Football retourne** :
```
Status : PST (Postponed)
```

**Résultat** :
```
Status DB mis à jour : PST
Users voient         : "Match reporté"
```

## 🐛 Dépannage

### Problème : Edge Function échoue

**Solution** :
1. Vérifier les variables d'environnement
2. Vérifier les quotas API-Football
3. Consulter les logs : `supabase functions logs sync-fixture-schedules`

### Problème : pg_cron ne fonctionne pas

**Solution** :
1. Vérifier si l'extension est disponible :
   ```sql
   SELECT * FROM pg_available_extensions WHERE name = 'pg_cron';
   ```
2. Si non disponible, utiliser GitHub Actions
3. Contacter le support Supabase pour activer pg_cron

### Problème : GitHub Actions ne se déclenche pas

**Solution** :
1. Vérifier que les secrets sont configurés
2. Vérifier la syntaxe cron dans le workflow
3. Tester avec un déclenchement manuel ("Run workflow")

### Problème : Aucun changement détecté

**Normal si** :
- Aucun match n'a été reprogrammé
- Les fixtures en DB sont déjà à jour

**Vérifier** :
```sql
-- Compter les fixtures NS dans les prochains jours
SELECT COUNT(*)
FROM fb_fixtures
WHERE status = 'NS'
AND date >= NOW()
AND date <= NOW() + INTERVAL '14 days';
```

## 📚 API Reference

### Edge Function Response

```typescript
{
  success: boolean
  checked: number          // Nombre de fixtures vérifiées
  inserted: number         // Nouvelles fixtures insérées
  updated: number          // Fixtures mises à jour
  schedule_changes: [{     // Changements détectés
    fixture_id: string
    old_date: string
    new_date: string
    home_team: string
    away_team: string
    league: string
  }]
}
```

### Table fixture_sync_log

```sql
CREATE TABLE fixture_sync_log (
  id UUID PRIMARY KEY,
  sync_type TEXT,          -- 'upcoming', 'today', 'manual', 'scheduled'
  checked INTEGER,
  updated INTEGER,
  schedule_changes JSONB,
  created_at TIMESTAMPTZ
);
```

## 🔐 Sécurité

- ✅ Edge Function utilise `service_role_key` (accès complet)
- ✅ Secrets GitHub stockés de manière sécurisée
- ✅ Rate limiting respecté (100ms entre appels API)
- ✅ RLS activé sur `fixture_sync_log` (lecture publique seulement)

## 📈 Performance

### Quotas API-Football

- Plan gratuit : **100 requêtes/jour**
- Plan standard : **7,500 requêtes/jour**

### Consommation estimée

| Opération | Ligues | Requêtes | Fréquence | Total/jour |
|-----------|--------|----------|-----------|------------|
| Sync quotidien | 4 | 4 | 1x | 4 |
| Refresh du jour | 4 | 4 | 9x | 36 |
| **Total** | | | | **~40/jour** |

✅ Bien en dessous du quota même pour le plan gratuit

## 🎉 Avantages

1. **Données précises** : Heures de match toujours à jour
2. **Automatique** : Aucune intervention manuelle nécessaire
3. **Traçable** : Tous les changements sont loggés
4. **Flexible** : Fonctionne avec pg_cron OU GitHub Actions
5. **Efficace** : Consommation API minimale
6. **Scalable** : Supporte facilement plus de ligues

## 📞 Support

Pour toute question ou problème :
1. Consulter les logs : `fixture_sync_log` table
2. Vérifier le diagnostic : `node check_espanyol_sevilla_detailed.js`
3. Tester manuellement via Admin Panel
4. Consulter les logs GitHub Actions (si utilisé)

---

**Créé le** : 24 novembre 2025
**Version** : 1.0.0
**Auteur** : Claude AI Assistant
