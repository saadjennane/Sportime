import React from 'react';
import { FantasyPlayer } from '../../types';
import { CategoryIcon } from './CategoryIcon';
import { PositionIcon } from './PositionIcon';
import { FatigueBar } from './FatigueBar';

interface PlayerCarouselCardProps {
  player: FantasyPlayer;
}

export const PlayerCarouselCard: React.FC<PlayerCarouselCardProps> = ({ player }) => {
  return (
    <div className="flex-shrink-0 w-36 bg-white rounded-2xl shadow-md p-3 space-y-2 snap-center">
      <div className="relative">
        <img src={player.photo} alt={player.name} className="w-20 h-20 rounded-full mx-auto object-cover bg-gray-200 border-2 border-white shadow-sm" />
        <img src={player.teamLogo} alt={player.teamName} className="absolute bottom-0 right-3 w-7 h-7 bg-white rounded-full p-0.5 shadow" />
      </div>
      <div className="text-center">
        <p className="text-sm font-bold truncate">{player.name}</p>
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <div className="flex items-center gap-1">
                <PositionIcon position={player.position} size={12} />
                <CategoryIcon category={player.status} size={12} />
            </div>
            <span className="font-semibold">{player.pgs.toFixed(1)}</span>
        </div>
      </div>
      <FatigueBar fatigue={player.fatigue} />
    </div>
  );
};
