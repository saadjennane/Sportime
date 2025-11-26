import React, { useState } from 'react';

interface Player {
  name: string;
  position: string;
  grid?: string;
  number?: number;
}

interface LineupPitchProps {
  starters: Player[];
  formation: string;
}

interface PlayerCircleProps {
  player: Player;
  isSelected: boolean;
  onSelect: () => void;
}

const PlayerCircle: React.FC<PlayerCircleProps> = ({ player, isSelected, onSelect }) => {
  const positionColors: Record<string, string> = {
    G: 'bg-amber-500',
    D: 'bg-emerald-500',
    M: 'bg-electric-blue',
    F: 'bg-hot-red',
  };

  const bgColor = positionColors[player.position] || 'bg-gray-500';

  return (
    <div className="flex flex-col items-center gap-0.5 relative">
      <button
        onClick={onSelect}
        className={`w-9 h-9 rounded-full ${bgColor} flex items-center justify-center font-bold text-white text-sm shadow-lg border-2 ${
          isSelected ? 'border-white scale-110' : 'border-transparent'
        } transition-all duration-200`}
      >
        {player.number ?? '?'}
      </button>
      {isSelected && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-deep-navy/95 px-2 py-0.5 rounded text-[10px] text-white whitespace-nowrap z-10 border border-disabled">
          {player.name}
        </div>
      )}
    </div>
  );
};

// Parse grid "row:col" into { row, col }
function parseGrid(grid?: string): { row: number; col: number } | null {
  if (!grid) return null;
  const parts = grid.split(':');
  if (parts.length !== 2) return null;
  const row = parseInt(parts[0], 10);
  const col = parseInt(parts[1], 10);
  if (isNaN(row) || isNaN(col)) return null;
  return { row, col };
}

// Group players by row
function groupByRow(players: Player[]): Map<number, Player[]> {
  const groups = new Map<number, Player[]>();

  for (const player of players) {
    const parsed = parseGrid(player.grid);
    const row = parsed?.row ?? 0;

    if (!groups.has(row)) {
      groups.set(row, []);
    }
    groups.get(row)!.push(player);
  }

  // Sort each row by column
  for (const [, rowPlayers] of groups) {
    rowPlayers.sort((a, b) => {
      const colA = parseGrid(a.grid)?.col ?? 0;
      const colB = parseGrid(b.grid)?.col ?? 0;
      return colA - colB;
    });
  }

  return groups;
}

export const LineupPitch: React.FC<LineupPitchProps> = ({ starters, formation }) => {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const rowGroups = groupByRow(starters);

  // Get sorted rows (highest first = attackers at top)
  const sortedRows = Array.from(rowGroups.keys()).sort((a, b) => b - a);

  const handlePlayerSelect = (playerName: string) => {
    setSelectedPlayer(selectedPlayer === playerName ? null : playerName);
  };

  // Row labels based on typical positions
  const rowLabels: Record<number, string> = {
    1: 'GK',
    2: 'DEF',
    3: 'MID',
    4: 'ATT',
    5: 'ATT',
  };

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden"
      style={{
        backgroundImage: 'url(https://i.imgur.com/sC4a7fD.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay for better visibility */}
      <div className="absolute inset-0 bg-emerald-900/40" />

      {/* Pitch content */}
      <div className="relative z-10 py-6 px-2 min-h-[320px] flex flex-col justify-between">
        {sortedRows.map((rowNum) => {
          const rowPlayers = rowGroups.get(rowNum) || [];

          return (
            <div key={rowNum} className="flex justify-center items-center gap-3 py-2">
              {rowPlayers.map((player) => (
                <PlayerCircle
                  key={player.name}
                  player={player}
                  isSelected={selectedPlayer === player.name}
                  onSelect={() => handlePlayerSelect(player.name)}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Formation badge */}
      <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs text-white font-medium">
        {formation}
      </div>
    </div>
  );
};
