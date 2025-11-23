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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-6 relative border border-purple-500/20">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-700/50 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center">
          <div className="inline-block bg-gradient-to-br from-purple-600 to-blue-600 p-3 rounded-full mb-3">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Create Your Account</h2>
          <p className="text-gray-300 mt-2">
            Want to save your progress, join challenges, and earn XP? Create a free Sportime account!
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={onConfirm}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 hover:from-purple-700 hover:to-blue-700 transition-all"
          >
            Create Account
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 text-sm font-semibold text-gray-400 hover:bg-gray-700/50 rounded-xl transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};
