import React from 'react';
import { X, Trophy, Gift, Coins } from 'lucide-react';
import { motion } from 'framer-motion';

interface PaidTournamentResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant: 'winner' | 'participant';
  rank?: number;
  prize?: number;
  bonusCoins?: number;
}

const ConfettiPiece: React.FC = () => {
  const colors = ['#FFBA08', '#1E90FF', '#4AF626', '#FF3355'];
  const style = {
    position: 'absolute' as 'absolute',
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * -50}px`,
    width: `${Math.random() * 8 + 4}px`,
    height: `${Math.random() * 8 + 4}px`,
    backgroundColor: colors[Math.floor(Math.random() * colors.length)],
    borderRadius: '50%',
  };
  return (
    <motion.div
      style={style}
      animate={{
        y: '120vh',
        x: Math.random() * 100 - 50,
        rotate: Math.random() * 360,
      }}
      transition={{
        duration: Math.random() * 3 + 2,
        repeat: Infinity,
        repeatType: 'loop',
        ease: 'linear',
      }}
    />
  );
};

export const PaidTournamentResultsModal: React.FC<PaidTournamentResultsModalProps> = ({ isOpen, onClose, variant, rank, prize, bonusCoins }) => {
  if (!isOpen) return null;

  const isWinner = variant === 'winner';

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      {isWinner && Array.from({ length: 50 }).map((_, i) => <ConfettiPiece key={i} />)}
      <div className="modal-base max-w-sm w-full p-6 space-y-6 relative overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full z-10">
          <X size={24} />
        </button>
        
        <div className="text-center">
          <div className={`inline-block p-4 rounded-full mb-3 ${isWinner ? 'bg-warm-yellow/10' : 'bg-lime-glow/10'}`}>
            {isWinner ? (
              <Trophy className="w-10 h-10 text-warm-yellow" />
            ) : (
              <Coins className="w-10 h-10 text-lime-glow" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-text-primary">
            {isWinner ? 'Congratulations!' : 'Great Run!'}
          </h2>
          {isWinner ? (
            <p className="text-text-secondary mt-2">
              You placed #{rank} and won a <b className="text-text-primary">€{prize?.toFixed(2)} Gift Card</b> + exclusive rewards!
            </p>
          ) : (
            <p className="text-text-secondary mt-2">
              You finished all your matches and earned <b className="text-text-primary">{bonusCoins} bonus coins</b> 💰 — consistency pays off!
            </p>
          )}
        </div>

        {isWinner && (
          <p className="text-center text-xs text-lime-glow bg-lime-glow/10 p-2 rounded-lg">
            🎟 Check your profile to claim your Spin and Ticket rewards.
          </p>
        )}

        <button onClick={onClose} className="w-full primary-button">
          Awesome!
        </button>
      </div>
    </div>
  );
};
