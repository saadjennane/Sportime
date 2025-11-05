import React from 'react';
import { X, Users } from 'lucide-react';

interface NoLeaguesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateLeague: () => void;
}

export const NoLeaguesModal: React.FC<NoLeaguesModalProps> = ({ isOpen, onClose, onCreateLeague }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full">
          <X size={24} />
        </button>
        <div className="text-center">
          <div className="inline-block bg-electric-blue/10 p-3 rounded-full mb-3">
            <Users className="w-8 h-8 text-electric-blue" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">Link this Game with Friends</h2>
          <p className="text-text-secondary mt-2">
            By linking this game to a private league, you can compare your scores only with your friends. You don’t have a league yet — create one now or do it later.
          </p>
        </div>
        <div className="space-y-3">
          <button onClick={onCreateLeague} className="w-full primary-button">
            Create My League
          </button>
          <button onClick={onClose} className="w-full py-3 text-sm font-semibold text-text-secondary hover:bg-white/10 rounded-xl">
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};
