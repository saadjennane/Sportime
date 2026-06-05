import React, { useState } from 'react';
import { X, Key, Loader2 } from 'lucide-react';
import { useMockStore } from '../../store/useMockStore';
import { useToast } from '../../hooks/useToast';

interface JoinGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JoinGameModal: React.FC<JoinGameModalProps> = ({ isOpen, onClose }) => {
  const { joinLiveSession } = useMockStore();
  const { addToast } = useToast();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 5) return;
    setLoading(true);
    setTimeout(() => { // Simulate network
      const session = joinLiveSession(pin);
      if (session) {
        addToast(`Joined game! Redirecting...`, 'success');
        // In a real app, you would redirect here, e.g., window.location.href = `/live/${session.id}`;
        console.log("Joined session:", session);
        onClose();
      } else {
        addToast('Game not found or expired.', 'error');
      }
      setLoading(false);
      setPin('');
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full">
          <X size={24} />
        </button>
        
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text-primary">Join Game</h2>
          <p className="text-text-secondary mt-1">Enter the 5-digit PIN to join.</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4 pt-4">
          <div>
            <label className="block text-sm font-medium text-text-disabled mb-1" htmlFor="pin-input">
              Game PIN
            </label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warm-yellow" />
              <input
                id="pin-input"
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className="w-full pl-12 pr-4 py-3 bg-deep-navy border-2 border-disabled rounded-xl text-center text-2xl tracking-[0.5em] font-bold"
                required
                placeholder="_ _ _ _ _"
                maxLength={5}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || pin.length !== 5}
            className="w-full primary-button flex items-center justify-center gap-3 text-lg"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Join Game'}
          </button>
        </form>
      </div>
    </div>
  );
};
