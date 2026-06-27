# Squad Feed — Phase 1 Spec

**Décision (Head of Product) :** garder le **système de posts**, pas de chat autonome.
Faire évoluer `squad_feed` en **fil d'activité événementiel** avec **réactions multi-emoji**,
**commentaires légers**, et davantage de **moments auto-générés**. Le chat (live thread
éphémère) est repoussé en Phase 2, déclenché par la data.

> Terminologie : « squad » (UI) = `squad_*` (DB). Le type legacy `LeagueFeedPost` reflète
> `squad_feed`.

---

## 0. Existant (point de départ)

- **`squad_feed`** : `id, squad_id, user_id, post_type, content, related_game_id, created_at`.
  `post_type` actuel : `celebration`, `announcement`, `game_linked`.
- **`squad_feed_likes`** : `post_id, user_id` (un seul like binaire).
- **`squad_leaderboard_snapshots`** : podium figé d'un game.
- Services : `getSquadFeed`, `createCelebrationPost`, `toggleLike`.
- UI : `LeagueFeed`, `LeagueFeedPostCard` (affiche `content`, `top_players`, `likes.length`).
- **Manque** : réactions variées, commentaires, et des moments auto au-delà de la célébration.

---

## 1. Réactions multi-emoji

Remplacer le like binaire par un set restreint de réactions (garde `toggleLike` en alias 👍).

**DB** — étendre `squad_feed_likes` (ou table dédiée `squad_feed_reactions`) :
```sql
alter table squad_feed_likes add column if not exists reaction text not null default '👍';
-- contrainte set fermé :
alter table squad_feed_likes add constraint reaction_set
  check (reaction in ('👍','🔥','😂','😮','💪','😭'));
-- unicité par (post, user) : une réaction par user et par post (on remplace).
```
**Service** : `setReaction(postId, userId, emoji | null)` → upsert/delete. `getSquadFeed`
agrège `reactions` en `{emoji: count}` + `my_reaction`.
**UX** : barre de 6 emojis ; tap = pose/retire ; compteurs par emoji ; long-press du like
existant = picker.

---

## 2. Commentaires

**DB** — nouvelle table :
```sql
create table squad_feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references squad_feed(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index on squad_feed_comments (post_id, created_at);
-- RLS : lecture/écriture réservées aux membres de la squad du post.
```
**Service** : `addComment(postId, body)`, `listComments(postId)`, `deleteComment(id)`
(auteur ou admin squad). `getSquadFeed` renvoie `comment_count` par post.
**UX** : sous la carte, `N comments` (repliés) → expand → thread + composer inline.
Pas de threads imbriqués (flat), pas d'édition en Phase 1.

---

## 3. Catalogue des moments auto-générés

Le cœur de la valeur : **remplir le feed sans effort** pour qu'il ne soit jamais mort.
Générés **server-side** (trigger/cron après settlement), insérés dans `squad_feed` avec un
nouveau `post_type` et un `metadata` jsonb. `user_id` = système (ou l'auteur concerné).

| post_type | Déclencheur | Copie (template) | Source |
|---|---|---|---|
| `game_settled` | un game lié à la squad se règle | « 🏁 {game} terminé — {winner} prend la 1ʳᵉ place 🥇 » | settlement + snapshot |
| `rank_change` | dépassement au classement squad post-settlement | « ↗️ {a} double {b} et grimpe à la {n}ᵉ » | diff de classement |
| `near_miss` | perdu un game à ≤1 pt / 1 rang | « 😭 {user} rate le podium pour 1 point » | snapshot |
| `bold_pick_hit` | pick contrarian (cote/odds élevée) gagnant | « 🔮 {user} avait osé {pick} (cote {x}) — ça passe ! » | picks vs résultat |
| `member_joined` | nouveau membre | « 👋 {user} rejoint la squad » | squad_members insert |
| `streak` | série de victoires/podiums consécutifs | « 🔥 {user} enchaîne {k} podiums d'affilée » | historique snapshots |

**Règles anti-bruit** :
- max **1 post auto / game / squad** pour `game_settled` (le podium agrège tout).
- `rank_change` : seulement les **dépassements du top 3** (pas tout le classement).
- dédup : ne pas reposter le même moment (clé `metadata.dedup_key`).
- les moments auto sont **likables/commentables** comme les autres → c'est là que naît le banter.

**Implémentation** : une fonction `squad_emit_moments(p_game_id)` appelée par le settlement
existant (et un cron de rattrapage). Réutilise les snapshots déjà produits.

---

## 4. Anatomie de la carte (UX)

```
┌─────────────────────────────────────────────┐
│ 🏁  Game settled · 2h            ⋯           │  ← type chip + temps + menu
│ Premier League MD24 terminé —                │
│ Saad prend la 1ʳᵉ place 🥇                    │  ← content
│ ┌── podium mini (top 3) ──┐ (si snapshot)    │
│ 🥇 Saad 142  🥈 Leo 138  🥉 Sam 131           │
│ ───────────────────────────────────────────  │
│ 🔥 4  😂 2  💪 1            💬 5 comments      │  ← réactions + compteur commentaires
└─────────────────────────────────────────────┘
   (expand) → thread plat + composer
```
- **Empty state** : si 0 post, afficher un placeholder « les moments de ta squad
  apparaîtront ici » — mais en pratique les moments auto le remplissent au 1er game.

---

## 5. Notifications (discipline anti-spam)

Tout passe par l'orchestrateur `notify` (caps / quiet-hours / dedup déjà en place).

| Évènement | Cible | Cadence |
|---|---|---|
| `squad_moment` (game_settled, rank_change…) | membres de la squad | **capé** (1 push / squad / fenêtre), in-app sinon |
| `squad_comment` sur un post où tu es impliqué | auteur + commentateurs du thread | **digest** (regroupé), jamais 1 push par commentaire |
| `squad_reaction` | auteur du post | **in-app only** (jamais de push) |

Nouvelles clés notif : `squad_moment`, `squad_comment_digest`. Respecte le holdout/lift déjà
instrumenté.

---

## 6. Phasage interne

- **1a — Engagement** *(plus haut levier, plus bas risque)* : réactions multi-emoji +
  commentaires (DB + services + carte). Marche sur les posts existants.
- **1b — Moments auto** : `squad_emit_moments` branché au settlement + `game_settled`,
  `rank_change`, `member_joined`. (les 3 plus simples/à fort signal).
- **1c — Notifs** : `squad_moment` capé + `squad_comment_digest`.
- **1d — Moments avancés** : `near_miss`, `bold_pick_hit`, `streak` (demandent picks/odds).

---

## 7. À instrumenter (pour décider la Phase 2 = live thread)

- posts/squad/semaine · % auto vs manuel · réactions/post · commentaires/post · % posts
  avec ≥1 commentaire.
- **Fenêtres live** : taux de commentaires pendant un match en cours vs hors-match.
  → si forte concentration pendant le live, **alors** ouvrir le « Live thread » éphémère (Phase 2).
- Feedback qualitatif « où je parle à ma squad ? ».

---

## 8. Hors-scope Phase 1 (assumé)
Chat permanent · threads imbriqués · édition de commentaires · GIFs/images · mentions @ ·
présence/typing. Tout ça attend un signal de demande réel.
