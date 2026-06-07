# Live Game A — Score Prediction (logique)

Jeu temps réel sur **un match** (bouton **Play** d'une carte match). Tu pronostiques le **score final** + réponds à **3 questions bonus**. Réglé automatiquement à la fin du match depuis `fb_fixtures` (+ `fb_fixture_stats` pour les bonus).

## Barème — total **200 pts**

| Composante | Points |
|---|---|
| **Écart de buts** (\|écart prédit − écart réel\|) | 0 → **90** · 1 → 72 · 2 → 54 · 3 → 36 · 4 → 18 · 5+ → **0** |
| **Résultat juste (1N2)** | **70** |
| **Questions bonus** (3 × selon situation) | **40** (20 + 10 + 10) |

- **Malus mi‑temps −40 %** : si le joueur édite son score pendant le match (`midtime_edit`), le **−40 %** s'applique sur **(résultat + écart)** uniquement — les bonus restent figés.
- **Classement** : `total_points` décroissant, départage par `goal_diff_error` croissant.

## Questions bonus — **par situation** (orthogonales au score)

Les questions portent sur des **stats du match** (indépendantes du score exact). Les 3 questions sont **tirées au hasard dans le sous‑pool de la situation** du pronostic (20/10/10). Différents joueurs peuvent avoir des questions différentes (selon leur pronostic), résolues sur le **même match**.

### Détection de la situation (depuis le score pronostiqué)
| Situation | Condition |
|---|---|
| **Nul vierge** (`goalless`) | total = 0 (0‑0) |
| **Clean sheet** (`clean_sheet`) | un seul côté = 0 (X‑0 / 0‑X) |
| **Les 2 marquent** (`both_score`) | les deux > 0 (X‑Y) |

### Sous‑pools

**🟦 Nul vierge (0‑0)** — *aucune question liée aux buts*
- Quelle équipe a le plus de **possession** ? *(Dom/Ext)*
- Les **2 équipes** prennent un carton ? *(O/N)*
- **4 cartons** ou plus ? *(O/N)*
- Quelle équipe reçoit le **plus de cartons** ? *(Dom/Ext)*
- Un **carton rouge** ? *(O/N)*
- Plus de **9 corners** ? *(O/N)*
- Quelle équipe a le plus de **corners** ? *(Dom/Ext)*

**🟨 Clean sheet (X‑0 / 0‑X)** — *pas de « qui marque en premier » (forcé)*
- *(les 7 ci‑dessus)* +
- **1er but** en **1ʳᵉ mi‑temps** ? *(O/N)*

**🟩 Les 2 marquent (X‑Y)** — *tout est valide*
- *(les 8 ci‑dessus)* +
- Quelle équipe **marque en premier** ? *(Dom/Ext)*

### Résolution des bonus (depuis `fb_fixture_stats`)
| Clé | Réponse correcte |
|---|---|
| `possession_most` | équipe avec le + de possession (`home`/`away`/`none`) |
| `both_carded` | `yes` si chaque équipe a ≥ 1 carton |
| `cards_4plus` | `yes` si total cartons (J+R) ≥ 4 |
| `cards_most` | équipe avec le + de cartons |
| `red_card` | `yes` si ≥ 1 rouge |
| `first_scorer` | équipe du 1er but (`home`/`away`/`none`) |
| `first_goal_1h` | `yes` si 1er but en 1ʳᵉ MT |
| `corners_9plus` | `yes` si total corners ≥ 10 |
| `corners_most` | équipe avec le + de corners |

## Données

- **Score / résultat** : `fb_fixtures` (goals_home/away, status).
- **Stats bonus** : `fb_fixture_stats` (possession, cartons J/R par équipe, corners par équipe, équipe + mi‑temps du 1er but) — capturées de l'API (`/fixtures/statistics` + `/fixtures/events`) par la sync.

## Modes & multijoueur
- **Free** (coins virtuels) · **Staked** (mise réelle). Récompenses configurées **dans l'admin** (tables `live_game_free_rewards` / `live_game_reward_tiers`).
- Les joueurs qui font **Play sur le même match** rejoignent la **même partie** et se concurrencent sur son leaderboard.

## Implémentation (serveur)
- `live_situation(h,a)` · `live_bonus_subpool(situation)` · `resolve_live_bonus(key, stats)`
- `join_live_game` (déduction coins serveur) · `submit_live_prediction` (lock kickoff + valide les 3 questions de la situation) · `edit_live_prediction` (mi‑temps, malus)
- `settle_live_game_score` (réglé via `fb_fixtures` + `fb_fixture_stats`) → branché dans `sync-live-scores` + cron.
- `get_live_game_state` (lecture unique : game + fixture + logos + entries).
