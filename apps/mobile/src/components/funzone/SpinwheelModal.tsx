import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Gift, Loader2 } from 'lucide-react';
import { getSpinSegments, spinWheel, SpinSegment } from '../../services/spinSegmentsService';
import { getUserSpinState } from '../../services/spinService';
import { hapticImpact } from '../../native/haptics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tier: string;
  userId: string;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onSpun?: () => void;
}

// Slice fills use deeper "jewel" tones so they glow on the dark background (with the
// vignette + bright tier ring) instead of looking flat/funfair.
const CATEGORY_COLOR: Record<string, string> = {
  coins: '#E0A21A', xp: '#2563EB', ticket: '#1FA855', spin: '#0E9CB8',
  masterpass: '#C4283F', premium: '#7C3AED', gift_card: '#C13584', none: '#2A3542',
};
// The tier ring + pointer stay bright/brand for the glow accent.
const TIER_RING: Record<string, string> = {
  free: '#4AF626', amateur: '#4AF626', master: '#FFBA08', apex: '#FF3355', premium: '#A855F7',
};

export const SpinwheelModal: React.FC<Props> = ({ isOpen, onClose, tier, userId, addToast, onSpun }) => {
  const [segments, setSegments] = useState<SpinSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [finalReward, setFinalReward] = useState<string | null>(null);
  const [spinsLeft, setSpinsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true); setFinalReward(null); setRotation(0);
    getSpinSegments(tier).then(s => { setSegments(s); setLoading(false); });
    getUserSpinState(userId).then(st => setSpinsLeft((st.availableSpins as any)?.[tier] ?? 0)).catch(() => setSpinsLeft(null));
  }, [isOpen, tier, userId]);

  const n = segments.length || 1;
  const anglePerSlice = 360 / n;
  const ring = TIER_RING[tier] ?? '#4AF626';

  const handleSpin = async () => {
    if (isSpinning || segments.length === 0) return;
    try {
      setIsSpinning(true);
      setFinalReward(null);
      hapticImpact('medium');
      const res = await spinWheel(tier);
      if (!res.ok) {
        if (res.error === 'cooldown') {
          const at = res.next_at ? new Date(res.next_at) : null;
          addToast(at ? `Next free spin at ${at.toLocaleTimeString()}` : 'Free spin already used today', 'info');
        } else if (res.error === 'no_spins') {
          addToast(`No ${tier} spins available`, 'info');
        } else {
          addToast(res.error || 'Spin failed', 'error');
        }
        setIsSpinning(false);
        return;
      }
      const winningIndex = Math.min(res.index ?? 0, n - 1);
      const targetAngle = (winningIndex * anglePerSlice) + (anglePerSlice / 2);
      const jitter = Math.random() * (anglePerSlice * 0.6) - (anglePerSlice * 0.3);
      // The final rotation (mod 360) that lands the winning slice under the pointer.
      const desiredMod = (((-(targetAngle + jitter)) % 360) + 360) % 360;
      // Accumulate: always add ≥5 full turns on top of the CURRENT rotation, then nudge
      // to the desired landing offset — so every spin really spins (no near-zero moves).
      setRotation(prev => {
        const base = prev + 360 * 5;
        const baseMod = ((base % 360) + 360) % 360;
        let add = desiredMod - baseMod;
        if (add < 0) add += 360;
        return base + add;
      });
      setSpinsLeft(prev => (prev != null ? Math.max(0, prev - 1) : prev));
      setTimeout(() => {
        setIsSpinning(false);
        setFinalReward(res.label ?? 'Reward');
        hapticImpact('heavy');
        addToast(`You won: ${res.label}`, 'success');
        onSpun?.();
      }, 4200);
    } catch (e) {
      console.error('[SpinwheelModal]', e);
      addToast('Spin failed', 'error');
      setIsSpinning(false);
    }
  };

  if (!isOpen) return null;

  // Build distinct conic-gradient slices by category colour.
  const gradient = segments.length
    ? `conic-gradient(from 0deg, ${segments.map((s, i) => {
        const c = CATEGORY_COLOR[s.category] ?? '#3A4654';
        return `${c} ${i * anglePerSlice}deg, ${c} ${(i + 1) * anglePerSlice}deg`;
      }).join(', ')})`
    : 'none';

  return (
    <div className="fixed inset-0 bg-deep-navy/85 backdrop-blur-xl flex flex-col items-center justify-center z-[60] animate-scale-in">
      <button onClick={onClose} className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] p-2 text-text-secondary hover:bg-white/10 rounded-full z-10"><X size={24} /></button>
      <div className="text-center mb-10">
        <p className="text-text-secondary text-sm uppercase tracking-widest">{tier} wheel</p>
        {/* Free wheel is a once-a-day spin (cooldown) — never a credit count. Other tiers
            are ticket/credit-based, so they show how many spins are left. */}
        {tier === 'free' ? (
          <p className="text-xs mt-1.5 text-text-secondary">One free spin per day</p>
        ) : spinsLeft != null && (
          <p className="text-xs mt-1.5">{spinsLeft > 0
            ? <span className="text-lime-glow font-semibold">{spinsLeft} spin{spinsLeft === 1 ? '' : 's'} left</span>
            : <span className="text-text-disabled">No spins left</span>}</p>
        )}
      </div>

      {loading ? (
        <div className="w-[90vw] max-w-md aspect-square flex items-center justify-center"><Loader2 size={48} className="animate-spin text-electric-blue" /></div>
      ) : (
        <div className="relative w-[90vw] max-w-md aspect-square flex items-center justify-center">
          {/* pointer — points DOWN into the wheel */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-30" style={{ filter: `drop-shadow(0 0 6px ${ring}) drop-shadow(0 2px 3px rgba(0,0,0,0.6))` }}>
            <div className="w-0 h-0 border-l-[11px] border-r-[11px] border-t-[19px] border-l-transparent border-r-transparent" style={{ borderTopColor: ring }} />
          </div>

          <motion.div
            className="relative w-full h-full rounded-full"
            style={{ backgroundImage: gradient, boxShadow: `0 0 60px ${ring}55, 0 0 24px ${ring}33, inset 0 0 45px rgba(0,0,0,0.55)`, border: `4px solid ${ring}` }}
            animate={{ rotate: rotation }}
            transition={{ duration: 4, ease: [0.16, 1, 0.3, 1] }}
          >
            {segments.map((s, index) => {
              const angle = index * anglePerSlice;
              return (
                <React.Fragment key={s.id}>
                  <div className="absolute w-full h-full" style={{ transform: `rotate(${angle + anglePerSlice / 2}deg)` }}>
                    <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 text-center">
                      <p className="text-[11px] font-extrabold text-white uppercase leading-tight" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>{s.label}</p>
                    </div>
                  </div>
                  <div className="absolute top-0 left-1/2 w-px h-1/2 bg-black/25" style={{ transform: `rotate(${angle}deg)`, transformOrigin: 'bottom' }} />
                </React.Fragment>
              );
            })}
          </motion.div>

          {/* glowy vignette — dark centre, luminous rim (kills the "funfair" flatness) */}
          <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle at center, rgba(10,12,16,0.92) 26%, rgba(10,12,16,0.40) 50%, transparent 72%)' }} />

          <div className="absolute w-[30%] h-[30%] z-10">
            <button
              onClick={handleSpin}
              disabled={isSpinning}
              className="w-full h-full rounded-full bg-deep-navy flex flex-col items-center justify-center shadow-2xl transition-transform hover:scale-105 disabled:scale-100 disabled:opacity-60"
              style={{ border: `4px solid ${ring}` }}
            >
              {isSpinning ? <Loader2 size={26} className="animate-spin text-white" /> : <span className="font-extrabold text-xl tracking-wider text-white">SPIN</span>}
            </button>
          </div>
        </div>
      )}

      {finalReward && (
        <motion.div initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="absolute bottom-12 text-center">
          <div className="bg-navy-accent/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 border border-warm-yellow/30">
            <Gift size={22} className="text-warm-yellow" />
            <p className="text-lg font-bold text-warm-yellow">{finalReward}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
};
