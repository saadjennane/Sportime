import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  isDestructive: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText, isDestructive }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 rounded-full">
          <X size={24} />
        </button>
        <div className="text-center">
          {isDestructive && (
            <div className="inline-block bg-red-100 p-3 rounded-full mb-3">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          )}
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-gray-500 mt-2">{message}</p>
        </div>
        <div className="space-y-3">
          <button
            onClick={onConfirm}
            className={`w-full py-3 font-bold rounded-xl shadow-lg transition-all ${isDestructive ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
          >
            {confirmText}
          </button>
          <button onClick={onClose} className="w-full py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
