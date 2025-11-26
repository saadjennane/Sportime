import React, { useRef, useEffect, useMemo } from 'react';
import { Match, Bet } from '../types';
import { MatchCard } from '../components/MatchCard';
import { LeagueMatchGroup } from '../components/matches/LeagueMatchGroup';
import { useUserPicks } from '../features/matches/useUserPicks';
import { Loader, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface PicksPageProps {
  bets: Bet[];
  onViewStats: (match: Match) => void;
  orderedLeagues: string[];
}

const PicksPage: React.FC<PicksPageProps> = ({
  bets,
  onViewStats,
  orderedLeagues,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { picks, isLoading, hasMore, loadMore, stats, totalPicks } = useUserPicks(bets);

  // Group picks by league
  const groupedPicks = useMemo(() => {
    const grouped: Record<string, { match: Match; bet: Bet }[]> = {};
    picks.forEach((pick) => {
      const leagueName = pick.match.leagueName || 'Unknown League';
      if (!grouped[leagueName]) {
        grouped[leagueName] = [];
      }
      grouped[leagueName].push({ match: pick.match, bet: pick.bet });
    });
    return grouped;
  }, [picks]);

  // Sort leagues according to user's order
  const sortedLeagueNames = useMemo(() => {
    const leaguesInPicks = Object.keys(groupedPicks);
    const ordered = orderedLeagues.filter((league) => leaguesInPicks.includes(league));
    const unordered = leaguesInPicks.filter((league) => !orderedLeagues.includes(league));
    return [...ordered, ...unordered];
  }, [groupedPicks, orderedLeagues]);

  // Infinite scroll detection
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !hasMore || isLoading) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;

      if (isNearBottom) {
        loadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoading, loadMore]);

  const hasPicks = picks.length > 0;
  const showEmptyState = !isLoading && !hasPicks;

  return (
    <div ref={scrollContainerRef} className="space-y-4 max-h-screen overflow-y-auto">
      {/* Stats Header */}
      <div className="card-base p-4">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-text-secondary">
              <Clock size={14} />
              <span className="text-xs">Pending</span>
            </div>
            <span className="text-lg font-bold text-warm-yellow">{stats.pending}</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-text-secondary">
              <TrendingUp size={14} />
              <span className="text-xs">Won</span>
            </div>
            <span className="text-lg font-bold text-lime-glow">{stats.won}</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-text-secondary">
              <TrendingDown size={14} />
              <span className="text-xs">Lost</span>
            </div>
            <span className="text-lg font-bold text-hot-red">{stats.lost}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs text-text-secondary">Net</span>
            <span className={`text-lg font-bold ${stats.totalWinnings >= 0 ? 'text-lime-glow' : 'text-hot-red'}`}>
              {stats.totalWinnings >= 0 ? '+' : ''}{stats.totalWinnings}
            </span>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="text-center text-sm text-text-disabled">
        {isLoading && picks.length === 0 ? (
          <span>Loading your picks...</span>
        ) : hasPicks ? (
          <span>Showing {picks.length} of {totalPicks} picks</span>
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
                <MatchCard
                  key={`${match.id}-${bet.prediction}`}
                  match={match}
                  onViewStats={() => onViewStats(match)}
                  userBet={bet}
                />
              ))}
            </LeagueMatchGroup>
          );
        })}

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
