import React from 'react';
import { Coins, Gem } from 'lucide-react';

interface CoinsShopCardProps {
  name: string;
  coins: number;
  price: number;
  bonus: number;
  isBestValue?: boolean;
  onClick: () => void;
}

export const CoinsShopCard: React.FC<CoinsShopCardProps> = ({ name, coins, price, bonus, isBestValue, onClick }) => {
  return (
    <div className={`card-base p-4 flex flex-col justify-between text-center relative overflow-hidden transition-all duration-300 ${isBestValue ? 'border-warm-yellow' : 'hover:border-electric-blue/50'}`}>
      {isBestValue && (
        <div className="absolute top-0 right-0 bg-warm-yellow text-deep-navy text-xs font-bold px-4 py-1 rounded-bl-lg flex items-center gap-1">
          <Gem size={12} /> Best Value
        </div>
      )}
      <div className="space-y-2 my-4">
        <h3 className="text-lg font-bold text-text-primary">{name}</h3>
        <div className="flex items-center justify-center gap-2">
          <Coins size={24} className="text-warm-yellow" />
          <p className="text-4xl font-bold text-warm-yellow">{coins.toLocaleString()}</p>
        </div>
        {bonus > 0 && <p className="text-sm font-semibold text-lime-glow">+{bonus}% Bonus</p>}
      </div>
      <button onClick={onClick} className="w-full primary-button">
        Buy for {price.toFixed(2)} €
      </button>
    </div>
  );
};
