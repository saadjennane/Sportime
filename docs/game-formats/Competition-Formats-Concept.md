# Note de concept — Formats de compétition (au-delà du Leaderboard)

> Document de réflexion produit (Head of Product). **Aucune implémentation** — à ressortir
> le moment venu. Capture le raisonnement, les décisions actées, et les pièges connus.

---

## 1. Contexte & problème

Aujourd'hui **tous les games sont au format Leaderboard** (classement cumulatif). C'est
simple et universel, mais **plat émotionnellement** : le milieu de tableau n'a pas d'enjeu,
pas de rivalité directe, pas de récit. On veut ajouter des formats qui créent **enjeu
hebdomadaire, rivalité et narration**.

Bonne nouvelle : le code a déjà du **scaffolding** dans cette direction —
`PrivateLeagueGameConfig` (`format_type: 'championship' | 'championship_knockout' |
'knockout'`, `knockout_type`, `include_third_place`, `tie_advantage: 'higher_seed'`,
`honorary_title`, `pairing_rule`) + un `CreatePrivateLeagueWizard`.

---

## 2. Vue d'ensemble

| Format | Où | Taille idéale | Cadence | Récit |
|---|---|---|---|---|
| **Round-robin** (H2H 3-1-0) | Squads | 6-12, figé | Toutes les journées | Table → champion |
| **Swiss** (H2H apparié au niveau) | Squads | 12+, ou saison courte | N journées fixes | Convergence vers une finale |
| **Ladder → Divisions** | **Public** (futur) | Population | Hebdo/mensuel | Grimper, promo/relégation |
| *(Adjacent)* **Knockout / Coupe** | Public événementiel / premium | 8-32 | Événement court | Bracket → finale |

Principe de base de Round-robin & Swiss : chaque **journée**, deux membres s'affrontent en
**H2H** — on compare leur score de pronostics sur les mêmes matchs, le meilleur gagne
(**3 pts victoire / 1 nul / 0 défaite**). Une table se construit.

---

## 3. Round-robin (squads)

**Mécanique** : tout le monde affronte tout le monde. À 8 joueurs → 7 journées (aller),
14 (aller-retour). Table 3-1-0.

- ✅ Le plus équitable et lisible (« la vraie ligue »), narratif.
- ❌ Exige un effectif **pair et figé**, et **N-1 journées** (explose vite, ne rentre pas
  toujours dans une saison).
- **Idéal** : squads **petites et stables (6-12)**.

**Pièges à trancher** : effectif impair (byes) · arrivées/départs en cours de saison
(figer le roster au coup d'envoi) · égalités (tiebreak) · **no-show** (un membre qui ne
pique pas = défaite auto ?) · matchs sans enjeu en fin de saison.

---

## 4. Swiss (squads)

**Mécanique** : on **fixe le nombre de journées** (ex. 5), pas l'adversaire. À chaque
journée, tu es apparié à quelqu'un ayant **le même nombre de points** que toi. Après N
journées → classement par points + tiebreak (type **Buchholz** = force des adversaires
rencontrés).

```
J1 : appariements par seed/aléatoire
J2 : 3 pts vs 3 pts · 0 pt vs 0 pt
J3 : 6 vs 6 …  → les leaders convergent vers une "finale" naturelle
```

- ✅ Marche avec **n'importe quel effectif** (gère les byes), **nombre de journées fixe**
  quelle que soit la taille, peu de matchs écrasés.
- ❌ Moins lisible (« pourquoi je joue lui ? ») · demande un **moteur d'appariement**
  (éviter rematchs, byes, tiebreak).
- **Idéal** : squads **moyennes/grandes (12+)** ou quand le round-robin complet ne tient
  pas dans la saison.

---

## 5. Ladder → Divisions (public, dans le tiroir)

Le **ladder** seul = une **échelle classée permanente** (king of the hill), sans saison.
Deux variantes :
- **À défis (position-swap)** : tu défies quelqu'un 2-3 places au-dessus ; si tu gagnes,
  vous échangez de place. Joueur-initié, asynchrone. *(Risque : camping du #1, coordination.)*
- **À rating (style Elo)** : chacun a un rating (départ 1000) ; chaque journée auto-apparié
  à un rating proche ; battre un mieux classé rapporte plus. Classement = rating. *(Zéro
  coordination, s'auto-équilibre.)*

### Le vrai usage visé : **Divisions avec promotion/relégation** (modèle Duolingo Leagues)

C'est la **destination** du ladder pour le **format public vivant sur l'année** :

- Joueurs répartis en **cohortes de taille fixe (~30)**, empilées en **divisions** (Bronze →
  … → Division 1 au sommet, une seule cohorte d'élite).
- Chaque période (**hebdo ou mensuelle**) : les **X meilleurs montent** d'une division, les
  **X moins bons descendent** — et échangent leurs places avec la division adjacente.
- Jusqu'en **fin de saison** où les meilleurs de la **Division 1 gagnent les récompenses**.

**Pourquoi c'est si fort** : dans une cohorte de 30 avec top-10 promus / bottom-10 relégués,
**~20 joueurs sur 30 ont un enjeu chaque période** (course à la promo ou lutte pour le
maintien). Le milieu de tableau — mort dans un leaderboard — devient le plus disputé.

**Les 4 facteurs critiques** :
1. **Cohortes de taille fixe**, pas des bassins géants (sinon « 47e sur 4 000 » ne veut rien
   dire). Une division = plein de cohortes de ~30 en parallèle.
2. **Cadence** : hebdo > mensuel pour l'addiction (boucle courte). Compromis possible :
   cohortes hebdo + récompenses de saison plus espacées.
3. **Récompenser la PROMOTION**, pas seulement la Division 1 en fin de saison — sinon 80 %
   des joueurs n'ont rien à viser. La montée elle-même = récompense (badge de division,
   coins) ; la Division 1 = le gros lot.
4. **Anti-inactivité = relégation** : pas de pick sur la période → fond de classement /
   descente, pour garder la mobilité.

**Cold start** : démarrer avec **1-2 divisions** et ajouter des étages quand la base grandit
(sinon cohortes ridicules) · tout le monde entre **en bas (Bronze)** et monte au mérite.

> Idée pour donner une « finale » au ladder pur sans saison : figer le classement
> périodiquement → titre honorifique « 🏆 Roi du mois » + post auto dans le feed.

---

## 6. Adjacent — Knockout / Coupes

Bracket à élimination (single/double, 3e place). Tension do-or-die + une finale.
- ❌ **Élimination précoce = désengagement** (churn). Mitiger : double élim, consolante, ou
  **phase de groupes d'abord** (matchs garantis) → c'est le format `championship_knockout`
  déjà prévu, **le meilleur des deux mondes**.
- **Usage** : **Coupes événementielles** (public) ou **playoff de fin de saison** entre les
  tops d'un championnat de squad. Pas un format « permanent ».

---

## 7. Angle premium (squads)

Hook premium clair et **non pay-to-win** : *« crée et pilote un championnat / une coupe
pour ta squad »* = le rôle de **commissioner** (statut + contrôle).

**Règle d'or** : ne verrouiller que la **création/le format** derrière le premium, **jamais
la participation**. Le créateur premium = commissioner ; ses membres jouent **gratuitement**
(sinon on tue l'effet réseau). Perks qui font envie : calendrier custom, titres
honorifiques/trophées, promotion/relégation entre saisons, pouvoirs de commissioner.

---

## 8. Séquencement recommandé

1. **Prouver d'abord le cœur de boucle squad** (feed social + leaderboard) — `squad_games`
   est encore vide ; ne pas empiler de la complexité de format avant la traction.
2. **Round-robin (H2H)** comme format squad de départ — meilleur ratio engagement/complexité,
   enjeu hebdo, carburant à banter pour le feed.
3. **Swiss** comme repli scalable pour les grandes squads.
4. **`championship_knockout`** (poules + playoffs) comme **format premium phare** ensuite.
5. **Knockout pur** réservé aux **Coupes** événementielles.
6. **Ladder → Divisions** = **dans le tiroir**, sorti **quand la population publique est
   suffisante** (système de population : il faut du volume pour remplir les cohortes). C'est
   alors le mécanisme de rétention le plus puissant de l'app.

---

## 9. Réutilisation de l'existant (allègement)

- **Scoring** : à l'intérieur d'une journée/cohorte, c'est le **leaderboard existant** sur la
  période. On settle déjà des classements par game → la source de score existe.
- **Le « nouveau »** se réduit à : **(a)** un **moteur d'appariement** (round-robin / Swiss /
  cohortes), **(b)** une **agrégation W/D/L → table**, **(c)** un **moteur de progression**
  (bracket et/ou promo-relégation).
- **Config** : `PrivateLeagueGameConfig` encode déjà championship / championship_knockout /
  knockout, seeding, 3e place, avantage au mieux classé.

---

## 10. Questions ouvertes à trancher (au moment du build)

- **No-show** : un membre qui ne pronostique pas une journée → défaite auto ? bye ? exclu ?
- **Roster mouvant** : figé au coup d'envoi (RR) vs toléré (Swiss/ladder) — politique par format.
- **Tiebreaks** : différence de points ? confrontation directe ? Buchholz (Swiss) ?
- **Taille de cohorte** et **X promus/relégués** (divisions) — règle exactes de mobilité.
- **Cadence divisions** : hebdo vs mensuel (et où placent les récompenses).
- **Récompenses** : promo (micro) vs Division 1 fin de saison (gros) — barème.
- **Premium** : quels formats sont gated ? quels pouvoirs commissioner exactement ?

---

## 11. Décisions actées (à ce stade)

- ✅ **Squads** : Round-robin (petites/stables) **+** Swiss (grandes/saison courte). H2H 3-1-0.
- ✅ **Knockout** : pas un format permanent → **Coupes** événementielles + `championship_knockout`
  premium.
- ✅ **Ladder** : **mis de côté**, destiné au futur **format public à divisions** (promo/relégation
  type Duolingo Leagues).
- ✅ **Premium** = commissioner d'une squad (création/format payants, **participation gratuite**).
- ✅ **Timing** : après validation du cœur de boucle squad (feed + leaderboard).
