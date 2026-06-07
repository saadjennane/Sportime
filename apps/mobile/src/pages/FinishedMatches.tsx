import React, { useMemo, useState } from 'react';
import { Match, Bet } from '../types';
import { FinishedCard } from '../components/matches/FinishedCard';
import { LeagueMatchGroup } from '../components/matches/LeagueMatchGroup';
import { DailySummaryHeader } from '../components/matches/DailySummaryHeader';
import { EmptyState } from '../components/EmptyState';

interface FinishedMatchesPageProps {
  /** Today's finished matches, grouped by league. */
  groupedMatches: Record<string, Match[]>;
  bets: Bet[];
  /** Header stats over all of today's picks (computed by MatchesPage). */
  successfulPicks: number;
  totalPicks: number;
  earnings: number;
  onViewStats: (match: Match) => void;
  onPlayGame?: (matchId: string, matchName: string) => void;
  orderedLeagues: string[];
  /** Opens the full bet history (all dates). */
  onOpenHistory?: () => void;
}

const FinishedMatchesPage: React.FC<FinishedMatchesPageProps> = ({
  groupedMatches,
  bets,
  successfulPicks,
  totalPicks,
  earnings,
  onViewStats,
  onPlayGame,
  orderedLeagues,
  onOpenHistory,
}) => {
  const [pickedOnly, setPickedOnly] = useState(false);

  const betByMatchId = useMemo(() => {
    const m = new Map<string, Bet>();
    bets.forEach((b) => m.set(b.matchId, b));
    return m;
  }, [bets]);

  // Today's finished matches, optionally filtered to the ones the user picked.
  const displayedGrouped = useMemo(() => {
    const result: Record<string, Match[]> = {};
    for (const [league, ms] of Object.entries(groupedMatches)) {
      const filtered = pickedOnly ? ms.filter((m) => betByMatchId.has(m.id)) : ms;
      if (filtered.length) result[league] = filtered;
    }
    return result;
  }, [groupedMatches, pickedOnly, betByMatchId]);

  const sortedLeagueNames = useMemo(() => {
    const leaguesInMatches = Object.keys(displayedGrouped);
    const ordered = orderedLeagues.filter((l) => leaguesInMatches.includes(l));
    const unordered = leaguesInMatches.filter((l) => !orderedLeagues.includes(l));
    return [...ordered, ...unordered];
  }, [displayedGrouped, orderedLeagues]);

  const hasMatches = Object.keys(displayedGrouped).length > 0;

  return (
    <div className="space-y-4">
      {/* Header: Successful Picks (won / today's picks) + Earnings (net) + history */}
      <DailySummaryHeader
        picksCount={successfulPicks}
        totalMatches={totalPicks}
        potentialWinnings={earnings}
        isPlayedTab={true}
        onOpenHistory={onOpenHistory}
      />

      {/* Picked Games Only toggle — filters today's finished matches */}
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

      {!hasMatches ? (
        <EmptyState
          glyph="🏁"
          title={pickedOnly ? 'No picked games finished' : 'No results yet'}
          subtitle={
            pickedOnly
              ? "None of your picked games have finished today."
              : 'Finished matches and your settled bets will land here.'
          }
          cta={onOpenHistory ? { label: '🕘 View History', onClick: onOpenHistory } : undefined}
          secondaryCta
        />
      ) : (
        sortedLeagueNames.map((leagueName, index) => {
          const matchesForLeague = displayedGrouped[leagueName] || [];
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
                <FinishedCard
                  key={match.id}
                  match={match}
                  bet={betByMatchId.get(match.id)}
                  onViewStats={() => onViewStats(match)}
                  onPlayGame={onPlayGame}
                />
              ))}
            </LeagueMatchGroup>
          );
        })
      )}
    </div>
  );
};

export default FinishedMatchesPage;
