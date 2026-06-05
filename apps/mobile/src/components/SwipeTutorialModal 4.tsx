import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, MousePointerClick } from 'lucide-react';

interface SwipeTutorialModalProps {
  onClose: (dontShowAgain: boolean) => void;
}

export const SwipeTutorialModal: React.FC<SwipeTutorialModalProps> = ({ onClose }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const GestureInfo: React.FC<{ icon: React.ReactNode, title: string, description: string }> = ({ icon, title, description }) => (
    <div className="flex items-center gap-4 bg-deep-navy p-3 rounded-lg">
      <div className="bg-navy-accent p-3 rounded-full text-text-secondary">
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-text-primary">{title}</h4>
        <p className="text-sm text-text-secondary">{description}</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-navy-accent border border-white/10 rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-6 relative">

        <div className="text-center space-y-1">
          <div className="inline-block bg-electric-blue/20 p-3 rounded-full mb-2">
            <MousePointerClick className="w-8 h-8 text-electric-blue" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">How to Play</h2>
          <p className="text-sm text-text-secondary">Swipe the cards to make your predictions!</p>
        </div>

        <div className="space-y-3">
          <GestureInfo icon={<ArrowLeft />} title="Swipe Left" description="To predict Team A wins" />
          <GestureInfo icon={<ArrowRight />} title="Swipe Right" description="To predict Team B wins" />
          <GestureInfo icon={<ArrowUp />} title="Swipe Up" description="To predict a Draw" />
        </div>

        <p className="text-center text-xs text-text-secondary bg-electric-blue/10 border border-electric-blue/20 p-3 rounded-lg">
          Don't worry! You can review and edit all your picks on the next screen before the first match starts.
        </p>

        <div className="pt-2 space-y-3">
          <div className="flex items-center justify-center">
            <input
              id="dont-show-again-swipe"
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-deep-navy text-electric-blue focus:ring-electric-blue"
            />
            <label htmlFor="dont-show-again-swipe" className="ml-2 block text-sm text-text-secondary">
              Don't show this again
            </label>
          </div>

          <button
            onClick={() => onClose(dontShowAgain)}
            className="w-full py-3 bg-gradient-to-r from-electric-blue to-neon-cyan hover:shadow-lg text-white rounded-xl font-bold transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};
