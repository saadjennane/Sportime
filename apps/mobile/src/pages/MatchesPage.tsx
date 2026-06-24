import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Match, Bet } from '../types';
import UpcomingPage from './Upcoming';
import { FinishedDigest } from '../components/matches/FinishedDigest';
import PicksPage from './PicksPage';
import { EmptyState } from '../components/EmptyState';
import { format, isToday, isYesterday } from 'date-fns';
import { useUserPicks } from '../features/matches/useUserPicks';
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
  onViewResults?: (fixtureId: string, matchName: string) => void;
  onBrowseGames?: () => void;
  /** Opens the full pick history (hosted at App level so Profile can open it too). */
  onOpenHistory: () => void;
  /** Deep-link requested sub-tab (today/picks/finished) — applied then cleared. */
  requestedTab?: 'today' | 'picks' | 'finished' | null;
  onTabConsumed?: () => void;
}

const MatchesPage: React.FC<MatchesPageProps> = ({ matches, bets, onBet, onPlayGame, onViewResults, onBrowseGames, onOpenHistory, requestedTab, onTabConsumed }) => {
  const [activeTab, setActiveTab] = useState<Tab>('today');

  // Apply a deep-link requested tab (from a notification), then clear it.
  useEffect(() => {
    if (requestedTab) { setActiveTab(requestedTab); onTabConsumed?.(); }
  }, [requestedTab, onTabConsumed]);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedMatchForStats, setSelectedMatchForStats] = useState<Match | null>(null);

  // Fixture ids the user has already picked — passed to the hook so the day-count
  // badges exclude them (picked matches leave Today/Tomorrow for the Picks tab).
  const pickedIdList = useMemo(() => Array.from(new Set(bets.map(b => b.matchId))), [bets]);

  const { data: groups, isLoading: loading, error, refresh, day, setDay, dayCounts } = useMatchesOfTheDay(pickedIdList);
  const { leagues: importedLeagues, isLoading: leaguesLoading, error: leaguesError } = useImportedLeagues();

  // Picks tab badge = active (unsettled) picks only — settled ones live in Finished.
  const activePicksCount = useMemo(() => bets.filter(b => b.status === 'pending').length, [bets]);

  // Picks (with match dates) — owned here so the Finished badge and the Finished tab
  // share one fetch. Finished now shows Today + Yesterday, so the badge is scoped to those.
  const { picks: userPicks, isLoading: picksLoading } = useUserPicks(bets);
  const recentSettledBets = useMemo(() => {
    const recent = (t: string) => { const d = new Date(t); return Number.isFinite(d.getTime()) && (isToday(d) || isYesterday(d)); };
    return userPicks
      .filter(p => (p.bet.status === 'won' || p.bet.status === 'lost') && recent(p.match.kickoffTime))
      .map(p => p.bet);
  }, [userPicks]);

  // Unread badge = settled results from Today/Yesterday the user hasn't seen; cleared on opening Finished.
  const { unreadCount, markAllSeen } = useUnreadSettled(recentSettledBets);
  useEffect(() => {
    if (activeTab === 'finished') markAllSeen();
  }, [activeTab, markAllSeen]);

  // The Today/Tomorrow switcher only belongs to the Matches tab. Reset to Today when
  // leaving it so Finished (and its header stats) always reflect *today*, never the
  // day left selected on Tomorrow — otherwise Finished would render empty/garbage.
  useEffect(() => {
    if (activeTab !== 'today') setDay('today');
  }, [activeTab, setDay]);


  const toLegacyMatch = useCallback((m: UiMatch): Match => {
    const fallbackEmoji = (name: string) => (name ? name.charAt(0).toUpperCase() : '⚽');
    const leagueLogo = m.league.logo ?? (m.league.apiId ? `https://media.api-sports.io/football/leagues/${m.league.apiId}.png` : null);
    const goalsHome = m.home.goals ?? null;
    const goalsAway = m.away.goals ?? null;
    // The 1X2 odds settle on the REGULAR-TIME (90') result. A match that went to extra
    // time or penalties (AET/PEN) was level at 90' by definition, so it settles as a
    // Draw — NOT by the extra-time goals (which would wrongly show a winner). Void /
    // technical statuses (CANC/ABD/WO/AWD) leave result undefined (bet refunded).
    let result: 'teamA' | 'draw' | 'teamB' | undefined;
    if (m.status === 'played') {
      if (m.rawStatus === 'AET' || m.rawStatus === 'PEN') {
        result = 'draw';
      } else if (m.rawStatus === 'FT' && goalsHome !== null && goalsAway !== null) {
        if (goalsHome > goalsAway) result = 'teamA';
        else if (goalsHome < goalsAway) result = 'teamB';
        else result = 'draw';
      }
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

  // Day badges must match the LIST (which drops picked → Picks and finished → Finished).
  // For the day currently loaded we use the exact visible count (updates instantly on a
  // pick); the other day uses the server count, which the hook also filters the same way.
  const visibleDayCount = useMemo(() => Object.values(groupedToday).flat().length, [groupedToday]);
  const badgeToday = day === 'today' ? visibleDayCount : dayCounts.today;
  const badgeTomorrow = day === 'tomorrow' ? visibleDayCount : dayCounts.tomorrow;

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
            Matches
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
        <>
        {/* Day switcher: Today (J) / Tomorrow (J+1) */}
        <div className="flex bg-navy-accent rounded-xl p-1 mb-3">
          <button onClick={() => setDay('today')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${day === 'today' ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}>
            Today{badgeToday > 0 && <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${day === 'today' ? 'bg-white/20' : 'bg-electric-blue/20 text-electric-blue'}`}>{badgeToday}</span>}
          </button>
          <button onClick={() => setDay('tomorrow')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${day === 'tomorrow' ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}>
            Tomorrow{badgeTomorrow > 0 && <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${day === 'tomorrow' ? 'bg-white/20' : 'bg-electric-blue/20 text-electric-blue'}`}>{badgeTomorrow}</span>}
          </button>
        </div>
        {loading ? (
          <div className="card-base p-6 text-center text-text-secondary text-sm">Loading today's matches…</div>
        ) : error ? (
          <div className="card-base p-6 text-center text-hot-red text-sm">Failed to load matches: {error}</div>
        ) : Object.keys(groupedToday).length === 0 ? (
          Object.keys(groupedUpcoming).length === 0 ? (
            <EmptyState
              glyph="⚽"
              title={day === 'tomorrow' ? 'No matches tomorrow' : 'No kickoff today'}
              subtitle={day === 'tomorrow' ? 'Nothing scheduled for tomorrow yet — check back later.' : 'Nothing on the pitch right now. Switch to Tomorrow or browse challenges.'}
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
        )}
        </>
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
        <FinishedDigest
          picks={userPicks}
          isLoading={picksLoading}
          onViewStats={setSelectedMatchForStats}
          onViewResults={onViewResults}
          onOpenHistory={onOpenHistory}
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
    </PullToRefresh>
  );
};

export default MatchesPage;
