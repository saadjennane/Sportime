import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Match, Bet } from '../types';
import { FinishedCard } from '../components/matches/FinishedCard';
import { LeagueMatchGroup } from '../components/matches/LeagueMatchGroup';
import { DailySummaryHeader } from '../components/matches/DailySummaryHeader';
import { useFinishedMatches } from '../features/matches/useFinishedMatches';
import { useUserPicks } from '../features/matches/useUserPicks';
import { Loader } from 'lucide-react';

interface FinishedMatchesPageProps {
  userId?: string;
  bets: Bet[];
  onViewStats: (match: Match) => void;
  orderedLeagues: string[];
}

interface FinishedItem {
  match: Match;
  bet?: Bet;
}

const FinishedMatchesPage: React.FC<FinishedMatchesPageProps> = ({
  userId,
  bets,
  onViewStats,
  orderedLeagues,
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [pickedOnly, setPickedOnly] = useState(false);

  // OFF: all finished matches in a rolling date window (paginated).
  const { matches, isLoading, hasMore, loadMore } = useFinishedMatches(userId, bets);
  // ON (Option B): ALL the user's settled picks, regardless of date.
  const { picks, isLoading: picksLoading } = useUserPicks(bets);

  const betByMatchId = useMemo(() => {
    const m = new Map<string, Bet>();
    bets.forEach((b) => m.set(b.matchId, b));
    return m;
  }, [bets]);

  const items: FinishedItem[] = useMemo(() => {
    if (pickedOnly) {
      return picks
        .filter((p) => p.match.status === 'played')
        .map((p) => ({ match: p.match, bet: p.bet }));
    }
    return matches.map((m) => ({ match: m, bet: betByMatchId.get(m.id) }));
  }, [pickedOnly, picks, matches, betByMatchId]);

  // Group by league
  const groupedItems = useMemo(() => {
    const grouped: Record<string, FinishedItem[]> = {};
    items.forEach((it) => {
      const league = it.match.leagueName || 'Unknown League';
      (grouped[league] ||= []).push(it);
    });
    return grouped;
  }, [items]);

  const sortedLeagueNames = useMemo(() => {
    const leaguesInMatches = Object.keys(groupedItems);
    const ordered = orderedLeagues.filter((l) => leaguesInMatches.includes(l));
    const unordered = leaguesInMatches.filter((l) => !orderedLeagues.includes(l));
    return [...ordered, ...unordered];
  }, [groupedItems, orderedLeagues]);

  // Infinite scroll only for the full (date-windowed) list.
  useEffect(() => {
    if (pickedOnly) return;
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
  }, [pickedOnly, hasMore, isLoading, loadMore]);

  const loading = pickedOnly ? picksLoading : isLoading;
  const hasItems = items.length > 0;
  const showEmptyState = !loading && !hasItems;

  // Header stats from ALL settled picks (won + winnings).
  const headerStats = useMemo(() => {
    const settled = picks.filter((p) => p.match.status === 'played');
    const successfulPicks = settled.filter((p) => p.bet.status === 'won').length;
    const totalWinnings = settled.reduce(
      (t, p) => (p.bet.status === 'won' && p.bet.winAmount ? t + p.bet.winAmount : t),
      0,
    );
    return { successfulPicks, totalBets: settled.length, totalWinnings };
  }, [picks]);

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

      {loading && !hasItems && (
        <div className="text-center text-sm text-text-disabled">Loading finished matches…</div>
      )}

      {/* Empty State */}
      {showEmptyState && (
        <div className="card-base p-8 text-center">
          <div className="text-6xl mb-4">🏆</div>
          <p className="text-text-secondary font-medium">
            {pickedOnly ? 'No settled picks yet' : 'No finished matches found'}
          </p>
          <p className="text-sm text-text-disabled mt-2">
            {pickedOnly ? 'Your settled bets will appear here.' : 'Check back later for recent results'}
          </p>
        </div>
      )}

      {/* Matches grouped by league */}
      {hasItems &&
        sortedLeagueNames.map((leagueName, index) => {
          const itemsForLeague = groupedItems[leagueName] || [];
          if (itemsForLeague.length === 0) return null;

          return (
            <LeagueMatchGroup
              key={leagueName}
              leagueName={leagueName}
              leagueLogo={itemsForLeague[0].match.leagueLogo}
              matchesCount={itemsForLeague.length}
              initialOpen={index < 5}
            >
              {itemsForLeague.map(({ match, bet }) => (
                <FinishedCard
                  key={match.id}
                  match={match}
                  bet={bet}
                  onViewStats={() => onViewStats(match)}
                />
              ))}
            </LeagueMatchGroup>
          );
        })}

      {/* Infinite-scroll sentinel (full list only) */}
      {!pickedOnly && <div ref={sentinelRef} className="h-px" />}

      {/* Loading More Indicator */}
      {!pickedOnly && isLoading && matches.length > 0 && (
        <div className="flex items-center justify-center gap-2 py-4 text-text-disabled">
          <Loader className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading older matches...</span>
        </div>
      )}

      {/* End of List */}
      {!pickedOnly && !isLoading && !hasMore && hasItems && (
        <div className="text-center text-sm text-text-disabled py-4">
          <span>That's all the finished matches we have!</span>
        </div>
      )}
      {pickedOnly && hasItems && (
        <div className="text-center text-sm text-text-disabled py-4">
          <span>That's all your settled picks.</span>
        </div>
      )}
    </div>
  );
};

export default FinishedMatchesPage;
