import React from 'react';
import { FantasyPlayer } from '../types';
import { Key, Dices, Star as StarIcon } from 'lucide-react';

interface FantasyPlayerCardProps {
  player: FantasyPlayer;
  isCaptain: boolean;
  onClick: () => void;
  isLive: boolean;
}

const CategoryIcon: React.FC<{ category: 'Star' | 'Key' | 'Wild', size?: number }> = ({ category, size = 12 }) => {
  switch (category) {
    case 'Star':
      return <StarIcon size={size} className="text-yellow-400 fill-yellow-400" />;
    case 'Key':
      return <Key size={size} className="text-gray-400 -rotate-90" />;
    case 'Wild':
      return <Dices size={size} className="text-green-400" />;
    default:
      return null;
  }
};

const FatigueBar: React.FC<{ fatigue: number }> = ({ fatigue }) => {
  const getColor = () => {
    if (fatigue > 70) return 'bg-green-500';
    if (fatigue > 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5 relative overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${getColor()}`}
        style={{ width: `${fatigue}%` }}
      ></div>
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white mix-blend-difference">
        {fatigue}%
      </span>
    </div>
  );
};

export const FantasyPlayerCard: React.FC<FantasyPlayerCardProps> = ({ player, isCaptain, onClick, isLive }) => {
  return (
    <div className="relative flex flex-col items-center text-center w-20 group" onClick={onClick}>
      {isCaptain && (
        <div className="absolute -top-2 -right-1 bg-black text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-md z-10">
          C
        </div>
      )}
      <div className="relative w-16 h-16 mb-1">
        <img src={player.photo} alt={player.name} className="w-full h-full rounded-full object-cover bg-gray-200 border-2 border-white shadow-md" />
        <div className="absolute -bottom-1 -right-0 bg-white p-0.5 rounded-full shadow">
          <img src={player.teamLogo} alt={player.teamName} className="w-5 h-5" />
        </div>
      </div>
      <p className="text-xs font-bold text-gray-800 truncate w-full">{player.name}</p>
      
      {isLive ? (
        <div className="mt-1 text-center">
            <p className="text-lg font-bold text-purple-700">{player.livePoints ?? 0}</p>
            <p className="text-[10px] text-gray-500 -mt-1">pts</p>
        </div>
      ) : (
        <>
            <div className="flex items-center justify-center gap-1 text-xs text-gray-500 w-full">
                <CategoryIcon category={player.category} />
                <span className="font-semibold">{player.avgFantasyScore.toFixed(1)}</span>
            </div>
            <div className="w-12 mt-1">
                <FatigueBar fatigue={player.fatigue} />
            </div>
        </>
      )}
    </div>
  );
};
