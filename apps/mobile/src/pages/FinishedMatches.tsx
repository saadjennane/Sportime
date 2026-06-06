import React, { useRef, useEffect, useMemo, useState } from 'react';
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
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [pickedOnly, setPickedOnly] = useState(false);

  const { matches, isLoading, hasMore, loadMore } = useFinishedMatches(
    userId,
    bets
  );

  const pickedMatchIds = useMemo(() => new Set(bets.map((b) => b.matchId)), [bets]);

  // All finished matches, or only the ones the user picked when the toggle is on.
  const displayedMatches = useMemo(
    () => (pickedOnly ? matches.filter((m) => pickedMatchIds.has(m.id)) : matches),
    [matches, pickedOnly, pickedMatchIds],
  );

  // Group matches by league
  const groupedMatches = useMemo(() => {
    const grouped: Record<string, Match[]> = {};
    displayedMatches.forEach((match) => {
      const leagueName = match.leagueName || 'Unknown League';
      if (!grouped[leagueName]) {
        grouped[leagueName] = [];
      }
      grouped[leagueName].push(match);
    });
    return grouped;
  }, [displayedMatches]);


  // Sort leagues according to user's order
  const sortedLeagueNames = useMemo(() => {
    const leaguesInMatches = Object.keys(groupedMatches);
    const ordered = orderedLeagues.filter((league) => leaguesInMatches.includes(league));
    const unordered = leaguesInMatches.filter((league) => !orderedLeagues.includes(league));
    return [...ordered, ...unordered];
  }, [groupedMatches, orderedLeagues]);

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

  const hasMatches = displayedMatches.length > 0;
  const showEmptyState = !isLoading && !hasMatches;

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
    <div className="space-y-4">
      {/* Header with stats */}
      <DailySummaryHeader
        picksCount={headerStats.successfulPicks}
        totalMatches={headerStats.totalBets}
        potentialWinnings={headerStats.totalWinnings}
        isPlayedTab={true}
      />

      {/* Picked Games Only toggle */}
      <button
        type="button"
        onClick={() => setPickedOnly((v) => !v)}
        className="w-full flex items-center justify-between bg-navy-accent rounded-xl px-4 py-2.5"
      >
        <span className="text-sm font-semibold text-text-primary">Picked Games Only</span>
        <span
          className={`relative w-11 h-6 rounded-full transition-colors ${
            pickedOnly ? 'bg-electric-blue' : 'bg-deep-navy border border-disabled'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              pickedOnly ? 'translate-x-5' : ''
            }`}
          />
        </span>
      </button>

      {isLoading && matches.length === 0 && (
        <div className="text-center text-sm text-text-disabled">Loading finished matches…</div>
      )}

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

      {/* Infinite-scroll sentinel */}
      <div ref={sentinelRef} className="h-px" />

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
