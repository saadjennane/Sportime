import React, { useState } from 'react';
import type { MatchLineups, LineupPlayer, TeamLineup } from '../../../types';

interface LineupPitchProps {
  data: MatchLineups;
}

interface PlayerNodeProps {
  player: LineupPlayer;
  isSelected: boolean;
  onSelect: () => void;
  isAway?: boolean;
}

const PlayerNode: React.FC<PlayerNodeProps> = ({ player, isSelected, onSelect, isAway }) => {
  const positionColors: Record<string, string> = {
    G: 'from-amber-400 to-amber-600',
    D: 'from-emerald-400 to-emerald-600',
    M: 'from-blue-400 to-blue-600',
    F: 'from-red-400 to-red-600',
  };

  const gradient = positionColors[player.position] || 'from-gray-400 to-gray-600';

  return (
    <div className="flex flex-col items-center gap-0.5 relative">
      <button
        onClick={onSelect}
        className={`relative w-10 h-10 rounded-full overflow-hidden shadow-lg border-2 transition-all duration-200 ${
          isSelected ? 'border-white scale-110 z-10' : 'border-white/30'
        }`}
      >
        {player.photo ? (
          <img
            src={player.photo}
            alt={player.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div
          className={`absolute inset-0 bg-gradient-to-b ${gradient} flex items-center justify-center ${
            player.photo ? 'hidden' : ''
          }`}
        >
          <span className="text-white font-bold text-sm">{player.number ?? '?'}</span>
        </div>
      </button>
      <div
        className={`text-[9px] font-medium text-white text-center max-w-[50px] truncate ${
          isAway ? 'text-red-200' : 'text-blue-200'
        }`}
      >
        {player.name.split(' ').pop()}
      </div>
      {isSelected && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/90 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap z-20 border border-white/20">
          <div className="font-semibold">{player.name}</div>
          <div className="text-white/70">#{player.number} • {player.position}</div>
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

// Group players by row and sort by column
function groupByRow(players: LineupPlayer[]): Map<number, LineupPlayer[]> {
  const groups = new Map<number, LineupPlayer[]>();

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

interface TeamFormationProps {
  team: TeamLineup;
  isAway?: boolean;
  selectedPlayer: string | null;
  onSelectPlayer: (name: string) => void;
}

const TeamFormation: React.FC<TeamFormationProps> = ({
  team,
  isAway,
  selectedPlayer,
  onSelectPlayer,
}) => {
  const rowGroups = groupByRow(team.starters);
  // Get sorted rows - for home team: highest first (ATT at top), for away: lowest first (ATT at top when inverted)
  const sortedRows = Array.from(rowGroups.keys()).sort((a, b) => (isAway ? a - b : b - a));

  return (
    <div className={`flex-1 flex flex-col ${isAway ? 'justify-start' : 'justify-end'} py-2`}>
      {/* Team header */}
      <div
        className={`flex items-center gap-2 px-3 py-1 ${isAway ? 'justify-end' : 'justify-start'}`}
      >
        {!isAway && team.teamLogo && (
          <img src={team.teamLogo} alt={team.teamName} className="w-5 h-5 object-contain" />
        )}
        <span className="text-[10px] font-bold text-white/90">{team.formation}</span>
        {isAway && team.teamLogo && (
          <img src={team.teamLogo} alt={team.teamName} className="w-5 h-5 object-contain" />
        )}
      </div>

      {/* Formation rows */}
      <div className={`flex flex-col ${isAway ? '' : ''} gap-1`}>
        {sortedRows.map((rowNum) => {
          const rowPlayers = rowGroups.get(rowNum) || [];
          return (
            <div key={rowNum} className="flex justify-center items-center gap-2 py-1">
              {rowPlayers.map((player) => (
                <PlayerNode
                  key={player.name}
                  player={player}
                  isAway={isAway}
                  isSelected={selectedPlayer === player.name}
                  onSelect={() =>
                    onSelectPlayer(selectedPlayer === player.name ? '' : player.name)
                  }
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const LineupPitch: React.FC<LineupPitchProps> = ({ data }) => {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  return (
    <div className="relative w-full rounded-xl overflow-hidden">
      {/* Pitch background */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(to bottom,
              #1a472a 0%,
              #2d5a3a 10%,
              #1a472a 20%,
              #2d5a3a 30%,
              #1a472a 40%,
              #2d5a3a 50%,
              #1a472a 60%,
              #2d5a3a 70%,
              #1a472a 80%,
              #2d5a3a 90%,
              #1a472a 100%
            )
          `,
        }}
      />

      {/* Pitch lines */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Border */}
        <div className="absolute inset-2 border-2 border-white/30 rounded-lg" />
        {/* Center line */}
        <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-white/30" />
        {/* Center circle */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-white/30 rounded-full" />
        {/* Center dot */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/30 rounded-full" />
        {/* Top penalty box */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-32 h-12 border-2 border-t-0 border-white/30" />
        {/* Top goal box */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-16 h-5 border-2 border-t-0 border-white/30" />
        {/* Bottom penalty box */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-32 h-12 border-2 border-b-0 border-white/30" />
        {/* Bottom goal box */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-16 h-5 border-2 border-b-0 border-white/30" />
      </div>

      {/* Teams */}
      <div className="relative z-10 flex flex-col min-h-[520px]">
        {/* Away team (top) */}
        <TeamFormation
          team={data.away}
          isAway={true}
          selectedPlayer={selectedPlayer}
          onSelectPlayer={setSelectedPlayer}
        />

        {/* Center separator with VS */}
        <div className="flex items-center justify-center py-2">
          <div className="bg-white/10 px-4 py-1 rounded-full">
            <span className="text-white/50 text-xs font-bold">VS</span>
          </div>
        </div>

        {/* Home team (bottom) */}
        <TeamFormation
          team={data.home}
          isAway={false}
          selectedPlayer={selectedPlayer}
          onSelectPlayer={setSelectedPlayer}
        />
      </div>
    </div>
  );
};
