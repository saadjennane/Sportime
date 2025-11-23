# Sportime – Context Overview

Dernière MAJ: 2025-02-03

## But de ce dossier
Ce dossier `docs/context/` sert de **mémoire persistante** pour l’IA (Codex/Claude Code) entre les sessions.  
Avant toute modification de code, **l’IA doit lire ces fichiers** pour recharger le contexte.

## Produit (focus actuel)
- **Matches of the Day**: afficher les matchs du jour (heure locale, statut, équipes, logos, score si joué).
- **Bet Modal (sans UI à modifier)**: y injecter logos, forme par équipe, head-to-head, lineups (si dispo).
- **1X2 Odds**: pré-match odds (home/draw/away) pour les fixtures du jour.

## Stack & déploiement
- Frontend: React + Vite (TypeScript)
- Backend: Supabase (PostgREST + RLS), Edge Functions (Deno)
- Proxy API-Football: **Edge Function** `api-football-proxy`
- Hébergement: Vercel (branche stable = `Sportime-stable-oct17` ou branches de travail)

## Règle d’or (API-Football)
> **Jamais** d’appel direct vers API-Football côté frontend.  
> Toujours passer par:  
> `supabase.functions.invoke('api-football-proxy', { body: { path: '/<endpoint>', params } })`

Exemples d’endpoints (via *api-football-proxy*):
- `/fixtures` (listes de matchs)
- `/odds` (1X2)
- `/teams/statistics` (forme)
- `/fixtures/headtohead`
- `/fixtures/lineups`

## Schéma (résumé utile)
Tables utilisées côté app:
- `leagues(id uuid, name text, logo text, type text, season int, api_league_id int unique, invite_code text not null, …)`
- `teams(id int, name text, logo text, …)`
- `fixtures(id int, date timestamptz, status text, league_id uuid, home_team_id int, away_team_id int, goals_home int, goals_away int, …)`
- `odds(fixture_id int, home_win numeric, draw numeric, away_win numeric, bookmaker_name text, …)`

> Note: Les IDs `fixtures`, `teams`, `api_league_id` viennent d’API-Football (entiers).  
> `leagues.id` est un **UUID interne**. On mappe via `api_league_id`.

## Fichiers clés (pointers)
- Pages:
  - `src/pages/MatchesPage.tsx` (conteneur onglets Upcoming/Played)
  - `src/pages/Upcoming.tsx` (liste des matchs “à venir” groupés par ligue)
- Composants:
  - `src/components/matches/LeagueMatchGroup.tsx`
  - `src/components/matches/MatchCard.tsx`
  - **Bet Modal**: `src/components/.../BetModal.tsx` (nom exact à confirmer)
- Data/hooks/services:
  - `src/features/matches/useMatchesOfTheDay.ts` (hook pour les fixtures du jour – à créer/compléter)
  - `src/features/matches/useMatchExtras.ts` (hook pour logos/forme/H2H/lineups – à créer)
  - `src/lib/apiFootballService.ts` (enveloppe `supabase.functions.invoke`)
  - `src/services/supabase.ts` (client Supabase)

## Contrat UI (résumé)
- `MatchCard` attend un objet `match` avec:
  - `id` (utiliser `fixture.id` comme code)
  - `kickoffTime` (label local, ex. "20:00")
  - `status` ('upcoming' | 'played' + statut brut disponible)
  - `teamA`, `teamB` { name, emoji/logo }
  - `leagueLogo`
  - `odds` { home, draw, away, bookmaker }
- Groupes par ligue: `{ leagueId, leagueName, leagueLogo, matches: UiMatch[] }`

## Flux de données recommandé
1. **Fixtures du jour** via Supabase (`fixtures` + relations `leagues`, `teams`, `odds`), filtre sur fenêtre [startOfDay, endOfDay] en **heure locale**.
2. **Odds 1X2** : injectées depuis table `odds` si déjà stockées (sinon via proxy `/odds` et upsert).
3. **Extras pour Bet Modal** (on-demand):
   - `/teams/statistics` pour la **forme**
   - `/fixtures/headtohead` pour le **H2H**
   - `/fixtures/lineups` pour **lineups** si dispo
4. **Aucune** requête API-Football directe côté client.

## Ce que l’IA doit faire en début de session
1. Lire **tous** les fichiers `docs/context/*.md`.
2. Me demander confirmation si des chemins/fichiers référencés n’existent pas.
3. Proposer un **plan** avant modifications (Plan First), puis attendre mon “Oui”.
