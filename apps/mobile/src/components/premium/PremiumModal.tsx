import React from 'react';
import { X, CheckCircle } from 'lucide-react';
import { PREMIUM_BENEFITS } from '../../config/premiumBenefits';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: (plan: 'monthly' | 'seasonal') => void;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({ isOpen, onClose, onSubscribe }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-lg flex items-center justify-center p-4 z-[100] animate-scale-in">
      <div className="modal-base max-w-md w-full p-6 space-y-6 relative border-2 border-warm-yellow/50">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full">
          <X size={24} />
        </button>
        
        <div className="text-center">
          <h2 className="text-3xl font-bold text-warm-yellow">💎 Go Premium</h2>
          <p className="text-text-secondary mt-1">Unlock the ultimate Sportime experience.</p>
        </div>

        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
          {PREMIUM_BENEFITS.map(benefit => (
            <div key={benefit.title} className="flex items-start gap-3">
              <div className="text-xl mt-0.5">{benefit.icon}</div>
              <div>
                <h4 className="font-semibold text-text-primary">{benefit.title}</h4>
                <p className="text-xs text-text-disabled">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-deep-navy/50 p-3 rounded-lg text-center">
          <p className="text-sm font-semibold text-lime-glow">One-time welcome bonus: +5,000 Coins! ✨</p>
        </div>

        <div className="space-y-3 pt-2">
          <button onClick={() => onSubscribe('monthly')} className="w-full primary-button">
            Subscribe – €7.99/month
          </button>
          <button onClick={() => onSubscribe('seasonal')} className="w-full secondary-button">
            Subscribe – €39.99 / 6 months
          </button>
        </div>
      </div>
    </div>
  );
};
