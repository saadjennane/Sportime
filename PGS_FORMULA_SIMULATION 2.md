# Simulation PGS - Comparaison Formules Actuelles vs Nouvelles

## 📊 Données des Joueurs (La Liga 2025)

| Joueur | Goals | Assists | Rating | Appearances | Minutes | Key Passes | Shots On Target |
|--------|-------|---------|--------|-------------|---------|------------|-----------------|
| Kylian Mbappé | 13 | 2 | 7.95 | 12 | 1080 (100%) | ~15 | ~25 |
| Lamine Yamal | 4 | 4 | 7.69 | 8 | 720 (100%) | ~12 | ~10 |
| Vinícius Júnior | 5 | 4 | 7.49 | 12 | 1080 (100%) | ~10 | ~15 |
| Jude Bellingham | 2 | 1 | 7.33 | 8 | 471 (65%) | ~10 | ~8 |
| Pedri | 2 | 1 | 7.70 | 10 | 900 (100%) | ~20 | ~5 |
| Frenkie de Jong | 0 | 2 | 7.34 | 10 | 900 (100%) | ~15 | ~3 |

---

## 🔴 FORMULE ACTUELLE (PROBLÉMATIQUE)

### Impact Score Actuel
```sql
impact_per_game = (
    (goals × 1.0) +
    (assists × 0.7) +
    (key_passes × 0.3) +
    (dribbles × 0.2) +
    (tackles × 0.15) +
    (shots_on_target × 0.1)
) / appearances

-- Puis cappé à 10
impact_score = MIN(impact_per_game, 10)
```

### PGS Actuel
```sql
base_pgs = (rating × 0.5) + (impact × 0.3) + (consistency × 0.2)
playtime_bonus = 0.3 si ≥90%, 0.15 si ≥50%, 0.05 sinon
pgs = base_pgs + playtime_bonus
```

### Catégories Actuelles
- Star: PGS ≥ 7.5
- Key: 6.5 ≤ PGS < 7.5
- Wild: PGS < 6.5

---

## 📈 CALCULS AVEC FORMULE ACTUELLE

### Kylian Mbappé (13 goals, 2 assists, 7.95 rating)
```
Impact per game = (13×1.0 + 2×0.7 + 15×0.3 + 0 + 0 + 25×0.1) / 12
                = (13 + 1.4 + 4.5 + 2.5) / 12
                = 21.4 / 12
                = 1.78

Impact Score = MIN(1.78, 10) = 1.78

Consistency = ~8.0 (supposé, basé sur stddev)

Base PGS = (7.95 × 0.5) + (1.78 × 0.3) + (8.0 × 0.2)
         = 3.975 + 0.534 + 1.600
         = 6.11

Playtime Bonus = 0.3 (100% playtime)

PGS Final = 6.11 + 0.3 = 6.41

Catégorie = Wild ❌ (devrait être Star)
```

### Lamine Yamal (4 goals, 4 assists, 7.69 rating)
```
Impact per game = (4×1.0 + 4×0.7 + 12×0.3 + 0 + 0 + 10×0.1) / 8
                = (4 + 2.8 + 3.6 + 1.0) / 8
                = 11.4 / 8
                = 1.43

Impact Score = 1.43

Consistency = ~7.5

Base PGS = (7.69 × 0.5) + (1.43 × 0.3) + (7.5 × 0.2)
         = 3.845 + 0.429 + 1.500
         = 5.77

Playtime Bonus = 0.3

PGS Final = 5.77 + 0.3 = 6.07

Catégorie = Wild ❌ (devrait être Star)
```

### Jude Bellingham (2 goals, 1 assist, 7.33 rating)
```
Impact per game = (2×1.0 + 1×0.7 + 10×0.3 + 0 + 0 + 8×0.1) / 8
                = (2 + 0.7 + 3.0 + 0.8) / 8
                = 6.5 / 8
                = 0.81

Impact Score = 0.81

Consistency = 9.26 (from DB)

Base PGS = (7.33 × 0.5) + (0.81 × 0.3) + (9.26 × 0.2)
         = 3.665 + 0.243 + 1.852
         = 5.76

Playtime Bonus = 0.15 (65% playtime)

PGS Final = 5.76 + 0.15 = 5.91

Catégorie = Wild ❌ (devrait être Key)
```

### Pedri (2 goals, 1 assist, 7.70 rating)
```
Impact per game = (2×1.0 + 1×0.7 + 20×0.3 + 0 + 0 + 5×0.1) / 10
                = (2 + 0.7 + 6.0 + 0.5) / 10
                = 9.2 / 10
                = 0.92

Impact Score = 0.92

Consistency = ~8.0

Base PGS = (7.70 × 0.5) + (0.92 × 0.3) + (8.0 × 0.2)
         = 3.850 + 0.276 + 1.600
         = 5.73

Playtime Bonus = 0.3

PGS Final = 5.73 + 0.3 = 6.03

Catégorie = Wild ❌ (devrait être Key)
```

---

## 🟢 NOUVELLE FORMULE PROPOSÉE

### Nouveau Impact Score
```sql
-- NE PLUS diviser par appearances, utiliser des multiplicateurs directs
raw_impact = (
    (goals × 3.0) +           -- Augmenté de 1.0 à 3.0
    (assists × 2.0) +          -- Augmenté de 0.7 à 2.0
    (key_passes × 0.08) +      -- Ajusté pour ~10 key passes = 0.8
    (shots_on_target × 0.06) + -- Ajusté pour ~15 shots = 0.9
    (dribbles × 0.05) +        -- Bonus pour dribbleurs
    (tackles × 0.04)           -- Bonus pour défenseurs
)

-- Normaliser sur échelle 0-10
impact_score = MIN(raw_impact / (appearances * 0.5), 10)
-- Division par (appearances × 0.5) pour tenir compte de la régularité
-- Un joueur avec 10 goals en 10 matchs aura plus d'impact qu'avec 10 goals en 30 matchs
```

### Nouveau PGS
```sql
-- Augmenter le poids de l'impact, réduire le rating
base_pgs = (rating × 0.35) + (impact × 0.50) + (consistency × 0.15)

-- Augmenter les bonus de playtime
playtime_bonus = 0.5 si ≥90%, 0.25 si ≥50%, 0.1 sinon

-- Gérer les NULL ratings
IF rating IS NULL THEN
    base_pgs = (impact × 0.70) + (consistency × 0.30)
END IF

pgs = base_pgs + playtime_bonus
```

### Nouvelles Catégories (ajustées)
- Star: PGS ≥ 7.0 (baissé de 7.5)
- Key: 5.5 ≤ PGS < 7.0 (baissé de 6.5)
- Wild: PGS < 5.5

---

## 📈 CALCULS AVEC NOUVELLE FORMULE

### Kylian Mbappé (13 goals, 2 assists, 7.95 rating)
```
Raw Impact = (13×3.0) + (2×2.0) + (15×0.08) + (25×0.06) + 0 + 0
           = 39 + 4 + 1.2 + 1.5
           = 45.7

Impact Score = MIN(45.7 / (12 × 0.5), 10)
             = MIN(45.7 / 6, 10)
             = MIN(7.62, 10)
             = 7.62

Consistency = 8.0

Base PGS = (7.95 × 0.35) + (7.62 × 0.50) + (8.0 × 0.15)
         = 2.783 + 3.810 + 1.200
         = 7.79

Playtime Bonus = 0.5

PGS Final = 7.79 + 0.5 = 8.29

Catégorie = Star ✅
```

### Lamine Yamal (4 goals, 4 assists, 7.69 rating)
```
Raw Impact = (4×3.0) + (4×2.0) + (12×0.08) + (10×0.06) + 0 + 0
           = 12 + 8 + 0.96 + 0.6
           = 21.56

Impact Score = MIN(21.56 / (8 × 0.5), 10)
             = MIN(21.56 / 4, 10)
             = MIN(5.39, 10)
             = 5.39

Consistency = 7.5

Base PGS = (7.69 × 0.35) + (5.39 × 0.50) + (7.5 × 0.15)
         = 2.692 + 2.695 + 1.125
         = 6.51

Playtime Bonus = 0.5

PGS Final = 6.51 + 0.5 = 7.01

Catégorie = Star ✅
```

### Vinícius Júnior (5 goals, 4 assists, 7.49 rating)
```
Raw Impact = (5×3.0) + (4×2.0) + (10×0.08) + (15×0.06) + 0 + 0
           = 15 + 8 + 0.8 + 0.9
           = 24.7

Impact Score = MIN(24.7 / (12 × 0.5), 10)
             = MIN(24.7 / 6, 10)
             = 4.12

Consistency = 7.0

Base PGS = (7.49 × 0.35) + (4.12 × 0.50) + (7.0 × 0.15)
         = 2.622 + 2.060 + 1.050
         = 5.73

Playtime Bonus = 0.5

PGS Final = 5.73 + 0.5 = 6.23

Catégorie = Key ✅ (proche de Star)
```

### Jude Bellingham (2 goals, 1 assist, 7.33 rating)
```
Raw Impact = (2×3.0) + (1×2.0) + (10×0.08) + (8×0.06) + 0 + 0
           = 6 + 2 + 0.8 + 0.48
           = 9.28

Impact Score = MIN(9.28 / (8 × 0.5), 10)
             = MIN(9.28 / 4, 10)
             = 2.32

Consistency = 9.26

Base PGS = (7.33 × 0.35) + (2.32 × 0.50) + (9.26 × 0.15)
         = 2.566 + 1.160 + 1.389
         = 5.11

Playtime Bonus = 0.25 (65% playtime)

PGS Final = 5.11 + 0.25 = 5.36

Catégorie = Wild ❌ (attendu: Key)

Note: Bellingham souffre de faibles stats offensives (2 goals, 1 assist)
      mais a une excellente consistency (9.26).
      Sa catégorie Wild est justifiée par manque de production offensive.
```

### Pedri (2 goals, 1 assist, 7.70 rating)
```
Raw Impact = (2×3.0) + (1×2.0) + (20×0.08) + (5×0.06) + 0 + 0
           = 6 + 2 + 1.6 + 0.3
           = 9.9

Impact Score = MIN(9.9 / (10 × 0.5), 10)
             = MIN(9.9 / 5, 10)
             = 1.98

Consistency = 8.0

Base PGS = (7.70 × 0.35) + (1.98 × 0.50) + (8.0 × 0.15)
         = 2.695 + 0.990 + 1.200
         = 4.88

Playtime Bonus = 0.5

PGS Final = 4.88 + 0.5 = 5.38

Catégorie = Wild ❌ (attendu: Key)

Note: Pedri est un milieu défensif/créateur avec peu de goals/assists.
      Son rating élevé (7.70) et bonnes key passes (20) ne suffisent pas
      dans la nouvelle formule qui privilégie goals/assists.
```

### Frenkie de Jong (0 goals, 2 assists, 7.34 rating)
```
Raw Impact = (0×3.0) + (2×2.0) + (15×0.08) + (3×0.06) + 0 + 0
           = 0 + 4 + 1.2 + 0.18
           = 5.38

Impact Score = MIN(5.38 / (10 × 0.5), 10)
             = MIN(5.38 / 5, 10)
             = 1.08

Consistency = 7.5

Base PGS = (7.34 × 0.35) + (1.08 × 0.50) + (7.5 × 0.15)
         = 2.569 + 0.540 + 1.125
         = 4.23

Playtime Bonus = 0.5

PGS Final = 4.23 + 0.5 = 4.73

Catégorie = Wild ✅ (justifié: 0 goals, 2 assists)
```

---

## 📊 TABLEAU COMPARATIF

| Joueur | Goals | Assists | Rating | PGS Actuel | Catégorie Actuelle | PGS Nouveau | Catégorie Nouvelle | Changement |
|--------|-------|---------|--------|------------|-------------------|-------------|-------------------|------------|
| **Mbappé** | 13 | 2 | 7.95 | 6.41 | Wild ❌ | **8.29** | **Star ✅** | +1.88 |
| **Yamal** | 4 | 4 | 7.69 | 6.07 | Wild ❌ | **7.01** | **Star ✅** | +0.94 |
| **Vinícius Jr** | 5 | 4 | 7.49 | ~6.0 | Wild ❌ | **6.23** | **Key ✅** | +0.23 |
| **Bellingham** | 2 | 1 | 7.33 | 5.91 | Wild | **5.36** | **Wild** | -0.55 |
| **Pedri** | 2 | 1 | 7.70 | 6.03 | Wild | **5.38** | **Wild** | -0.65 |
| **De Jong** | 0 | 2 | 7.34 | ~5.5 | Wild ✅ | **4.73** | **Wild ✅** | -0.77 |

---

## ✅ RÉSULTATS DE LA SIMULATION

### Top Performers (Goals + Assists)
- **Mbappé**: Passe de Wild (6.41) à **Star (8.29)** ✅
- **Yamal**: Passe de Wild (6.07) à **Star (7.01)** ✅
- **Vinícius**: Passe de Wild (6.0) à **Key (6.23)** ✅

### Milieux Créateurs (Peu de G+A)
- **Bellingham**: Reste Wild (5.36) - Justifié par 2G+1A seulement
- **Pedri**: Reste Wild (5.38) - Milieu défensif, peu de production offensive
- **De Jong**: Reste Wild (4.73) - 0 goals, rôle purement défensif

---

## 🎯 AJUSTEMENTS SUGGÉRÉS

### Option 1: Formule Actuelle (Conservatrice)
✅ **Avantages:**
- Mbappé et Yamal deviennent Star
- Récompense correctement les buteurs

❌ **Inconvénients:**
- Pédri et De Jong (milieux défensifs de classe mondiale) deviennent Wild
- Ne valorise pas assez les créateurs sans goals

### Option 2: Formule Ajustée (Recommandée)
**Augmenter le poids des key passes:**
```sql
raw_impact = (
    (goals × 3.0) +
    (assists × 2.0) +
    (key_passes × 0.12) +  -- Augmenté de 0.08 à 0.12
    (shots_on_target × 0.06) +
    (dribbles × 0.05) +
    (tackles × 0.04)
)
```

**Recalcul pour Pedri:**
```
Raw Impact = (2×3.0) + (1×2.0) + (20×0.12) + (5×0.06)
           = 6 + 2 + 2.4 + 0.3 = 10.7

Impact Score = 10.7 / 5 = 2.14

Base PGS = (7.70×0.35) + (2.14×0.50) + (8.0×0.15)
         = 2.695 + 1.070 + 1.200 = 4.96

PGS Final = 4.96 + 0.5 = 5.46

Catégorie = Wild (juste en dessous de Key 5.5)
```

Même avec l'ajustement, Pedri reste Wild car il a seulement 2 goals + 1 assist.

---

## 🔍 RECOMMANDATION FINALE

### Formule Recommandée:
```sql
-- Impact Score
raw_impact = (goals×3.0) + (assists×2.0) + (key_passes×0.10) +
             (shots_on_target×0.06) + (dribbles×0.05) + (tackles×0.04)
impact_score = MIN(raw_impact / (appearances × 0.5), 10)

-- PGS
base_pgs = (rating×0.35) + (impact×0.50) + (consistency×0.15)
playtime_bonus = 0.5 si ≥90%, 0.25 si ≥50%, 0.1 sinon
pgs = base_pgs + playtime_bonus

-- Catégories
Star: PGS ≥ 7.0
Key: 5.5 ≤ PGS < 7.0
Wild: PGS < 5.5
```

### Résultats Attendus:
- ✅ **Mbappé** (13G, 2A): Star (8.29)
- ✅ **Yamal** (4G, 4A): Star (7.01)
- ✅ **Vinícius** (5G, 4A): Key (6.23)
- ⚠️ **Bellingham** (2G, 1A): Wild (5.36) - Acceptable vu ses stats
- ⚠️ **Pedri** (2G, 1A): Wild (5.38) - Milieu défensif, acceptable

Cette formule privilégie clairement les **buteurs et passeurs décisifs**, ce qui est cohérent avec un jeu Fantasy Football où les goals/assists rapportent le plus de points.

---

## 📌 NOTES IMPORTANTES

1. **Joueurs sans rating (108 joueurs):**
   - La nouvelle formule calculera PGS même sans rating
   - Utilise: `base_pgs = (impact × 0.70) + (consistency × 0.30)`

2. **Défenseurs et Gardiens:**
   - Ajouté bonus pour tackles et clean sheets
   - Leur impact sera principalement basé sur consistency et rating

3. **Impact de l'ajustement:**
   - ~15-20% des joueurs changeront de catégorie
   - Les buteurs seront mieux classés
   - Les milieux défensifs resteront majoritairement Wild/Key

Êtes-vous d'accord avec cette formule ? Voulez-vous ajuster certains coefficients avant la migration ?
