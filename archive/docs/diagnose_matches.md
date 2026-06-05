# Diagnostic: Matches Page - Pas de Logos, Scores ni Cotes

## 🔍 Problème Identifié

Le code est **correct** mais les **données sont probablement absentes** de la base de données.

---

## ✅ Vérifications à Faire dans Supabase

### 1. Vérifier si vous avez des fixtures importées

```sql
-- Combien de fixtures au total?
SELECT COUNT(*) as total_fixtures FROM fb_fixtures;

-- Combien de fixtures aujourd'hui?
SELECT COUNT(*) as today_fixtures
FROM fb_fixtures
WHERE date >= NOW() - INTERVAL '1 day'
  AND date <= NOW() + INTERVAL '1 day';
```

**Résultat Attendu**: `total_fixtures > 0` et `today_fixtures > 0`

**Si 0**: Vous n'avez AUCUNE fixture importée → Il faut synchroniser les fixtures

---

### 2. Vérifier les équipes

```sql
SELECT
  COUNT(*) as total_teams,
  COUNT(logo) as teams_with_logo,
  COUNT(*) - COUNT(logo) as teams_without_logo
FROM fb_teams;
```

**Résultat Attendu**: `total_teams > 0`

**Si 0**: Vous n'avez AUCUNE équipe importée

---

### 3. Vérifier les cotes

```sql
SELECT COUNT(DISTINCT fixture_id) as fixtures_with_odds
FROM fb_odds;
```

**Résultat Attendu**: `fixtures_with_odds > 0`

**Si 0**: Aucune cote n'est synchronisée (normal si pas de sync manuel)

---

### 4. Vérifier un échantillon de fixtures

```sql
SELECT
  f.id,
  f.date,
  f.status,
  f.goals_home,
  f.goals_away,
  f.home_team_id,
  f.away_team_id,
  ht.name as home_team,
  ht.logo as home_logo,
  at.name as away_team,
  at.logo as away_logo
FROM fb_fixtures f
LEFT JOIN fb_teams ht ON ht.id = f.home_team_id
LEFT JOIN fb_teams at ON at.id = f.away_team_id
WHERE f.date >= NOW() - INTERVAL '1 day'
  AND f.date <= NOW() + INTERVAL '1 day'
ORDER BY f.date
LIMIT 5;
```

**Résultat Attendu**: Au moins 1 ligne avec des équipes et dates

---

## 🚨 Si Aucune Donnée N'Est Retournée

### Vous devez synchroniser les données depuis l'Admin Panel

#### Étape 1: Synchroniser les Ligues
1. Ouvrir **Admin Panel** (http://localhost:5174 ou port affiché)
2. Aller dans **Data Sync**
3. Section **Leagues**
4. Cliquer sur **"Sync Leagues"**
5. Sélectionner les ligues que vous voulez (ex: La Liga, Premier League)

#### Étape 2: Synchroniser les Équipes
1. Même page **Data Sync**
2. Section **Teams**
3. Sélectionner une ligue
4. Cliquer sur **"Sync Teams"**
5. Répéter pour chaque ligue

#### Étape 3: Synchroniser les Fixtures
1. Section **Fixtures**
2. Sélectionner une ligue
3. Sélectionner une saison (ex: 2024)
4. Cliquer sur **"Sync Fixtures"**

#### Étape 4: (Optionnel) Synchroniser les Cotes
1. Section **Odds**
2. Cliquer sur **"Sync Odds"** pour les matchs à venir

---

## 🔧 Autre Possibilité: Problème de Foreign Key

Si `fb_fixtures` existe mais `fb_teams` est vide, le problème est que:

```sql
-- Les fixtures pointent vers des team_id qui n'existent pas
SELECT
  f.id,
  f.home_team_id,
  f.away_team_id
FROM fb_fixtures f
LEFT JOIN fb_teams ht ON ht.id = f.home_team_id
LEFT JOIN fb_teams at ON at.id = f.away_team_id
WHERE ht.id IS NULL OR at.id IS NULL
LIMIT 5;
```

**Solution**: Synchroniser les équipes d'abord

---

## 📊 Logs à Vérifier

Dans votre navigateur (Console DevTools):

1. Ouvrir **DevTools** (F12)
2. Onglet **Console**
3. Chercher:
   ```
   [MatchesPage] Imported leagues: [...]
   [useMatchesOfTheDay] Found X finished fixtures
   ```

4. Si vous voyez:
   ```
   [MatchesPage] Imported leagues: []
   ```
   → Aucune ligue importée, synchronisez d'abord

---

## ✅ Checklist de Débogage

- [ ] Vérifier que `fb_leagues` contient des ligues
- [ ] Vérifier que `fb_teams` contient des équipes
- [ ] Vérifier que `fb_fixtures` contient des fixtures
- [ ] Vérifier que `fb_fixtures.date` est dans la plage d'aujourd'hui
- [ ] Vérifier les logs de la console navigateur
- [ ] Rafraîchir la page après synchronisation
- [ ] Vérifier que l'app mobile tourne sur http://localhost:5179/mobile/

---

## 🎯 Test Rapide

Exécutez cette requête pour voir si TOUT est vide:

```sql
SELECT
  (SELECT COUNT(*) FROM fb_leagues) as leagues,
  (SELECT COUNT(*) FROM fb_teams) as teams,
  (SELECT COUNT(*) FROM fb_fixtures) as fixtures,
  (SELECT COUNT(*) FROM fb_odds) as odds;
```

Si tout est à **0**, vous devez faire la synchronisation complète via l'Admin Panel.
