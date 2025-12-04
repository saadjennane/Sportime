import React from 'react';
import { LiveGamePlayerEntry } from '../../../../types';
import { Coins } from 'lucide-react';

interface LiveBettingPlayerStatusProps {
  playerEntry?: LiveGamePlayerEntry;
}

export const LiveBettingPlayerStatus: React.FC<LiveBettingPlayerStatusProps> = ({ playerEntry }) => {
  const preMatchBalance = playerEntry?.betting_state?.pre_match_balance ?? 1000;
  const liveBalance = playerEntry?.betting_state?.live_balance ?? 1000;
  const totalGain = playerEntry?.betting_state?.total_gain ?? 0;

  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="card-base p-2">
        <p className="text-xs font-semibold text-text-disabled">Pre-Match</p>
        <div className="flex items-center justify-center gap-1 font-bold text-text-primary">
          <Coins size={14} className="text-warm-yellow" /> {preMatchBalance}
        </div>
      </div>
      <div className="card-base p-2">
        <p className="text-xs font-semibold text-text-disabled">Live</p>
        <div className="flex items-center justify-center gap-1 font-bold text-text-primary">
          <Coins size={14} className="text-warm-yellow" /> {liveBalance}
        </div>
      </div>
      <div className="card-base p-2">
        <p className="text-xs font-semibold text-text-disabled">Total Gain</p>
        <p className={`font-bold ${totalGain >= 0 ? 'text-lime-glow' : 'text-hot-red'}`}>
          {totalGain >= 0 ? `+${totalGain}` : totalGain}
        </p>
      </div>
    </div>
  );
};
