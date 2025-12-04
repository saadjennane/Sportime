import React, { useState } from 'react';
import { Match } from '../../../types';
import { X, Radio, Gamepad2, ShieldCheck, Star } from 'lucide-react';

interface LiveGameSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (match: Match, mode: 'prediction' | 'betting' | 'fantasy-live') => void;
  matches: Match[];
}

export const LiveGameSetupModal: React.FC<LiveGameSetupModalProps> = ({ isOpen, onClose, onCreate, matches }) => {
  const [mode, setMode] = useState<'prediction' | 'betting' | 'fantasy-live'>('prediction');
  
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
        
        {/* Mode Selector */}
        <div className="bg-deep-navy/50 p-2 rounded-xl grid grid-cols-3 gap-2">
          <button onClick={() => setMode('prediction')} className={`flex items-center justify-center gap-2 p-2 rounded-lg font-semibold transition-all ${mode === 'prediction' ? 'bg-electric-blue text-white' : 'text-text-secondary'}`}>
            <Gamepad2 size={16} /> Prediction
          </button>
          <button onClick={() => setMode('betting')} className={`flex items-center justify-center gap-2 p-2 rounded-lg font-semibold transition-all ${mode === 'betting' ? 'bg-electric-blue text-white' : 'text-text-secondary'}`}>
            <ShieldCheck size={16} /> Betting
          </button>
          <button onClick={() => setMode('fantasy-live')} className={`flex items-center justify-center gap-2 p-2 rounded-lg font-semibold transition-all ${mode === 'fantasy-live' ? 'bg-electric-blue text-white' : 'text-text-secondary'}`}>
            <Star size={16} /> Fantasy
          </button>
        </div>

        <p className="text-sm text-text-secondary">Select an upcoming match to create a live game for your league.</p>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {matches.length > 0 ? matches.map(match => (
            <button
              key={match.id}
              onClick={() => onCreate(match, mode)}
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
