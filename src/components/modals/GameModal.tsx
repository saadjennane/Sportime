import React from 'react';
import { X, Zap, Key, Flame } from 'lucide-react';

interface GameModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string | null;
  matchName: string | null;
  onStartLiveGame: () => void;
  onJoinGame: () => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const GameModal: React.FC<GameModalProps> = ({ isOpen, onClose, matchName, onStartLiveGame, onJoinGame, addToast }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full">
          <X size={24} />
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text-primary">Play Game</h2>
          {matchName && <p className="text-text-secondary text-sm mt-1">{matchName}</p>}
        </div>
        <div className="space-y-3 pt-4">
          <button onClick={() => addToast('Coming soon: Fun Zone!', 'info')} className="w-full secondary-button flex items-center justify-center gap-3 text-lg bg-navy-accent border-disabled text-text-secondary hover:border-electric-blue hover:text-electric-blue">
            <Flame size={20} /> Fun Zone
          </button>
          <button onClick={onStartLiveGame} className="w-full primary-button flex items-center justify-center gap-3 text-lg">
            <Zap size={20} /> Live Game
          </button>
          <button onClick={onJoinGame} className="w-full secondary-button flex items-center justify-center gap-3 text-lg">
            <Key size={20} /> Join Game
          </button>
        </div>
        <p className="text-xs text-text-disabled text-center pt-2">Codes expire once the game ends.</p>
      </div>
    </div>
  );
};
