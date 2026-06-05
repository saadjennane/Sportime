import React from 'react';
import { Gem } from 'lucide-react';

interface PremiumUnlockCardProps {
  onClick: () => void;
}

export const PremiumUnlockCard: React.FC<PremiumUnlockCardProps> = ({ onClick }) => {
  return (
    <div className="card-base p-4 flex items-center justify-between gap-4">
      <div>
        <h4 className="font-bold text-warm-yellow flex items-center gap-2"><Gem size={16} /> Unlock Premium</h4>
        <p className="text-xs text-text-secondary mt-1">Enjoy exclusive tournaments, double tickets, and faster XP gain.</p>
      </div>
      <button onClick={onClick} className="primary-button text-sm py-2 px-4 flex-shrink-0">
        Learn More
      </button>
    </div>
  );
};
