import React from 'react';
import { FantasyPlayer, PlayerLiveStatus } from '../../types';
import { Plus, ArrowUp } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { FatigueBar } from './FatigueBar';

interface PlayerCircleProps {
  player: FantasyPlayer | null;
  onClick: () => void;
  isCaptain: boolean;
  isSelectedForSwap: boolean;
  size?: 'normal' | 'small';
  isLive: boolean;
}

export const PlayerCircle: React.FC<PlayerCircleProps> = ({ player, onClick, isCaptain, isSelectedForSwap, size = 'normal', isLive }) => {
  const containerSize = size === 'normal' ? 'w-20' : 'w-16';
  const photoSize = size === 'normal' ? 'w-20 h-20' : 'w-16 h-16';
  const clubLogoSize = size === 'normal' ? 'w-6 h-6' : 'w-5 h-5';
  const statusIconSize = size === 'normal' ? 16 : 14;
  const captainSize = size === 'normal' ? 'w-5 h-5 text-[10px]' : 'w-4 h-4 text-[8px]';
  const pgsFontSize = size === 'normal' ? 'text-sm' : 'text-xs';

  if (!player) {
    return (
      <div className={`flex flex-col items-center gap-1 ${containerSize}`}>
        <button
          onClick={onClick}
          disabled={isLive}
          className={`${photoSize} flex items-center justify-center bg-black/20 rounded-full border-2 border-dashed border-white/30 hover:bg-black/30 transition-colors disabled:cursor-not-allowed`}
        >
          <Plus className="text-white/50" />
        </button>
        <div className="h-5" /> {/* Placeholder for score and fatigue bar */}
      </div>
    );
  }

  const liveStatusStyles: Record<PlayerLiveStatus, string> = {
    playing: 'opacity-100',
    not_yet_played: 'opacity-50',
    dnp: 'opacity-30 grayscale',
    finished: 'opacity-100',
  };
  
  const liveStatusClass = isLive && player.liveStatus ? liveStatusStyles[player.liveStatus] : '';

  return (
    <div className={`flex flex-col items-center gap-1 group cursor-pointer ${containerSize} ${liveStatusClass} transition-all`} onClick={onClick}>
      <div className="relative">
        <div className={`absolute -inset-1 rounded-full transition-all duration-300 ${isSelectedForSwap && !isLive ? 'ring-4 ring-yellow-400' : ''}`} />
        <img
          src={player.photo}
          alt={player.name}
          className={`${photoSize} rounded-full object-cover bg-gray-300 border-2 border-white/50 shadow-lg`}
        />
        {/* Overlays */}
        <img src={player.teamLogo} alt={player.teamName} className={`${clubLogoSize} absolute -top-1 -left-1 bg-white rounded-full p-0.5 shadow-md`} />
        
        {player.liveStatus !== 'dnp' && (
          <div className="absolute -top-1 -right-1 bg-white p-0.5 rounded-full shadow-md">
            <CategoryIcon category={player.status} size={statusIconSize} />
          </div>
        )}

        {isCaptain && player.liveStatus !== 'dnp' && (
          <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 bg-purple-600 text-white font-bold flex items-center justify-center rounded-full border-2 border-white shadow-md ${captainSize}`}>
            C
          </div>
        )}
        
        {player.isSubbedIn && (
           <div className="absolute -bottom-1 right-0 bg-green-500 text-white rounded-full p-0.5 border-2 border-white shadow-md">
             <ArrowUp size={size === 'normal' ? 12 : 10} />
           </div>
        )}

        {player.liveStatus === 'dnp' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
            <span className="font-bold text-white text-lg">DNP</span>
          </div>
        )}

        {!isLive && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 rounded-full transition-opacity">
            <span className="text-white text-xs font-bold text-center px-1 truncate">{player.name}</span>
          </div>
        )}
      </div>

      {isLive ? (
        <p className="font-bold text-blue-300 text-sm">
          {player.livePoints?.toFixed(1) ?? '0.0'}
        </p>
      ) : (
        <p className={`font-bold text-white ${pgsFontSize}`}>{player.pgs.toFixed(1)}</p>
      )}

      <div className="w-16">
        <FatigueBar fatigue={player.fatigue} />
      </div>
    </div>
  );
};
