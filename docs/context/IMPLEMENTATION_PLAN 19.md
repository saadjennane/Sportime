# Sportime — Implementation Plan (Matches of the Day + Odds + Modal Extras)

Dernière MAJ: 2025-02-03

> Ce plan est séquentiel. L’IA DOIT s’y conformer dans l’ordre, et consulter aussi `CODE_POINTERS.md` avant d’écrire du code.

---

## 0) Pré-vol (sanity checks)

- Vérifier que les imports d’alias `@/...` sont résolus (voir `tsconfig.json` et `vite.config.ts`).
- Vérifier que `src/lib/apiFootballService.ts` appelle bien l’Edge Function **avec des paths commençant par `/`** (ex: `/fixtures`, `/odds`).
- Vérifier la présence des tables Supabase: `fixtures`, `leagues`, `teams`, `odds` avec FK mentionnées dans `CODE_POINTERS.md`.
- Confirmer que la timezone locale est gérée côté client (on calcule [startOfDay, endOfDay) en local puis converti en ISO).

---

## 1) Créer le hook `useMatchesOfTheDay`

**Fichier**: `src/features/matches/useMatchesOfTheDay.ts` (nouveau)

- Objectif: retourner les **matchs du jour** depuis Supabase PostgREST (pas d’appel direct API-Football).
- Sélection (relations):
  - `fixtures ( id, date, status, goals_home, goals_away )`
  - `league: leagues ( id, name, logo, api_league_id )`
  - `home: teams!fixtures_home_team_id_fkey ( id, name, logo )`
  - `away: teams!fixtures_away_team_id_fkey ( id, name, logo )`
  - `odds: odds!odds_fixture_id_fkey ( home_win, draw, away_win, bookmaker_name )`
- Filtre temps: `.gte('date', startOfDayISO).lt('date', endOfDayISO)`, tri par `date` asc.
- Mapping:
  - `UiMatch`:
    - `id = String(fixture.id)`
    - `kickoffISO = fixture.date`
    - `kickoffLabel = formatLocalTime(fixture.date)` (HH:mm)
    - `status = normalizeStatus(fixture.status)` → `'upcoming' | 'played' | brut`
    - `home/away` = `{ id, name, logo, goals? }`
    - `league` = `{ id, name, logo (fallback si null), apiId }`
    - `odds?` = `{ home, draw, away, bookmaker }` si présent
  - Group by league → `UiLeagueGroup[]`
- Sortie: `{ data, isLoading, error, refresh }`

**Notes**:
- Fallback `league.logo` si null: `https://media.api-sports.io/football/leagues/${league.api_league_id}.png`
- Fournir helpers: `formatLocalTime(dateISO)`, `normalizeStatus(s)`.

**Critères d’acceptation**:
- Build passe.
- Le hook renvoie des groupes **non vides** quand il y a des fixtures aujourd’hui.
- Les heures affichées sont locales (ex: Africa/Casablanca).

---

## 2) Intégrer le hook dans `MatchesPage.tsx`

**Fichier**: `src/pages/MatchesPage.tsx` (existant)

- Remplacer (ou compléter) la source de données `matches/bets` par `useMatchesOfTheDay`.
- Conserver la compat `Upcoming.tsx` en mappant si nécessaire `UiMatch → Match` (ou ajuster props).
- États:
  - `loading` → squelette ou spinner déjà présent
  - `error` → toast si dispo / fallback message
  - `empty` → message “No matches scheduled for today” si `data.length === 0`

**Critères d’acceptation**:
- Les ligues s’affichent en sections accordéon (via `LeagueMatchGroup`).
- Les `MatchCard` affichent heure locale, noms d’équipes, logo de ligue et (si existants) odds 1X2.

---

## 3) Upsert d’odds 1X2 (fallback si `odds` manquants)

**But**: si `odds` pour certaines fixtures sont absents en DB, fetch via Edge Function `/odds` puis **upsert** dans `odds`.

- Créer util dans `src/features/matches/oddsUtils.ts`:
  - `fetchAndUpsertOddsForFixtures(fixtureIds: number[], leagueApiId?: number, season?: number)`
  - Appels API-Football via `apiFootball('/odds', { fixture })` (un par fixture).
  - Extraire bookmaker prioritaire selon stratégie (cf. `BOOKMAKER_PREFERENCE`).
  - Trouver bet **Match Winner (id=1 ou name='Match Winner')**.
  - Upsert `odds` (home_win, draw, away_win, bookmaker_name) par `fixture_id`.
- Déclenchement:
  - Dans `useMatchesOfTheDay`, après premier fetch DB, si certains fixtures n’ont pas d’odds → appeler util puis recharger DB (via `refresh()`).

**Critères d’acceptation**:
- À l’ouverture de la page, si `odds` absents, ils apparaissent après quelques secondes (une fois upsert).
- Aucun appel direct à API-Football côté frontend (toujours via Edge Function).

---

## 4) Hook on-demand pour Bet Modal (forme, H2H, lineups)

**Fichier**: `src/features/matches/useMatchExtras.ts` (nouveau)

- Entrées:
  - `fixtureId: number`, `homeId: number`, `awayId: number`, `leagueApiId: number`, `season: number`
- Expose: `{ load, isLoading, error, data }`
- `load()`:
  - **Forme** (par équipe): `apiFootball('/teams/statistics', { team: homeId, league: leagueApiId, season })` et idem pour `away`
  - **H2H**: `apiFootball('/fixtures/headtohead', { h2h: `${homeId}-${awayId}` })`
  - **Lineups**: `apiFootball('/fixtures/lineups', { fixture: fixtureId })`
- Pas d’upsert DB obligatoire pour ces extras (lecture côté UI OK).
- Nettoyage/normalisation pour UI (ex: derniers 5 matchs, moyenne buts, H2H last N, lineups XI + formation).

**Critères d’acceptation**:
- À l’ouverture du modal bet, les logos home/away sont visibles.
- Un bouton/onglet “Stats” affiche la forme et H2H.
- Si lineups disponibles, afficher XI + formation (sinon message “Not available”).

---

## 5) Bet Modal — intégrer logos + extras

**Fichier**: `src/components/.../BetModal*.tsx` (nom exact à confirmer)

- **Logos**:
  - Utiliser `match.home.logo` et `match.away.logo` (déjà mappés via hook).
  - Fallback placeholder si null.
- **Extras**:
  - Importer `useMatchExtras`.
  - Au mount/ou à l’ouverture modal, appeler `load()` avec `fixtureId`, `homeId`, `awayId`, `leagueApiId`, `season`.
  - Afficher indicateurs de chargement et sections (Forme / H2H / Lineups).
- **Odds 1X2**:
  - Lire `match.odds` si présent; sinon, on se repose sur la mécanique d’upsert du §3 (déjà fait par `MatchesOfTheDay` côté page).

**Critères d’acceptation**:
- Modal montre logos d’équipes.
- Tab/section Stats affiche forme/H2H/lineups quand dispo.
- Pas d’erreur CORS ni appel direct à API-Football.

---

## 6) Qualité & Résilience

- **Loading**: spinner/skeleton sur page + modal.
- **Error**: toasts si dispo, minimal fallback visible.
- **Empty**: “No matches scheduled for today.”
- **Timezones**: test manuel Africa/Casablanca (UTC+1, no DST actuellement).
- **Performance**: paginer odds fetch si > N fixtures (limiter à fixtures du jour seulement).

---

## 7) Recette / Scénarios de test

1. **UCL jour de match**:
   - La ligue apparait; fixtures du jour s’affichent.
   - Heures locales correctes.
   - Odds apparaissent (immédiates si en DB, sinon quelques secondes après upsert).
2. **Modal Bet**:
   - Logos home/away OK.
   - Stats: forme (5 derniers), H2H (derniers face-à-face).
   - Lineups: si disponible.
3. **Journée sans match**:
   - Message “No matches scheduled for today.”
4. **Build**:
   - `npm run build` OK, pas d’erreurs TS.
5. **Aucune fuite directe**:
   - Pas d’appels API-Football directs côté UI (tout via Edge Function).

---

## 8) Livraison incrémentale (commits)

- `feat(matches): add useMatchesOfTheDay hook (fixtures + odds relations)`
- `feat(matches): integrate hook into MatchesPage (grouping by league)`
- `feat(odds): upsert 1X2 odds via edge function fallback`
- `feat(modal): add useMatchExtras (team form, h2h, lineups)`
- `feat(modal): show team logos & stats in BetModal`
- `chore: add docs/context files`

---

## 9) Post-livraison

- Vérifier que les crons/edge jobs alimentent `fixtures/odds` régulièrement (si prévu).
- Ajouter un bouton “Refresh” sur MatchesPage utilisant `refresh()` du hook.
