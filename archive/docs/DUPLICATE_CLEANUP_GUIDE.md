# Guide de Nettoyage des Doublons - Sportime Admin

Ce guide explique comment identifier et supprimer les doublons dans les tables Leagues, Teams et Players.

## 🔍 Problème

Les doublons sont causés par:
1. **Incohérence dans les migrations** - Certaines utilisent `api_league_id`, d'autres `api_id`
2. **Entrées manuelles** - Ligues/équipes/joueurs créés manuellement avec `api_id = null`
3. **Synchronisation multiple** - Données importées plusieurs fois depuis API-Football

## 📋 Procédure de Nettoyage

### Option A: Nettoyage Complet en Une Seule Fois (RECOMMANDÉ)

**Fichier**: `MASTER_CLEANUP_ALL_DUPLICATES.sql`

Ce script nettoie automatiquement les 3 tables (Leagues → Teams → Players) dans le bon ordre avec reporting détaillé.

**Avantages**:
- ✅ Exécution en une seule fois
- ✅ Ordre correct garanti (Leagues → Teams → Players)
- ✅ Reporting détaillé à chaque étape
- ✅ Vérifications automatiques avant/après

**URL**: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql

### Option B: Nettoyage Manuel Table par Table

#### Étape 1: Investiguer les Doublons

Exécutez ces scripts dans **Supabase SQL Editor** pour identifier les doublons:

##### Leagues
```bash
Fichier: CHECK_LEAGUES_DUPLICATES.sql (contenu dans REMOVE_DUPLICATES.sql - Step 1)
```

##### Teams
```bash
Fichier: CHECK_TEAMS_DUPLICATES.sql
```

##### Players
```bash
Fichier: CHECK_PLAYERS_DUPLICATES.sql
```

**URL**: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql

### Étape 2: Comprendre les Résultats

Les scripts vous montreront:
- ✓ **Total d'entrées** vs **entrées uniques**
- ✓ **Doublons par api_id** - Même entité importée plusieurs fois
- ✓ **Doublons par nom** - Entrées manuelles vs API
- ✓ **Entrées avec/sans API ID**

### Étape 3: Supprimer les Doublons

⚠️ **IMPORTANT**: Exécutez ces scripts dans l'ordre!

#### 3.1 Nettoyer les Leagues
```bash
Fichier: REMOVE_DUPLICATES.sql
```
**Résultat attendu**: 8 leagues → 4 leagues uniques

#### 3.2 Nettoyer les Teams
```bash
Fichier: REMOVE_TEAMS_DUPLICATES.sql
```

#### 3.3 Nettoyer les Players
```bash
Fichier: REMOVE_PLAYERS_DUPLICATES.sql
```

### Étape 4: Vérifier les Résultats

Après chaque nettoyage:
1. Vérifiez le nombre d'entrées supprimées
2. Regardez la liste finale (Step 4 de chaque script)
3. Rechargez la page admin pour voir les changements

## 🎯 Stratégie de Nettoyage

Les scripts suivent cette logique:

1. **Garde les entrées avec api_id** (données API-Football)
2. **Supprime les entrées manuelles** (api_id = null) qui dupliquent les API
3. **Pour les doublons API** (même api_id), garde la plus récente (created_at DESC)

### Exemple - Leagues

**Avant**:
```
| name          | api_id | created_at |
|---------------|--------|------------|
| Premier League| 39     | 2025-01-10 | ✓ GARDÉ
| Premier League| NULL   | 2025-01-05 | ✗ SUPPRIMÉ
| La Liga       | 140    | 2025-01-10 | ✓ GARDÉ
| La Liga       | NULL   | 2025-01-05 | ✗ SUPPRIMÉ
```

**Après**:
```
| name          | api_id | created_at |
|---------------|--------|------------|
| Premier League| 39     | 2025-01-10 |
| La Liga       | 140    | 2025-01-10 |
```

## ⚙️ Structure des Scripts

Chaque script de nettoyage suit ce pattern:

```sql
-- Step 0: Vérifier la structure de la table
-- Step 1: Identifier les doublons
-- Step 2A: Supprimer les doublons par api_id
-- Step 2B: Supprimer les entrées manuelles dupliquées
-- Step 3: Vérifier le nettoyage
-- Step 4: Afficher les résultats
```

## 🔧 Cas Particuliers

### Si vous voulez garder certaines entrées manuelles

Modifiez Step 2B pour exclure certains noms:

```sql
DELETE FROM public.teams
WHERE api_id IS NULL
  AND name IN (
    SELECT DISTINCT name
    FROM public.teams
    WHERE api_id IS NOT NULL
  )
  AND name NOT IN ('My Custom Team'); -- Exclure
```

### Si vous voulez voir les doublons avant de supprimer

Utilisez `SELECT` au lieu de `DELETE`:

```sql
-- Au lieu de DELETE FROM...
SELECT * FROM public.teams
WHERE id IN (
  -- ... reste du script
);
```

## 📊 Ordre d'Exécution Recommandé

1. **Leagues** d'abord (tables de base)
2. **Teams** ensuite (dépendent des leagues via team_league_participation)
3. **Players** en dernier (dépendent des teams via player_team_association)

## 🚨 Sécurité

- ✓ Les scripts utilisent des transactions implicites
- ✓ Vérification avant suppression (Step 1)
- ✓ Vérification après suppression (Step 3)
- ✓ Les foreign keys CASCADE évitent les orphelins

## 📝 Après le Nettoyage

1. Rechargez les pages admin (Ctrl+Shift+R)
2. Vérifiez que les compteurs sont corrects
3. Testez la création/modification d'entrées
4. Documentez combien de doublons ont été supprimés

## 🔄 Prévention Future

Pour éviter les doublons à l'avenir:

1. **Utilisez toujours la même colonne** - Standardisez sur `api_id` (pas `api_league_id`)
2. **Contraintes UNIQUE** - Ajoutez `UNIQUE (api_id)` aux tables
3. **Triggers UPSERT** - Utilisez `ON CONFLICT DO UPDATE` dans les triggers de sync
4. **Validez avant import** - Vérifiez les doublons avant d'importer de nouvelles données

## 📞 Support

En cas de problème:
1. Vérifiez les logs dans la console du navigateur
2. Vérifiez les erreurs SQL dans Supabase Dashboard
3. Restaurez depuis un backup si nécessaire

---

**Dernière mise à jour**: 2025-11-15
**Auteur**: Claude Code
