import React from 'react';
import { Flame, AlertCircle } from 'lucide-react';

interface DailyStreakModalProps {
  isOpen: boolean;
  onClaim: () => void;
  streakDay: number;
  previousStreakDay?: number | null; // Previous streak from database (null if first time)
}

export const DailyStreakModal: React.FC<DailyStreakModalProps> = ({
  isOpen,
  onClaim,
  streakDay,
  previousStreakDay
}) => {
  if (!isOpen) return null;

  // Detect if streak was lost
  const isStreakLost = streakDay === 1 && previousStreakDay && previousStreakDay > 1;
  const isFirstStreak = streakDay === 1 && !previousStreakDay;
  const isContinuing = streakDay > 1;

  // Choose message based on state
  let title: string;
  let message: string;
  let icon: React.ReactNode;
  let borderColor: string;

  if (isStreakLost) {
    title = "Streak Lost!";
    message = `Your ${previousStreakDay}-day streak is gone. But don't give up! Start fresh from Day 1.`;
    icon = <AlertCircle className="w-12 h-12 text-hot-red" />;
    borderColor = "border-hot-red/50";
  } else if (isFirstStreak) {
    title = `Start Your Streak!`;
    message = "Welcome! Claim your Day 1 reward and come back tomorrow to build your streak.";
    icon = <Flame className="w-12 h-12 text-warm-yellow" />;
    borderColor = "border-warm-yellow/50";
  } else {
    title = `Day ${streakDay} Streak!`;
    message = "Your daily reward is ready. Keep the fire going!";
    icon = <Flame className="w-12 h-12 text-warm-yellow" />;
    borderColor = "border-warm-yellow/50";
  }

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-lg flex items-center justify-center p-4 z-[100] animate-scale-in">
      <div className={`modal-base max-w-sm w-full p-8 space-y-6 text-center border-2 ${borderColor}`}>
        <div className={`inline-block ${isStreakLost ? 'bg-hot-red/10' : 'bg-warm-yellow/10'} p-4 rounded-full`}>
          {icon}
        </div>
        <h2 className="text-3xl font-bold text-text-primary">{title}</h2>
        <p className="text-text-secondary">{message}</p>
        <button onClick={onClaim} className="w-full primary-button text-lg">
          Claim Reward
        </button>
      </div>
    </div>
  );
};
