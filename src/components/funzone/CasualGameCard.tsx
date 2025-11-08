import React from 'react';
import { FunZoneGame } from '../../types';
import { Gamepad2 } from 'lucide-react';

interface CasualGameCardProps {
  game: FunZoneGame;
}

export const CasualGameCard: React.FC<CasualGameCardProps> = ({ game }) => {
  return (
    <div className="card-base p-4 space-y-3 opacity-70">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-bold text-text-primary">{game.name}</h4>
          <p className="text-sm text-text-secondary">{game.description}</p>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-warm-yellow/20 text-warm-yellow">
          Coming Soon
        </span>
      </div>
      <button disabled className="w-full primary-button py-2 text-sm flex items-center justify-center gap-2">
        <Gamepad2 size={16} /> Play
      </button>
    </div>
  );
};
