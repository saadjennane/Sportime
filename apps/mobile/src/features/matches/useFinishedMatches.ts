import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Match, Bet } from '../../types';

interface FinishedMatchFilters {
  myBetsOnly?: boolean;
}

interface UseFinishedMatchesReturn {
  matches: Match[];
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  refetch: () => void;
  daysLoaded: number;
}

const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWARDED', 'W.O', 'CANC', 'ABD', 'POST'];
const INITIAL_DAYS = 2;
const MAX_DAYS = 30; // Reasonable limit

export function useFinishedMatches(
  userId?: string,
  userBets: Bet[] = [],
  filters: FinishedMatchFilters = {}
): UseFinishedMatchesReturn {
  const [matches, setMatches] = useState<Match[]>([]);
  const [daysLoaded, setDaysLoaded] = useState(INITIAL_DAYS);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async (days: number) => {
    if (!supabase || days > MAX_DAYS) {
      setHasMore(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Calculate date range: from (today - days) to end of today
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - days);
      fromDate.setHours(0, 0, 0, 0);

      console.log('[useFinishedMatches] Date range:', {
        fromDate: fromDate.toISOString(),
        toDate: today.toISOString(),
        daysRequested: days,
      });

      // Build query with odds
      const query = supabase
        .from('fb_fixtures')
        .select(`
          id,
          api_id,
          date,
          status,
          goals_home,
          goals_away,
          league_id,
          home_team_id,
          away_team_id,
          league:fb_leagues!fb_fixtures_league_id_fkey(
            id,
            name,
            logo
          ),
          fb_odds!fb_odds_fixture_id_fkey(
            home_win,
            draw,
            away_win,
            bookmaker_name
          )
        `)
        .gte('date', fromDate.toISOString())
        .lte('date', today.toISOString())
        .in('status', FINISHED_STATUSES)
        .order('date', { ascending: false });

      const { data: fixturesData, error: fixturesError } = await query;

      console.log('[useFinishedMatches] Query result:', {
        count: fixturesData?.length || 0,
        error: fixturesError,
        sampleMatch: fixturesData?.[0],
      });

      if (fixturesError) {
        throw fixturesError;
      }

      if (!fixturesData) {
        console.log('[useFinishedMatches] No fixtures data returned');
        setMatches([]);
        setHasMore(false);
        return;
      }

      // Fetch team details
      const homeTeamIds = [...new Set(fixturesData.map(f => f.home_team_id).filter(Boolean))];
      const awayTeamIds = [...new Set(fixturesData.map(f => f.away_team_id).filter(Boolean))];
      const allTeamIds = [...new Set([...homeTeamIds, ...awayTeamIds])];

      const { data: teamsData } = await supabase
        .from('fb_teams')
        .select('id, name, logo_url')
        .in('id', allTeamIds);

      const teamsMap = new Map(teamsData?.map(t => [t.id, t]) || []);

      // Transform to Match format
      const transformedMatches: Match[] = fixturesData
        .map(fixture => {
          const homeTeam = teamsMap.get(fixture.home_team_id);
          const awayTeam = teamsMap.get(fixture.away_team_id);

          if (!homeTeam || !awayTeam) return null;

          const match: Match = {
            id: String(fixture.api_id || fixture.id),
            leagueName: fixture.league?.name || 'Unknown League',
            leagueLogo: fixture.league?.logo || null,
            teamA: {
              name: homeTeam.name || 'Unknown',
              emoji: '',
              logo: homeTeam.logo_url,
            },
            teamB: {
              name: awayTeam.name || 'Unknown',
              emoji: '',
              logo: awayTeam.logo_url,
            },
            kickoffTime: fixture.date,
            status: 'played',
            odds: {
              teamA: fixture.fb_odds?.[0]?.home_win ?? 0,
              draw: fixture.fb_odds?.[0]?.draw ?? 0,
              teamB: fixture.fb_odds?.[0]?.away_win ?? 0,
            },
            score: {
              teamA: fixture.goals_home || 0,
              teamB: fixture.goals_away || 0,
            },
            result: determineResult(fixture.goals_home, fixture.goals_away),
          };

          return match;
        })
        .filter((m): m is Match => m !== null);

      // Apply "My Bets Only" filter if enabled
      const filteredMatches = filters.myBetsOnly
        ? transformedMatches.filter(match =>
            userBets.some(bet => bet.matchId === match.id)
          )
        : transformedMatches;

      console.log('[useFinishedMatches] Final result:', {
        transformedCount: transformedMatches.length,
        filteredCount: filteredMatches.length,
        myBetsOnlyEnabled: filters.myBetsOnly,
        userBetsCount: userBets.length,
      });

      setMatches(filteredMatches);

      // Determine if there are more days to load
      const hasMoreDays = days < MAX_DAYS && filteredMatches.length > 0;
      setHasMore(hasMoreDays);
    } catch (err: any) {
      console.error('[useFinishedMatches] Error fetching matches:', err);
      setError(err.message || 'Failed to load matches');
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [filters.myBetsOnly, userBets, userId]);

  // Initial load
  useEffect(() => {
    setDaysLoaded(INITIAL_DAYS);
    fetchMatches(INITIAL_DAYS);
  }, [fetchMatches]);

  // Load more (add one more day)
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      const newDays = daysLoaded + 1;
      setDaysLoaded(newDays);
      fetchMatches(newDays);
    }
  }, [isLoading, hasMore, daysLoaded, fetchMatches]);

  // Refetch (reset to initial days)
  const refetch = useCallback(() => {
    setDaysLoaded(INITIAL_DAYS);
    fetchMatches(INITIAL_DAYS);
  }, [fetchMatches]);

  return {
    matches,
    isLoading,
    hasMore,
    error,
    loadMore,
    refetch,
    daysLoaded,
  };
}

function determineResult(goalsHome: number | null, goalsAway: number | null): 'teamA' | 'draw' | 'teamB' {
  if (goalsHome === null || goalsAway === null) return 'draw';
  if (goalsHome > goalsAway) return 'teamA';
  if (goalsHome < goalsAway) return 'teamB';
  return 'draw';
}
