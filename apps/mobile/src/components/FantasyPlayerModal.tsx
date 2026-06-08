import React, { useState, useMemo } from 'react';
import { FantasyPlayer, PlayerPosition } from '../types';
import { X, Search } from 'lucide-react';
import { CategoryIcon } from './fantasy/CategoryIcon';

interface FantasyPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: PlayerPosition;
  allPlayers: FantasyPlayer[];
  onSelectPlayer: (player: FantasyPlayer) => void;
  selectedPlayerIds?: string[];
}

export const FantasyPlayerModal: React.FC<FantasyPlayerModalProps> = ({ isOpen, onClose, position, allPlayers, onSelectPlayer, selectedPlayerIds = [] }) => {
  const takenIds = new Set(selectedPlayerIds);
  const [searchTerm, setSearchTerm] = useState('');
  
  const availablePlayers = useMemo(() => {
    return allPlayers
      // Eligible for this slot (derived from real lineups), falling back to primary.
      .filter(p => (p.eligiblePositions && p.eligiblePositions.length > 0)
        ? p.eligiblePositions.includes(position)
        : p.position === position)
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.pgs - a.pgs);
  }, [allPlayers, position, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-navy-accent rounded-3xl shadow-2xl max-w-sm w-full h-[80vh] flex flex-col p-5 border border-white/10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-text-primary">Select a {position}</h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
            <X size={22} />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-disabled" />
          <input
            type="text"
            placeholder="Search player..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 bg-deep-navy border border-white/10 rounded-lg text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-electric-blue"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {availablePlayers.length === 0 ? (
            <p className="text-center text-sm text-text-disabled mt-8">No players found.</p>
          ) : availablePlayers.map(player => {
            const taken = takenIds.has(player.id);
            return (
            <button
              key={player.id}
              onClick={() => { if (!taken) { onSelectPlayer(player); onClose(); } }}
              disabled={taken}
              className={`w-full flex items-center gap-3 p-3 bg-deep-navy border border-white/5 rounded-xl transition-colors text-left ${taken ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5'}`}
            >
              <img
                src={player.photo || `https://api.dicebear.com/8.x/bottts/svg?seed=${player.id}`}
                alt={player.name}
                className="w-11 h-11 rounded-full object-cover bg-navy-accent flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-text-primary truncate">{player.name}</p>
                <p className="text-xs text-text-secondary truncate">{player.teamName}</p>
              </div>
              <div className="text-center w-10 flex-shrink-0">
                <CategoryIcon category={player.status} />
                <p className="text-xs font-semibold text-text-primary">{player.pgs.toFixed(1)}</p>
              </div>
              <div className="text-center w-12 flex-shrink-0">
                <p className="text-[10px] text-text-disabled">Fatigue</p>
                <p className="font-bold text-sm text-text-primary">{player.fatigue}%</p>
              </div>
            </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
