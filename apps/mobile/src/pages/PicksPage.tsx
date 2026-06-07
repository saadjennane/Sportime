import React, { useRef, useEffect, useMemo } from 'react';
import { Match, Bet } from '../types';
import { PickCard } from '../components/matches/PickCard';
import { LeagueMatchGroup } from '../components/matches/LeagueMatchGroup';
import { useUserPicks } from '../features/matches/useUserPicks';
import { Loader } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

interface PicksPageProps {
  bets: Bet[];
  onViewStats: (match: Match) => void;
  onBet: (match: Match, prediction: 'teamA' | 'draw' | 'teamB', odds: number) => void;
  onPlayGame?: (matchId: string, matchName: string) => void;
  onGoToToday?: () => void;
  orderedLeagues: string[];
}

const PicksPage: React.FC<PicksPageProps> = ({
  bets,
  onViewStats,
  onBet,
  onPlayGame,
  onGoToToday,
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

  return (
    <div className="space-y-4">
      {isLoading && picks.length === 0 && (
        <div className="text-center text-sm text-text-disabled">Loading your picks…</div>
      )}

      {/* Empty State */}
      {showEmptyState && (
        <EmptyState
          glyph="🎯"
          title="No active picks"
          subtitle="Call a winner on today's matches and they'll show up here."
          cta={onGoToToday ? { label: '⚡ Go to Today', onClick: onGoToToday } : undefined}
        />
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
