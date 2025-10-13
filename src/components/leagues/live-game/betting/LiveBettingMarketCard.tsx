import React, { useState, useEffect } from 'react';
import { LiveGameMarket, LiveBet } from '../../../../types';
import { Timer, Coins, Check, CheckCircle } from 'lucide-react';

interface LiveBettingMarketCardProps {
  market: LiveGameMarket;
  onPlaceBet: (option: string, amount: number, odds: number) => void;
  playerBalance: number;
  placedBet?: LiveBet;
  phase: 'pre-match' | 'live';
}

export const LiveBettingMarketCard: React.FC<LiveBettingMarketCardProps> = ({ market, onPlaceBet, playerBalance, placedBet, phase }) => {
  const [amount, setAmount] = useState(100);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const expiry = new Date(market.expires_at).getTime();
    const updateTimer = () => {
      const now = new Date().getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [market.expires_at]);

  const quickAmounts = [100, 250, 500];

  if (placedBet) {
    return (
      <div className="card-base p-4 opacity-80">
        <p className="text-sm font-semibold text-text-secondary">{market.title}</p>
        <div className="flex items-center justify-center gap-3 text-center bg-deep-navy p-3 rounded-lg mt-2">
          <CheckCircle size={20} className="text-lime-glow" />
          <div>
            <p className="text-text-primary">You bet <b className="text-warm-yellow">{placedBet.amount} coins</b> on</p>
            <p className="font-bold text-electric-blue text-lg">{placedBet.option}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-base p-4 space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm font-semibold text-text-secondary">{market.title}</p>
        <div className="flex items-center gap-1 text-xs font-bold text-hot-red bg-hot-red/10 px-2 py-1 rounded-full">
          <Timer size={14} /> {timeLeft}s
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        {market.odds.map(({ option, adjusted }) => (
          <button
            key={option}
            onClick={() => onPlaceBet(option, amount, adjusted)}
            disabled={amount > playerBalance}
            className="p-3 rounded-lg text-center bg-deep-navy hover:bg-navy-accent disabled:opacity-50"
          >
            <p className="font-bold text-text-primary">{option}</p>
            <p className="text-sm font-semibold text-electric-blue">@{adjusted.toFixed(2)}</p>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-yellow" />
          <input
            type="range"
            min="50"
            max={playerBalance}
            step="50"
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            className="w-full h-2 bg-disabled rounded-lg appearance-none cursor-pointer accent-electric-blue"
          />
        </div>
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {quickAmounts.map(qa => (
              <button
                key={qa}
                onClick={() => setAmount(qa)}
                className="text-xs font-semibold bg-deep-navy px-3 py-1 rounded-md text-text-secondary hover:text-electric-blue"
              >
                {qa}
              </button>
            ))}
          </div>
          <span className="text-lg font-bold text-warm-yellow">{amount}</span>
        </div>
      </div>
    </div>
  );
};
