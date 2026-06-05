import React, { useRef, useEffect, useMemo } from 'react';
import { Match, Bet } from '../types';
import { MatchCard } from '../components/MatchCard';
import { LeagueMatchGroup } from '../components/matches/LeagueMatchGroup';
import { DailySummaryHeader } from '../components/matches/DailySummaryHeader';
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

  const { matches, isLoading, hasMore, loadMore, daysLoaded } = useFinishedMatches(
    userId,
    bets
  );

  // Group matches by league
  const groupedMatches = useMemo(() => {
    const grouped: Record<string, Match[]> = {};
    matches.forEach((match) => {
      const leagueName = match.leagueName || 'Unknown League';
      if (!grouped[leagueName]) {
        grouped[leagueName] = [];
      }
      grouped[leagueName].push(match);
    });
    return grouped;
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

  // Calculate header stats for finished matches
  const headerStats = useMemo(() => {
    // Get bets that have a corresponding finished match
    const finishedBets = bets.filter(bet =>
      matches.some(match => match.id === bet.matchId)
    );

    // Count successful picks (won bets)
    const successfulPicks = finishedBets.filter(bet => bet.status === 'won').length;

    // Calculate total winnings from won bets
    const totalWinnings = finishedBets.reduce((total, bet) => {
      if (bet.status === 'won' && bet.winAmount) {
        return total + bet.winAmount;
      }
      return total;
    }, 0);

    return {
      successfulPicks,
      totalBets: finishedBets.length,
      totalWinnings,
    };
  }, [bets, matches]);

  return (
    <div ref={scrollContainerRef} className="space-y-4 max-h-screen overflow-y-auto">
      {/* Header with stats */}
      <DailySummaryHeader
        picksCount={headerStats.successfulPicks}
        totalMatches={headerStats.totalBets}
        potentialWinnings={headerStats.totalWinnings}
        isPlayedTab={true}
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
          <p className="text-text-secondary font-medium">No finished matches found</p>
          <p className="text-sm text-text-disabled mt-2">
            Check back later for recent results
          </p>
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
              leagueLogo={matchesForLeague[0].leagueLogo}
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
