import React from 'react';
import { Target, Coins, CheckCircle2, CircleDollarSign } from 'lucide-react';

interface DailySummaryHeaderProps {
  picksCount: number;
  totalMatches: number;
  potentialWinnings: number;
  isPlayedTab?: boolean;
  totalBets?: number; // Total coins bet (for Today tab)
}

export const DailySummaryHeader: React.FC<DailySummaryHeaderProps> = ({
  picksCount,
  totalMatches,
  potentialWinnings,
  isPlayedTab = false,
  totalBets = 0
}) => {
  // Today tab has 3 columns, Finished tab has 2 columns
  const gridCols = isPlayedTab ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className={`grid ${gridCols} gap-2 text-xs`}>
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
            {isPlayedTab ? 'Winnings' : 'Potential Win'}
          </p>
          <p className="text-text-secondary">{potentialWinnings.toLocaleString()} coins</p>
        </div>
      </div>
    </div>
  );
};
