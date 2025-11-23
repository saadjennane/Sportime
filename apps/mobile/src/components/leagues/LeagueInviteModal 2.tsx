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
  const inviteLink = `${window.location.origin}/join/${inviteCode}`;

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 rounded-full">
          <X size={24} />
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Invite Members</h2>
          <p className="text-gray-500 mt-1">Share this link with others to let them join your squad.</p>
        </div>
        
        <div className="bg-gray-100 p-3 rounded-xl flex items-center gap-2">
          <input type="text" value={inviteLink} readOnly className="flex-1 bg-transparent text-sm text-gray-600 truncate" />
          <button onClick={handleCopy} className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>

        {isAdmin && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-xs text-gray-500 text-center">As an admin, you can reset the invite link. The old link will stop working.</p>
            <button onClick={onReset} className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-red-600 hover:bg-red-100 p-2 rounded-lg">
              <RefreshCw size={14} /> Reset Invite Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
