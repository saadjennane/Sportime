import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gift } from 'lucide-react';
import { SpinTier, SpinReward, UserSpinState } from '../types';
import { SPIN_REWARDS } from '../config/spinConstants';
import { useSpinStore } from '../store/useSpinStore';
import { initialUserSpinState } from '../store/useSpinStore';

interface SpinWheelProps {
  isOpen: boolean;
  onClose: () => void;
  tier: SpinTier;
  userId: string;
}

const tierColors = {
  rookie: 'from-lime-glow/50 to-green-400/50',
  pro: 'from-warm-yellow/50 to-orange-400/50',
  elite: 'from-hot-red/50 to-red-500/50',
};

const tierCenterColors = {
  rookie: 'border-lime-glow',
  pro: 'border-warm-yellow',
  elite: 'border-hot-red',
};

const rewardIcons: Record<string, React.ReactNode> = {
  ticket_rookie: <Gift />,
  ticket_pro: <Gift />,
  ticket_elite: <Gift />,
  extra_spin: <Gift />,
  masterpass_rookie: <Gift />,
  masterpass_pro: <Gift />,
  masterpass_elite: <Gift />,
  boost_50: <Gift />,
  boost_100: <Gift />,
  boost_200: <Gift />,
  boost_400: <Gift />,
  boost_800: <Gift />,
  boost_1200: <Gift />,
  premium_3d: <Gift />,
  premium_7d: <Gift />,
  gift_card: <Gift />,
};

export const SpinWheel: React.FC<SpinWheelProps> = ({ isOpen, onClose, tier, userId }) => {
  const { performSpin } = useSpinStore();
  const userState = useSpinStore(state => state.userSpinStates[userId]);
  const memoizedUserState = useMemo(() => userState || initialUserSpinState(userId), [userState, userId]);

  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [finalReward, setFinalReward] = useState<SpinReward | null>(null);

  const rewards = SPIN_REWARDS[tier];
  const anglePerSlice = 360 / rewards.length;

  useEffect(() => {
    if (!isOpen) {
      setIsSpinning(false);
      setRotation(0);
      setFinalReward(null);
    }
  }, [isOpen]);

  const handleSpin = async () => {
    if (isSpinning || memoizedUserState.availableSpins[tier] <= 0) return;

    setIsSpinning(true);
    setFinalReward(null);

    const spinResult = await performSpin(userId, tier);
    if (!spinResult) {
      setIsSpinning(false);
      return;
    }

    const winningReward = rewards.find(r => r.id === spinResult.rewardId);
    if (!winningReward) {
      setIsSpinning(false);
      return;
    }
    
    const winningIndex = rewards.findIndex(r => r.id === winningReward.id);
    const baseRotation = 360 * 5; // 5 full spins
    const targetAngle = (winningIndex * anglePerSlice) + (anglePerSlice / 2);
    const randomOffset = Math.random() * (anglePerSlice * 0.8) - (anglePerSlice * 0.4);
    const finalRotation = baseRotation - targetAngle - randomOffset;

    setRotation(finalRotation);

    setTimeout(() => {
      setIsSpinning(false);
      setFinalReward(winningReward);
    }, 4000); // Corresponds to animation duration
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-xl flex flex-col items-center justify-center z-[60] animate-scale-in">
      <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full z-10">
        <X size={24} />
      </button>

      <div className="relative w-[95vw] h-[95vw] max-w-lg max-h-lg flex items-center justify-center">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
          <div className="w-0 h-0 border-l-8 border-r-8 border-b-16 border-l-transparent border-r-transparent border-b-warm-yellow"></div>
        </div>

        {/* Wheel */}
        <motion.div
          className="relative w-full h-full rounded-full"
          style={{
            backgroundImage: `conic-gradient(from 0deg, ${rewards.map((_, i) => `var(--tw-gradient-from) ${i * anglePerSlice}deg, var(--tw-gradient-to) ${(i + 1) * anglePerSlice}deg`).join(', ')})`,
          }}
          animate={{ rotate: rotation }}
          transition={{ duration: 4, ease: 'easeOut' }}
        >
          <div className={`absolute inset-0 rounded-full bg-gradient-radial ${tierColors[tier]}`} />
          {rewards.map((reward, index) => {
            const angle = index * anglePerSlice;
            return (
              <React.Fragment key={reward.id}>
                <div
                  className="absolute w-full h-full"
                  style={{ transform: `rotate(${angle + anglePerSlice / 2}deg)` }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 text-center flex flex-col items-center gap-1">
                    <div className="text-white text-2xl">{rewardIcons[reward.id]}</div>
                    <p className="text-xs font-bold text-white uppercase tracking-wider" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                      {reward.label}
                    </p>
                  </div>
                </div>
                {index > 0 && (
                  <div
                    className="absolute top-0 left-1/2 w-px h-1/2 bg-white/20"
                    style={{ transform: `rotate(${angle}deg)`, transformOrigin: 'bottom' }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </motion.div>

        {/* Center Button */}
        <div className="absolute w-1/3 h-1/3">
          <button
            onClick={handleSpin}
            disabled={isSpinning || memoizedUserState.availableSpins[tier] <= 0}
            className={`w-full h-full rounded-full bg-deep-navy border-4 ${tierCenterColors[tier]} flex flex-col items-center justify-center shadow-2xl transition-transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed`}
          >
            <span className="font-extrabold text-2xl tracking-wider text-white">SPIN</span>
            <span className="text-xs font-semibold text-text-disabled">{memoizedUserState.availableSpins[tier]} left</span>
          </button>
        </div>
      </div>
      
      <AnimatePresence>
        {finalReward && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-10 text-center"
          >
            <div className="bg-navy-accent/80 backdrop-blur-md p-4 rounded-xl shadow-lg">
              <p className="text-sm text-text-secondary">You won...</p>
              <p className="text-2xl font-bold text-warm-yellow">{finalReward.label}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
