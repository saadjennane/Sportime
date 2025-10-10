import React, { useState, useRef } from 'react';
import { X, Copy, Check, RefreshCw } from 'lucide-react';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteCode: string;
  onReset: (leagueId: string) => void;
  leagueId: string;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, inviteCode, onReset, leagueId, addToast }) => {
  const [copied, setCopied] = useState(false);
  const inviteLink = `${window.location.origin}/join/${inviteCode}`;
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      // Try the modern Clipboard API first
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      addToast('Invite link copied!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text automatically: ', err);
      // Fallback for environments where the Clipboard API is blocked
      if (inputRef.current) {
        inputRef.current.select();
        inputRef.current.setSelectionRange(0, 99999); // For mobile devices
        addToast('Could not copy automatically. Link selected!', 'info');
      } else {
        addToast('Failed to copy link.', 'error');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 rounded-full">
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold text-center text-gray-900">Invite Members</h2>
        
        <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Share this link with your friends:</label>
            <div className="flex items-center gap-2">
                <input
                    ref={inputRef}
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg font-mono text-sm"
                />
                <button onClick={handleCopy} className="p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                    {copied ? <Check size={20} className="text-green-600" /> : <Copy size={20} />}
                </button>
            </div>
        </div>

        <div className="border-t pt-4 space-y-2">
            <p className="text-sm text-gray-600">If you think your link has been compromised, you can reset it.</p>
            <button onClick={() => onReset(leagueId)} className="w-full flex items-center justify-center gap-2 py-2 bg-red-100 text-red-700 font-semibold rounded-lg hover:bg-red-200">
                <RefreshCw size={16} /> Reset Invite Link
            </button>
        </div>
      </div>
    </div>
  );
};
