import React from 'react';
import { X, Coins, CheckCircle } from 'lucide-react';
import { CoinPack } from '../../types';

interface PurchaseConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pack: CoinPack;
}

export const PurchaseConfirmationModal: React.FC<PurchaseConfirmationModalProps> = ({ isOpen, onClose, onConfirm, pack }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center space-y-2">
          <div className="inline-block bg-warm-yellow/10 p-3 rounded-full mb-2">
            <Coins size={32} className="text-warm-yellow" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">Confirm Purchase</h2>
          <p className="text-text-secondary">You are about to purchase the <b className="text-text-primary">{pack.name}</b>.</p>
        </div>

        <div className="bg-deep-navy border border-disabled rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center text-lg">
            <span className="font-semibold text-text-secondary">Coins</span>
            <span className="font-bold text-warm-yellow">{pack.coins.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold text-text-secondary">Bonus</span>
            <span className="font-bold text-lime-glow">+{pack.bonus}%</span>
          </div>
          <div className="flex justify-between items-center text-xl font-bold pt-2 border-t border-disabled">
            <span className="text-text-primary">Total</span>
            <span className="text-electric-blue">{pack.priceEUR.toFixed(2)} €</span>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <button onClick={onConfirm} className="w-full primary-button flex items-center justify-center gap-2">
            <CheckCircle size={18} /> Confirm & Pay
          </button>
          <button onClick={onClose} className="w-full py-3 text-sm font-semibold text-text-secondary hover:bg-white/10 rounded-xl">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
