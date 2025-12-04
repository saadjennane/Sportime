import { useCallback, useEffect, useState } from 'react'
import type { Challenge, ChallengeMatch } from '../../types'
import { fetchChallengeMatches } from '../../services/challengeService'

type ChallengeMatchesState = {
  challenge: Challenge | null
  matches: ChallengeMatch[]
}

const EMPTY_STATE: ChallengeMatchesState = {
  challenge: null,
  matches: [],
}

export function useChallengeMatches(challengeId: string | null, enabled: boolean) {
  const [state, setState] = useState<ChallengeMatchesState>(EMPTY_STATE)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled || !challengeId) {
      setState(EMPTY_STATE)
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const detail = await fetchChallengeMatches(challengeId)
      setState({
        challenge: detail.challenge,
        matches: detail.matches,
      })
    } catch (err: any) {
      console.error('[useChallengeMatches] Failed to load challenge matches', err)
      setState(EMPTY_STATE)
      setError(err?.message ?? 'Unable to load challenge data')
    } finally {
      setIsLoading(false)
    }
  }, [challengeId, enabled])

  useEffect(() => {
    load()
  }, [load])

  return {
    challenge: state.challenge,
    matches: state.matches,
    isLoading,
    error,
    refresh: load,
  }
}
