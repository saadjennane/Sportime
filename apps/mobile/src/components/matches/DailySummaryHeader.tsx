import React from 'react';
import { Target, Coins, CheckCircle2 } from 'lucide-react';

interface DailySummaryHeaderProps {
  picksCount: number;
  totalMatches: number;
  potentialWinnings: number;
  isPlayedTab?: boolean;
}

export const DailySummaryHeader: React.FC<DailySummaryHeaderProps> = ({
  picksCount,
  totalMatches,
  potentialWinnings,
  isPlayedTab = false
}) => {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
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
