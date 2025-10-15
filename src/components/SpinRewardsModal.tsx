import React from 'react';
import { X, Gift, Clock } from 'lucide-react';
import { SpinReward, SpinTier, UserSpinState } from '../types';
import { useSpinStore } from '../store/useSpinStore';
import { PITY_TIMER_THRESHOLD } from '../config/spinConstants';
import { formatDistanceToNow } from 'date-fns';

interface SpinRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: SpinReward | null;
  tier: SpinTier;
  userId: string;
}

export const SpinRewardsModal: React.FC<SpinRewardsModalProps> = ({ isOpen, onClose, result, tier, userId }) => {
  const { getUserSpinState } = useSpinStore();
  const userState = getUserSpinState(userId);

  if (!isOpen) return null;

  const pityProgress = (userState.pityCounter / PITY_TIMER_THRESHOLD) * 100;

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-[110] animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-text-primary">Spin Result</h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
            <X size={24} />
          </button>
        </div>

        {result && (
          <div className="text-center bg-deep-navy/50 p-6 rounded-xl border-2 border-warm-yellow">
            <p className="text-text-secondary">You won...</p>
            <div className="text-6xl my-4 mx-auto w-fit text-warm-yellow animate-bounce">
              <Gift />
            </div>
            <h3 className="text-3xl font-bold text-warm-yellow">{result.label}</h3>
          </div>
        )}

        <div className="space-y-3">
          <h4 className="font-bold text-text-secondary">Luck Meter</h4>
          <div className="w-full bg-disabled rounded-full h-4">
            <div
              className="bg-gradient-to-r from-electric-blue to-neon-cyan h-4 rounded-full"
              style={{ width: `${pityProgress}%` }}
            />
          </div>
          <p className="text-xs text-text-disabled text-center">
            Your next spin has an increased chance for a rare reward after {PITY_TIMER_THRESHOLD} non-rare spins.
            Current: {userState.pityCounter}/{PITY_TIMER_THRESHOLD}.
          </p>
        </div>

        <div className="space-y-3 pt-3 border-t border-disabled">
          <h4 className="font-bold text-text-secondary flex items-center gap-2"><Clock size={16} /> Recent Spins</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
            {userState.spinHistory.length > 0 ? userState.spinHistory.map(spin => (
              <div key={spin.id} className="flex justify-between items-center text-sm bg-deep-navy p-2 rounded-lg">
                <span className="font-semibold text-text-primary capitalize">{spin.tier}: <span className="text-electric-blue">{spin.rewardLabel}</span></span>
                <span className="text-xs text-text-disabled">{formatDistanceToNow(new Date(spin.timestamp), { addSuffix: true })}</span>
              </div>
            )) : (
              <p className="text-center text-sm text-text-disabled py-4">No recent spins.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
