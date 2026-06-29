import React from 'react';
import { Info, Gift, Trophy } from 'lucide-react';

interface GameHeaderProps {
  title: string;
  icon?: React.ReactNode;
  onRules?: () => void;
  onRewards?: () => void;
  onLeaderboard?: () => void;
  rank?: number | null;   // the user's current rank (shown on the leaderboard button)
  points?: number | null; // the user's current points
}

/** Unified game header: title + Rules / Rewards / Leaderboard actions.
 *  The leaderboard button surfaces the player's rank & points at a glance. */
export const GameHeader: React.FC<GameHeaderProps> = ({ title, icon, onRules, onRewards, onLeaderboard, rank, points }) => (
  <div className="card-base p-3 flex items-center justify-between gap-2">
    <div className="flex items-center gap-2 font-bold text-text-primary min-w-0">
      {icon}<span className="truncate">{title}</span>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      {onRules && <button onClick={onRules} className="p-2 rounded-lg bg-electric-blue/10 text-electric-blue" aria-label="Rules"><Info size={16} /></button>}
      {onRewards && <button onClick={onRewards} className="p-2 rounded-lg bg-warm-yellow/15 text-warm-yellow" aria-label="Rewards"><Gift size={16} /></button>}
      {onLeaderboard && (
        <button onClick={onLeaderboard} className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-navy-accent text-text-secondary" aria-label="Leaderboard">
          <Trophy size={16} className="text-warm-yellow" />
          {(rank != null || points != null) && (
            <span className="text-xs font-bold text-text-primary">
              {rank != null ? `#${rank}` : ''}{rank != null && points != null ? ' · ' : ''}{points != null ? `${points.toLocaleString()}` : ''}
            </span>
          )}
        </button>
      )}
    </div>
  </div>
);

export default GameHeader;
