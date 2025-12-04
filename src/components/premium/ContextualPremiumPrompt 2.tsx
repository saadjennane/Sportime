import React from 'react';
import { X, Gem } from 'lucide-react';

interface ContextualPremiumPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export const ContextualPremiumPrompt: React.FC<ContextualPremiumPromptProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90] animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full">
          <X size={20} />
        </button>
        <div className="text-center space-y-2">
          <div className="inline-block bg-warm-yellow/10 p-3 rounded-full mb-2">
            <Gem size={28} className="text-warm-yellow" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
          <p className="text-text-secondary">{message}</p>
        </div>
        <div className="flex gap-3 pt-3">
          <button onClick={onClose} className="flex-1 py-2.5 bg-disabled text-text-secondary rounded-lg font-semibold">
            Maybe Later
          </button>
          <button onClick={onConfirm} className="flex-1 primary-button py-2.5">
            Go Premium
          </button>
        </div>
      </div>
    </div>
  );
};
