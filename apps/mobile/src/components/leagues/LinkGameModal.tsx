import React from 'react';
import { Game } from '../../types';
import { X, Gamepad2, CheckCircle } from 'lucide-react';

interface LinkGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinkGame: (game: Game) => void;
  linkableGames: Game[];
  alreadyLinkedGameIds: string[];
}

const gameTypeDetails = {
  betting: { tag: 'Betting', color: 'bg-electric-blue/20 text-electric-blue' },
  prediction: { tag: 'Prediction', color: 'bg-neon-cyan/20 text-neon-cyan' },
  fantasy: { tag: 'Fantasy', color: 'bg-lime-glow/20 text-lime-glow' },
};

export const LinkGameModal: React.FC<LinkGameModalProps> = ({ isOpen, onClose, onLinkGame, linkableGames, alreadyLinkedGameIds }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full h-[80vh] flex flex-col p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Gamepad2 /> Link a Game
          </h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {linkableGames.length > 0 ? linkableGames.map(game => {
            const isLinked = alreadyLinkedGameIds.includes(game.id);
            const details = gameTypeDetails[game.gameType];
            return (
              <button
                key={game.id}
                onClick={() => {
                  if (!isLinked) {
                    onLinkGame(game);
                    onClose();
                  }
                }}
                disabled={isLinked}
                className="w-full flex items-center gap-3 p-3 text-left rounded-xl transition-colors bg-navy-accent/50 hover:bg-navy-accent disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="flex-1">
                  <p className="font-bold text-text-primary">{game.name}</p>
                  <p className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${details.color}`}>{details.tag}</p>
                </div>
                {isLinked && <CheckCircle size={20} className="text-lime-glow" />}
              </button>
            );
          }) : (
            <div className="text-center text-text-disabled py-10">
              No linkable games available right now.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
