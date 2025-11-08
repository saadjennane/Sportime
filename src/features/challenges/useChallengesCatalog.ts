import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  SportimeGame,
  UserChallengeEntry,
  UserSwipeEntry,
  UserFantasyTeam,
} from '../../types'
import { fetchChallengeCatalog } from '../../services/challengeService'

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
  }
}
