import React, { useEffect, useState } from 'react';
import { X, Loader2, Target, Flame, TrendingUp } from 'lucide-react';
import { getPredictionStats, PredictionStats } from '../../services/premiumService';

interface Props {
  userId: string;
  onClose: () => void;
}

const pct = (correct: number, total: number) => (total > 0 ? Math.round((100 * correct) / total) : 0);

const TypeRow: React.FC<{ label: string; total: number; correct: number; color: string }> = ({ label, total, correct, color }) => {
  const p = pct(correct, total);
  return (
    <div className="py-2">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-text-primary font-semibold">{label}</span>
        <span className="text-text-secondary tabular-nums">{correct}/{total} · <span className="text-text-primary font-bold">{p}%</span></span>
      </div>
      <div className="h-2 rounded-full bg-deep-navy overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
};

export const PremiumStatsModal: React.FC<Props> = ({ userId, onClose }) => {
  const [stats, setStats] = useState<PredictionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPredictionStats(userId).then(s => { if (!cancelled) { setStats(s); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  const by = stats?.by_type ?? {};
  const home = by.home ?? { total: 0, correct: 0 };
  const draw = by.draw ?? { total: 0, correct: 0 };
  const away = by.away ?? { total: 0, correct: 0 };

  return (
    <div className="fixed inset-0 z-[70] bg-deep-navy/85 backdrop-blur-sm flex items-center justify-center p-4 animate-scale-in" onClick={onClose}>
      <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-3xl bg-navy-accent shadow-2xl scrollbar-hide" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-warm-yellow/30 to-warm-yellow/5">
          <div className="w-10 h-10 rounded-xl bg-deep-navy/40 flex items-center justify-center"><Target size={20} className="text-warm-yellow" /></div>
          <h2 className="flex-1 font-extrabold text-text-primary text-lg">Your Predictions</h2>
          <button onClick={onClose} className="p-1.5 text-text-primary/80 hover:bg-black/15 rounded-full"><X size={22} /></button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-electric-blue" size={28} /></div>
          ) : !stats?.ok || stats.total === 0 ? (
            <p className="text-center text-text-secondary py-12">No settled predictions yet — make some picks to see your stats.</p>
          ) : (
            <>
              {/* Hero accuracy */}
              <div className="text-center py-2">
                <p className="text-5xl font-extrabold text-lime-glow tabular-nums">{stats.accuracy_pct}%</p>
                <p className="text-xs text-text-secondary mt-1 uppercase tracking-wide">Overall accuracy · {stats.correct}/{stats.total}</p>
              </div>

              {/* Streak + last 30d */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="card-base p-3 text-center">
                  <p className="text-[11px] text-text-secondary flex items-center justify-center gap-1"><Flame size={12} className="text-hot-red" /> Current streak</p>
                  <p className="text-xl font-extrabold text-hot-red tabular-nums">{stats.current_streak}</p>
                </div>
                <div className="card-base p-3 text-center">
                  <p className="text-[11px] text-text-secondary flex items-center justify-center gap-1"><TrendingUp size={12} className="text-electric-blue" /> Last 30 days</p>
                  <p className="text-xl font-extrabold text-electric-blue tabular-nums">{stats.last30.accuracy_pct}%</p>
                </div>
              </div>

              {/* By pick type */}
              <div className="mt-5">
                <p className="text-[11px] font-bold text-text-secondary mb-1 uppercase tracking-wide">Accuracy by pick</p>
                <TypeRow label="🏠 Home" total={home.total} correct={home.correct} color="bg-lime-glow" />
                <TypeRow label="🤝 Draw" total={draw.total} correct={draw.correct} color="bg-warm-yellow" />
                <TypeRow label="✈️ Away" total={away.total} correct={away.correct} color="bg-electric-blue" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
