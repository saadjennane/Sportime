import React, { useState } from 'react';
import { X, Users, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const MasterpassClaimModal: React.FC<Props> = ({ isOpen, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);
  if (!isOpen) return null;
  const claim = async () => { setLoading(true); try { await onConfirm(); } finally { setLoading(false); } };
  return (
    <div className="fixed inset-0 bg-deep-navy/70 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-5 relative text-center">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full"><X className="w-6 h-6" /></button>
        <div className="w-16 h-16 mx-auto rounded-full bg-hot-red/15 flex items-center justify-center"><Users size={30} className="text-hot-red" /></div>
        <div>
          <h2 className="text-2xl font-bold text-text-primary">You're invited! 🎟️</h2>
          <p className="text-sm text-text-secondary mt-1">A friend used a MasterPass to bring you into their game — your entry is <b className="text-lime-glow">free</b>.</p>
        </div>
        <button onClick={claim} disabled={loading} className="w-full bg-lime-glow text-deep-navy font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Join free'}
        </button>
        <button onClick={onClose} className="w-full py-2 text-sm font-semibold text-text-secondary hover:bg-white/10 rounded-xl">Maybe later</button>
      </div>
    </div>
  );
};
