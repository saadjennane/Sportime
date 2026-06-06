import React, { useRef, useEffect, useMemo } from 'react';
import { Match, Bet } from '../types';
import { PickCard } from '../components/matches/PickCard';
import { LeagueMatchGroup } from '../components/matches/LeagueMatchGroup';
import { useUserPicks } from '../features/matches/useUserPicks';
import { Loader, Target, CircleDollarSign, Coins } from 'lucide-react';

interface PicksPageProps {
  bets: Bet[];
  onViewStats: (match: Match) => void;
  onBet: (match: Match, prediction: 'teamA' | 'draw' | 'teamB', odds: number) => void;
  onPlayGame?: (matchId: string, matchName: string) => void;
  orderedLeagues: string[];
}

const PicksPage: React.FC<PicksPageProps> = ({
  bets,
  onViewStats,
  onBet,
  onPlayGame,
  orderedLeagues,
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { picks, isLoading, hasMore, loadMore } = useUserPicks(bets);

  // Picks tab only shows picks whose match is still upcoming or ongoing.
  // Finished picked matches move to the Finished tab.
  const activePicks = useMemo(
    () => picks.filter((pick) => pick.match.status !== 'played'),
    [picks],
  );

  // Group picks by league
  const groupedPicks = useMemo(() => {
    const grouped: Record<string, { match: Match; bet: Bet }[]> = {};
    activePicks.forEach((pick) => {
      const leagueName = pick.match.leagueName || 'Unknown League';
      if (!grouped[leagueName]) {
        grouped[leagueName] = [];
      }
      grouped[leagueName].push({ match: pick.match, bet: pick.bet });
    });
    return grouped;
  }, [activePicks]);

  // Sort leagues according to user's order
  const sortedLeagueNames = useMemo(() => {
    const leaguesInPicks = Object.keys(groupedPicks);
    const ordered = orderedLeagues.filter((league) => leaguesInPicks.includes(league));
    const unordered = leaguesInPicks.filter((league) => !orderedLeagues.includes(league));
    return [...ordered, ...unordered];
  }, [groupedPicks, orderedLeagues]);

  // Infinite scroll via a sentinel — works with the app's single scroll region.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore]);

  const hasPicks = activePicks.length > 0;
  const showEmptyState = !isLoading && !hasPicks;

  // Stats relevant to ACTIVE picks (settled results live in Finished).
  const picksSummary = useMemo(() => {
    const staked = activePicks.reduce((t, p) => t + p.bet.amount, 0);
    const potential = activePicks.reduce(
      (t, p) => t + Math.ceil(p.bet.amount * (Number.isFinite(p.bet.odds) ? p.bet.odds : 0)),
      0,
    );
    return { count: activePicks.length, staked, potential };
  }, [activePicks]);

  return (
    <div className="space-y-4">
      {/* Stats Header - Active Picks | Staked | Potential Win */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-navy-accent p-2 rounded-lg flex items-center gap-2">
          <Target size={24} className="text-electric-blue" />
          <div>
            <p className="font-bold text-text-primary">Active Picks</p>
            <p className="text-text-secondary">{picksSummary.count}</p>
          </div>
        </div>
        <div className="bg-navy-accent p-2 rounded-lg flex items-center gap-2">
          <CircleDollarSign size={24} className="text-electric-blue" />
          <div>
            <p className="font-bold text-text-primary">Staked</p>
            <p className="text-text-secondary">{picksSummary.staked.toLocaleString()} coins</p>
          </div>
        </div>
        <div className="bg-navy-accent p-2 rounded-lg flex items-center gap-2">
          <Coins size={24} className="text-warm-yellow" />
          <div>
            <p className="font-bold text-text-primary">Potential Win</p>
            <p className="text-text-secondary">{picksSummary.potential.toLocaleString()} coins</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="text-center text-sm text-text-disabled">
        {isLoading && picks.length === 0 ? (
          <span>Loading your picks...</span>
        ) : hasPicks ? (
          <span>{activePicks.length} active {activePicks.length === 1 ? 'pick' : 'picks'}</span>
        ) : null}
      </div>

      {/* Empty State */}
      {showEmptyState && (
        <div className="card-base p-8 text-center">
          <div className="text-6xl mb-4">🎯</div>
          <p className="text-text-secondary font-medium">No picks yet</p>
          <p className="text-sm text-text-disabled mt-2">
            Start betting on matches to see your picks here!
          </p>
        </div>
      )}

      {/* Picks Grouped by League */}
      {hasPicks &&
        sortedLeagueNames.map((leagueName, index) => {
          const picksForLeague = groupedPicks[leagueName] || [];
          if (picksForLeague.length === 0) return null;

          return (
            <LeagueMatchGroup
              key={leagueName}
              leagueName={leagueName}
              leagueLogo={picksForLeague[0].match.leagueLogo}
              matchesCount={picksForLeague.length}
              initialOpen={index < 5}
            >
              {picksForLeague.map(({ match, bet }) => (
                <PickCard
                  key={`${match.id}-${bet.prediction}`}
                  match={match}
                  bet={bet}
                  onEdit={() => onBet(match, bet.prediction, bet.odds)}
                  onViewStats={() => onViewStats(match)}
                  onPlayGame={onPlayGame}
                />
              ))}
            </LeagueMatchGroup>
          );
        })}

      {/* Infinite-scroll sentinel */}
      <div ref={sentinelRef} className="h-px" />

      {/* Loading More Indicator */}
      {isLoading && picks.length > 0 && (
        <div className="flex items-center justify-center gap-2 py-4 text-text-disabled">
          <Loader className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading more picks...</span>
        </div>
      )}

      {/* End of List */}
      {!isLoading && !hasMore && hasPicks && (
        <div className="text-center text-sm text-text-disabled py-4">
          <span>That's all your picks!</span>
        </div>
      )}
    </div>
  );
};

export default PicksPage;
