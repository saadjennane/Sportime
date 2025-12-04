# Games List Page - Spécification Détaillée

## Vue d'ensemble

La page **Games List** (`GamesListPage.tsx`) affiche les jeux auxquels l'utilisateur participe ou peut rejoindre. Elle est divisée en deux onglets principaux :

1. **My Games** - Les jeux auxquels l'utilisateur a déjà rejoint
2. **Browse** - Les jeux disponibles à rejoindre

---

## Types de Jeux Supportés

| Type | Description | CTA Principal |
|------|-------------|---------------|
| `betting` | Paris sur les résultats des matchs | "Place your bets" |
| `prediction` | Prédictions swipe (gauche/droite) | "Make your predictions" |
| `fantasy` | Équipe fantasy à composer | "Select your team" / "Complete your team" |
| `fantasy-live` | Fantasy en temps réel | "Select your team" / "Complete your team" |

---

## Types de Périodes (`period_type`)

| Type | Groupement | Exemple d'affichage |
|------|------------|---------------------|
| `matchdays` | Par numéro de journée | "Matchday 15", "Matchday 16" |
| `calendar` | Par date calendaire | "Dec 5", "Dec 6", "Dec 7" |

---

## Onglet "My Games" - Sections

### 1. Play Now (Jouer Maintenant)

**Condition d'affichage :** Jeux où l'utilisateur peut encore agir (placer des paris, faire des prédictions, etc.)

**Règles de catégorisation :**
- Le **dernier match** du matchday/jour actuel n'a PAS encore le statut `FT` (Full Time)
- OU le dernier match est terminé ET il existe un prochain matchday dont le premier match n'a pas encore commencé

**CTA selon le type de jeu :**
| Game Type | CTA | Icône |
|-----------|-----|-------|
| betting | "Place your bets" | → |
| prediction | "Make your predictions" | → |
| fantasy (sans équipe) | "Select your team" | → |
| fantasy (équipe incomplète) | "Complete your team" | → |

**Compteur affiché :** "Deadline in Xh Ymin" (temps avant le kickoff du premier match du groupe actuel)

---

### 2. Awaiting Results (En attente des résultats)

**Condition d'affichage :** Matchs en cours - l'utilisateur ne peut plus agir

**Règles de catégorisation :**
- Le **premier match** du matchday/jour actuel a commencé (kickoff passé)
- ET le **dernier match** n'est PAS encore terminé (statut ≠ FT)

**CTA :** "View Game" avec icône horloge

**Pas de compteur** - les matchs sont en cours

---

### 3. Recently Finished (Récemment terminés)

**Condition d'affichage :** Jeux terminés depuis moins de 7 jours

**Règles de catégorisation :**
- La `end_date` du jeu est passée
- ET `end_date` > (now - 7 jours)

**CTA :** "View Results" avec icône →

**Tri :** Par `end_date` décroissante (plus récent en premier)

---

### 4. Past Games (Jeux passés)

**Condition d'affichage :** Jeux terminés depuis plus de 7 jours

**Règles de catégorisation :**
- La `end_date` du jeu est passée
- ET `end_date` ≤ (now - 7 jours)
- OU jeu annulé (`status === 'Cancelled'`)

**CTA :** "View Results"

**Tri :** Par `end_date` décroissante

---

## Onglet "Browse" - Sections

### 1. Available Games (Jeux disponibles)

**Condition d'affichage :** Jeux que l'utilisateur n'a pas encore rejoints

**Règles :**
- L'utilisateur n'est PAS participant (`myGameIds` ne contient pas le jeu)
- Le jeu n'est pas terminé (`end_date` pas passée)
- Le jeu n'est pas annulé

**CTA selon l'état :**
| État | CTA | Condition |
|------|-----|-----------|
| JOIN | "Join with Ticket" / "Join (X coins)" | Inscription ouverte |
| LOCKED | "Locked" (disabled) | Inscription fermée (30min avant kickoff) |
| IN_PROGRESS | "Live Now (Can't Join)" (disabled) | Premier match commencé |

**Compteur affiché :** "Registration closes in Xh Ymin" (pour l'état JOIN)

---

## Logique de Transition entre États

### Flux d'un jeu Betting/Prediction

```
[JOIN] → User joins → [PLACE_BETS / MAKE_PREDICTIONS]
                              ↓
                     Premier match kickoff
                              ↓
                        [AWAITING]
                              ↓
                     Dernier match FT
                              ↓
              Prochain matchday existe?
             /                          \
           OUI                          NON
            ↓                            ↓
    [PLACE_BETS]                  end_date passée?
    (next matchday)              /              \
                               OUI             NON
                                ↓               ↓
                          [RESULTS]        [AWAITING]
```

### Règle Clé : Transition "Awaiting → Play Now"

**Quand le dernier match d'un matchday a le statut `FT`, le jeu passe de "Awaiting Results" à "Play Now" pour le prochain matchday.**

Implémentation dans `challengeService.ts` :
1. Récupérer les fixtures du matchday via `matchday_fixtures`
2. Trier par `date` (kickoff) décroissante
3. Vérifier si le premier (= dernier chronologiquement) a `status === 'FT'`
4. Si oui → `result: 'draw'` (placeholder pour marquer comme terminé)

---

## Calcul des Deadlines

### Entry Deadline (Inscription)

**Fichier :** `GamesListPage.tsx` - fonction `calculateEntryDeadline`

```typescript
// 30 minutes avant le premier kickoff du jeu
entryDeadline = first_kickoff_time - 30 minutes
```

### Game Deadline (Action)

**Fichier :** `gameStateService.ts` - fonction `getGameDeadline`

```typescript
// Premier kickoff du groupe/matchday actuel
deadline = firstKickoff du currentGroupKey
```

---

## Affichage du Compteur

### Format selon le temps restant

| Temps restant | Format affiché |
|---------------|----------------|
| > 24h | "Dec 5, 3:00 PM" (date complète) |
| 1h - 24h | "Xh Ymin" |
| < 1h | "Ymin" (en rouge, urgent) |
| Passé | Rien (compteur masqué) |

---

## États des Matchs (Fixture Status)

### Statuts "Terminé"

```typescript
const finishedStatuses = ['FT', 'AET', 'PEN', 'AWARDED', 'W.O', 'CANC', 'ABD', 'POST']
```

| Status | Signification |
|--------|--------------|
| FT | Full Time (90 min) |
| AET | After Extra Time |
| PEN | Penalties |
| AWARDED | Match attribué |
| W.O | Walkover (forfait) |
| CANC | Cancelled |
| ABD | Abandoned |
| POST | Postponed |

### Statuts "En cours"

| Status | Signification |
|--------|--------------|
| NS | Not Started |
| 1H | First Half |
| HT | Half Time |
| 2H | Second Half |
| ET | Extra Time |
| BT | Break Time |
| P | Penalties en cours |

---

## Flux de Données

### Sources de données pour `matchesByChallenge`

1. **Source 1 : `challenge_matches`** (matches assignés manuellement)
   - Table `challenge_matches` avec jointure sur `fb_fixtures`
   - Vérifie le vrai statut/score des fixtures

2. **Source 2 : `challenge_matchdays`** (matchdays créés dans l'admin)
   - Table `challenge_matchdays` + `matchday_fixtures`
   - Vérifie le statut du **dernier match** pour déterminer si terminé

3. **Source 3 : Auto-génération depuis `fb_fixtures`**
   - Pour les jeux sans matchdays existants
   - Groupe par `round` (matchdays) ou `date` (calendar)
   - Vérifie le statut du **dernier match** de chaque groupe

---

## Fichiers Clés

| Fichier | Rôle |
|---------|------|
| `GamesListPage.tsx` | Page principale, catégorisation UI |
| `gameStateService.ts` | Logique centralisée de calcul d'état |
| `challengeService.ts` | Récupération des données, peuplement `matches` |
| `GameCard.tsx` | Composant carte de jeu, affichage CTA/compteurs |
| `ChallengeRoomPage.tsx` | Page de détail d'un jeu betting |

---

## Exemples de Scénarios

### Scénario 1 : Liga - Matchday 15 en cours

**État :**
- Matchday 15 : 3 matchs sur 10 terminés (FT), 2 en cours (2H), 5 pas commencés (NS)
- Dernier match du jour : 21:00, status NS

**Résultat :**
- **Catégorie :** Awaiting Results
- **CTA :** View Game
- **Raison :** Premier match a commencé mais dernier match pas encore FT

---

### Scénario 2 : Liga - Matchday 15 terminé, Matchday 16 dans 3 jours

**État :**
- Matchday 15 : Tous les matchs FT (dernier match FT à 23:00 hier)
- Matchday 16 : Premier match dans 3 jours

**Résultat :**
- **Catégorie :** Play Now
- **CTA :** Place your bets
- **Compteur :** "Deadline Dec 7, 6:30 PM"
- **Raison :** Dernier match MD15 = FT → transition vers MD16

---

### Scénario 3 : Swipe Calendar - Dec 4 sans matchs

**État :**
- Dec 3 : Tous matchs terminés
- Dec 4 : Aucun match programmé
- Dec 5 : Matchs programmés, premier à 15:00

**Résultat :**
- **Catégorie :** Play Now
- **CTA :** Make your predictions
- **Date picker :** Affiche Dec 3, Dec 5 (Dec 4 masqué car vide)
- **Sélection par défaut :** Dec 5

---

## Notes Techniques

### Performance
- Les queries Supabase sont optimisées avec des `in()` batch
- Le calcul d'état est mémoïsé avec `useMemo`
- Les compteurs se mettent à jour toutes les 60 secondes

### Cache
- `matchesByChallenge` est calculé une fois au chargement
- Les résultats de `fetchChallengeCatalog` sont mis en cache

### Edge Cases
- Jeux sans matchdays : Auto-génération depuis `fb_fixtures`
- Jeux annulés : Toujours dans "Past Games"
- Matchdays vides : Masqués dans le date picker
