import React from 'react';
import { X } from 'lucide-react';

interface SignUpPromptModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  coins?: number;   // guest's current balance — shown as "at risk" (loss aversion)
  tickets?: number; // guest's current tickets
  reason?: string | null; // contextual headline (e.g. "You just won 500 🪙 …")
}

const BENEFITS: { icon: string; label: string }[] = [
  { icon: '🏆', label: 'Join squads & challenge your friends' },
  { icon: '🎁', label: 'Claim rewards & gift cards' },
  { icon: '📊', label: 'Keep your level, history & rank' },
  { icon: '🔔', label: 'Kickoff & result alerts' },
  { icon: '📱', label: 'Access your account on any device' },
];

export const SignUpPromptModal: React.FC<SignUpPromptModalProps> = ({ isOpen, onConfirm, onCancel, coins = 0, tickets = 0, reason }) => {
  if (!isOpen) return null;

  const atRisk = [
    coins > 0 ? `${coins.toLocaleString()} 🪙` : null,
    tickets > 0 ? `${tickets} 🎟️` : null,
  ].filter(Boolean).join(' & ');

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-scale-in">
      <div className="w-full max-w-sm bg-deep-navy rounded-2xl p-6 space-y-5 relative border border-white/10 shadow-2xl">
        <button onClick={onCancel} className="absolute top-4 right-4 p-2 text-text-secondary hover:text-text-primary transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-text-primary">{reason ? 'Nice win! 🎉' : 'Secure your progress'}</h2>
          <p className="text-text-secondary mt-2 text-sm">{reason ?? "You're playing as a guest. Create a free account so you don't lose it."}</p>
        </div>

        {/* Loss-aversion: what's at stake right now */}
        {atRisk && (
          <div className="rounded-xl bg-hot-red/10 border border-hot-red/30 px-4 py-3 text-center">
            <p className="text-xs text-text-secondary">Not saved yet</p>
            <p className="text-lg font-bold text-text-primary mt-0.5">{atRisk}</p>
          </div>
        )}

        {/* Benefits */}
        <div className="space-y-2.5">
          {BENEFITS.map((b) => (
            <div key={b.label} className="flex items-center gap-3 text-sm text-text-secondary">
              <span className="text-base">{b.icon}</span>
              <span>{b.label}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <button onClick={onConfirm} className="w-full py-3.5 bg-electric-blue text-white font-bold rounded-xl hover:brightness-110 transition">
            Create my account
          </button>
          <button onClick={onConfirm} className="w-full py-2 text-sm font-bold text-electric-blue hover:brightness-110 transition-colors">
            Already have an account? Sign in
          </button>
          <button onClick={onCancel} className="w-full py-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};
