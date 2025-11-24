import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Match, Bet } from '../types';
import { MatchCard } from '../components/MatchCard';
import { LeagueMatchGroup } from '../components/matches/LeagueMatchGroup';
import { FinishedMatchesFilterPanel, FinishedMatchesFilters } from '../components/filters/FinishedMatchesFilterPanel';
import { useFinishedMatches } from '../features/matches/useFinishedMatches';
import { Loader } from 'lucide-react';

interface FinishedMatchesPageProps {
  userId?: string;
  bets: Bet[];
  onViewStats: (match: Match) => void;
  orderedLeagues: string[];
}

const FinishedMatchesPage: React.FC<FinishedMatchesPageProps> = ({
  userId,
  bets,
  onViewStats,
  orderedLeagues,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<FinishedMatchesFilters>({
    leagueIds: [],
    statuses: [],
    myBetsOnly: false,
  });

  const { matches, isLoading, hasMore, loadMore, daysLoaded } = useFinishedMatches(
    userId,
    bets,
    filters
  );

  // Group matches by league
  const groupedMatches = useMemo(() => {
    const grouped: Record<string, Match[]> = {};
    matches.forEach((match) => {
      const leagueName = match.league?.name || 'Unknown League';
      if (!grouped[leagueName]) {
        grouped[leagueName] = [];
      }
      grouped[leagueName].push(match);
    });
    return grouped;
  }, [matches]);

  // Get available leagues for filter
  const availableLeagues = useMemo(() => {
    const uniqueLeagues = new Map<string, string>();
    matches.forEach((match) => {
      if (match.league) {
        uniqueLeagues.set(match.league.id, match.league.name);
      }
    });
    return Array.from(uniqueLeagues.entries()).map(([id, name]) => ({ id, name }));
  }, [matches]);

  // Sort leagues according to user's order
  const sortedLeagueNames = useMemo(() => {
    const leaguesInMatches = Object.keys(groupedMatches);
    const ordered = orderedLeagues.filter((league) => leaguesInMatches.includes(league));
    const unordered = leaguesInMatches.filter((league) => !orderedLeagues.includes(league));
    return [...ordered, ...unordered];
  }, [groupedMatches, orderedLeagues]);

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

  const hasMatches = matches.length > 0;
  const showEmptyState = !isLoading && !hasMatches;

  const formatDaysLoaded = (days: number) => {
    if (days === 2) return 'last 2 days';
    return `last ${days} days`;
  };

  return (
    <div ref={scrollContainerRef} className="space-y-4 max-h-screen overflow-y-auto">
      {/* Filter Panel */}
      <FinishedMatchesFilterPanel
        filters={filters}
        onFilterChange={setFilters}
        availableLeagues={availableLeagues}
      />

      {/* Info Banner */}
      <div className="text-center text-sm text-text-disabled">
        {isLoading && matches.length === 0 ? (
          <span>Loading finished matches...</span>
        ) : hasMatches ? (
          <span>Showing matches from the {formatDaysLoaded(daysLoaded)}</span>
        ) : null}
      </div>

      {/* Empty State */}
      {showEmptyState && (
        <div className="card-base p-8 text-center">
          <div className="text-6xl mb-4">🏆</div>
          {filters.myBetsOnly ? (
            <>
              <p className="text-text-secondary font-medium">No bets placed yet</p>
              <p className="text-sm text-text-disabled mt-2">
                Start betting on upcoming matches to see them here!
              </p>
            </>
          ) : (
            <>
              <p className="text-text-secondary font-medium">No finished matches found</p>
              <p className="text-sm text-text-disabled mt-2">
                Try adjusting your filters or check back later
              </p>
            </>
          )}
        </div>
      )}

      {/* Matches Grouped by League */}
      {hasMatches &&
        sortedLeagueNames.map((leagueName, index) => {
          const matchesForLeague = groupedMatches[leagueName] || [];
          if (matchesForLeague.length === 0) return null;

          return (
            <LeagueMatchGroup
              key={leagueName}
              leagueName={leagueName}
              leagueLogo={matchesForLeague[0].league?.logo}
              matchesCount={matchesForLeague.length}
              initialOpen={index < 5}
            >
              {matchesForLeague.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  onViewStats={() => onViewStats(match)}
                  userBet={bets.find((bet) => bet.matchId === match.id)}
                />
              ))}
            </LeagueMatchGroup>
          );
        })}

      {/* Loading More Indicator */}
      {isLoading && matches.length > 0 && (
        <div className="flex items-center justify-center gap-2 py-4 text-text-disabled">
          <Loader className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading older matches...</span>
        </div>
      )}

      {/* End of List */}
      {!isLoading && !hasMore && hasMatches && (
        <div className="text-center text-sm text-text-disabled py-4">
          <span>That's all the finished matches we have!</span>
        </div>
      )}
    </div>
  );
};

export default FinishedMatchesPage;
