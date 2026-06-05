import React from 'react';
import { X, Gift } from 'lucide-react';
import { SpinResult, SpinTier } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface SpinRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastResult: SpinResult | null;
  history: SpinResult[];
  pityCounter: number;
  pityThreshold: number;
}

export const SpinRewardsModal: React.FC<SpinRewardsModalProps> = ({ isOpen, onClose, lastResult, history, pityCounter, pityThreshold }) => {
  if (!isOpen) return null;

  const luckMeterProgress = (pityCounter / pityThreshold) * 100;

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full">
          <X size={24} />
        </button>

        {lastResult ? (
          <div className="text-center space-y-2">
            <div className="inline-block bg-warm-yellow/10 p-4 rounded-full mb-2">
              <Gift size={32} className="text-warm-yellow" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary">Congratulations!</h2>
            <p className="text-lg text-text-secondary">You won a <b className="text-warm-yellow">{lastResult.rewardLabel}</b></p>
          </div>
        ) : (
          <h2 className="text-2xl font-bold text-center text-text-primary">Spin History</h2>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-text-disabled">Luck Meter (Pity Timer)</label>
            <div className="w-full bg-disabled rounded-full h-4 mt-1">
              <div
                className="bg-gradient-to-r from-electric-blue to-neon-cyan h-4 rounded-full"
                style={{ width: `${luckMeterProgress}%` }}
              />
            </div>
            <p className="text-xs text-text-disabled text-center mt-1">Next rare reward guaranteed in {pityThreshold - pityCounter} spins.</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-text-secondary mt-4 mb-2">Recent Wins</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
              {history.length > 0 ? history.map(spin => (
                <div key={spin.id} className="bg-deep-navy p-3 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-text-primary">{spin.rewardLabel}</p>
                    <p className="text-xs text-text-disabled capitalize">{spin.tier} Wheel</p>
                  </div>
                  <p className="text-xs text-text-disabled">{formatDistanceToNow(new Date(spin.timestamp), { addSuffix: true })}</p>
                </div>
              )) : (
                <p className="text-center text-sm text-text-disabled py-4">No recent spins.</p>
              )}
            </div>
          </div>
        </div>
        
        <button onClick={onClose} className="w-full primary-button mt-4">
          Close
        </button>
      </div>
    </div>
  );
};
