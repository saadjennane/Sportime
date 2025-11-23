import React from 'react';
import { Gem } from 'lucide-react';

interface PremiumPromoCardProps {
  onClick: () => void;
}

export const PremiumPromoCard: React.FC<PremiumPromoCardProps> = ({ onClick }) => {
  return (
    <div className="card-base p-4 border-dashed border-warm-yellow/50 text-center space-y-3">
      <h3 className="text-lg font-bold text-warm-yellow flex items-center justify-center gap-2">
        <Gem size={20} /> Go Premium
      </h3>
      <p className="text-sm text-text-secondary">Get 5,000 coins, XP boost, and free entries every month.</p>
      <button onClick={onClick} className="font-semibold text-sm text-deep-navy bg-warm-yellow px-4 py-2 rounded-lg hover:opacity-90">
        See Premium Benefits
      </button>
    </div>
  );
};
