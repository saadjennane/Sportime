import React, { useMemo } from 'react';
import { Match, Bet } from '../types';
import { useUserPicks } from '../features/matches/useUserPicks';
import { PickCard } from '../components/matches/PickCard';
import { FinishedCard } from '../components/matches/FinishedCard';
import { ArrowLeft, Loader } from 'lucide-react';

interface BetHistoryPageProps {
  bets: Bet[];
  onClose: () => void;
  onViewStats: (match: Match) => void;
}

/**
 * Full-screen history of every bet (all dates), most recent kick-off first.
 * Settled bets use the FinishedCard, active ones the PickCard (view-only).
 */
export const BetHistoryPage: React.FC<BetHistoryPageProps> = ({ bets, onClose, onViewStats }) => {
  const { picks, isLoading } = useUserPicks(bets);

  const sorted = useMemo(
    () =>
      [...picks].sort(
        (a, b) => new Date(b.match.kickoffTime).getTime() - new Date(a.match.kickoffTime).getTime(),
      ),
    [picks],
  );

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
        <h1 className="text-lg font-bold text-text-primary">Bet History</h1>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] space-y-3">
        {isLoading && picks.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-text-disabled">
            <Loader className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="card-base p-8 text-center">
            <div className="text-6xl mb-4">🧾</div>
            <p className="text-text-secondary font-medium">No bets yet</p>
            <p className="text-sm text-text-disabled mt-2">Your bets will appear here.</p>
          </div>
        ) : (
          sorted.map(({ match, bet }) =>
            match.status === 'played' ? (
              <FinishedCard
                key={`${match.id}-${bet.prediction}`}
                match={match}
                bet={bet}
                onViewStats={() => onViewStats(match)}
              />
            ) : (
              <PickCard
                key={`${match.id}-${bet.prediction}`}
                match={match}
                bet={bet}
                onViewStats={() => onViewStats(match)}
              />
            ),
          )
        )}
      </div>
    </div>
  );
};

export default BetHistoryPage;
