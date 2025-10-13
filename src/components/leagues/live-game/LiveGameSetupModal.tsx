import React from 'react';
import { Match } from '../../../types';
import { X, Radio } from 'lucide-react';

interface LiveGameSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (match: Match) => void;
  matches: Match[];
}

export const LiveGameSetupModal: React.FC<LiveGameSetupModalProps> = ({ isOpen, onClose, onCreate, matches }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full h-[80vh] flex flex-col p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Radio /> Create Live Game
          </h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
            <X size={24} />
          </button>
        </div>
        <p className="text-sm text-text-secondary">Select an upcoming match to create a live prediction game for your league.</p>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {matches.length > 0 ? matches.map(match => (
            <button
              key={match.id}
              onClick={() => onCreate(match)}
              className="w-full flex items-center gap-3 p-3 text-left rounded-xl transition-colors bg-navy-accent/50 hover:bg-navy-accent"
            >
              <div className="text-2xl">{match.teamA.emoji}</div>
              <div className="flex-1">
                <p className="font-bold text-text-primary">{match.teamA.name} vs {match.teamB.name}</p>
                <p className="text-xs text-text-disabled">{match.kickoffTime}</p>
              </div>
              <div className="text-2xl">{match.teamB.emoji}</div>
            </button>
          )) : (
            <div className="text-center text-text-disabled py-10">
              No upcoming matches available to create a game.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
