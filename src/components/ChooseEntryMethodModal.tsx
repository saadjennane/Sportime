import React from 'react';
import { X, Coins, Ticket } from 'lucide-react';
import { BettingChallenge } from '../types';

interface ChooseEntryMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMethod: (method: 'coins' | 'ticket') => void;
  challenge: BettingChallenge;
}

export const ChooseEntryMethodModal: React.FC<ChooseEntryMethodModalProps> = ({
  isOpen,
  onClose,
  onSelectMethod,
  challenge,
}) => {
  if (!isOpen) return null;

  const tierDetails = {
    rookie: { label: 'Rookie', color: 'text-lime-glow' },
    pro: { label: 'Pro', color: 'text-warm-yellow' },
    elite: { label: 'Elite', color: 'text-hot-red' },
  };
  const tierInfo = tierDetails[challenge.tournament_type];

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-center text-text-primary">How do you want to join?</h2>
        <p className="text-center text-text-secondary -mt-2">{challenge.name}</p>

        <div className="space-y-3 pt-2">
          <button
            onClick={() => onSelectMethod('coins')}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-deep-navy hover:bg-navy-accent border-2 border-disabled hover:border-electric-blue transition-colors"
          >
            <div className="flex items-center gap-3">
              <Coins className="w-6 h-6 text-warm-yellow" />
              <span className="font-bold text-text-primary">Use Coins</span>
            </div>
            <span className="font-semibold text-warm-yellow">{challenge.entryCost.toLocaleString()}</span>
          </button>

          <button
            onClick={() => onSelectMethod('ticket')}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-deep-navy hover:bg-navy-accent border-2 border-disabled hover:border-electric-blue transition-colors"
          >
            <div className="flex items-center gap-3">
              <Ticket className={`w-6 h-6 ${tierInfo.color}`} />
              <span className="font-bold text-text-primary">Use Ticket</span>
            </div>
            <span className={`font-semibold capitalize ${tierInfo.color}`}>{tierInfo.label}</span>
          </button>
        </div>

        <div className="text-center">
          <button
            onClick={onClose}
            className="py-2 px-4 text-sm font-semibold text-text-secondary hover:bg-white/10 rounded-xl"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
