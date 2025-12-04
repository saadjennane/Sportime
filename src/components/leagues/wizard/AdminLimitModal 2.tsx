import React from 'react';
import { X, ShieldAlert } from 'lucide-react';

interface AdminLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  limitType: 'active_limit' | 'monthly_limit' | null;
}

export const AdminLimitModal: React.FC<AdminLimitModalProps> = ({ isOpen, onClose, limitType }) => {
  if (!isOpen) return null;

  const content = {
    active_limit: {
      title: 'Active Game Limit Reached',
      message: 'You can only have 2 active paid tournaments at once.',
    },
    monthly_limit: {
      title: 'Monthly Limit Reached',
      message: 'You have reached your monthly limit of 5 paid tournaments.',
    },
  };

  const currentContent = limitType ? content[limitType] : content.monthly_limit;

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full">
          <X size={24} />
        </button>
        <div className="text-center">
          <div className="inline-block bg-hot-red/10 p-3 rounded-full mb-3">
            <ShieldAlert className="w-8 h-8 text-hot-red" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">{currentContent.title}</h2>
          <p className="text-text-secondary mt-2">
            Upgrade your admin level to unlock more paid games and premium tools.
          </p>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => alert('Admin upgrade path coming soon!')}
            className="w-full primary-button"
          >
            Upgrade Admin Level
          </button>
          <button onClick={onClose} className="w-full py-3 text-sm font-semibold text-text-secondary hover:bg-white/10 rounded-xl">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
