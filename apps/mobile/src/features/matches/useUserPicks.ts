import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Match, Bet } from '../../types';

export interface PickWithMatch {
  bet: Bet;
  match: Match;
}

interface UseUserPicksReturn {
  picks: PickWithMatch[];
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  refetch: () => void;
  totalPicks: number;
  stats: {
    pending: number;
    won: number;
    lost: number;
    totalWinnings: number;
  };
}

const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWARDED', 'W.O', 'CANC', 'ABD', 'POST'];
const INITIAL_PICKS_LIMIT = 10;
const LOAD_MORE_INCREMENT = 10;

export function useUserPicks(userBets: Bet[] = []): UseUserPicksReturn {
  const [picks, setPicks] = useState<PickWithMatch[]>([]);
  const [displayedCount, setDisplayedCount] = useState(INITIAL_PICKS_LIMIT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate if we need lazy loading
  const needsLazyLoading = useMemo(() => {
    if (userBets.length > INITIAL_PICKS_LIMIT) return true;
    // Check if bets span more than 2 days - we'll calculate this after fetching
    return false;
  }, [userBets.length]);

  const fetchMatchesForBets = useCallback(async () => {
    if (!supabase || userBets.length === 0) {
      setPicks([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get all unique match IDs from bets
      const matchIds = [...new Set(userBets.map(bet => bet.matchId))];

      console.log('[useUserPicks] Fetching matches for bet IDs:', matchIds);

      // Separate numeric IDs (api_id) from UUID IDs (fixture id)
      const numericIds = matchIds.filter(id => /^\d+$/.test(id)).map(Number);
      const uuidIds = matchIds.filter(id => /^[0-9a-f-]{36}$/i.test(id));

      console.log('[useUserPicks] Numeric IDs:', numericIds, 'UUID IDs:', uuidIds);

      let fixturesData: any[] = [];

      // Fetch by api_id if we have numeric IDs
      if (numericIds.length > 0) {
        const { data, error: fetchError } = await supabase
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
            )
          `)
          .in('api_id', numericIds)
          .order('date', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        fixturesData = data || [];
      }

      // Fetch by UUID id if we have UUID IDs
      if (uuidIds.length > 0) {
        const { data, error: fetchError } = await supabase
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
            )
          `)
          .in('id', uuidIds)
          .order('date', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        // Merge with existing fixtures, avoiding duplicates
        const existingIds = new Set(fixturesData.map(f => f.id));
        (data || []).forEach(fixture => {
          if (!existingIds.has(fixture.id)) {
            fixturesData.push(fixture);
          }
        });
      }

      console.log('[useUserPicks] Fixtures fetched:', fixturesData.length);

      if (fixturesData.length === 0) {
        setPicks([]);
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

      // Create a map of fixtures by BOTH api_id AND UUID id for quick lookup
      const fixturesMap = new Map<string, any>();
      fixturesData.forEach(f => {
        // Index by UUID
        fixturesMap.set(String(f.id), f);
        // Also index by api_id if available
        if (f.api_id) {
          fixturesMap.set(String(f.api_id), f);
        }
      });

      console.log('[useUserPicks] fixturesMap keys:', Array.from(fixturesMap.keys()));

      // Transform bets with their matches
      const picksWithMatches: PickWithMatch[] = userBets
        .map(bet => {
          const fixture = fixturesMap.get(bet.matchId);
          console.log('[useUserPicks] Looking for matchId:', bet.matchId, 'Found:', !!fixture);
          if (!fixture) return null;

          const homeTeam = teamsMap.get(fixture.home_team_id);
          const awayTeam = teamsMap.get(fixture.away_team_id);

          if (!homeTeam || !awayTeam) return null;

          const isFinished = FINISHED_STATUSES.includes(fixture.status);
          const result = isFinished ? determineResult(fixture.goals_home, fixture.goals_away) : undefined;

          // Calculate bet status based on match result
          let betStatus = bet.status;
          let winAmount = bet.winAmount;

          if (isFinished && bet.status === 'pending') {
            if (result === bet.prediction) {
              betStatus = 'won';
              winAmount = Math.ceil(bet.amount * bet.odds);
            } else {
              betStatus = 'lost';
              winAmount = 0;
            }
          }

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
            status: isFinished ? 'played' : 'upcoming',
            rawStatus: fixture.status || 'NS',
            isLive: !isFinished && fixture.status !== 'NS' && fixture.status !== 'TBD',
            odds: {
              teamA: 0,
              draw: 0,
              teamB: 0,
            },
            score: isFinished ? {
              teamA: fixture.goals_home || 0,
              teamB: fixture.goals_away || 0,
            } : undefined,
            result,
          };

          return {
            bet: {
              ...bet,
              status: betStatus,
              winAmount,
            },
            match,
          };
        })
        .filter((p): p is PickWithMatch => p !== null)
        // Sort by match date descending (most recent first)
        .sort((a, b) => new Date(b.match.kickoffTime).getTime() - new Date(a.match.kickoffTime).getTime());

      console.log('[useUserPicks] Picks with matches:', picksWithMatches.length);
      setPicks(picksWithMatches);

    } catch (err: any) {
      console.error('[useUserPicks] Error:', err);
      setError(err.message || 'Failed to load picks');
    } finally {
      setIsLoading(false);
    }
  }, [userBets]);

  // Fetch matches when bets change
  useEffect(() => {
    fetchMatchesForBets();
  }, [fetchMatchesForBets]);

  // Calculate stats
  const stats = useMemo(() => {
    return picks.reduce((acc, pick) => {
      if (pick.bet.status === 'pending') acc.pending++;
      else if (pick.bet.status === 'won') {
        acc.won++;
        acc.totalWinnings += (pick.bet.winAmount || 0) - pick.bet.amount;
      }
      else if (pick.bet.status === 'lost') {
        acc.lost++;
        acc.totalWinnings -= pick.bet.amount;
      }
      return acc;
    }, { pending: 0, won: 0, lost: 0, totalWinnings: 0 });
  }, [picks]);

  // Check if picks span more than 2 days
  const picksSpanMultipleDays = useMemo(() => {
    if (picks.length < 2) return false;
    const dates = picks.map(p => new Date(p.match.kickoffTime).toDateString());
    const uniqueDates = [...new Set(dates)];
    return uniqueDates.length > 2;
  }, [picks]);

  // Determine if we should use lazy loading
  const shouldLazyLoad = picks.length > INITIAL_PICKS_LIMIT || picksSpanMultipleDays;

  // Get displayed picks (with lazy loading)
  const displayedPicks = shouldLazyLoad
    ? picks.slice(0, displayedCount)
    : picks;

  const hasMore = shouldLazyLoad && displayedCount < picks.length;

  const loadMore = useCallback(() => {
    if (hasMore) {
      setDisplayedCount(prev => prev + LOAD_MORE_INCREMENT);
    }
  }, [hasMore]);

  const refetch = useCallback(() => {
    setDisplayedCount(INITIAL_PICKS_LIMIT);
    fetchMatchesForBets();
  }, [fetchMatchesForBets]);

  return {
    picks: displayedPicks,
    isLoading,
    hasMore,
    error,
    loadMore,
    refetch,
    totalPicks: picks.length,
    stats,
  };
}

function determineResult(goalsHome: number | null, goalsAway: number | null): 'teamA' | 'draw' | 'teamB' {
  if (goalsHome === null || goalsAway === null) return 'draw';
  if (goalsHome > goalsAway) return 'teamA';
  if (goalsHome < goalsAway) return 'teamB';
  return 'draw';
}
