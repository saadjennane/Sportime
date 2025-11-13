import React, { useEffect, useState } from 'react';
import { Gift, Coins, Star, Ticket, Trophy, Award, Sparkles } from 'lucide-react';
import { RewardItem } from '../../types';
import confetti from 'canvas-confetti';

interface RewardNotificationProps {
  rewards: RewardItem[];
  onClose: () => void;
  autoClose?: number; // milliseconds
}

const REWARD_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  coins: Coins,
  ticket: Ticket,
  xp: Star,
  spin: Gift,
  masterpass: Trophy,
  giftcard: Gift,
  custom: Award,
  premium_3d: Sparkles,
  premium_7d: Sparkles,
};

const REWARD_COLORS: Record<string, string> = {
  coins: 'text-warm-yellow',
  ticket: 'text-electric-blue',
  xp: 'text-lime-glow',
  spin: 'text-neon-cyan',
  masterpass: 'text-hot-red',
  giftcard: 'text-warm-yellow',
  custom: 'text-purple-400',
  premium_3d: 'text-purple-400',
  premium_7d: 'text-purple-400',
};

export const RewardNotification: React.FC<RewardNotificationProps> = ({
  rewards,
  onClose,
  autoClose = 5000,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Trigger confetti on mount
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Confetti from left and right
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    // Auto-close timer
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade-out animation
    }, autoClose);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [autoClose, onClose]);

  const formatRewardLabel = (reward: RewardItem): string => {
    const typeName = reward.type.replace('_', ' ');

    if (reward.type === 'coins' || reward.type === 'xp' || reward.type === 'giftcard') {
      return `${reward.value} ${typeName}`;
    }

    if (reward.type === 'ticket' || reward.type === 'spin' || reward.type === 'masterpass') {
      return `${reward.tier} ${typeName}`;
    }

    if (reward.type === 'custom') {
      return reward.name || 'Custom Reward';
    }

    if (reward.type === 'premium_3d') {
      return '3-Day Premium';
    }

    if (reward.type === 'premium_7d') {
      return '7-Day Premium';
    }

    return typeName;
  };

  return (
    <div
      className={`fixed top-4 right-4 z-[100] transition-all duration-300 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="modal-base max-w-sm p-6 space-y-4 shadow-2xl border-2 border-lime-glow/50 animate-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-lime-glow/20">
            <Trophy className="text-lime-glow" size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-text-primary">Rewards Earned!</h3>
            <p className="text-text-secondary text-sm">You've been rewarded</p>
          </div>
        </div>

        {/* Rewards List */}
        <div className="space-y-2">
          {rewards.map((reward, index) => {
            const Icon = REWARD_ICONS[reward.type] || Gift;
            const colorClass = REWARD_COLORS[reward.type] || 'text-text-primary';

            return (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg bg-navy-accent hover:bg-white/5 transition-colors"
              >
                <Icon size={24} className={colorClass} />
                <span className="font-semibold text-text-primary capitalize">
                  {formatRewardLabel(reward)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-disabled rounded-full h-1 overflow-hidden">
          <div
            className="h-full bg-lime-glow rounded-full animate-progress"
            style={{ animation: `progressBar ${autoClose}ms linear` }}
          />
        </div>
      </div>

      <style>{`
        @keyframes progressBar {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }

        .animate-progress {
          animation: progressBar ${autoClose}ms linear;
        }
      `}</style>
    </div>
  );
};
