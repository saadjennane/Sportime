import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Gift, Loader2 } from 'lucide-react';
import { useSpinWheel } from '../../hooks/useSpinWheel';
import { FREE_SPIN_REWARDS } from '../../data/mockFunZone';

interface FreeSpinwheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const FreeSpinwheelModal: React.FC<FreeSpinwheelModalProps> = ({ isOpen, onClose, userId, addToast }) => {
  const { spin, canClaimFreeSpin, claimFreeSpin, isLoading, nextFreeSpinAt } = useSpinWheel({ userId });
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [finalReward, setFinalReward] = useState<string | null>(null);

  const anglePerSlice = 360 / FREE_SPIN_REWARDS.length;

  const handleSpin = async () => {
    if (isSpinning) return;

    // First, try to claim the daily free spin
    if (!canClaimFreeSpin) {
      const hoursLeft = nextFreeSpinAt
        ? Math.ceil((nextFreeSpinAt.getTime() - Date.now()) / (1000 * 60 * 60))
        : 24;
      addToast(`Next free spin in ${hoursLeft}h`, 'info');
      onClose();
      return;
    }

    try {
      setIsSpinning(true);
      setFinalReward(null);

      // Claim the free spin first
      const claimResult = await claimFreeSpin();

      if (!claimResult.success) {
        addToast(claimResult.message, 'info');
        setIsSpinning(false);
        onClose();
        return;
      }

      // Perform the spin
      const spinResult = await spin('free');

      if (!spinResult) {
        addToast('Spin failed. Please try again.', 'error');
        setIsSpinning(false);
        return;
      }

      // Find the winning slice index
      const winningIndex = FREE_SPIN_REWARDS.findIndex(r =>
        r.label === spinResult.reward.label ||
        r.type === spinResult.reward.category
      ) || 0;

      const baseRotation = 360 * 5;
      const targetAngle = (winningIndex * anglePerSlice) + (anglePerSlice / 2);
      const randomOffset = Math.random() * (anglePerSlice * 0.8) - (anglePerSlice * 0.4);
      const finalRotation = baseRotation - targetAngle - randomOffset;

      setRotation(finalRotation);

      setTimeout(() => {
        setIsSpinning(false);
        setFinalReward(spinResult.reward.label);
        addToast(`You won: ${spinResult.reward.label}`, 'success');
      }, 4000);
    } catch (error) {
      console.error('[FreeSpinwheelModal] Error:', error);
      addToast('Failed to perform spin', 'error');
      setIsSpinning(false);
    }
  };

  if (!isOpen) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-xl flex items-center justify-center z-[60]">
        <Loader2 size={48} className="animate-spin text-electric-blue" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-xl flex flex-col items-center justify-center z-[60] animate-scale-in">
      <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full z-10">
        <X size={24} />
      </button>

      <div className="relative w-[95vw] h-[95vw] max-w-lg max-h-lg flex items-center justify-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
          <div className="w-0 h-0 border-l-8 border-r-8 border-b-16 border-l-transparent border-r-transparent border-b-warm-yellow"></div>
        </div>

        <motion.div
          className="relative w-full h-full rounded-full"
          style={{
            backgroundImage: `conic-gradient(from 0deg, ${FREE_SPIN_REWARDS.map((_, i) => `var(--tw-gradient-from) ${i * anglePerSlice}deg, var(--tw-gradient-to) ${(i + 1) * anglePerSlice}deg`).join(', ')})`,
          }}
          animate={{ rotate: rotation }}
          transition={{ duration: 4, ease: 'easeOut' }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-radial from-lime-glow/20 to-lime-glow/5" />
          {FREE_SPIN_REWARDS.map((reward, index) => {
            const angle = index * anglePerSlice;
            return (
              <React.Fragment key={reward.label}>
                <div
                  className="absolute w-full h-full"
                  style={{ transform: `rotate(${angle + anglePerSlice / 2}deg)` }}
                >
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-48 text-center flex flex-col items-center gap-1">
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

        <div className="absolute w-1/3 h-1/3">
          <button
            onClick={handleSpin}
            disabled={isSpinning || !canClaimFreeSpin}
            className="w-full h-full rounded-full bg-deep-navy border-4 border-lime-glow flex flex-col items-center justify-center shadow-2xl transition-transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:border-disabled"
          >
            {isSpinning ? (
              <Loader2 size={24} className="animate-spin text-white" />
            ) : (
              <span className="font-extrabold text-2xl tracking-wider text-white">SPIN</span>
            )}
          </button>
        </div>
      </div>

      {finalReward && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute bottom-10 text-center"
        >
          <div className="bg-navy-accent/80 backdrop-blur-md p-4 rounded-xl shadow-lg flex items-center gap-2">
            <Gift size={20} className="text-warm-yellow" />
            <p className="text-lg font-bold text-warm-yellow">{finalReward}</p>
          </div>
        </motion.div>
      )}

      {!canClaimFreeSpin && nextFreeSpinAt && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-10 text-center"
        >
          <div className="bg-navy-accent/80 backdrop-blur-md p-3 rounded-xl shadow-lg">
            <p className="text-sm text-text-secondary">
              Next free spin: {new Date(nextFreeSpinAt).toLocaleTimeString()}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};
