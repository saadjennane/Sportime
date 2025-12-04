# Rapport d'Audit - Intégrité Base de Données Sportime

**Date:** 12 Novembre 2025
**Statut:** ✅ Nettoyage effectué - Migrations créées - Vérification en cours

---

## Résumé Exécutif

Suite au nettoyage des tables leagues, voici les actions effectuées et les vérifications à faire:

### ✅ Actions Complétées

1. **Suppression de af_leagues** - Table obsolète supprimée
2. **Nettoyage des duplications dans leagues** - Script `fix_leagues_duplications.sql` exécuté
3. **Ajout contrainte UNIQUE** - `leagues.api_id` avec contrainte unique
4. **Mise à jour du trigger** - Trigger de sync modifié pour UPSERT
5. **Migrations créées** - Migrations permanentes créées:
   - `20250712000000_fix_leagues_sync_trigger_upsert.sql`
   - `20250712000001_add_leagues_api_id_unique_constraint.sql`

### ⚠️ Note sur les Migrations

Les fixes ont été appliqués manuellement via `fix_leagues_duplications.sql` et sont donc déjà actifs dans la base de données de production.

Les migrations `20250712000000` et `20250712000001` ont été créées pour:
- Documenter les changements dans le contrôle de version
- Garantir que les fixes sont appliqués si la base est réinitialisée
- Maintenir l'historique de migration cohérent

**Statut**: Les migrations sont prêtes mais en attente de résolution d'un problème avec une migration antérieure (`1759861204810_api_football_schema.sql`).

---

## Scripts de Vérification Disponibles

### 1. Vérification Rapide (quick_integrity_check.sql)

**Usage:** Vérification rapide en 8 points
```bash
# Copier le contenu et exécuter dans Supabase SQL Editor
/Users/sj/Desktop/Sportime/quick_integrity_check.sql
```

**Vérifie:**
- ✅ af_leagues supprimée
- ✅ Pas de duplications dans leagues
- ✅ Contrainte UNIQUE existe
- ✅ Trigger de sync actif
- ✅ Synchronisation fb_leagues ↔ leagues
- 📊 Comptages teams, fixtures, players

**Temps d'exécution:** ~2 secondes

---

### 2. Audit Complet (database_integrity_audit.sql)

**Usage:** Audit approfondi en 10 sections
```bash
# Copier le contenu et exécuter dans Supabase SQL Editor
/Users/sj/Desktop/Sportime/database_integrity_audit.sql
```

**Sections:**
1. Existence des tables
2. Intégrité tables leagues (fb_leagues ↔ leagues)
3. Intégrité tables teams (fb_teams ↔ teams)
4. Intégrité fixtures (références valides)
5. Intégrité players (fb_players ↔ players)
6. Contraintes FK (foreign keys)
7. Records orphelins
8. Cohérence des données (NULLs, duplications)
9. Résumé des comptages
10. Score final d'intégrité

**Temps d'exécution:** ~10-15 secondes

---

## Architecture de la Base de Données

### Pattern de Staging (fb_* → production)

```
API-Football
     ↓
fb_leagues (staging) ─────→ leagues (production)
fb_teams (staging) ─────→ teams (production)
fb_players (staging) ─────→ players (production)
fb_fixtures (staging, no sync)
```

### Tables Staging (fb_*)

**Caractéristiques:**
- IDs INTEGER (format API-Football)
- Données brutes JSONB
- Peut être vidée/réimportée sans impact
- UPSERT sur `api_*_id`

### Tables Production

**Caractéristiques:**
- IDs UUID (standard Supabase/RLS)
- Relations stables
- Champs métier additionnels
- Synchronisation automatique via triggers

---

## Vérifications Post-Nettoyage

### ✅ À Vérifier Immédiatement

```sql
-- 1. af_leagues n'existe plus
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'af_leagues'
); -- Doit retourner: false

-- 2. Pas de duplications dans leagues
SELECT COUNT(*) - COUNT(DISTINCT api_id)
FROM leagues WHERE api_id IS NOT NULL;
-- Doit retourner: 0

-- 3. Contrainte UNIQUE existe
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'leagues'
  AND constraint_type = 'UNIQUE'
  AND constraint_name = 'leagues_api_id_unique';
-- Doit retourner: leagues_api_id_unique

-- 4. Trigger de sync existe et utilise UPSERT
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'on_fb_leagues_sync_to_leagues';
-- Doit retourner: on_fb_leagues_sync_to_leagues
```

---

## Tests de Régression

### Test 1: Import d'une nouvelle ligue

```sql
-- Insérer une nouvelle ligue dans fb_leagues
INSERT INTO fb_leagues (api_league_id, name, country, logo, type, season)
VALUES (999, 'Test League', 'Test Country', 'https://test.com/logo.png', 'Cup', 2025);

-- Vérifier qu'elle apparaît automatiquement dans leagues
SELECT * FROM leagues WHERE api_id = 999;
-- Doit retourner: 1 ligne
```

### Test 2: Réimport de la même ligue (UPSERT)

```sql
-- Mettre à jour la ligue dans fb_leagues
UPDATE fb_leagues
SET name = 'Test League Updated'
WHERE api_league_id = 999;

-- Vérifier que leagues est mise à jour (pas de duplication)
SELECT COUNT(*), name FROM leagues WHERE api_id = 999 GROUP BY name;
-- Doit retourner: 1 ligne avec name='Test League Updated'
```

### Test 3: Suppression d'une ligue

```sql
-- Supprimer de fb_leagues
DELETE FROM fb_leagues WHERE api_league_id = 999;

-- Vérifier que leagues est aussi supprimée
SELECT COUNT(*) FROM leagues WHERE api_id = 999;
-- Doit retourner: 0
```

---

## Problèmes Potentiels et Solutions

### ❌ Problème: "duplicate key value violates unique constraint"

**Cause:** Tentative d'insérer une ligue qui existe déjà

**Solution:** Le trigger devrait gérer cela avec UPSERT. Si l'erreur persiste:
```sql
-- Vérifier que le trigger utilise ON CONFLICT
SELECT prosrc FROM pg_proc
WHERE proname = 'sync_fb_leagues_to_leagues';
-- Doit contenir: "ON CONFLICT (api_id) DO UPDATE"
```

### ❌ Problème: Ligues manquantes dans l'app

**Cause:** Déconnexion entre fb_leagues et leagues

**Solution:**
```sql
-- Identifier les ligues manquantes
SELECT fl.api_league_id, fl.name
FROM fb_leagues fl
LEFT JOIN leagues l ON l.api_id = fl.api_league_id::INTEGER
WHERE l.id IS NULL;

-- Forcer la synchronisation
UPDATE fb_leagues SET updated_at = NOW()
WHERE api_league_id IN (/* IDs manquants */);
```

### ❌ Problème: Fixtures sans ligues

**Cause:** Fixtures référencent des ligues non importées

**Solution:**
```sql
-- Identifier les fixtures orphelines
SELECT f.id, f.league_id
FROM fb_fixtures f
WHERE NOT EXISTS (SELECT 1 FROM fb_leagues WHERE id = f.league_id);

-- Option 1: Importer les ligues manquantes via Admin Sync
-- Option 2: Supprimer les fixtures orphelines
DELETE FROM fb_fixtures
WHERE NOT EXISTS (SELECT 1 FROM fb_leagues WHERE id = league_id);
```

---

## Recommandations

### 🔒 Sécurité

1. **Backup régulier** - Avant tout nettoyage, faire un backup
2. **Test sur staging** - Tester les scripts sur environnement de test
3. **Vérification post-migration** - Toujours exécuter l'audit après modifications

### 🚀 Performance

1. **Indexes sur api_id** - Vérifier que les indexes existent:
```sql
SELECT indexname FROM pg_indexes
WHERE tablename IN ('leagues', 'teams', 'players')
  AND indexname LIKE '%api_id%';
```

2. **Nettoyage fixtures anciennes** - Supprimer les fixtures > 30 jours:
```sql
DELETE FROM fb_fixtures
WHERE date < NOW() - INTERVAL '30 days';
```

### 📊 Monitoring

1. **Vérification hebdomadaire** - Exécuter `quick_integrity_check.sql`
2. **Audit mensuel** - Exécuter `database_integrity_audit.sql`
3. **Alertes** - Configurer alertes Supabase sur taille des tables

---

## Checklist Post-Audit

- [ ] Exécuter `quick_integrity_check.sql` dans Supabase
- [ ] Vérifier que tous les checks sont ✅
- [ ] Exécuter les 3 tests de régression
- [ ] Vérifier que l'app fonctionne correctement
- [ ] Tester l'import d'une nouvelle ligue dans Admin Sync
- [ ] Vérifier que la page matches affiche les bonnes ligues
- [ ] Documenter tout problème rencontré

---

## Support

**Scripts disponibles:**
- `quick_integrity_check.sql` - Vérification rapide
- `database_integrity_audit.sql` - Audit complet
- `fix_leagues_duplications.sql` - Nettoyage duplications (déjà exécuté)

**En cas de problème:**
1. Exécuter l'audit complet
2. Noter les checks ❌ qui échouent
3. Consulter la section "Problèmes Potentiels et Solutions"
4. Si problème persiste, rollback au backup

---

**Dernière mise à jour:** 12 Nov 2025
**Version:** 1.0
