import React from 'react';
import { FantasyPlayer, PlayerPosition } from '../../types';
import { PlayerCircle } from './PlayerCircle';

interface FantasyPitchProps {
  starters: FantasyPlayer[];
  onSlotClick: (position: PlayerPosition, player: FantasyPlayer | null, slotIndex: number) => void;
  captainId: string | null;
  selectedForSwap: FantasyPlayer | null;
  formation: string; // e.g., "2-3-1" for DEF-MID-FWD
  isLive: boolean;
  playerSlots?: Record<string, number>;
}

export const FantasyPitch: React.FC<FantasyPitchProps> = ({ starters, onSlotClick, captainId, selectedForSwap, formation, isLive, playerSlots }) => {
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
    const groupPlayers = playersByPosition[position];
    // Exact placement: a player with an explicit slot index goes there; any others
    // fill the remaining slots left-to-right (robust to missing/old slot data).
    const placed: (FantasyPlayer | null)[] = Array(count).fill(null);
    const leftover: FantasyPlayer[] = [];
    for (const p of groupPlayers) {
      const idx = playerSlots?.[p.id];
      if (idx != null && idx >= 0 && idx < count && placed[idx] == null) placed[idx] = p;
      else leftover.push(p);
    }
    let free = 0;
    for (const p of leftover) {
      while (free < count && placed[free] != null) free++;
      if (free < count) placed[free] = p;
    }
    const slots = [];
    for (let i = 0; i < count; i++) {
      const player = placed[i];
      slots.push(
        <PlayerCircle
          key={`${position}-${i}`}
          player={player}
          onClick={() => onSlotClick(position, player, i)}
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
      className="rounded-2xl p-4 space-y-2 shadow-inner relative overflow-hidden"
      style={{ background: 'repeating-linear-gradient(to bottom, #15532e 0px, #15532e 28px, #176836 28px, #176836 56px)' }}
    >
      {/* Pitch markings (CSS-drawn) */}
      <div className="absolute inset-2 rounded-xl border-2 border-white/15 pointer-events-none" />
      <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 border-t-2 border-white/15 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-white/15 pointer-events-none" />
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-10 border-2 border-t-0 border-white/15 rounded-b-md pointer-events-none" />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-10 border-2 border-b-0 border-white/15 rounded-t-md pointer-events-none" />
      <div className="relative">
        {renderRow('Attacker', currentFormation.Attacker)}
        {renderRow('Midfielder', currentFormation.Midfielder)}
        {renderRow('Defender', currentFormation.Defender)}
        {renderRow('Goalkeeper', currentFormation.Goalkeeper)}
      </div>
    </div>
  );
};
