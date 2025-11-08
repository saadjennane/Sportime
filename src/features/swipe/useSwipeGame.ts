/**
 * useSwipeGame Hook
 *
 * Main hook for managing swipe game state including:
 * - Challenge details
 * - Matchdays
 * - Fixtures/matches
 * - Real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import * as swipeService from '../../services/swipeGameService';
import { fixturesToSwipeMatches, groupFixturesByDate } from './swipeMappers';
import type { SwipeMatch, SwipeMatchDay } from '../../types';
import type { ChallengeMatchday } from '../../services/swipeGameService';
import type { FixtureData } from './swipeMappers';

interface UseSwipeGameReturn {
  // Challenge data
  challenge: SwipeMatchDay | null;
  matchdays: ChallengeMatchday[];

  // Current matchday
  currentMatchday: ChallengeMatchday | null;
  matches: SwipeMatch[];

  // Grouped by date (for multi-day view)
  matchesByDate: Map<string, SwipeMatch[]>;

  // State
  isLoading: boolean;
  error: Error | null;

  // Actions
  refresh: () => Promise<void>;
  selectMatchday: (matchdayId: string) => Promise<void>;
  hasJoined: boolean;
  joinGame: () => Promise<void>;
}

export function useSwipeGame(
  challengeId: string,
  userId: string | null,
  initialMatchdayId?: string
): UseSwipeGameReturn {
  const [challenge, setChallenge] = useState<SwipeMatchDay | null>(null);
  const [matchdays, setMatchdays] = useState<ChallengeMatchday[]>([]);
  const [currentMatchday, setCurrentMatchday] = useState<ChallengeMatchday | null>(null);
  const [matches, setMatches] = useState<SwipeMatch[]>([]);
  const [matchesByDate, setMatchesByDate] = useState<Map<string, SwipeMatch[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasJoined, setHasJoined] = useState(false);

  // Load challenge data
  const loadChallenge = useCallback(async () => {
    try {
      const data = await swipeService.getSwipeChallenge(challengeId);

      // Transform to SwipeMatchDay format
      const leagueData = data.challenge_leagues?.[0]?.league;

      setChallenge({
        id: data.id,
        name: data.name,
        description: data.description || '',
        league_id: leagueData?.id,
        league_name: leagueData?.name || '',
        league_logo: leagueData?.logo || '',
        start_date: data.start_date,
        end_date: data.end_date,
        game_type: 'prediction',
        tier: 'free',
        entry_cost: data.entry_cost || 0,
        rewards: data.prizes || [],
        matches: [], // Will be populated per matchday
        status: data.status,
      });
    } catch (err) {
      console.error('Error loading challenge:', err);
      setError(err as Error);
    }
  }, [challengeId]);

  // Load all matchdays
  const loadMatchdays = useCallback(async () => {
    try {
      const data = await swipeService.getChallengeMatchdays(challengeId);
      setMatchdays(data);

      // Auto-select matchday
      if (data.length > 0) {
        let selectedMatchday: ChallengeMatchday;

        if (initialMatchdayId) {
          selectedMatchday = data.find(md => md.id === initialMatchdayId) || data[0];
        } else {
          // Select first active/upcoming matchday
          selectedMatchday = data.find(md => md.status !== 'finished') || data[data.length - 1];
        }

        await loadMatchdayMatches(selectedMatchday.id);
      }
    } catch (err) {
      console.error('Error loading matchdays:', err);
      setError(err as Error);
    }
  }, [challengeId, initialMatchdayId]);

  // Load matches for a specific matchday
  const loadMatchdayMatches = useCallback(async (matchdayId: string) => {
    try {
      const data = await swipeService.getMatchdayWithFixtures(matchdayId);
      setCurrentMatchday(data);

      // Extract fixtures from nested structure
      const fixtures = data.matchday_fixtures?.map((mf: any) => mf.fixture) || [];

      // Get user predictions if logged in
      let predictions: any[] = [];
      if (userId) {
        predictions = await swipeService.getUserMatchdayPredictions(matchdayId, userId);
      }

      // Transform to SwipeMatch format
      const swipeMatches = fixturesToSwipeMatches(fixtures as FixtureData[], predictions);
      setMatches(swipeMatches);

      // Group by date
      const fixturesByDate = groupFixturesByDate(fixtures as FixtureData[]);
      const matchesByDateMap = new Map<string, SwipeMatch[]>();

      for (const [date, dateFixtures] of fixturesByDate.entries()) {
        const datePredictions = predictions.filter(p =>
          dateFixtures.some(f => f.id === p.fixture_id)
        );
        matchesByDateMap.set(date, fixturesToSwipeMatches(dateFixtures, datePredictions));
      }

      setMatchesByDate(matchesByDateMap);
    } catch (err) {
      console.error('Error loading matchday matches:', err);
      setError(err as Error);
    }
  }, [userId]);

  // Check if user has joined
  const checkJoinStatus = useCallback(async () => {
    if (!userId) {
      setHasJoined(false);
      return;
    }

    try {
      const joined = await swipeService.hasJoinedChallenge(challengeId, userId);
      setHasJoined(joined);
    } catch (err) {
      console.error('Error checking join status:', err);
    }
  }, [challengeId, userId]);

  // Join game
  const joinGame = useCallback(async () => {
    if (!userId) return;

    try {
      await swipeService.joinSwipeChallenge(challengeId, userId);
      setHasJoined(true);
    } catch (err) {
      console.error('Error joining game:', err);
      throw err;
    }
  }, [challengeId, userId]);

  // Select a different matchday
  const selectMatchday = useCallback(async (matchdayId: string) => {
    setIsLoading(true);
    try {
      await loadMatchdayMatches(matchdayId);
    } finally {
      setIsLoading(false);
    }
  }, [loadMatchdayMatches]);

  // Refresh all data
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadChallenge(),
        loadMatchdays(),
        checkJoinStatus(),
      ]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [loadChallenge, loadMatchdays, checkJoinStatus]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [challengeId]);

  // Subscribe to real-time updates on fixtures
  useEffect(() => {
    if (!currentMatchday) return;

    const channel = supabase
      .channel(`swipe-game-${currentMatchday.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'fixtures',
        },
        async (payload) => {
          console.log('Fixture updated:', payload);
          // Reload matches when a fixture updates (status/score change)
          if (currentMatchday) {
            await loadMatchdayMatches(currentMatchday.id);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentMatchday?.id, loadMatchdayMatches]);

  return {
    challenge,
    matchdays,
    currentMatchday,
    matches,
    matchesByDate,
    isLoading,
    error,
    refresh,
    selectMatchday,
    hasJoined,
    joinGame,
  };
}
