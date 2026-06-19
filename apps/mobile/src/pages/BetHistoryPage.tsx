import React, { useMemo } from 'react';
import { Match, Bet } from '../types';
import { useUserPicks } from '../features/matches/useUserPicks';
import { PickCard } from '../components/matches/PickCard';
import { FinishedCard } from '../components/matches/FinishedCard';
import { ArrowLeft, Loader, CheckCircle2, Coins } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

interface BetHistoryPageProps {
  bets: Bet[];
  onClose: () => void;
  onViewStats: (match: Match) => void;
  onViewResults?: (fixtureId: string, matchName: string) => void;
}

interface DayGroup {
  key: string;
  items: { match: Match; bet: Bet }[];
  won: number;
  total: number;
  settled: number;
  net: number;
  time: number;
}

const dayLabel = (key: string) => {
  if (key === 'unknown') return 'Earlier';
  const d = new Date(key);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMM d');
};

/**
 * Full-screen pick history, grouped by match day (most recent first). Each day shows
 * its Successful Picks (won/total) and net Result. match.kickoffTime here is an ISO
 * date (set from fixture.date in useUserPicks), so it's safe to parse for grouping.
 */
export const BetHistoryPage: React.FC<BetHistoryPageProps> = ({ bets, onClose, onViewStats, onViewResults }) => {
  const { picks, isLoading } = useUserPicks(bets);

  const days: DayGroup[] = useMemo(() => {
    const map = new Map<string, { match: Match; bet: Bet }[]>();
    for (const p of picks) {
      const d = new Date(p.match.kickoffTime);
      const key = Number.isFinite(d.getTime()) ? d.toDateString() : 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    const groups: DayGroup[] = [];
    for (const [key, items] of map.entries()) {
      let won = 0, settled = 0, net = 0;
      for (const { bet } of items) {
        if (bet.status === 'won') { won++; settled++; net += (bet.winAmount ?? 0) - bet.amount; }
        else if (bet.status === 'lost') { settled++; net -= bet.amount; }
      }
      items.sort((a, b) => new Date(b.match.kickoffTime).getTime() - new Date(a.match.kickoffTime).getTime());
      groups.push({ key, items, won, total: items.length, settled, net, time: key === 'unknown' ? 0 : new Date(key).getTime() });
    }
    groups.sort((a, b) => b.time - a.time);
    return groups;
  }, [picks]);

  // Overall summary across every pick, plus the date of the earliest one ("since …").
  const overall = useMemo(() => {
    let won = 0, settled = 0, net = 0, since = Infinity;
    for (const { match, bet } of picks) {
      if (bet.status === 'won') { won++; settled++; net += (bet.winAmount ?? 0) - bet.amount; }
      else if (bet.status === 'lost') { settled++; net -= bet.amount; }
      const t = new Date(match.kickoffTime).getTime();
      if (Number.isFinite(t)) since = Math.min(since, t);
    }
    return { won, total: picks.length, settled, net, since: Number.isFinite(since) ? since : null };
  }, [picks]);

  return (
    <div className="fixed inset-0 z-[60] bg-deep-navy flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-white/10">
        <button
          onClick={onClose}
          aria-label="Back"
          className="p-2 -ml-2 text-text-secondary hover:text-electric-blue"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-text-primary">Pick History</h1>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] space-y-5">
        {isLoading && picks.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-text-disabled">
            <Loader className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : days.length === 0 ? (
          <div className="card-base p-8 text-center">
            <div className="text-6xl mb-4">🧾</div>
            <p className="text-text-secondary font-medium">No picks yet</p>
            <p className="text-sm text-text-disabled mt-2">Your picks will appear here.</p>
          </div>
        ) : (
          <>
            {/* Overall summary across every pick */}
            <div className="card-base p-3 border border-electric-blue/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-text-primary">Overall</span>
                {overall.since && (
                  <span className="text-[11px] text-text-disabled">since {format(new Date(overall.since), 'MMM d, yyyy')}</span>
                )}
              </div>
              <SummaryStats won={overall.won} total={overall.total} settled={overall.settled} net={overall.net} />
            </div>

            {days.map(day => (
              <div key={day.key} className="space-y-3">
                {/* Day separator with the day's Successful Picks + Result */}
                <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-deep-navy/95 backdrop-blur-sm">
                  <p className="text-sm font-bold text-text-primary mb-2">{dayLabel(day.key)}</p>
                  <SummaryStats won={day.won} total={day.total} settled={day.settled} net={day.net} />
                </div>

                {/* That day's picks */}
                <div className="space-y-3">
                  {day.items.map(({ match, bet }) =>
                    match.status === 'played' ? (
                      <FinishedCard
                        key={`${match.id}-${bet.prediction}`}
                        match={match}
                        bet={bet}
                        onViewStats={() => onViewStats(match)}
                        onViewResults={onViewResults}
                      />
                    ) : (
                      <PickCard
                        key={`${match.id}-${bet.prediction}`}
                        match={match}
                        bet={bet}
                        onViewStats={() => onViewStats(match)}
                      />
                    ),
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

// Two-tile summary (Successful Picks + Result) — shared by the Overall card and each day header.
const SummaryStats: React.FC<{ won: number; total: number; settled: number; net: number }> = ({ won, total, settled, net }) => (
  <div className="grid grid-cols-2 gap-2">
    <div className="bg-navy-accent rounded-lg p-2 flex items-center gap-2">
      <CheckCircle2 size={18} className="text-lime-glow flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-text-disabled leading-tight">Successful Picks</p>
        <p className="text-sm font-bold text-text-primary">{won}/{total}</p>
      </div>
    </div>
    <div className="bg-navy-accent rounded-lg p-2 flex items-center gap-2">
      <Coins size={18} className="text-warm-yellow flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-text-disabled leading-tight">Result</p>
        {settled === 0 ? (
          <p className="text-sm font-bold text-text-disabled">Pending</p>
        ) : (
          <p className={`text-sm font-bold ${net >= 0 ? 'text-lime-glow' : 'text-hot-red'}`}>
            {net >= 0 ? '+' : ''}{net.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  </div>
);

export default BetHistoryPage;
