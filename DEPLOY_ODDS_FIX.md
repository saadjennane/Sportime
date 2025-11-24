# 🚀 Déploiement de la Correction des Cotes

## Étapes Rapides

### 1. Vérifier l'état actuel (AVANT)

Dans le SQL Editor de Supabase, exécutez :

```sql
-- Vérifier combien d'odds sont dans chaque table
SELECT 'fb_odds (staging)' as table_name, COUNT(*) as count FROM public.fb_odds
UNION ALL
SELECT 'odds (production)' as table_name, COUNT(*) as count FROM public.odds;
```

**Résultat attendu AVANT** :
| table_name | count |
|------------|-------|
| fb_odds (staging) | > 0 |
| odds (production) | 0 |

---

### 2. Appliquer la Migration

#### Option A : Via Fichier Local

1. Ouvrir `/Users/sj/Desktop/Sportime/supabase/migrations/20251124100000_sync_odds_staging_to_production.sql`
2. Copier TOUT le contenu
3. Dans Supabase Dashboard > SQL Editor
4. Coller et cliquer sur "Run"

#### Option B : Via Supabase CLI (si disponible)

```bash
cd /Users/sj/Desktop/Sportime
supabase db push
```

---

### 3. Vérifier la Migration (APRÈS)

```sql
-- 1. Compter les odds synchronisées
SELECT COUNT(*) as total_odds FROM public.odds;

-- 2. Voir quelques exemples
SELECT
  f.api_id as fixture,
  o.bookmaker_name,
  o.home_win,
  o.draw,
  o.away_win,
  o.updated_at
FROM public.odds o
JOIN public.fixtures f ON o.fixture_id = f.id
ORDER BY o.updated_at DESC
LIMIT 10;
```

**Résultat attendu APRÈS** :
- `total_odds` > 0 (devrait être égal ou proche du nombre dans `fb_odds`)
- Liste d'odds avec bookmakers, cotes home/draw/away

---

### 4. Tester le Trigger Automatique

#### Test 1 : Via DataSyncAdmin (UI)

1. Allez dans l'interface admin
2. Section "Data Sync"
3. Synchroniser les odds d'un match récent
4. Exécutez cette requête :

```sql
-- Vérifier que les nouvelles odds sont apparues
SELECT * FROM public.odds
ORDER BY updated_at DESC
LIMIT 5;
```

#### Test 2 : Via SQL Direct

```sql
-- 1. Trouver une odd existante
SELECT id, fixture_id, bookmaker_name, home_win
FROM public.fb_odds
LIMIT 1;

-- 2. Modifier cette odd (changez les valeurs selon votre test)
UPDATE public.fb_odds
SET home_win = 2.5, draw = 3.0, away_win = 2.8, updated_at = NOW()
WHERE id = 'VOTRE_ID_ICI';

-- 3. Vérifier que la modification s'est propagée dans odds
SELECT o.home_win, o.draw, o.away_win, o.updated_at
FROM public.odds o
JOIN public.fixtures f ON o.fixture_id = f.id
JOIN public.fb_fixtures ff ON f.api_id = ff.api_id::TEXT
JOIN public.fb_odds fbo ON fbo.fixture_id = ff.id
WHERE fbo.id = 'VOTRE_ID_ICI';
```

**Résultat attendu** : Les valeurs dans `odds` correspondent aux nouvelles valeurs

---

### 5. Tester dans l'Application

#### Frontend (BetModal)

1. Ouvrir l'app mobile/web
2. Aller sur un challenge de paris
3. Cliquer sur un match pour parier
4. **Vérifier que les cotes affichées sont réelles** (pas 2.0, 3.2, 2.4)

#### Console Browser

Ouvrir la console du navigateur et chercher :
- ❌ AVANT : `[fetchMultipleFixtureOdds] No odds found`
- ✅ APRÈS : Pas ce message (ou logs montrant des odds trouvées)

---

## 🔍 Diagnostic de Problèmes

### Problème : "No odds found" persiste

**Solution** : Force une re-synchronisation

```sql
SELECT * FROM public.force_resync_odds();
```

Cela va :
1. Supprimer toutes les odds de `odds`
2. Re-copier depuis `fb_odds`
3. Retourner le nombre d'odds synchronisées

### Problème : Aucune odd dans fb_odds

**Solution** : Synchroniser depuis l'API d'abord

1. Via DataSyncAdmin (interface admin)
2. Ou via script : `/Users/sj/Desktop/Sportime/sync_today_matches.js`

```bash
cd /Users/sj/Desktop/Sportime
node sync_today_matches.js
```

### Problème : Trigger ne se déclenche pas

**Vérification** :

```sql
-- Vérifier que le trigger existe
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'fb_odds'
  AND trigger_name = 'trigger_sync_fb_odds_to_odds';
```

**Résultat attendu** : Une ligne montrant le trigger

Si le trigger n'existe pas, réappliquez la migration.

---

## ✅ Checklist de Validation Complète

- [ ] **Étape 1** : État AVANT vérifié (fb_odds > 0, odds = 0)
- [ ] **Étape 2** : Migration appliquée sans erreur
- [ ] **Étape 3** : État APRÈS vérifié (odds > 0)
- [ ] **Étape 4** : Trigger testé et fonctionnel
- [ ] **Étape 5** : Frontend affiche vraies cotes
- [ ] **Bonus** : Users peuvent placer des paris avec cotes réelles

---

## 📊 Résultats Attendus

### Base de Données
```
fb_odds (staging):  150 odds
        ↓ (sync automatique via trigger)
odds (production): 150 odds
```

### Application
- **BetModal** : Affiche cotes comme `1.85`, `3.45`, `4.20`
- **Pari** : Users peuvent sélectionner et parier avec les vraies cotes
- **Snapshot** : Les cotes sont sauvegardées dans `challenge_entries.odds_snapshot`

---

## 🎯 Prochaine Étape (Optionnel)

**Synchronisation automatique périodique des odds**

Créer une Edge Function + Cron job pour :
- Synchroniser les odds toutes les heures
- Mettre à jour automatiquement `fb_odds`
- Le trigger propagera vers `odds` automatiquement

Ceci n'est **PAS urgent** si vous synchronisez manuellement via DataSyncAdmin.

---

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs PostgreSQL dans Supabase Dashboard
2. Exécutez `/Users/sj/Desktop/Sportime/test_odds_sync.sql` section par section
3. Consultez `/Users/sj/Desktop/Sportime/ODDS_SYNC_FIX.md` pour diagnostic détaillé

---

**Temps estimé** : 10-15 minutes
**Difficulté** : Faible (copier-coller SQL)
**Impact** : Critique (débloque le système de paris)
