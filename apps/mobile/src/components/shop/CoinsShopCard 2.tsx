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
    <div className={`card-base p-3 flex flex-col justify-between text-center relative overflow-hidden transition-all duration-300 ${isBestValue ? 'border-warm-yellow' : 'hover:border-electric-blue/50'}`}>
      {isBestValue && (
        <div className="absolute top-0 right-0 bg-warm-yellow text-deep-navy text-[10px] font-bold px-2 py-0.5 rounded-bl-lg flex items-center gap-1">
          <Gem size={10} /> Best Value
        </div>
      )}
      <div className="space-y-1 my-2">
        <h3 className="text-md font-bold text-text-primary">{name}</h3>
        <div className="flex items-center justify-center gap-2">
          <Coins size={20} className="text-warm-yellow" />
          <p className="text-3xl font-bold text-warm-yellow">{coins.toLocaleString()}</p>
        </div>
        {bonus > 0 && <p className="text-xs font-semibold text-lime-glow">+{bonus}% Bonus</p>}
      </div>
      <button onClick={onClick} className="w-full primary-button py-2 text-sm">
        Buy for {price.toFixed(2)} €
      </button>
    </div>
  );
};
