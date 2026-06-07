import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Match, Bet } from '../types';
import UpcomingPage from './Upcoming';
import FinishedMatchesPage from './FinishedMatches';
import PicksPage from './PicksPage';
import { BetHistoryPage } from './BetHistoryPage';
import { EmptyState } from '../components/EmptyState';
import { format } from 'date-fns';
import { Settings, Calendar, Target } from 'lucide-react';
import { useLeagueOrder } from '../hooks/useLeagueOrder';
import { useImportedLeagues } from '../hooks/useImportedLeagues';
import { LeagueOrderModal } from '../components/matches/LeagueOrderModal';
import { MatchStatsDrawer } from '../components/matches/stats/MatchStatsDrawer';
import { useMatchesOfTheDay } from '../features/matches/useMatchesOfTheDay';
import { useUnreadSettled } from '../features/matches/useUnreadSettled';
import { PullToRefresh } from '../components/PullToRefresh';
import type { UiMatch } from '../features/matches/useMatchesOfTheDay';

type Tab = 'today' | 'picks' | 'finished';

interface MatchesPageProps {
  matches: Match[];
  bets: Bet[];
  onBet: (match: Match, prediction: 'teamA' | 'draw' | 'teamB', odds: number) => void;
  onPlayGame: (matchId: string, matchName: string) => void;
  onBrowseGames?: () => void;
}

const MatchesPage: React.FC<MatchesPageProps> = ({ matches, bets, onBet, onPlayGame, onBrowseGames }) => {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedMatchForStats, setSelectedMatchForStats] = useState<Match | null>(null);

  const { data: groups, isLoading: loading, error, refresh } = useMatchesOfTheDay();
  const { leagues: importedLeagues, isLoading: leaguesLoading, error: leaguesError } = useImportedLeagues();

  // Picks tab badge = active (unsettled) picks only — settled ones live in Finished.
  const activePicksCount = useMemo(() => bets.filter(b => b.status === 'pending').length, [bets]);

  // Unread badge for settled bets the user hasn't seen; cleared on opening Finished.
  const { unreadCount, markAllSeen } = useUnreadSettled(bets);
  useEffect(() => {
    if (activeTab === 'finished') markAllSeen();
  }, [activeTab, markAllSeen]);


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

    // Use API IDs for stats drawer - these are numeric IDs from API-Football
    const fixtureId = m.apiId ?? Number.NaN;
    const homeTeamId = m.home.apiId ?? Number.NaN;
    const awayTeamId = m.away.apiId ?? Number.NaN;

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
      rawStatus: m.rawStatus,
      isLive: m.isLive,
      elapsedMinutes: m.elapsedMinutes,
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

  const effectiveOrderedLeagues = useMemo(() => {
    if (orderedLeagues.length) return orderedLeagues;
    const upcomingLeagueNames = Object.keys(groupedUpcoming);
    if (upcomingLeagueNames.length) return upcomingLeagueNames;
    return [];
  }, [orderedLeagues, groupedUpcoming]);

  // Use ALL imported leagues for the modal, not just those with matches today
  const uniqueLeaguesWithLogos = useMemo(() => {
    // Convert imported leagues to the format expected by the modal
    const allLeagues = importedLeagues.map(league => ({
      name: league.name,
      logo: league.logo || `https://media.api-sports.io/football/leagues/${league.api_league_id}.png`
    }));

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
      return sorted;
    }

    return allLeagues;
  }, [importedLeagues, orderedLeagues]);

  // Ids of matches the user has a pick on.
  const pickedMatchIds = useMemo(() => new Set(bets.map(b => b.matchId)), [bets]);

  // Today tab = today's matches that are NOT picked and NOT finished.
  // Picked matches move to Picks; finished matches move to Finished.
  const groupedToday = useMemo(() => {
    const result: Record<string, Match[]> = {};
    for (const [league, leagueMatches] of Object.entries(groupedUpcoming)) {
      const filtered = leagueMatches.filter(
        m => !pickedMatchIds.has(m.id) && m.status !== 'played',
      );
      if (filtered.length) result[league] = filtered;
    }
    return result;
  }, [groupedUpcoming, pickedMatchIds]);

  // Finished tab (daily) = today's matches that are finished.
  const groupedFinished = useMemo(() => {
    const result: Record<string, Match[]> = {};
    for (const [league, leagueMatches] of Object.entries(groupedUpcoming)) {
      const filtered = leagueMatches.filter(m => m.status === 'played');
      if (filtered.length) result[league] = filtered;
    }
    return result;
  }, [groupedUpcoming]);

  // Finished header stats over ALL of today's picks (finished + pending):
  // won count, total picks, and the day's net earnings (+won / −lost stakes).
  const finishedHeaderStats = useMemo(() => {
    const todayIds = new Set(upcomingMatches.map(m => m.id));
    const todayBets = bets.filter(b => todayIds.has(b.matchId));
    const won = todayBets.filter(b => b.status === 'won').length;
    // Net balance: win => profit (payout − stake), loss => −stake.
    const net = todayBets.reduce(
      (t, b) =>
        b.status === 'won'
          ? t + ((b.winAmount ?? 0) - b.amount)
          : b.status === 'lost'
            ? t - b.amount
            : t,
      0,
    );
    return { won, totalPicks: todayBets.length, net };
  }, [upcomingMatches, bets]);

  return (
    <PullToRefresh onRefresh={refresh}>
    <div className="space-y-4">
      {/* Sticky date + tabs — stay fixed while the lists scroll */}
      <div className="sticky top-0 z-20 -mx-4 px-4 pt-2 pb-3 bg-deep-navy space-y-3">
      {/* 1. Date */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2 text-lg font-bold text-text-primary">
          <Calendar size={18} className="text-electric-blue" />
          <span>{format(new Date(), 'EEEE, MMM d, yyyy')}</span>
        </div>
      </div>

      {/* 2. Onglets Today/Picks/Finished */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex bg-navy-accent rounded-xl p-1">
          <button
            onClick={() => setActiveTab('today')}
            className={`flex-1 p-2 rounded-lg font-semibold transition-all text-sm ${activeTab === 'today' ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}
          >
            Today
          </button>
          <button
            onClick={() => setActiveTab('picks')}
            className={`flex-1 p-2 rounded-lg font-semibold transition-all text-sm flex items-center justify-center gap-1 ${activeTab === 'picks' ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}
          >
            <Target size={14} />
            Picks
            {activePicksCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'picks' ? 'bg-white/20' : 'bg-electric-blue/20 text-electric-blue'}`}>
                {activePicksCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('finished')}
            className={`flex-1 p-2 rounded-lg font-semibold transition-all text-sm flex items-center justify-center gap-1 ${activeTab === 'finished' ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}
          >
            Finished
            {unreadCount > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-hot-red text-white font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
        <button onClick={() => setIsOrderModalOpen(true)} className="p-3 bg-navy-accent rounded-xl text-text-secondary hover:text-electric-blue">
          <Settings size={20} />
        </button>
      </div>
      </div>

      {/* 4. Liste des matchs */}
      {activeTab === 'today' ? (
        loading ? (
          <div className="card-base p-6 text-center text-text-secondary text-sm">Loading today's matches…</div>
        ) : error ? (
          <div className="card-base p-6 text-center text-hot-red text-sm">Failed to load matches: {error}</div>
        ) : Object.keys(groupedToday).length === 0 ? (
          Object.keys(groupedUpcoming).length === 0 ? (
            <EmptyState
              glyph="⚽"
              title="No kickoff today"
              subtitle="Nothing on the pitch right now. Browse challenges or come back tomorrow."
              cta={onBrowseGames ? { label: '🎮 Browse Games', onClick: onBrowseGames } : undefined}
            />
          ) : (
            <EmptyState
              glyph="👏"
              title="All caught up"
              subtitle="You've handled today's matches — check your Picks and the results in Finished."
              cta={{ label: '→ View Picks', onClick: () => setActiveTab('picks') }}
            />
          )
        ) : (
          <UpcomingPage
            groupedMatches={groupedToday}
            orderedLeagues={effectiveOrderedLeagues}
            bets={bets}
            onBet={onBet}
            onViewStats={setSelectedMatchForStats}
            onPlayGame={onPlayGame}
          />
        )
      ) : activeTab === 'picks' ? (
        <PicksPage
          bets={bets}
          onViewStats={setSelectedMatchForStats}
          onGoToToday={() => setActiveTab('today')}
          onBet={onBet}
          onPlayGame={onPlayGame}
          orderedLeagues={effectiveOrderedLeagues}
        />
      ) : (
        <FinishedMatchesPage
          groupedMatches={groupedFinished}
          bets={bets}
          successfulPicks={finishedHeaderStats.won}
          totalPicks={finishedHeaderStats.totalPicks}
          earnings={finishedHeaderStats.net}
          onViewStats={setSelectedMatchForStats}
          onPlayGame={onPlayGame}
          orderedLeagues={effectiveOrderedLeagues}
          onOpenHistory={() => setIsHistoryOpen(true)}
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

      {isHistoryOpen && (
        <BetHistoryPage
          bets={bets}
          onClose={() => setIsHistoryOpen(false)}
          onViewStats={setSelectedMatchForStats}
        />
      )}
    </div>
    </PullToRefresh>
  );
};

export default MatchesPage;
