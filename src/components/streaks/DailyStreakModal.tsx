import React from 'react';
import { Flame } from 'lucide-react';

interface DailyStreakModalProps {
  isOpen: boolean;
  onClaim: () => void;
  streakDay: number;
}

export const DailyStreakModal: React.FC<DailyStreakModalProps> = ({ isOpen, onClaim, streakDay }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-lg flex items-center justify-center p-4 z-[100] animate-scale-in">
      <div className="modal-base max-w-sm w-full p-8 space-y-6 text-center border-2 border-warm-yellow/50">
        <div className="inline-block bg-warm-yellow/10 p-4 rounded-full">
          <Flame className="w-12 h-12 text-warm-yellow" />
        </div>
        <h2 className="text-3xl font-bold text-text-primary">Day {streakDay} Streak!</h2>
        <p className="text-text-secondary">Your daily reward is ready. Keep the fire going!</p>
        <button onClick={onClaim} className="w-full primary-button text-lg">
          Claim Reward
        </button>
      </div>
    </div>
  );
};
