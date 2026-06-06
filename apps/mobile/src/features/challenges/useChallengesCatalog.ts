import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  SportimeGame,
  UserChallengeEntry,
  UserSwipeEntry,
  UserFantasyTeam,
  ChallengeBet,
} from '../../types'
import { fetchChallengeCatalog } from '../../services/challengeService'
import { useResumeRefresh } from '../../native/useResumeRefresh'

type CatalogState = {
  games: SportimeGame[]
  userChallengeEntries: UserChallengeEntry[]
  userSwipeEntries: UserSwipeEntry[]
  userFantasyTeams: UserFantasyTeam[]
  joinedChallengeIds: string[]
}

const EMPTY_STATE: CatalogState = {
  games: [],
  userChallengeEntries: [],
  userSwipeEntries: [],
  userFantasyTeams: [],
  joinedChallengeIds: [],
}

export function useChallengesCatalog(userId: string | null, enabled: boolean) {
  const [state, setState] = useState<CatalogState>(EMPTY_STATE)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)

  const loadCatalog = useCallback(async () => {
    if (!enabled) {
      setState(EMPTY_STATE)
      setError(null)
      setIsLoading(false)
      setHasError(false)
      return
    }

    setIsLoading(true)
    setError(null)
    setHasError(false)
    try {
      const catalog = await fetchChallengeCatalog(userId ?? undefined)
      setState(catalog)
      setHasError(false)
    } catch (err: any) {
      console.error('[useChallengesCatalog] Failed to load challenges', err)
      setError(err?.message ?? 'Unable to load challenges')
      setState(EMPTY_STATE)
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [userId, enabled])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  const joinedSet = useMemo(() => new Set(state.joinedChallengeIds), [state.joinedChallengeIds])

  // Update user entry bets locally without refetching from server (optimistic update)
  const updateUserEntryBets = useCallback((
    challengeId: string,
    day: number,
    newBets: ChallengeBet[]
  ) => {
    setState(prev => ({
      ...prev,
      userChallengeEntries: prev.userChallengeEntries.map(entry => {
        if (entry.challengeId !== challengeId) return entry;

        // Check if dailyEntry for this day exists
        const dayExists = entry.dailyEntries.some(d => d.day === day);

        if (dayExists) {
          // Update existing day
          return {
            ...entry,
            dailyEntries: entry.dailyEntries.map(d => {
              if (d.day !== day) return d;
              return { ...d, bets: newBets };
            }),
          };
        } else {
          // Create new daily entry for this day
          console.log('[updateUserEntryBets] Creating new dailyEntry for day:', day);
          return {
            ...entry,
            dailyEntries: [...entry.dailyEntries, { day, bets: newBets }],
          };
        }
      }),
    }));
  }, []);

  // Refresh the catalog when the app returns to the foreground (native).
  useResumeRefresh(loadCatalog)

  return {
    games: state.games,
    userChallengeEntries: state.userChallengeEntries,
    userSwipeEntries: state.userSwipeEntries,
    userFantasyTeams: state.userFantasyTeams,
    joinedChallengeIds: state.joinedChallengeIds,
    joinedChallengeSet: joinedSet,
    isLoading,
    error,
    hasError,
    refresh: loadCatalog,
    updateUserEntryBets,
  }
}
