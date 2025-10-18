import React from 'react';
import { Calendar, Target, Coins } from 'lucide-react';

interface DailySummaryHeaderProps {
  date: string;
  picksCount: number;
  totalMatches: number;
  potentialWinnings: number;
}

export const DailySummaryHeader: React.FC<DailySummaryHeaderProps> = ({ date, picksCount, totalMatches, potentialWinnings }) => {
  return (
    <div className="sticky top-0 z-30 bg-deep-navy/80 backdrop-blur-md -mx-4 px-4 py-3 border-b border-disabled/50">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-text-primary">Matches of the Day</h1>
        <div className="flex items-center gap-1 text-sm font-semibold text-text-secondary">
          <Calendar size={16} />
          <span>{date}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-navy-accent p-2 rounded-lg flex items-center gap-2">
          <Target size={24} className="text-electric-blue" />
          <div>
            <p className="font-bold text-text-primary">Your Picks</p>
            <p className="text-text-secondary">{picksCount} / {totalMatches}</p>
          </div>
        </div>
        <div className="bg-navy-accent p-2 rounded-lg flex items-center gap-2">
          <Coins size={24} className="text-warm-yellow" />
          <div>
            <p className="font-bold text-text-primary">Potential Win</p>
            <p className="text-text-secondary">{potentialWinnings.toLocaleString()} coins</p>
          </div>
        </div>
      </div>
    </div>
  );
};
