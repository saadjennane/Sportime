import React, { useCallback, useMemo, useState } from 'react';
import { Match, Bet } from '../types';
import UpcomingPage from './Upcoming';
import PlayedPage from './Played';
import { DailySummaryHeader } from '../components/matches/DailySummaryHeader';
import { format } from 'date-fns';
import { Settings } from 'lucide-react';
import { useLeagueOrder } from '../hooks/useLeagueOrder';
import { useImportedLeagues } from '../hooks/useImportedLeagues';
import { LeagueOrderModal } from '../components/matches/LeagueOrderModal';
import { MatchStatsDrawer } from '../components/matches/stats/MatchStatsDrawer';
import { useMatchesOfTheDay } from '../features/matches/useMatchesOfTheDay';
import type { UiMatch } from '../features/matches/useMatchesOfTheDay';

type Tab = 'upcoming' | 'played';

interface MatchesPageProps {
  matches: Match[];
  bets: Bet[];
  onBet: (match: Match, prediction: 'teamA' | 'draw' | 'teamB', odds: number) => void;
  onPlayGame: (matchId: string, matchName: string) => void;
}

const MatchesPage: React.FC<MatchesPageProps> = ({ matches, bets, onBet, onPlayGame }) => {
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedMatchForStats, setSelectedMatchForStats] = useState<Match | null>(null);

  const { data: groups, isLoading: loading, error } = useMatchesOfTheDay();
  const { leagues: importedLeagues, isLoading: leaguesLoading, error: leaguesError } = useImportedLeagues();

  console.log('[MatchesPage] Imported leagues:', importedLeagues);
  console.log('[MatchesPage] Leagues loading:', leaguesLoading);
  console.log('[MatchesPage] Leagues error:', leaguesError);

  const toLegacyMatch = useCallback((m: UiMatch): Match => {
    const fallbackEmoji = (name: string) => (name ? name.charAt(0).toUpperCase() : '⚽');
    const leagueLogo = m.league.logo ?? (m.league.apiId ? `https://media.api-sports.io/football/leagues/${m.league.apiId}.png` : null);
    const goalsHome = m.home.goals ?? null;
    const goalsAway = m.away.goals ?? null;
    let result: 'teamA' | 'draw' | 'teamB' | undefined;
    if (m.status === 'played' && goalsHome !== null && goalsAway !== null) {
      if (goalsHome > goalsAway) result = 'teamA';
      else if (goalsHome < goalsAway) result = 'teamB';
      else result = 'draw';
    }

    const odds = {
      teamA: m.odds?.home ?? 0,
      draw: m.odds?.draw ?? 0,
      teamB: m.odds?.away ?? 0,
    };

    const fixtureId = Number(m.id);
    const homeTeamId = m.homeTeamId ?? (m.home.id ? Number(m.home.id) : Number.NaN);
    const awayTeamId = m.awayTeamId ?? (m.away.id ? Number(m.away.id) : Number.NaN);

    const meta =
      Number.isFinite(fixtureId) &&
      Number.isFinite(homeTeamId) &&
      Number.isFinite(awayTeamId)
        ? {
            fixtureId,
            leagueId: m.leagueInternalId ?? m.league.id,
            apiLeagueId: m.league.apiId ?? null,
            season: m.season ?? null,
            homeTeamId,
            awayTeamId,
          }
        : undefined;

    return {
      id: m.code ?? m.id,
      leagueName: m.league.name,
      leagueLogo,
      teamA: {
        name: m.home.name,
        emoji: fallbackEmoji(m.home.name),
        logo: m.home.logo ?? undefined,
      },
      teamB: {
        name: m.away.name,
        emoji: fallbackEmoji(m.away.name),
        logo: m.away.logo ?? undefined,
      },
      kickoffTime: m.kickoffLabel,
      odds,
      status: m.status,
      isLive: m.isLive,
      result,
      score:
        m.status === 'played' || m.isLive
          ? {
              teamA: goalsHome ?? 0,
              teamB: goalsAway ?? 0,
            }
          : undefined,
      hasLineup: m.hasLineup ?? false,
      meta,
    } as Match;
  }, []);

  const { upcomingMatches, groupedUpcoming } = useMemo(() => {
    if (!groups || groups.length === 0) {
      return {
        upcomingMatches: [],
        groupedUpcoming: {},
      };
    }

    const grouped = groups.reduce((acc, group) => {
      const mapped = group.matches.map(toLegacyMatch);
      acc[group.leagueName] = mapped;
      return acc;
    }, {} as Record<string, Match[]>);

    const flattened = Object.values(grouped).flat();

    return {
      upcomingMatches: flattened,
      groupedUpcoming: grouped,
    };
  }, [groups, toLegacyMatch]);

  // For now, we only show upcoming matches from useMatchesOfTheDay
  // Played matches would need to come from the same hook to be properly filtered
  const playedMatches: Match[] = [];

  // Create mock matches array with all imported leagues for useLeagueOrder
  const allLeaguesAsMatches = useMemo(() => {
    return importedLeagues.map(league => ({
      id: `league-${league.id}`,
      leagueName: league.name,
      leagueLogo: league.logo || '',
      teamA: { name: '', emoji: '', logo: undefined },
      teamB: { name: '', emoji: '', logo: undefined },
      kickoffTime: '',
      odds: { teamA: 0, draw: 0, teamB: 0 },
      status: 'upcoming' as const,
      isLive: false,
    })) as Match[];
  }, [importedLeagues]);

  const { orderedLeagues, setOrderedLeagues } = useLeagueOrder(allLeaguesAsMatches);

  const groupedPlayed = useMemo(() => {
    return playedMatches.reduce((acc, match) => {
      const league = match.leagueName || 'Other';
      if (!acc[league]) acc[league] = [];
      acc[league].push(match);
      return acc;
    }, {} as Record<string, Match[]>);
  }, [playedMatches]);
  
  const effectiveOrderedLeagues = useMemo(() => {
    if (orderedLeagues.length) return orderedLeagues;
    const upcomingLeagueNames = Object.keys(groupedUpcoming);
    if (upcomingLeagueNames.length) return upcomingLeagueNames;
    return Object.keys(groupedPlayed);
  }, [orderedLeagues, groupedUpcoming, groupedPlayed]);

  // Use ALL imported leagues for the modal, not just those with matches today
  const uniqueLeaguesWithLogos = useMemo(() => {
    console.log('[MatchesPage] Building uniqueLeaguesWithLogos from:', importedLeagues);

    // Convert imported leagues to the format expected by the modal
    const allLeagues = importedLeagues.map(league => ({
      name: league.name,
      logo: league.logo || `https://media.api-sports.io/football/leagues/${league.api_league_id}.png`
    }));

    console.log('[MatchesPage] All leagues for modal:', allLeagues);

    // Apply saved order if it exists
    if (orderedLeagues.length > 0) {
      // Sort leagues according to saved order
      const sorted = allLeagues.sort((a, b) => {
        const indexA = orderedLeagues.indexOf(a.name);
        const indexB = orderedLeagues.indexOf(b.name);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
      console.log('[MatchesPage] Sorted leagues for modal:', sorted);
      return sorted;
    }

    console.log('[MatchesPage] Unsorted leagues for modal:', allLeagues);
    return allLeagues;
  }, [importedLeagues, orderedLeagues]);

  const headerData = useMemo(() => {
    const picksCount = bets.filter(bet => upcomingMatches.some(m => m.id === bet.matchId)).length;
    const potentialWinnings = bets.reduce((total, bet) => {
      const match = upcomingMatches.find(m => m.id === bet.matchId);
      if (match) {
        return total + (bet.amount * bet.odds);
      }
      return total;
    }, 0);

    return {
      picksCount,
      totalMatches: upcomingMatches.length,
      potentialWinnings
    };
  }, [bets, upcomingMatches]);

  return (
    <div className="space-y-4">
      <DailySummaryHeader
        date={format(new Date(), 'EEEE, MMM d, yyyy')}
        picksCount={headerData.picksCount}
        totalMatches={headerData.totalMatches}
        potentialWinnings={headerData.potentialWinnings}
      />
      
      <div className="flex items-center gap-2">
        <div className="flex-1 flex bg-navy-accent rounded-xl p-1">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 p-2 rounded-lg font-semibold transition-all text-sm ${activeTab === 'upcoming' ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('played')}
            className={`flex-1 p-2 rounded-lg font-semibold transition-all text-sm ${activeTab === 'played' ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}
          >
            Played
          </button>
        </div>
        <button onClick={() => setIsOrderModalOpen(true)} className="p-3 bg-navy-accent rounded-xl text-text-secondary hover:text-electric-blue">
          <Settings size={20} />
        </button>
      </div>

      {activeTab === 'upcoming' ? (
        loading ? (
          <div className="card-base p-6 text-center text-text-secondary text-sm">Loading today’s matches…</div>
        ) : error ? (
          <div className="card-base p-6 text-center text-hot-red text-sm">Failed to load matches: {error}</div>
        ) : Object.keys(groupedUpcoming).length === 0 ? (
          <div className="card-base p-6 text-center text-text-secondary text-sm">No matches scheduled for today.</div>
        ) : (
          <UpcomingPage
            groupedMatches={groupedUpcoming}
            orderedLeagues={effectiveOrderedLeagues}
            bets={bets}
            onBet={onBet}
            onViewStats={setSelectedMatchForStats}
            onPlayGame={onPlayGame}
          />
        )
      ) : (
        <PlayedPage 
          groupedMatches={groupedPlayed}
          orderedLeagues={effectiveOrderedLeagues}
          bets={bets}
          onViewStats={setSelectedMatchForStats}
        />
      )}

      <LeagueOrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        leagues={uniqueLeaguesWithLogos}
        onSave={setOrderedLeagues}
      />

      <MatchStatsDrawer
        match={selectedMatchForStats}
        onClose={() => setSelectedMatchForStats(null)}
      />
    </div>
  );
};

export default MatchesPage;
