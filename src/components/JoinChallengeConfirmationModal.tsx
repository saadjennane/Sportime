import React from 'react';
import { X, Coins, ShieldAlert, CheckCircle, Ticket } from 'lucide-react';
import { BettingChallenge, UserTicket } from '../types';

interface JoinChallengeConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  challenge: BettingChallenge;
  userBalance: number;
  availableTicket?: UserTicket;
}

export const JoinChallengeConfirmationModal: React.FC<JoinChallengeConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  challenge,
  userBalance,
  availableTicket,
}) => {
  if (!isOpen) return null;

  const hasSufficientFunds = userBalance >= challenge.entryCost;
  const canJoin = availableTicket || hasSufficientFunds;

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-center text-text-primary">Join Challenge</h2>

        <div className="bg-deep-navy border border-disabled rounded-2xl p-4 text-center space-y-2">
          <p className="text-lg font-bold text-electric-blue">{challenge.name}</p>
          <div>
            <p className="text-sm text-text-disabled">Entry Cost</p>
            <div className="flex items-center justify-center gap-2">
              <Coins className="w-6 h-6 text-warm-yellow" />
              <p className="text-3xl font-bold text-text-primary">{challenge.entryCost.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {availableTicket ? (
          <div className="bg-lime-glow/10 border border-lime-glow/20 text-lime-glow p-3 rounded-xl flex items-center gap-3">
            <Ticket size={20} />
            <p className="text-sm font-medium">
              You have a <b className="capitalize">{availableTicket.type}</b> ticket! It will be used for entry.
            </p>
          </div>
        ) : hasSufficientFunds ? (
          <div className="bg-lime-glow/10 border border-lime-glow/20 text-lime-glow p-3 rounded-xl flex items-center gap-3">
            <CheckCircle size={20} />
            <p className="text-sm font-medium">
              You have enough coins to join. This amount will be deducted from your balance.
            </p>
          </div>
        ) : (
          <div className="bg-hot-red/10 border border-hot-red/20 text-hot-red p-3 rounded-xl flex items-center gap-3">
            <ShieldAlert size={20} />
            <p className="text-sm font-medium">
              You do not have enough coins or tickets to join this challenge.
            </p>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            onClick={onConfirm}
            disabled={!canJoin}
            className="w-full primary-button"
          >
            {canJoin ? 'Confirm & Join' : 'Insufficient Funds'}
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 bg-disabled/50 hover:bg-disabled/80 rounded-xl font-bold text-text-secondary transition-colors"
          >
            Cancel
          </button>
          <div className="text-center">
            <span className="text-sm text-text-secondary">
              Your Balance: <span className="font-semibold text-warm-yellow">{userBalance.toLocaleString()} coins</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
