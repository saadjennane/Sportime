import React from 'react';
import { Target, Coins, CheckCircle2, CircleDollarSign, History } from 'lucide-react';

interface DailySummaryHeaderProps {
  picksCount: number;
  totalMatches: number;
  potentialWinnings: number;
  isPlayedTab?: boolean;
  totalBets?: number; // Total coins bet (for Today tab)
  /** When provided, shows a history icon that opens the full bet history. */
  onOpenHistory?: () => void;
}

export const DailySummaryHeader: React.FC<DailySummaryHeaderProps> = ({
  picksCount,
  totalMatches,
  potentialWinnings,
  isPlayedTab = false,
  totalBets = 0,
  onOpenHistory,
}) => {
  // Today tab has 3 columns, Finished tab has 2 columns
  const gridCols = isPlayedTab ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="flex items-stretch gap-2">
    <div className={`grid ${gridCols} gap-2 text-xs flex-1`}>
      <div className="bg-navy-accent p-2 rounded-lg flex items-center gap-2">
        {isPlayedTab ? (
          <CheckCircle2 size={24} className="text-lime-glow" />
        ) : (
          <Target size={24} className="text-electric-blue" />
        )}
        <div>
          <p className="font-bold text-text-primary">
            {isPlayedTab ? 'Successful Picks' : 'Your Picks'}
          </p>
          <p className="text-text-secondary">{picksCount} / {totalMatches}</p>
        </div>
      </div>

      {/* Bets column - only for Today tab */}
      {!isPlayedTab && (
        <div className="bg-navy-accent p-2 rounded-lg flex items-center gap-2">
          <CircleDollarSign size={24} className="text-electric-blue" />
          <div>
            <p className="font-bold text-text-primary">Bets</p>
            <p className="text-text-secondary">{totalBets.toLocaleString()} coins</p>
          </div>
        </div>
      )}

      <div className="bg-navy-accent p-2 rounded-lg flex items-center gap-2">
        <Coins size={24} className="text-warm-yellow" />
        <div>
          <p className="font-bold text-text-primary">
            {isPlayedTab ? 'Results' : 'Potential Win'}
          </p>
          {isPlayedTab ? (
            <p className={potentialWinnings >= 0 ? 'text-lime-glow' : 'text-hot-red'}>
              {potentialWinnings > 0 ? '+' : ''}
              {potentialWinnings.toLocaleString()} coins
            </p>
          ) : (
            <p className="text-text-secondary">{potentialWinnings.toLocaleString()} coins</p>
          )}
        </div>
      </div>
    </div>

    {onOpenHistory && (
      <button
        type="button"
        onClick={onOpenHistory}
        aria-label="Bet history"
        className="flex-shrink-0 bg-navy-accent rounded-lg px-3 flex items-center justify-center text-text-secondary hover:text-electric-blue transition-colors"
      >
        <History size={20} />
      </button>
    )}
    </div>
  );
};
