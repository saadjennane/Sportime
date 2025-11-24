# 📋 Déploiement de la Configuration Bookmaker

## ✅ Étape 1 : Déployer la Migration

### Option A : Via Supabase Dashboard (Recommandé)

1. **Ouvrir le Dashboard Supabase**
   - Aller sur https://supabase.com/dashboard
   - Sélectionner votre projet Sportime

2. **Ouvrir le SQL Editor**
   - Cliquer sur "SQL Editor" dans le menu latéral gauche
   - Cliquer sur "New Query"

3. **Copier la Migration**
   - Ouvrir le fichier : `/Users/sj/Desktop/Sportime/supabase/migrations/20251124110000_bookmaker_configuration.sql`
   - Copier TOUT le contenu du fichier (279 lignes)

4. **Exécuter la Migration**
   - Coller le contenu dans le SQL Editor
   - Cliquer sur "Run" (ou Cmd+Enter / Ctrl+Enter)
   - ⏳ Attendre que l'exécution se termine

5. **Vérifier le Succès**
   - Vous devriez voir un message de succès
   - Le résultat devrait afficher : `synced_count: 4` (ou le nombre d'odds synchronisées)

### Option B : Via Supabase CLI (Si installé)

```bash
# Dans le dossier du projet
cd /Users/sj/Desktop/Sportime

# Déployer toutes les migrations
supabase db push
```

---

## 🔍 Étape 2 : Vérifier l'Installation

Exécutez ces requêtes dans le SQL Editor pour vérifier :

### Vérifier la table app_config
```sql
SELECT * FROM public.app_config WHERE key = 'preferred_bookmaker';
```
**Résultat attendu :**
- `key`: "preferred_bookmaker"
- `value`: "10Bet"
- `description`: "Bookmaker préféré pour l'affichage des cotes"

### Vérifier les fonctions créées
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%bookmaker%'
ORDER BY routine_name;
```
**Résultat attendu :**
- `get_available_bookmakers` (FUNCTION)
- `set_preferred_bookmaker` (FUNCTION)
- `sync_preferred_bookmaker_odds` (FUNCTION)

### Tester la fonction get_available_bookmakers
```sql
SELECT * FROM public.get_available_bookmakers();
```
**Résultat attendu :** Liste des bookmakers avec :
- `bookmaker_name`: Nom du bookmaker (ex: "10Bet")
- `odds_count`: Nombre de cotes disponibles
- `last_update`: Date de dernière mise à jour

### Vérifier les odds synchronisées
```sql
SELECT
  o.bookmaker_name,
  COUNT(*) as total_odds,
  MIN(o.updated_at) as oldest_update,
  MAX(o.updated_at) as newest_update
FROM public.odds o
GROUP BY o.bookmaker_name;
```

---

## 🎯 Étape 3 : Tester l'Interface Admin

1. **Démarrer le serveur admin** (si ce n'est pas déjà fait)
   ```bash
   cd /Users/sj/Desktop/Sportime/apps/admin
   npm run dev
   ```

2. **Ouvrir l'interface**
   - Ouvrir le navigateur : http://localhost:5173/bookmaker
   - Ou cliquer sur "Bookmakers" dans le menu latéral

3. **Vérifier l'interface**
   - ✅ Vous devriez voir le bookmaker actuel : "10Bet"
   - ✅ La liste des bookmakers disponibles avec leurs statistiques
   - ✅ Un bouton "Sélectionner" pour changer de bookmaker
   - ✅ Un bouton "Synchroniser les Cotes"

4. **Tester le changement de bookmaker** (si plusieurs disponibles)
   - Cliquer sur "Sélectionner" pour un autre bookmaker
   - Vérifier que les cotes sont automatiquement synchronisées
   - Vérifier que le message de succès s'affiche

---

## 🚨 Dépannage

### Erreur : "relation 'app_config' does not exist"
**Cause :** La migration n'a pas été exécutée correctement.
**Solution :** Réexécuter la migration complète depuis l'Étape 1.

### Erreur : "function get_available_bookmakers() does not exist"
**Cause :** Les fonctions n'ont pas été créées.
**Solution :** Vérifier que TOUTE la migration a été exécutée (les 279 lignes).

### Erreur : "there is no unique or exclusion constraint matching the ON CONFLICT"
**Cause :** La première migration (`20251124100000_sync_odds_staging_to_production.sql`) n'a pas été appliquée.
**Solution :**
1. D'abord appliquer la migration des odds de base
2. Puis appliquer cette migration

### L'interface bookmaker ne s'affiche pas
**Causes possibles :**
1. Le serveur admin n'est pas démarré
2. Le routage n'a pas été ajouté
3. Le composant n'a pas été créé

**Solutions :**
```bash
# Vérifier que le serveur tourne
cd /Users/sj/Desktop/Sportime/apps/admin
npm run dev

# Vérifier que les fichiers existent
ls -la src/pages/BookmakerPage.tsx
ls -la src/components/BookmakerAdmin.tsx
```

### Aucun bookmaker n'apparaît dans la liste
**Cause :** Aucune odds n'a été synchronisée depuis l'API.
**Solution :**
1. Vérifier la table `fb_odds` : `SELECT COUNT(*) FROM public.fb_odds;`
2. Si vide, synchroniser les odds depuis l'API Football
3. Réexécuter la fonction de sync : `SELECT * FROM public.sync_preferred_bookmaker_odds();`

---

## 📊 Comprendre le Système

### Architecture
```
API Football
    ↓
fb_odds (staging) ← Plusieurs bookmakers
    ↓ (trigger filtré)
odds (production) ← UN SEUL bookmaker (le préféré)
    ↓
Frontend (BetModal) ← Affiche les cotes aux utilisateurs
```

### Flux de Données
1. **Synchronisation API → Staging :** L'API Football synchronise tous les bookmakers dans `fb_odds`
2. **Filtre par préférence :** Le trigger vérifie le bookmaker préféré dans `app_config`
3. **Staging → Production :** Seules les cotes du bookmaker préféré sont copiées dans `odds`
4. **Production → Frontend :** Les utilisateurs voient uniquement les cotes du bookmaker sélectionné

### Changement de Bookmaker
Quand vous changez le bookmaker préféré via l'interface admin :
1. `set_preferred_bookmaker()` met à jour `app_config`
2. `sync_preferred_bookmaker_odds()` est automatiquement appelée
3. Les anciennes cotes sont supprimées de `odds`
4. Les nouvelles cotes du bookmaker sélectionné sont insérées
5. Le frontend affiche immédiatement les nouvelles cotes

---

## ✅ Checklist Finale

- [ ] Migration exécutée sans erreur
- [ ] Table `app_config` créée avec la config par défaut
- [ ] Fonctions créées : `get_available_bookmakers`, `set_preferred_bookmaker`, `sync_preferred_bookmaker_odds`
- [ ] Trigger `sync_fb_odds_to_odds` modifié pour filtrer par bookmaker
- [ ] Odds synchronisées pour le bookmaker "10Bet"
- [ ] Interface admin accessible à `/bookmaker`
- [ ] Bookmaker actuel affiché : "10Bet"
- [ ] Liste des bookmakers disponibles affichée
- [ ] Changement de bookmaker fonctionnel
- [ ] Synchronisation manuelle fonctionnelle

---

## 📚 Fichiers Créés/Modifiés

### Migrations
- ✅ `/Users/sj/Desktop/Sportime/supabase/migrations/20251124100000_sync_odds_staging_to_production.sql`
- 🔄 `/Users/sj/Desktop/Sportime/supabase/migrations/20251124110000_bookmaker_configuration.sql`

### Admin Interface
- ✅ `/Users/sj/Desktop/Sportime/apps/admin/src/components/BookmakerAdmin.tsx`
- ✅ `/Users/sj/Desktop/Sportime/apps/admin/src/pages/BookmakerPage.tsx`
- ✅ `/Users/sj/Desktop/Sportime/apps/admin/src/App.tsx` (modifié)
- ✅ `/Users/sj/Desktop/Sportime/apps/admin/src/components/Sidebar.tsx` (modifié)

### Documentation
- ✅ `/Users/sj/Desktop/Sportime/ODDS_SYNC_FIX.md`
- ✅ `/Users/sj/Desktop/Sportime/DEPLOY_ODDS_FIX.md`
- 🆕 `/Users/sj/Desktop/Sportime/DEPLOY_BOOKMAKER_CONFIG.md` (ce fichier)

---

## 🎉 Prochaines Étapes

Une fois cette migration déployée avec succès :

1. **Tester l'affichage frontend**
   - Ouvrir l'application mobile
   - Créer ou rejoindre un challenge de paris
   - Vérifier que les vraies cotes s'affichent (pas 2.0, 3.2, 2.4)

2. **Monitorer les logs**
   - Vérifier les logs Supabase pour les NOTICE du trigger
   - S'assurer que les odds se synchronisent automatiquement

3. **Commit Git**
   ```bash
   cd /Users/sj/Desktop/Sportime
   git add .
   git commit -m "feat(odds): add bookmaker configuration system"
   git push
   ```

---

**🎯 Objectif Final :** Permettre aux utilisateurs de parier avec des vraies cotes provenant du bookmaker de votre choix, avec la possibilité de changer de bookmaker à tout moment via l'interface admin ! 🚀
