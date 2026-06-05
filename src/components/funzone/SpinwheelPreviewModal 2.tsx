import React from 'react';
import { X, Gift } from 'lucide-react';
import { SpinTier, SpinReward } from '../../types';
import { SPIN_REWARDS } from '../../config/spinConstants';
import { FREE_SPIN_REWARDS } from '../../data/mockFunZone';

interface SpinwheelPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: SpinTier;
}

const tierDetails = {
  free: { title: "Free Spin" },
  rookie: { title: "Rookie Spin" },
  pro: { title: "Pro Spin" },
  elite: { title: "Elite Spin" },
  premium: { title: "Premium Spin" },
};

export const SpinwheelPreviewModal: React.FC<SpinwheelPreviewModalProps> = ({ isOpen, onClose, tier }) => {
  if (!isOpen) return null;

  const rewards = tier === 'free' ? FREE_SPIN_REWARDS.map(r => ({...r, id: r.label, baseChance: r.probability, category: r.type})) : (SPIN_REWARDS[tier] || []);
  const details = tierDetails[tier];

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full">
          <X size={24} />
        </button>

        <div className="text-center space-y-2">
          <div className="inline-block bg-warm-yellow/10 p-4 rounded-full mb-2">
            <Gift size={32} className="text-warm-yellow" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">{details.title} Rewards</h2>
          <p className="text-sm text-text-secondary">Unlock this wheel with a {tier} ticket to win bigger rewards!</p>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
          {rewards.map(reward => (
            <div key={reward.id} className="bg-deep-navy p-3 rounded-lg">
              <p className="font-semibold text-text-primary capitalize">{reward.label}</p>
            </div>
          ))}
        </div>
        
        <button onClick={() => alert('Ticket acquisition info coming soon!')} className="w-full primary-button mt-4">
          How to Get Tickets
        </button>
      </div>
    </div>
  );
};
