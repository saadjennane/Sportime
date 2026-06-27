# Quick Game Builder — Spec

**But :** créer un game (Football) en < 20 s via un wizard 3 étapes à defaults agressifs.
**Scope :** games curatés — **Pick'em**, **Swipe**, **Fantasy**, **Tournament Quest**.
(Les *live games* qui s'accrochent à tous les matchs de la base sont hors scope.)

---

## 1. Principe

Un game n'est pas un formulaire à remplir, c'est **un format tamponné sur un contenu qui existe déjà** (fixtures + cotes synchronisées, effectifs, standings warehouse). Sur ~14 paramètres, **1 seul est irréductible** (le scope) ; les autres sont pré-remplis par un moteur de defaults et seulement confirmés.

Parcours : `New Game → choix du type → wizard 3 étapes → Save Draft / Publish now`.

---

## 2. Launcher « New Game »

- Bouton primaire en haut du hub admin (`apps/admin/src/components/GameBuilder.tsx`).
- Ouvre un sélecteur de type, groupé par scope :
  - **Sur une journée** : Pick'em · Swipe · Fantasy (scope = round/fixtures)
  - **Sur un tournoi** : Tournament Quest (scope = compétition + saison)
- Toggle sport **Football / F1** (F1 = extension future, même pattern).
- Tap une carte → lance le wizard adapté, pré-rempli des defaults de ce format.

---

## 3. Le wizard 3 étapes (modèle commun)

### Étape 1 — Quoi ? (le scope, seule décision obligatoire)
- **Pick'em / Swipe / Fantasy** : Ligue → toggle **Matchdays / Calendar** → rounds/journées sélectionnables (multi), matchs **tous pré-cochés** (décocher possible).
- **Tournament Quest** : Compétition (à groupes uniquement) → Saison → `qualified_per_group` → **preview auto** de la structure (groupes/bracket/matchs). Pas de `fixture_ids`.
- **Nom auto-généré, éditable.**

### Étape 2 — Réglages (tout pré-rempli)
- `tier` (chips, défaut **amateur**) · `duration_type` (auto-déduit du scope) · `entry_cost` (auto `tier × durée`, override).
- **🎁 Reward pack** (`reward_pack_id`) — dropdown, défaut auto-matché au tier, aperçu de la distribution.
- **TQ uniquement** : `opens_at` (à la publication / planifié) + **barème éditable** (replié, défaut `TQ_DEFAULT_CONFIG`).
- **Conditions d'accès** (avancé, replié) : `minimum_level` · `required_badges` · `requires_subscription` · `min/max_players`.
- ⚠️ **Pas de toggle visibilité ici** — `is_visible` est dérivé du statut de publication (étape 3).

### Étape 3 — Publier
- Recap card (nom, contenu, coût, reward pack, structure pour TQ).
- **Pick'em / Swipe** : case « Créer aussi la version jumelle » (cross-create symétrique).
- **2 boutons** :
  - **Publish now** → `status = upcoming` (TQ: `open`) + `is_visible = true`
  - **Save Draft** → `status = draft` + `is_visible = false`

---

## 4. Décisions verrouillées

| Décision | Choix |
|---|---|
| Publication | 2 boutons explicites (Publish now / Save Draft) |
| Visibilité | dérivée du statut (pas de toggle séparé) |
| Tier défaut | **amateur** (coût auto par matrice) |
| Sélection matchs | **tous pré-cochés**, décochables |
| Pick'em ↔ Swipe | **2 games séparés** (`betting` / `prediction`), cross-create par case à cocher — pas de fusion de schéma |
| Reward pack | en étape 2, défaut auto-matché au tier, pour les 4 formats |
| Barème éditable par game | **TQ oui** (replié) · Fantasy non (config globale) · Pick'em/Swipe N/A (basé cotes) |
| Pool Fantasy | auto-dérivé de l'effectif du round, pas de validation |

---

## 5. Defaults par format

Commun (tronc) : `tier=amateur`, `duration_type` auto, `entry_cost` auto, `minimum_level=Rookie`,
`required_badges=[]`, `requires_subscription=false`, `min/max_players` defaults, `is_visible` dérivé, reward pack auto-tier.

| Champ | Pick'em | Swipe | Fantasy | Tournament Quest |
|---|---|---|---|---|
| Scope input | ligue + round(s) | ligue + round(s) | ligue + round(s) | compétition + saison |
| `game_type` | `betting` | `prediction` | — | — |
| `mode` | Matchdays/Calendar | idem | idem | N/A |
| `fixture_ids` | cochés | cochés | cochés | ❌ auto-seedé |
| Nom auto | `PL — MD24` | `PL — MD24 (Swipe)` | `PL — MD24 (Fantasy)` | `Champions League 2024-25` |
| `duration_type` défaut | déduit (1 round→flash) | idem | idem | `season` |
| Barème | cotes ×100 | cotes ×100 | `fantasy_configs` global | `config_json` (éditable) |
| Cross-create | ☐ Swipe | ☐ Pick'em | — | — |
| Spécifiques | — | — | pool auto | `opens_at`, `qualified_per_group` |

**Matrice de coût** (`entry_cost = TIER_BASE × DUR_MULT`) :
| | flash ×1 | series ×2 | season ×4 |
|---|---|---|---|
| amateur 2 000 | 2 000 | 4 000 | 8 000 |
| master 10 000 | 10 000 | 20 000 | 40 000 |
| apex 20 000 | 20 000 | 40 000 | 80 000 |

---

## 6. Modèle de données (proposition)

Type discriminé par format, alimenté par le wizard :

```ts
type GameFormat = 'pickem' | 'swipe' | 'fantasy' | 'tournament-quest';

interface GameDraftBase {
  format: GameFormat;
  name: string;                 // auto, éditable
  tier: 'amateur' | 'master' | 'apex';        // défaut amateur
  durationType: 'flash' | 'series' | 'season'; // déduit du scope
  entryCost: number;            // auto = TIER_BASE × DUR_MULT (override)
  rewardPackId: string | null;  // défaut auto-matché au tier
  minimumLevel: string;         // 'Rookie'
  requiredBadges: string[];     // []
  requiresSubscription: boolean; // false
  minPlayers: number;
  maxPlayers: number;
  rulesHtml: string | null;
  publish: 'now' | 'draft';     // → (status, is_visible)
}

// Scope par round (Pick'em / Swipe / Fantasy)
interface RoundScope {
  leagueIds: string[];
  mode: 'matchdays' | 'calendar';
  fixtureIds: string[];         // rounds/journées cochés → matchs
}

type PickemDraft  = GameDraftBase & RoundScope & { format: 'pickem'; gameType: 'betting'; alsoCreateSwipe?: boolean };
type SwipeDraft   = GameDraftBase & RoundScope & { format: 'swipe'; gameType: 'prediction'; alsoCreatePickem?: boolean };
type FantasyDraft = GameDraftBase & RoundScope & { format: 'fantasy' };

// Scope par tournoi (Tournament Quest)
type TQDraft = GameDraftBase & {
  format: 'tournament-quest';
  leagueApiId: number;
  season: number;
  qualifiedPerGroup: number;    // défaut 2
  opensAt: string | null;       // null = à la publication
  configJson: Record<string, unknown>; // défaut TQ_DEFAULT_CONFIG, éditable
};

type GameDraft = PickemDraft | SwipeDraft | FantasyDraft | TQDraft;
```

---

## 7. Mapping vers l'existant (réutilisation)

| Format | Fonction de création | Notes |
|---|---|---|
| Pick'em | `supabase/functions/create-matchday-challenge` | `game_type='betting'` |
| Swipe | `create-matchday-challenge` | `game_type='prediction'` ; si `alsoCreate*` → 2e appel |
| Fantasy | `supabase/functions/create-fantasy-game` | pool auto |
| Tournament Quest | `supabase/functions/tq-create-from-league` | groupes/bracket auto-seedés, `config_json` |

`status` / `is_visible` calculés depuis `publish` : `now → (upcoming|open, true)` · `draft → (draft, false)`.

---

## 8. Garde-fous

- **Cotes manquantes** (fixtures futures sans 1X2) → badge ⚠️ mais création autorisée.
- **TQ sans phase de groupes** pour la saison → compétition non listée / message explicite.
- **Reward pack absent** → fallback « à définir » + le game reste publiable (prix à compléter).

---

## 9. Phasage

1. ✅ **Phase 1** — Launcher + wizard **Pick'em** (+ Swipe via cross-create) ; moteur de defaults + matrice de coût. *(done)*
2. ✅ **Phase 2** — **Fantasy** football (même wizard, pool auto). *(done)*
3. ✅ **Phase 3** — **Tournament Quest** (scope compétition + saison, structure auto, barème par défaut). *(done)*
4. ✅ **F1** — toggle F1 du launcher : GP Predictor, Teammates Duels, Fantasy F1, Season Forecast. *(done)*
5. ⏳ **Phase 4** — **Presets** sauvegardés (création récurrente en <10 s) + barème TQ éditable in-wizard.

### État au build courant
Tous les formats sont créables via **+ New Game** (admin) :
Football → Pick'em · Swipe · Fantasy · Tournament Quest ; F1 → GP Predictor · Teammates Duels · Fantasy F1 · Season Forecast.
