import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Star, Ticket, Gift } from 'lucide-react';
import { SpinTier, SpinReward } from '../types';
import { SPIN_REWARDS } from '../config/spinConstants';
import { useSpinStore } from '../store/useSpinStore';
import { SpinRewardsModal } from './SpinRewardsModal';

interface SpinWheelProps {
  isOpen: boolean;
  onClose: () => void;
  tier: SpinTier;
}

const tierColors: Record<SpinTier, { text: string }> = {
  rookie: { text: 'text-lime-glow' },
  pro: { text: 'text-warm-yellow' },
  elite: { text: 'text-hot-red' },
};

export const SpinWheel: React.FC<SpinWheelProps> = ({ isOpen, onClose, tier }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinReward | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const { performSpin, getUserSpinState } = useSpinStore();

  const rewards = SPIN_REWARDS[tier];
  const segmentAngle = 360 / rewards.length;
  const userState = getUserSpinState('user-1'); // Hardcoded user for now

  const handleSpin = () => {
    if (isSpinning || userState.availableSpins[tier] <= 0) return;

    setIsSpinning(true);
    setResult(null);

    const spinResult = performSpin(tier, 'user-1');
    const winningReward = rewards.find(r => r.id === spinResult.rewardId)!;
    const winnerIndex = rewards.findIndex(r => r.id === winningReward.id);

    const randomOffset = (Math.random() - 0.5) * (segmentAngle * 0.8);
    const targetRotation = 360 * 5 - (winnerIndex * segmentAngle) - (segmentAngle / 2) + randomOffset;
    
    setRotation(prev => prev + targetRotation);

    setTimeout(() => {
      setIsSpinning(false);
      setResult(winningReward);
      setIsResultModalOpen(true);
    }, 4000); // Corresponds to animation duration
  };

  const getIconForReward = (reward: SpinReward) => {
    if (reward.category.includes('ticket')) return <Ticket />;
    if (reward.category.includes('boost')) return <Star />;
    return <Gift />;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-deep-navy/90 backdrop-blur-lg z-[100] flex flex-col items-center justify-center p-4">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full z-20">
          <X size={24} />
        </button>

        <h2 className={`text-3xl font-bold mb-4 capitalize ${tierColors[tier].text}`}>{tier} Spin Wheel</h2>
        <p className="text-text-secondary mb-8">You have {userState.availableSpins[tier]} spin(s) available.</p>

        <div className="relative w-80 h-80 md:w-96 md:h-96">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 drop-shadow-lg">
            <div className="w-0 h-0 
              border-l-[12px] border-l-transparent
              border-r-[12px] border-r-transparent
              border-t-[20px] border-t-warm-yellow">
            </div>
          </div>
          
          {/* Wheel */}
          <motion.div
            className="absolute inset-0 rounded-full border-8 border-navy-accent shadow-2xl"
            animate={{ rotate: rotation }}
            transition={{ duration: 4, ease: 'easeOut' }}
          >
            {rewards.map((reward, i) => (
              <div
                key={reward.id}
                className="absolute w-1/2 h-1/2 origin-bottom-right"
                style={{
                  transform: `rotate(${i * segmentAngle}deg)`,
                }}
              >
                <div
                  className={`absolute inset-[-100%] rounded-full ${i % 2 === 0 ? 'bg-electric-blue/20' : 'bg-neon-cyan/20'}`}
                  style={{
                    clipPath: `polygon(50% 50%, 100% 0, 100% 100%)`,
                    transform: `rotate(${segmentAngle / 2}deg) scale(0.98)`,
                  }}
                />
                <div
                  className="absolute w-full h-full flex justify-center items-start pt-4 text-text-primary"
                  style={{ transform: `rotate(${segmentAngle / 2}deg) translate(0, -20%)` }}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="text-2xl">{getIconForReward(reward)}</div>
                    <p className="text-xs font-semibold mt-1 w-16 break-words">{reward.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
          
          {/* Center Button */}
          <button
            onClick={handleSpin}
            disabled={isSpinning || userState.availableSpins[tier] <= 0}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-navy-accent rounded-full border-4 border-warm-yellow flex items-center justify-center text-warm-yellow font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            SPIN
          </button>
        </div>
      </div>
      <SpinRewardsModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        result={result}
        tier={tier}
        userId="user-1"
      />
    </>
  );
};
