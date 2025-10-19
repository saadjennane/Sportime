import React, { useState } from 'react';
import { X, Gamepad2, CheckCircle, Loader2 } from 'lucide-react';

interface JoinPaidTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameName: string;
  entryFee: number;
}

export const JoinPaidTournamentModal: React.FC<JoinPaidTournamentModalProps> = ({ isOpen, onClose, gameName, entryFee }) => {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleJoin = () => {
    setLoading(true);
    // Simulate payment processing
    setTimeout(() => {
      setLoading(false);
      setIsConfirmed(true);
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full">
          <X size={24} />
        </button>
        
        <div className="text-center">
          <div className="inline-block bg-electric-blue/10 p-3 rounded-full mb-3">
            <Gamepad2 className="w-8 h-8 text-electric-blue" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">
            {isConfirmed ? 'Entry Confirmed!' : 'Join a Prize Game ⚡'}
          </h2>
        </div>

        {isConfirmed ? (
          <div className="text-center space-y-4 animate-scale-in">
            <CheckCircle className="w-16 h-16 text-lime-glow mx-auto" />
            <p className="text-text-secondary">Your spot is locked in — good luck! 🔥</p>
            <button onClick={onClose} className="w-full primary-button">
              Let's Go!
            </button>
          </div>
        ) : (
          <>
            <p className="text-center text-text-secondary">
              This game has a small entry fee of <b className="text-text-primary">€{entryFee.toFixed(2)}</b>.
              The top 3 players share the prize pool + in-app rewards!
            </p>
            <p className="text-center text-xs text-lime-glow bg-lime-glow/10 p-2 rounded-lg">
              Everyone who finishes all matches earns bonus coins 💎 — so you never leave empty-handed.
            </p>
            <div className="space-y-3 pt-4">
              <button
                onClick={handleJoin}
                disabled={loading}
                className="w-full primary-button flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : '🎮 Join & Pay €' + entryFee.toFixed(2)}
              </button>
              <button onClick={onClose} className="w-full py-3 text-sm font-semibold text-text-secondary hover:bg-white/10 rounded-xl">
                Maybe Later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
