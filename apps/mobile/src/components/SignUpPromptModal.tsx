import React from 'react';
import { X, Gamepad2 } from 'lucide-react';

interface SignUpPromptModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const SignUpPromptModal: React.FC<SignUpPromptModalProps> = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-scale-in">
      <div className="w-full max-w-sm bg-deep-navy rounded-2xl p-6 space-y-6 relative border border-white/10 shadow-2xl">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="inline-flex items-center justify-center bg-electric-blue/15 p-3 rounded-full mb-3">
            <Gamepad2 className="w-8 h-8 text-electric-blue" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">Create Your Account</h2>
          <p className="text-text-secondary mt-2">
            Want to save your progress, join challenges, and earn XP? Create a free Sportime account!
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={onConfirm}
            className="w-full py-3.5 bg-electric-blue text-white font-bold rounded-xl hover:brightness-110 transition"
          >
            Create Account
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};
