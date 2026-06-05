# Sportime — Code Pointers (Cartographie)

Dernière MAJ: 2025-02-03

> Ce fichier liste **où** brancher les features et **quels fichiers** toucher.  
> L’IA doit lire ce document avant toute proposition de modifications.

---

## Pages & Conteneurs

### 1) `src/pages/MatchesPage.tsx`
- **Rôle** : conteneur des onglets (Upcoming / Played), gestion ordre des ligues (hook `useLeagueOrder`), modales (ordre, stats).
- **Attentes actuelles** : reçoit `matches` déjà groupés par statut (`'upcoming' | 'played'`) + `bets`.
- **Cible** : remplacer/compléter la source des données par le hook `useMatchesOfTheDay` (à créer, voir plus bas).  
  - Garde la compatibilité des props pour `Upcoming.tsx`.

### 2) `src/pages/Upcoming.tsx` (ou `src/pages/UpcomingPage.tsx`)
- **Rôle** : rend les groupes de matchs par ligue.
- **Props attendues** : `groupedMatches: Record<string, Match[]>`, `orderedLeagues`, `bets`, callbacks.
- **Note** : on peut fournir un adaptateur pour garder le type `Match` si nécessaire.

---

## Composants

### 3) `src/components/matches/LeagueMatchGroup.tsx`
- **Rôle** : section/accordéon par ligue.
- **Props** : `leagueName: string`, `leagueLogo: string | null`, `matchesCount: number`, `children` (liste de `MatchCard`), `initialOpen?`.
- **À savoir** : n’affiche pas de “code rencontre” explicitement, mais `MatchCard` utilise `match.id`.

### 4) `src/components/matches/MatchCard.tsx`
- **Rôle** : carte match.
- **Props** : `match` (type global UI) et handlers (`onBet`, `onViewStats`, etc.).
- **Champs utilisés** :
  - `match.id` → **code fixture** (utiliser `String(fixture.id)` côté mapping).
  - `match.kickoffTime` → label local (ex. `"20:00"`).
  - `match.leagueLogo` → logo de ligue.
  - `match.teamA.name` / `match.teamB.name`
  - `match.teamA.emoji` / `match.teamB.emoji` (peuvent être mappés à partir de `logo` / fallback).
  - `match.status` → `'upcoming' | 'played'` (+ statut brut si besoin).
  - `match.odds` → `{ home, draw, away, bookmaker }`.

### 5) Bet Modal (nom exact à confirmer)
- Rechercher dans `src/components/` un composant type `BetModal.tsx` / `PlaceBetModal.tsx` / `MatchBetModal.tsx`.
- **Objectif** :  
  - **Afficher logos** home/away à l’intérieur du modal.  
  - **Charger la forme par équipe** (`/teams/statistics`) et le **head-to-head** (`/fixtures/headtohead`).  
  - **Afficher le lineup** si disponible (`/fixtures/lineups`).  
- **Intégration** : via un **hook on-demand** (voir `useMatchExtras.ts` ci-dessous).

---

## Services & Hooks

### 6) `src/services/supabase.ts`
- **Rôle** : client Supabase.
- **Note** : utilisé partout (PostgREST et functions).

### 7) `src/lib/apiFootballService.ts`
- **Rôle** : enveloppe unique pour appeler l’Edge Function `api-football-proxy`.
- **Règle** : chemins **doivent commencer par `/`** (ex. `'/odds'` et pas `'odds'`).
- **Debug recommandé** :  
  ```ts
  console.log('🚀 apiFootball called with:', { path, params })
  console.log('📦 Edge Function response:', { data, error })
  ```

### 8) `src/features/matches/useMatchesOfTheDay.ts` (À CRÉER)
- **Rôle** : récupérer les fixtures du jour (avec relations) depuis Supabase (PostgREST, pas API-Football direct).
- **Sélection recommandée** :
  ```
  fixtures: id, date, status, goals_home, goals_away,
  league: leagues ( id, name, logo, api_league_id ),
  home: teams!fixtures_home_team_id_fkey ( id, name, logo ),
  away: teams!fixtures_away_team_id_fkey ( id, name, logo ),
  odds: odds!odds_fixture_id_fkey ( home_win, draw, away_win, bookmaker_name )
  ```
- **Filtre temps** : [startOfDayISO, endOfDayISO) en heure locale utilisateur (convertir correctement).
- **Mapping → UI** :
  - `id = String(fixture.id)` (sera le code pour MatchCard).
  - `kickoffISO = fixture.date`
  - `kickoffLabel = formatLocalTime(fixture.date)`
  - `status = normalizeStatus(fixture.status)` → `'upcoming' | 'played'` + statut brut si utile.
  - `home/away` → `{ id, name, logo, goals? }`
  - `league.logo` fallback: `https://media.api-sports.io/football/leagues/${league.api_league_id}.png` si null.
  - `odds` depuis fixtures.odds si présent (sinon à compléter via `/odds` puis upsert).
- **Sortie** : `{ data: UiLeagueGroup[], isLoading, error, refresh }`.

### 9) `src/features/matches/useMatchExtras.ts` (À CRÉER)
- **Rôle** : fournir à la demande (quand modal ouvert) :
  - Forme par équipe : `/teams/statistics` (params: `team`, `league`, `season`)
  - Head-to-Head : `/fixtures/headtohead` (params: `h2h = ${homeId}-${awayId}`)
  - Lineups : `/fixtures/lineups` (params: `fixture`)
- **Transport** : via `apiFootballService` → `supabase.functions.invoke('api-football-proxy', ...)`.
- **Usage** : le Bet Modal appelle ce hook en lui donnant `fixtureId`, `homeId`, `awayId`, `leagueApiId`, `season`.

---

## Types & Contrats

### 10) Types UI (adapter au projet)

**UiMatch minimal attendu par MatchCard :**
```ts
type UiMatch = {
  id: string; // fixture.id as string (code)
  kickoffISO: string;
  kickoffLabel: string;
  status: 'upcoming' | 'played' | string;
  league: { id: string; name: string; logo?: string | null; apiId?: number | null };
  home: { id: string; name: string; logo?: string | null; goals?: number | null };
  away: { id: string; name: string; logo?: string | null; goals?: number | null };
  odds?: { home?: number; draw?: number; away?: number; bookmaker?: string };
}
```

**UiLeagueGroup :**
```ts
type UiLeagueGroup = {
  leagueId: string;
  leagueName: string;
  leagueLogo: string | null;
  matches: UiMatch[];
}
```

---

## Points d’attention
- Jamais appeler API-Football directement côté frontend. Toujours passer par l’Edge Function.
- Heure locale : calculer début/fin de journée dans le timezone user, puis convertir en ISO.
- Season/League mapping : `leagues.id` (UUID interne) vs `api_league_id` (entier API-Football).
- Odds 1X2 : table `odds` → source préférée pour UI; si manquantes, fetch via `/odds` puis upsert.
- Robustesse : gérer no matches, loading, error.
- Compat : si le type `Match` actuel est très couplé, introduire un mapper `UiMatch` → `Match` pour ne pas casser l’existant.

---

## TODO Check rapide
- [ ] Créer `src/features/matches/useMatchesOfTheDay.ts`.
- [ ] Créer `src/features/matches/useMatchExtras.ts`.
- [ ] Intégrer `useMatchesOfTheDay` dans `MatchesPage.tsx`.
- [ ] Mapper `UiMatch` → `Match` si nécessaire pour `MatchCard`.
- [ ] Bet Modal : logos + forme + H2H + lineups (via `useMatchExtras`).
- [ ] Vérifier que les paths de `apiFootballService` commencent par `/`.
- [ ] Tests manuels sur une journée avec fixtures UCL/League.
