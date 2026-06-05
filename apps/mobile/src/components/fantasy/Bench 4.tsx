import React from 'react';
import { FantasyPlayer, PlayerPosition } from '../../types';
import { PlayerCircle } from './PlayerCircle';

interface BenchProps {
  substitutes: FantasyPlayer[];
  onSlotClick: (position: PlayerPosition, player: FantasyPlayer | null) => void;
  captainId: string | null;
  selectedForSwap: FantasyPlayer | null;
  isLive: boolean;
}

export const Bench: React.FC<BenchProps> = ({ substitutes, onSlotClick, captainId, selectedForSwap, isLive }) => {
  const midSub = substitutes.find(p => p.position === 'Midfielder') || null;
  const fwdSub = substitutes.find(p => p.position === 'Attacker') || null;

  return (
    <div className="bg-black/20 p-3 rounded-xl">
      <h4 className="text-center text-xs font-bold text-white/80 uppercase mb-2">Bench</h4>
      <div className="flex justify-center gap-4">
        <PlayerCircle
          player={midSub}
          onClick={() => onSlotClick('Midfielder', midSub)}
          isCaptain={!!(midSub && midSub.id === captainId)}
          isSelectedForSwap={!!(midSub && midSub.id === selectedForSwap?.id)}
          size="small"
          isLive={isLive}
        />
        <PlayerCircle
          player={fwdSub}
          onClick={() => onSlotClick('Attacker', fwdSub)}
          isCaptain={!!(fwdSub && fwdSub.id === captainId)}
          isSelectedForSwap={!!(fwdSub && fwdSub.id === selectedForSwap?.id)}
          size="small"
          isLive={isLive}
        />
      </div>
    </div>
  );
};
