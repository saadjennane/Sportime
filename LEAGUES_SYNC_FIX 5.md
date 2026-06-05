# Fix: fb_leagues Empty + leagues Duplicates

**Date:** 12 Novembre 2025
**Issue:** Modal des ligues vide - fb_leagues est vide et leagues a des duplicatas

---

## Diagnostic

### Problème Identifié
```
[MatchesPage] Imported leagues: []
[MatchesPage] Leagues loading: false
[MatchesPage] Leagues error: null
```

**Console logs montrent :**
- `importedLeagues` = `[]` (vide)
- Pas d'erreur → La requête réussit mais fb_leagues est vide
- Utilisateur confirme : "fb_leagues est vide et Leagues semble montrer des duplicatas"

### Architecture Attendue
```
fb_leagues (source, API-Football data)
    ↓ [trigger: on_fb_leagues_sync_to_leagues]
leagues (application table, with UUIDs)
```

### État Actuel
```
fb_leagues: VIDE ❌
leagues: Remplie mais avec DUPLICATAS ❌
```

**Cause racine:** Quelqu'un a vidé ou jamais rempli fb_leagues, mais leagues a été remplie directement (peut-être via l'ancienne migration `20250701000000_sync_fb_leagues_to_leagues.sql` qui faisait un TRUNCATE + INSERT depuis fb_leagues, mais fb_leagues était déjà vide).

---

## Solution

### Étape 1: Vérifier l'état actuel
```bash
psql [your-db-connection-string] -f verify_current_state.sql
```

Ce script vérifie :
- Contenu de fb_leagues (devrait être vide)
- Contenu de leagues et ses duplicatas
- Statut du trigger de sync
- Statut de la contrainte UNIQUE

### Étape 2: Repeupler fb_leagues depuis leagues
```bash
psql [your-db-connection-string] -f populate_fb_leagues_from_leagues.sql
```

Ce script :
1. Désactive temporairement le trigger de sync
2. Copie les données de `leagues` → `fb_leagues` (DISTINCT par api_id)
3. Réactive le trigger de sync
4. Nettoie les duplicatas dans `leagues`
5. Vérifie que tout est propre

### Étape 3: Tester dans l'application
1. Rafraîchir la page dans le navigateur
2. Ouvrir le modal "Reorder Leagues"
3. Vérifier les console logs :
   ```
   [useImportedLeagues] Number of leagues: X (devrait être > 0)
   [MatchesPage] Imported leagues: [{...}, {...}] (devrait avoir des données)
   ```
4. Le modal devrait maintenant afficher toutes les ligues importées

---

## Vérifications Post-Fix

Après avoir exécuté `populate_fb_leagues_from_leagues.sql`, vérifiez :

### ✅ fb_leagues est remplie
```sql
SELECT COUNT(*) FROM public.fb_leagues;
-- Devrait être > 0
```

### ✅ Pas de duplicatas dans leagues
```sql
SELECT api_id, COUNT(*)
FROM public.leagues
WHERE api_id IS NOT NULL
GROUP BY api_id
HAVING COUNT(*) > 1;
-- Devrait retourner 0 lignes
```

### ✅ Contrainte UNIQUE active
```sql
SELECT conname
FROM pg_constraint
WHERE conname = 'leagues_api_id_unique';
-- Devrait retourner: leagues_api_id_unique
```

### ✅ Trigger actif
```sql
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'on_fb_leagues_sync_to_leagues';
-- Devrait retourner: on_fb_leagues_sync_to_leagues
```

---

## Alternative: Importer depuis Admin Sync

Si vous préférez ne pas utiliser les données existantes dans `leagues`, vous pouvez aussi :

1. Vider complètement les deux tables :
   ```sql
   TRUNCATE TABLE public.leagues CASCADE;
   TRUNCATE TABLE public.fb_leagues CASCADE;
   ```

2. Aller dans **Admin Sync** dans l'application

3. Cliquer sur **"Sync Leagues, Teams and Players"**

4. Cela importera les ligues fraîches depuis l'API-Football dans `fb_leagues`, puis le trigger les synchronisera automatiquement vers `leagues`

**Note:** Cette option nécessite que l'Admin Sync fonctionne correctement et ait accès à l'API-Football.

---

## Scripts Créés

1. **`verify_current_state.sql`** - Diagnostic de l'état actuel
2. **`populate_fb_leagues_from_leagues.sql`** - Fix pour repeupler fb_leagues et nettoyer duplicatas

---

## Prochaines Étapes

Après le fix, la fonctionnalité "Reorder Leagues" devrait fonctionner :
- Modal affiche TOUTES les ligues importées (pas seulement celles avec matchs aujourd'hui)
- Ordre personnalisé de l'utilisateur est sauvegardé dans localStorage
- Ordre persiste entre les sessions
