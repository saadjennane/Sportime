import React, { useEffect, useMemo, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { F1Selection } from '../../features/f1/useRaceBetting';

interface Props {
  open: boolean;
  marketLabel: string;
  sel: F1Selection | null;
  balance: number;
  maxBet: number | null;
  existingStake?: number;
  onClose: () => void;
  onPlace: (stake: number) => Promise<{ ok: boolean; error?: string }>;
  onCancel?: () => Promise<{ ok: boolean; error?: string }>;
}

// Quick-stake ladder; only chips strictly below the cap are shown (Max covers the rest),
// so the options grow as the player's bet limit / balance increases.
const CHIP_LADDER = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];

export const F1BetModal: React.FC<Props> = ({ open, marketLabel, sel, balance, maxBet, existingStake = 0, onClose, onPlace, onCancel }) => {
  const [stake, setStake] = useState<string>('');
  const [placing, setPlacing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setStake(existingStake ? String(existingStake) : ''); setError(null); }
  }, [open, sel?.key]);

  // Editing refunds the old stake, so it's available again.
  const available = balance + existingStake;
  const cap = useMemo(() => Math.min(available, maxBet ?? Infinity), [available, maxBet]);

  const chips = useMemo(() => CHIP_LADDER.filter((c) => c < cap).slice(-3), [cap]);

  const amount = Math.max(0, Math.floor(Number(stake) || 0));
  const odds = sel?.odds ?? 0;
  const profit = amount > 0 ? Math.ceil(amount * odds) - amount : 0;
  const valid = amount > 0 && amount <= cap;

  if (!open || !sel) return null;

  const submit = async () => {
    if (!valid) { setError(amount > cap ? 'Amount exceeds your limit/balance' : 'Enter an amount'); return; }
    setPlacing(true); setError(null);
    const r = await onPlace(amount);
    setPlacing(false);
    if (!r.ok) setError(r.error || 'Could not place bet');
    else onClose();
  };

  const cancel = async () => {
    if (!onCancel) return;
    setCanceling(true); setError(null);
    const r = await onCancel();
    setCanceling(false);
    if (!r.ok) setError(r.error || 'Could not remove pick');
    else onClose();
  };

  const initials = sel.label.slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md bg-deep-navy rounded-t-2xl sm:rounded-2xl p-5 space-y-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{marketLabel}</span>
          <button onClick={onClose} className="text-text-secondary"><X size={20} /></button>
        </div>

        {/* Selection */}
        <div className="flex items-center gap-3">
          {sel.image
            ? <img src={sel.image} alt="" className="w-12 h-12 rounded-full object-cover bg-navy-accent" />
            : sel.teamLogo
              ? <img src={sel.teamLogo} alt="" className="w-12 h-12 rounded-xl object-contain bg-white p-1.5" />
              : <div className="w-12 h-12 rounded-full bg-navy-accent flex items-center justify-center text-sm font-bold text-text-secondary">{initials}</div>}
          <div className="min-w-0 flex-1">
            <div className="font-bold text-text-primary truncate flex items-center gap-1.5">
              {sel.label}
              {sel.image && sel.teamLogo && <img src={sel.teamLogo} alt="" className="w-4 h-4 object-contain" />}
            </div>
            {sel.sublabel && <div className="text-xs text-text-secondary truncate">{sel.sublabel}</div>}
          </div>
          <div className="text-2xl font-extrabold text-electric-blue">{odds.toFixed(2)}</div>
        </div>

        {/* Amount */}
        <div>
          <input
            type="number" inputMode="numeric" min={1} placeholder="Amount"
            value={stake} onChange={(e) => setStake(e.target.value)}
            className="w-full bg-navy-accent rounded-xl px-4 py-4 text-2xl font-extrabold text-text-primary text-center"
          />
          <div className="flex gap-2 mt-2">
            {chips.map((c) => (
              <button key={c} onClick={() => setStake(String(Math.min(c, cap)))}
                className="flex-1 py-2 rounded-lg bg-navy-accent text-sm font-semibold text-text-secondary hover:text-electric-blue">
                {c >= 1000 ? `${c / 1000}k` : c}
              </button>
            ))}
            <button onClick={() => setStake(String(Math.floor(cap)))}
              className="flex-1 py-2 rounded-lg bg-navy-accent text-sm font-semibold text-warm-yellow">Max</button>
          </div>
        </div>

        {/* Net / return */}
        <div className="flex justify-between items-center text-base">
          <span className="text-text-secondary">Net win</span>
          <span className="font-extrabold text-lime-glow text-lg">+{profit.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center text-base -mt-2">
          <span className="text-text-secondary">Total return</span>
          <span className="font-bold text-text-primary text-lg">{(amount + profit).toLocaleString()}</span>
        </div>

        {error && <div className="text-sm text-hot-red text-center">{error}</div>}

        <button onClick={submit} disabled={!valid || placing || canceling}
          className="w-full py-3 rounded-xl font-bold bg-electric-blue text-white disabled:opacity-40">
          {placing ? 'Placing…' : existingStake ? 'Update bet' : 'Place bet'}
        </button>
        {existingStake > 0 && onCancel && (
          <button onClick={cancel} disabled={placing || canceling}
            className="w-full py-2.5 rounded-xl font-semibold bg-hot-red/10 text-hot-red flex items-center justify-center gap-2 disabled:opacity-40">
            <Trash2 size={16} /> {canceling ? 'Removing…' : `Remove pick (refund ${existingStake.toLocaleString()})`}
          </button>
        )}
        <div className="text-center text-xs text-text-secondary">Balance: {balance.toLocaleString()} coins{maxBet ? ` · max ${maxBet.toLocaleString()}` : ''}</div>
      </div>
    </div>
  );
};

export default F1BetModal;
