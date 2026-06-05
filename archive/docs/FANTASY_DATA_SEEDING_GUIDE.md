# Guide de Seeding des Données Fantasy - La Liga

Ce guide explique comment peupler le système Fantasy avec les données de La Liga pour commencer à utiliser le jeu.

## 📋 Prérequis

- ✅ Edge functions déployées (Phase 1 complétée)
- ✅ GitHub workflows actifs
- ✅ API_SPORTS_KEY configurée dans Supabase
- ✅ Admin panel avec accès Fantasy

## 🎯 Vue d'ensemble du Processus

```
1. Seed La Liga Data (équipes, joueurs, stats) → 30-60 min
2. Populer Fantasy Players (pool de 300 joueurs) → 5 min
3. Créer Fantasy Game (saison 2024/25) → 2 min
4. Créer 38 Game Weeks (jornadas) → 2 min
5. Sync Match Stats (matchs terminés) → 15 min
6. Process Points (calcul pour jornadas terminées) → 5 min
```

**Temps total: ~1-2 heures** (la plupart est automatique)

---

## 📦 Étape 1: Seed La Liga Data

### Via Admin Panel

1. **Accéder au Panel Fantasy**:
   - Va sur `/admin`
   - Clique sur l'onglet "**Fantasy**"
   - Scroll jusqu'à "**Fantasy Manual Sync**"

2. **Lancer le Seed**:
   - Clique sur "**Lancer Seed**" (bouton vert)
   - Quand demandé:
     - League API ID: **140** (La Liga)
     - Season: **2024**
   - Entre ta **Supabase Service Role Key** quand demandé
   - Attends ~30-60 minutes

3. **Vérifier le Seed**:
   - Regarde les logs dans la section "Logs d'Exécution"
   - Tu devrais voir les équipes et joueurs importés

### Via cURL (Alternative)

```bash
curl -X POST "https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/seed-fantasy-data" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "leagues": [{
      "api_id": 140,
      "name": "La Liga",
      "country": "Spain",
      "priority": true
    }],
    "season": 2024
  }'
```

### ⚠️ Note Importante

L'edge function traite **20 joueurs à la fois** pour éviter les timeouts. Si tu as besoin de plus de joueurs:
- Relance la fonction plusieurs fois
- Ou augmente la limite dans le code de l'edge function

### ✅ Résultat Attendu

Après cette étape, tu devrais avoir:
- 20 équipes de La Liga dans `teams`
- ~600 joueurs dans `players`
- Stats de saison dans `player_season_stats`

---

## 👥 Étape 2: Populer Fantasy Players

### Via Admin Panel

1. **Accéder à Fantasy Player Admin**:
   - Dans l'onglet "Fantasy"
   - Scroll jusqu'à "**Fantasy Players Pool**"

2. **Lancer la Population**:
   - Clique sur "**Peupler depuis Stats**" (bouton vert)
   - Confirme quand demandé
   - Attends ~5-10 secondes

3. **Vérifier le Pool**:
   - Regarde les stats en haut:
     - Total Joueurs: devrait être ~300
     - Répartition par position (GK, DEF, MID, ATT)
     - Répartition par statut (Star, Key, Wild)
   - Utilise les filtres pour explorer le pool

### Via SQL (Alternative)

Si tu préfères exécuter via SQL Editor:

```sql
INSERT INTO fantasy_players (
  api_player_id, name, photo, position, status,
  fatigue, team_name, team_logo, birthdate, pgs
)
SELECT
  p.api_id,
  p.first_name || ' ' || p.last_name,
  p.photo_url,
  p.position,
  CASE
    WHEN pss.pgs >= 7.5 THEN 'Star'
    WHEN pss.pgs >= 6.0 THEN 'Key'
    ELSE 'Wild'
  END,
  100,
  t.name,
  t.logo_url,
  p.birthdate,
  pss.pgs
FROM players p
JOIN player_season_stats pss ON p.id = pss.player_id
JOIN teams t ON pss.team_id = t.id
WHERE pss.season = 2024
  AND pss.league_id = '22222222-2222-2222-2222-222222222222'
  AND pss.appearances >= 5
ORDER BY pss.pgs DESC
LIMIT 300
ON CONFLICT (api_player_id) DO NOTHING;
```

### ✅ Résultat Attendu

- 300 joueurs dans `fantasy_players`
- Distribution typique:
  - **Star** (PGS ≥7.5): ~50 joueurs
  - **Key** (PGS 6-7.5): ~100 joueurs
  - **Wild** (PGS <6): ~150 joueurs

---

## 🎮 Étape 3: Créer un Fantasy Game

### Via Admin Panel

1. **Accéder à Fantasy Game Admin**:
   - Dans l'onglet "Fantasy"
   - Section "**Fantasy Games Admin**"

2. **Cliquer sur "+ Nouveau Jeu**"

3. **Remplir le Formulaire**:
   - **Nom du Jeu**: `La Liga Fantasy - Saison 2024/25`
   - **Statut**: `Ongoing`
   - **Date de Début**: `2024-08-15` (début de saison)
   - **Date de Fin**: `2025-05-25` (fin de saison)
   - **Coût d'Entrée**: `1500` coins
   - **Linkable**: ✅ Coché

4. **Créer le Jeu**:
   - Clique sur "Créer le Jeu"
   - Note l'**ID du jeu** créé (tu en auras besoin pour les game weeks)

### Via SQL (Alternative)

```sql
INSERT INTO fantasy_games (id, name, status, start_date, end_date, entry_cost, is_linkable)
VALUES (
  gen_random_uuid(),
  'La Liga Fantasy - Saison 2024/25',
  'Ongoing',
  '2024-08-15',
  '2025-05-25',
  1500,
  true
) RETURNING id;
```

---

## 📅 Étape 4: Créer les Game Weeks

### Option A: Création en Masse (Recommandé)

1. **Accéder à Fantasy Game Week Admin**:
   - Dans l'onglet "Fantasy"
   - Section "**Fantasy Game Weeks Admin**"

2. **Sélectionner le Jeu**:
   - Dans le dropdown en haut, sélectionne le jeu créé à l'étape 3

3. **Cliquer sur "Création en Masse"**

4. **Remplir le Formulaire**:
   - **Nombre de Weeks**: `38`
   - **Date Première Jornada (Vendredi)**: `2024-08-16`
   - **Ligue**: `LaLiga`
   - **Max Joueurs par Club**: `2`

5. **Créer les Game Weeks**:
   - Clique sur "Créer 38 Game Weeks"
   - Attends ~2-3 secondes
   - Vérifie que 38 jornadas apparaissent dans la liste

### Option B: Création Manuelle (Une par Une)

Pour créer une seule game week:
1. Clique sur "+ Nouvelle Game Week"
2. Remplis les champs:
   - Nom: `Jornada 1`
   - Statut: `upcoming`/`live`/`finished`
   - Date début: `2024-08-16`
   - Date fin: `2024-08-18`
   - Max joueurs par club: `2`

### 📝 Calendrier La Liga 2024/25

Les 38 jornadas sont généralement:
- **Jornadas 1-19**: Août 2024 → Janvier 2025
- **Jornadas 20-38**: Janvier 2025 → Mai 2025

Le script "Création en Masse" génère automatiquement les dates (Vendredi → Dimanche, chaque semaine).

### ✅ Résultat Attendu

- 38 game weeks dans `fantasy_game_weeks`
- Statuts automatiquement calculés selon la date:
  - Passées: `finished`
  - En cours: `live`
  - Futures: `upcoming`

---

## 📊 Étape 5: Sync Match Stats

### Via Admin Panel

1. **Accéder à Fantasy Manual Sync**:
   - Dans l'onglet "Fantasy"
   - Section "**Fantasy Manual Sync & Processing**"

2. **Lancer Sync Match Stats**:
   - Clique sur "**Sync Stats**" (bouton bleu)
   - Quand demandé:
     - Laisse **vide** pour syncer toutes les game weeks actives
     - Ou entre un **Game Week ID** pour une jornada spécifique
   - Entre ta **Service Role Key**
   - Attends ~5-30 minutes (selon nombre de jornadas)

3. **Vérifier les Stats**:
   - Regarde les logs pour voir les fixtures synchro nisés
   - Devrait voir "X fixtures synced, Y players processed"

### Via cURL (Alternative)

```bash
# Sync toutes les game weeks actives/récentes
curl -X POST "https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-all-active-gameweeks" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# Ou sync une game week spécifique
curl -X POST "https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-match-stats" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"game_week_id": "UUID_DE_LA_GAME_WEEK"}'
```

### ✅ Résultat Attendu

- Stats de match dans `player_match_stats` pour chaque fixture terminé
- Données incluant: goals, assists, rating, minutes_played, etc.

---

## 🎯 Étape 6: Process Points

### Via Admin Panel

1. **Accéder à Fantasy Manual Sync**:
   - Section "**Fantasy Manual Sync & Processing**"

2. **Lancer Process Game Week**:
   - Clique sur "**Calculer Points**" (bouton violet)
   - Quand demandé:
     - Laisse **vide** pour processer toutes les jornadas finies
     - Ou entre un **Game Week ID** pour une jornada spécifique
   - Entre ta **Service Role Key**
   - Attends ~2-10 minutes

3. **Vérifier les Points**:
   - Les logs devraient montrer "X teams processed, Y leaderboard entries"
   - Va voir une game week dans le panel pour vérifier le leaderboard

### Via cURL (Alternative)

```bash
# Process toutes les game weeks finies
curl -X POST "https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/process-all-finished-gameweeks" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### ✅ Résultat Attendu

- Points calculés dans `user_fantasy_teams.total_points`
- Leaderboard généré dans `fantasy_leaderboard`
- Fatigue des joueurs mise à jour dans `fantasy_players`

---

## 🤖 Automatisation (Une Fois Configuré)

Une fois que tu as créé les jeux et game weeks, le système fonctionne automatiquement via les GitHub Actions:

### Workflows Actifs

1. **Update Game Week Status** (Toutes les 5 min):
   - Transitions automatiques: `upcoming` → `live` → `finished`
   - Verrouille les équipes quand `live`

2. **Sync Match Stats** (Toutes les 2h):
   - Synchronise les stats des matches en cours/terminés
   - Garde les données à jour

3. **Process Finished Game Weeks** (Toutes les heures à :15):
   - Calcule automatiquement les points pour les jornadas terminées
   - Met à jour le leaderboard

### Monitoring

Tu peux surveiller les workflows sur:
https://github.com/saadjennane/Sportime/actions

---

## 🛠️ Maintenance Régulière

### Hebdomadaire

- **Sync Fantasy Players** (optionnel):
  - Met à jour les PGS des joueurs
  - Ajuste les statuts (Star/Key/Wild) si nécessaire
  - Via "Sync Players" dans Fantasy Manual Sync

### Après Chaque Jornada

Le système fait tout automatiquement, mais tu peux vérifier:
1. Stats synchro: Vérifie dans `player_match_stats`
2. Points calculés: Vérifie le leaderboard
3. Fatigue mise à jour: Vérifie les joueurs utilisés

---

## 🐛 Troubleshooting

### Seed prend trop de temps?

- ✅ C'est normal (~30-60 min pour 600 joueurs)
- Rate limiting de 500ms entre chaque API call
- Solution: Sois patient ou augmente le batch size dans le code

### Pas tous les joueurs importés?

- La fonction traite 20 joueurs à la fois
- Relance la fonction plusieurs fois pour obtenir plus de joueurs

### Stats de match manquantes?

- Vérifie que les fixtures sont bien dans `fb_fixtures`
- Vérifie que les matchs ont le statut `'FT'` (Full Time)
- Relance sync-match-stats pour cette game week

### Points non calculés?

- Vérifie que le statut de la game week est `'finished'`
- Vérifie que les stats de match existent (`player_match_stats`)
- Lance manuellement process-fantasy-gameweek

### Fatigue incohérente?

- Utilise "Reset Fatigue (All)" dans Fantasy Player Admin
- Ou exécute:
  ```sql
  UPDATE fantasy_players SET fatigue = 100;
  ```

---

## 📞 Support

- **Documentation complète**: [FANTASY_PHASE1_COMPLETE.md](FANTASY_PHASE1_COMPLETE.md)
- **Vérification deployment**: [FANTASY_DEPLOYMENT_VERIFICATION.md](/tmp/FANTASY_DEPLOYMENT_VERIFICATION.md)
- **Supabase Dashboard**: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr
- **GitHub Actions**: https://github.com/saadjennane/Sportime/actions

---

## ✅ Checklist Complète

- [ ] Étape 1: Seed La Liga Data (30-60 min)
- [ ] Étape 2: Populer Fantasy Players (5 min)
- [ ] Étape 3: Créer Fantasy Game (2 min)
- [ ] Étape 4: Créer 38 Game Weeks (2 min)
- [ ] Étape 5: Sync Match Stats (15 min)
- [ ] Étape 6: Process Points (5 min)
- [ ] Vérifier workflows GitHub Actions actifs
- [ ] Vérifier leaderboard pour une jornada terminée
- [ ] Vérifier fatigue des joueurs

**Temps total: 1-2 heures** ⏱️

Une fois complété, le système Fantasy fonctionne en automatique! 🎉
