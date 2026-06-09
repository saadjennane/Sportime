import React, { useState } from 'react';
import { X, Copy, Share2, UserPlus, Check } from 'lucide-react';
import { inviteByUsername, buildInviteLink } from '../../services/masterpassService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  inviteId: string;
  token: string;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const MasterpassInviteModal: React.FC<Props> = ({ isOpen, onClose, inviteId, token, addToast }) => {
  const [username, setUsername] = useState('');
  const [copied, setCopied] = useState(false);
  const [inviting, setInviting] = useState(false);
  if (!isOpen) return null;
  const link = buildInviteLink(token);

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { addToast('Could not copy', 'error'); }
  };
  const share = async () => {
    try {
      if ((navigator as any).share) await (navigator as any).share({ title: 'Join me on Sportime', text: 'Join my game with a free MasterPass entry!', url: link });
      else copy();
    } catch { /* user cancelled */ }
  };
  const sendUsername = async () => {
    if (!username.trim()) return;
    setInviting(true);
    const res = await inviteByUsername(inviteId, username.trim());
    setInviting(false);
    if (res?.ok) { addToast(`Invited ${username}`, 'success'); setUsername(''); }
    else addToast(res?.error === 'user_not_found' ? 'Username not found' : (res?.error || 'Invite failed'), 'error');
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/70 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full"><X className="w-6 h-6" /></button>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text-primary">Invite your +1 🎟️</h2>
          <p className="text-sm text-text-secondary mt-1">You're in! Bring a friend for free with your MasterPass.</p>
        </div>

        {/* Username invite */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-text-secondary uppercase">Invite by username</label>
          <div className="flex gap-2">
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="@username"
              className="flex-1 bg-deep-navy border-2 border-disabled rounded-xl px-3 py-2.5 text-text-primary focus:border-electric-blue outline-none" />
            <button onClick={sendUsername} disabled={inviting || !username.trim()}
              className="bg-electric-blue text-white px-4 rounded-xl font-semibold flex items-center gap-1 disabled:opacity-50"><UserPlus size={18} /></button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-text-disabled text-xs"><div className="flex-1 h-px bg-white/10" />or share a link<div className="flex-1 h-px bg-white/10" /></div>

        {/* Share link */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-deep-navy border border-white/10 rounded-xl px-3 py-2.5">
            <span className="flex-1 text-sm text-text-secondary truncate">{link}</span>
            <button onClick={copy} className="text-electric-blue">{copied ? <Check size={18} /> : <Copy size={18} />}</button>
          </div>
          <button onClick={share} className="w-full bg-lime-glow text-deep-navy font-bold py-3 rounded-xl flex items-center justify-center gap-2"><Share2 size={18} /> Share invite</button>
        </div>

        <p className="text-center text-xs text-text-disabled">You can re‑open this from the game until a friend joins.</p>
      </div>
    </div>
  );
};
