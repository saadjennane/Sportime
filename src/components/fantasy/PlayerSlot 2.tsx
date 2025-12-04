import React from 'react';
import { FantasyPlayer } from '../../types';
import { Shirt } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { FatigueBar } from './FatigueBar';

interface PlayerSlotProps {
  player: FantasyPlayer | null;
  position: string;
  onClick: () => void;
  isSelectedForSwap: boolean;
}

export const PlayerSlot: React.FC<PlayerSlotProps> = ({ player, position, onClick, isSelectedForSwap }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full p-2 rounded-xl text-left transition-all duration-200 ${isSelectedForSwap ? 'bg-yellow-200 ring-2 ring-yellow-400' : 'bg-white/10 hover:bg-white/20'}`}
    >
      <div className="flex items-center gap-3">
        {player ? (
          <>
            <img src={player.photo} alt={player.name} className="w-12 h-12 rounded-full object-cover bg-gray-300" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white truncate text-sm">{player.name}</p>
              <div className="flex items-center gap-2 text-xs text-gray-200">
                <img src={player.teamLogo} alt={player.teamName} className="w-4 h-4" />
                <CategoryIcon category={player.status} />
                <span>PGS: {player.pgs.toFixed(1)}</span>
              </div>
              <div className="mt-1">
                <FatigueBar fatigue={player.fatigue} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 flex items-center justify-center bg-black/20 rounded-full">
              <Shirt className="text-white/50" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white/80">Select {position}</p>
            </div>
          </>
        )}
      </div>
    </button>
  );
};
