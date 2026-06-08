import React, { useState } from 'react';
import { X, Copy, RefreshCw, Check } from 'lucide-react';

interface LeagueInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteCode: string;
  isAdmin: boolean;
  onReset: () => void;
}

export const LeagueInviteModal: React.FC<LeagueInviteModalProps> = ({ isOpen, onClose, inviteCode, isAdmin, onReset }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-navy-accent rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-6 relative border border-white/10">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full">
          <X size={22} />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-text-primary">Invite Members</h2>
          <p className="text-text-secondary text-sm mt-1">Share this code so friends can join your squad.</p>
        </div>

        {/* Invite code (what people enter to join) */}
        <button onClick={handleCopy} className="w-full bg-deep-navy border border-white/10 rounded-2xl p-4 flex items-center justify-between hover:border-electric-blue/40 transition-colors">
          <span className="text-3xl font-extrabold tracking-[0.3em] text-text-primary">{inviteCode}</span>
          <span className="p-2 bg-electric-blue text-white rounded-lg flex-shrink-0">
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </span>
        </button>
        <p className="text-center text-xs text-text-disabled -mt-3">{copied ? 'Copied!' : 'Tap to copy the code'}</p>

        {isAdmin && (
          <div className="border-t border-white/10 pt-4 space-y-2">
            <p className="text-xs text-text-disabled text-center">As an admin, you can reset the code. The old one will stop working.</p>
            <button onClick={onReset} className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-hot-red hover:bg-hot-red/10 p-2.5 rounded-lg">
              <RefreshCw size={14} /> Reset Invite Code
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
