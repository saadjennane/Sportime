import React from 'react';
import { X, Coins, Ticket } from 'lucide-react';
import { BettingChallenge, TournamentType } from '../types';

interface ChooseEntryMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMethod: (method: 'coins' | 'ticket') => void;
  challenge: BettingChallenge;
  hasCoins?: boolean;
  hasTicket?: boolean;
}

const tierDetails: Record<TournamentType, { label: string; color: string }> = {
  amateur: { label: 'Amateur', color: 'text-lime-glow' },
  master: { label: 'Master', color: 'text-warm-yellow' },
  apex: { label: 'Apex', color: 'text-hot-red' },
};

export const ChooseEntryMethodModal: React.FC<ChooseEntryMethodModalProps> = ({
  isOpen,
  onClose,
  onSelectMethod,
  challenge,
  hasCoins = true,
  hasTicket = true,
}) => {
  if (!isOpen) return null;

  const tier = tierDetails[challenge.tier];

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-center text-text-primary">Confirm your entry</h2>
        <p className="text-center text-sm text-text-secondary -mt-3">Choose how you want to enter this challenge.</p>

        <div className="space-y-3 pt-2">
          <button
            onClick={() => hasCoins && onSelectMethod('coins')}
            disabled={!hasCoins}
            className="w-full flex items-center justify-between p-4 bg-deep-navy rounded-xl border-2 border-disabled transition-all enabled:hover:bg-navy-accent enabled:hover:border-electric-blue disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="font-bold text-lg text-text-primary">Use Coins</span>
            <div className="flex items-center gap-2 font-semibold text-warm-yellow">
              <Coins size={20} />
              <span>{challenge.entry_cost.toLocaleString()}</span>
            </div>
          </button>
          <button
            onClick={() => hasTicket && onSelectMethod('ticket')}
            disabled={!hasTicket}
            className="w-full flex items-center justify-between p-4 bg-deep-navy rounded-xl border-2 border-disabled transition-all enabled:hover:bg-navy-accent enabled:hover:border-electric-blue disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="font-bold text-lg text-text-primary">Use Ticket</span>
            <div className={`flex items-center gap-2 font-semibold ${tier.color}`}>
              <Ticket size={20} />
              <span className="capitalize">{hasTicket ? tier.label : 'None'}</span>
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 text-sm font-semibold text-text-secondary hover:bg-white/10 rounded-xl"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
