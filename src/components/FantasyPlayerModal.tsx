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
}

export const FantasyPlayerModal: React.FC<FantasyPlayerModalProps> = ({ isOpen, onClose, position, allPlayers, onSelectPlayer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const availablePlayers = useMemo(() => {
    return allPlayers
      .filter(p => p.position === position)
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.pgs - a.pgs);
  }, [allPlayers, position, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full h-[80vh] flex flex-col p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Select a {position}</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <X size={24} />
          </button>
        </div>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search player..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {availablePlayers.map(player => (
            <button
              key={player.id}
              onClick={() => { onSelectPlayer(player); onClose(); }}
              className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-purple-50 rounded-xl transition-colors text-left"
            >
              <img src={player.photo} alt={player.name} className="w-12 h-12 rounded-full object-cover bg-gray-200" />
              <div className="flex-1">
                <p className="font-bold text-sm">{player.name}</p>
                <p className="text-xs text-gray-500">{player.teamName}</p>
              </div>
              <div className="text-center w-10">
                <CategoryIcon category={player.status} />
                <p className="text-xs font-semibold">{player.pgs.toFixed(1)}</p>
              </div>
              <div className="text-center w-12">
                <p className="text-xs text-gray-500">Fatigue</p>
                <p className="font-bold text-sm">{player.fatigue}%</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
