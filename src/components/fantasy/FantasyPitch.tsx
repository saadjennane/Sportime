import React from 'react';
import { FantasyPlayer, PlayerPosition } from '../../types';
import { PlayerCircle } from './PlayerCircle';

interface FantasyPitchProps {
  starters: FantasyPlayer[];
  onSlotClick: (position: PlayerPosition, player: FantasyPlayer | null) => void;
  captainId: string | null;
  selectedForSwap: FantasyPlayer | null;
  formation: string; // e.g., "2-3-1" for DEF-MID-FWD
  isLive: boolean;
}

export const FantasyPitch: React.FC<FantasyPitchProps> = ({ starters, onSlotClick, captainId, selectedForSwap, formation, isLive }) => {
  const formationMap: Record<string, Record<PlayerPosition, number>> = {
    "2-3-1": { Defender: 2, Midfielder: 3, Attacker: 1, Goalkeeper: 1 },
    "1-3-2": { Defender: 1, Midfielder: 3, Attacker: 2, Goalkeeper: 1 },
    "2-2-2": { Defender: 2, Midfielder: 2, Attacker: 2, Goalkeeper: 1 },
  };

  const currentFormation = formationMap[formation] || formationMap["2-3-1"];

  const playersByPosition: Record<PlayerPosition, FantasyPlayer[]> = {
    Attacker: starters.filter(p => p.position === 'Attacker'),
    Midfielder: starters.filter(p => p.position === 'Midfielder'),
    Defender: starters.filter(p => p.position === 'Defender'),
    Goalkeeper: starters.filter(p => p.position === 'Goalkeeper'),
  };

  const renderRow = (position: PlayerPosition, count: number) => {
    const players = playersByPosition[position];
    const slots = [];
    for (let i = 0; i < count; i++) {
      const player = players[i] || null;
      slots.push(
        <PlayerCircle
          key={`${position}-${i}`}
          player={player}
          onClick={() => onSlotClick(position, player)}
          isCaptain={player?.id === captainId}
          isSelectedForSwap={player?.id === selectedForSwap?.id}
          isLive={isLive}
        />
      );
    }
    return (
      <div className="flex justify-around items-center gap-2 py-2">
        {slots}
      </div>
    );
  };

  return (
    <div
      className="rounded-2xl p-4 space-y-2 shadow-inner"
      style={{
        background: 'linear-gradient(to bottom, #16a34a, #15803d)',
        backgroundImage: "url('https://www.transparenttextures.com/patterns/large-leather.png'), linear-gradient(to bottom, #16a34a, #15803d)",
      }}
    >
      {renderRow('Attacker', currentFormation.Attacker)}
      {renderRow('Midfielder', currentFormation.Midfielder)}
      {renderRow('Defender', currentFormation.Defender)}
      {renderRow('Goalkeeper', currentFormation.Goalkeeper)}
    </div>
  );
};
