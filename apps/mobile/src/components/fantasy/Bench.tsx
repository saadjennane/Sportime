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

// One bench slot per position so a sub of ANY line (incl. GK / Defender) is visible & addable.
const BENCH_POSITIONS: PlayerPosition[] = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'];

export const Bench: React.FC<BenchProps> = ({ substitutes, onSlotClick, captainId, selectedForSwap, isLive }) => {
  return (
    <div className="bg-black/20 p-3 rounded-xl">
      <h4 className="text-center text-xs font-bold text-white/80 uppercase mb-2">Bench</h4>
      <div className="flex justify-center gap-4">
        {BENCH_POSITIONS.map(pos => {
          const sub = substitutes.find(p => p.position === pos) || null;
          return (
            <PlayerCircle
              key={pos}
              player={sub}
              onClick={() => onSlotClick(pos, sub)}
              isCaptain={!!(sub && sub.id === captainId)}
              isSelectedForSwap={!!(sub && sub.id === selectedForSwap?.id)}
              size="small"
              isLive={isLive}
            />
          );
        })}
      </div>
    </div>
  );
};
