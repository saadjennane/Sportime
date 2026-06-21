import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { X, Mail, Loader2, Gamepad2 } from 'lucide-react';

interface MagicLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MagicLinkModal: React.FC<MagicLinkModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      setMessage('Success! Check your email for the magic link to sign in.');
    } catch (err: any) {
      setError(err.error_description || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-deep-navy rounded-t-2xl sm:rounded-2xl p-6 space-y-6 relative animate-scale-in border-t border-white/10 sm:border" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="inline-flex items-center justify-center bg-electric-blue/15 p-3 rounded-full mb-3">
            <Gamepad2 className="w-8 h-8 text-electric-blue" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">Sign In to Join</h2>
          <p className="text-sm text-text-secondary mt-1">
            Create an account or sign in to save your progress and join challenges.
          </p>
        </div>

        <form onSubmit={handleMagicLink} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5" htmlFor="magic-email">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-disabled" />
              <input
                id="magic-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-3 bg-navy-accent border border-disabled rounded-xl text-text-primary placeholder-text-disabled focus:outline-none focus:border-electric-blue transition-colors"
                required
                placeholder="you@example.com"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !!message}
            className="w-full flex justify-center items-center py-3 px-4 rounded-xl font-bold text-white bg-electric-blue hover:brightness-110 focus:outline-none disabled:opacity-50 transition"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Send Magic Link'}
          </button>
        </form>

        {error && <p className="text-center text-sm text-hot-red">{error}</p>}
        {message && <p className="text-center text-sm text-lime-glow">{message}</p>}
      </div>
    </div>
  );
};
