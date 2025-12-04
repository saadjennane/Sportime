import React from 'react';
import { X, Info, MousePointerClick } from 'lucide-react';

interface SwipeRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SwipeRulesModal: React.FC<SwipeRulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-navy-accent border border-white/10 rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-deep-navy rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3">
          <div className="bg-electric-blue/20 p-2 rounded-full">
            <MousePointerClick className="w-6 h-6 text-electric-blue" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">Prediction Game Rules</h2>
        </div>

        <div className="space-y-4 text-text-secondary text-sm">
          <p>
            <strong className="text-text-primary">1. Join the Game:</strong> Pay the entry cost to participate in the MatchDay.
          </p>
          <p>
            <strong className="text-text-primary">2. Swipe to Predict:</strong> For each match, swipe left for Team A win, right for Team B win, or up for a draw. You must predict all matches.
          </p>
          <p>
            <strong className="text-text-primary">3. Edit Your Picks:</strong> You can review and change your predictions on the recap screen until the first match of the day begins.
          </p>
          <p>
            <strong className="text-text-primary">4. Points System:</strong> If your prediction is correct, you earn points equal to the <span className="font-bold text-electric-blue">odds × 100</span>. Incorrect predictions earn 0 points.
          </p>
          <p>
            <strong className="text-text-primary">5. The Winner:</strong> The player with the most points at the end of the MatchDay wins!
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 mt-4 bg-gradient-to-r from-electric-blue to-neon-cyan hover:shadow-lg text-white rounded-xl font-bold transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  );
};
