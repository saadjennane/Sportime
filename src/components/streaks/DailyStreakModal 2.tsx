import React from 'react';
import { Flame, Coins, Ticket } from 'lucide-react';
import { DAILY_STREAK_REWARDS } from '../../config/constants';

interface DailyStreakModalProps {
  isOpen: boolean;
  onClaim: () => void;
  streakDay: number;
}

export const DailyStreakModal: React.FC<DailyStreakModalProps> = ({
  isOpen,
  onClaim,
  streakDay
}) => {
  if (!isOpen) return null;

  // Day-specific messages for the 7-day cycle
  const messages: Record<number, string> = {
    1: "Let's start your streak today.",
    2: "Welcome back! You're building momentum.",
    3: "Halfway there! Keep it going.",
    4: "Day 4! You're on fire!",
    5: "Almost there! Two more days.",
    6: "Day 6! One more day for the big reward.",
    7: "Final day! Claim your biggest reward!"
  };

  const message = messages[streakDay] || "Your daily reward is ready!";
  const reward = DAILY_STREAK_REWARDS[streakDay];

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-lg flex items-center justify-center p-4 z-[100] animate-scale-in">
      <div className="modal-base max-w-sm w-full p-8 space-y-6 text-center border-2 border-warm-yellow/50">
        <div className="inline-block bg-warm-yellow/10 p-4 rounded-full">
          <Flame className="w-12 h-12 text-warm-yellow" />
        </div>
        <h2 className="text-3xl font-bold text-text-primary">Day {streakDay} Streak!</h2>
        <p className="text-text-secondary">{message}</p>

        {/* Reward Display */}
        {reward && (
          <div className="bg-surface-elevated/50 rounded-lg p-4 border border-warm-yellow/30">
            <p className="text-sm text-text-secondary mb-2">Your Reward</p>
            <div className="flex items-center justify-center gap-2">
              {reward.coins && (
                <>
                  <Coins className="w-6 h-6 text-warm-yellow" />
                  <span className="text-2xl font-bold text-warm-yellow">{reward.coins.toLocaleString()}</span>
                  <span className="text-text-secondary">coins</span>
                </>
              )}
              {reward.ticket && (
                <>
                  <Ticket className="w-6 h-6 text-warm-yellow" />
                  <span className="text-2xl font-bold text-warm-yellow capitalize">{reward.ticket}</span>
                  <span className="text-text-secondary">Ticket</span>
                </>
              )}
            </div>
          </div>
        )}

        <button onClick={onClaim} className="w-full primary-button text-lg">
          Claim Reward
        </button>
      </div>
    </div>
  );
};
