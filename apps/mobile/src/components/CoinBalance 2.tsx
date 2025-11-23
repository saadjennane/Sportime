import React from 'react';
import { Coins } from 'lucide-react';

interface CoinBalanceProps {
  balance: number;
}

export const CoinBalance: React.FC<CoinBalanceProps> = ({ balance }) => {
  return (
    <div className="bg-gradient-to-r from-amber-400 to-yellow-500 rounded-2xl p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-6 h-6 text-white" />
          <span className="text-white font-semibold text-sm">Your Balance</span>
        </div>
        <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl">
          <span className="text-white font-bold text-xl">{balance.toLocaleString()}</span>
          <span className="text-white/90 text-sm ml-1">coins</span>
        </div>
      </div>
    </div>
  );
};
