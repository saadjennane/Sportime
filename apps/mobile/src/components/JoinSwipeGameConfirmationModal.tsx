import React from 'react';
import { X, Coins, ShieldAlert, CheckCircle } from 'lucide-react';
import { SwipeMatchDay } from '../types';

interface JoinSwipeGameConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  game: SwipeMatchDay;
  userBalance: number;
}

export const JoinSwipeGameConfirmationModal: React.FC<JoinSwipeGameConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  game,
  userBalance,
}) => {
  if (!isOpen) return null;

  const hasSufficientFunds = userBalance >= game.entry_cost;

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

        <div className="bg-deep-navy border border-white/10 rounded-2xl p-4 text-center space-y-2">
          <p className="text-lg font-bold text-electric-blue">{game.name}</p>
          <div>
            <p className="text-sm text-text-secondary">Entry Cost</p>
            <div className="flex items-center justify-center gap-2">
              <Coins className="w-6 h-6 text-warm-yellow" />
              <p className="text-3xl font-bold text-text-primary">{game.entry_cost.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {hasSufficientFunds ? (
          <div className="bg-lime-glow/10 border border-lime-glow/30 text-lime-glow p-3 rounded-xl flex items-center gap-3">
            <CheckCircle size={20} className="flex-shrink-0" />
            <p className="text-sm font-medium">
              This amount will be deducted from your balance when you join.
            </p>
          </div>
        ) : (
          <div className="bg-hot-red/10 border border-hot-red/30 text-hot-red p-3 rounded-xl flex items-center gap-3">
            <ShieldAlert size={20} className="flex-shrink-0" />
            <p className="text-sm font-medium">
              You don't have enough coins to join this game.
            </p>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            onClick={onConfirm}
            disabled={!hasSufficientFunds}
            className="w-full py-3.5 px-6 primary-button disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {hasSufficientFunds ? 'Confirm & Join' : 'Insufficient Funds'}
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 px-6 bg-navy-accent hover:bg-white/10 rounded-xl font-bold text-text-secondary transition-colors"
          >
            Cancel
          </button>
          <div className="text-center">
            <span className="text-sm text-text-secondary">
              Your Balance: <span className="font-semibold text-text-primary">{userBalance.toLocaleString()} coins</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
