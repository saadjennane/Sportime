import React from 'react';
import { useProfileStats, type SportStat } from '../../hooks/useProfileStats';
import { Target, Gamepad2, Coins, Trophy, Globe, Flag, Loader2 } from 'lucide-react';

const accColor = (p: number) => (p >= 60 ? 'text-lime-glow' : p >= 45 ? 'text-warm-yellow' : 'text-hot-red');

interface Props {
  userId: string | null | undefined;
  /** Sports the user follows (Profile → Settings). Stats only renders these blocks. */
  sports?: string[];
}

export const UserProfileStats: React.FC<Props> = ({ userId, sports }) => {
  const { stats, isLoading, error } = useProfileStats(userId);

  // Undefined (legacy / not yet loaded) → show both; an explicit empty list → show prompt.
  const followed = sports === undefined ? ['football', 'f1'] : sports;

  if (isLoading) return <div className="flex justify-center items-center p-12"><Loader2 size={40} className="animate-spin text-electric-blue" /></div>;
  if (error) return <div className="text-center p-8 text-hot-red"><p>Failed to load statistics</p><p className="text-sm text-text-disabled mt-2">{error.message}</p></div>;
  if (!stats) return <div className="text-center p-8 text-text-disabled"><p>No statistics available</p></div>;

  if (followed.length === 0) {
    return (
      <div className="card-base p-6 text-center space-y-1 animate-scale-in">
        <p className="text-sm font-semibold text-text-primary">No sport added yet</p>
        <p className="text-sm text-text-disabled">Add Football or Formula 1 in Settings to see your stats.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-scale-in">
      {/* Football first, then F1 — only the sports the user follows. */}
      {followed.includes('football') && (
        <SportStats title="Football" icon={<Globe size={15} className="text-electric-blue" />} accent="text-electric-blue" s={stats.football} predLabel="predictions" />
      )}
      {followed.includes('f1') && (
        <SportStats title="Formula 1" icon={<Flag size={15} className="text-hot-red" />} accent="text-hot-red" s={stats.f1} predLabel="bets settled" />
      )}
    </div>
  );
};

const SportStats: React.FC<{ title: string; icon: React.ReactNode; accent: string; s: SportStat; predLabel: string }> = ({ title, icon, accent, s, predLabel }) => {
  const active = s.predictions_total > 0 || s.games_played > 0;
  const pct = s.predictions_total === 0 ? null : (s.predictions_correct / s.predictions_total) * 100;
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider px-1 flex items-center gap-1.5">{icon} {title}</h3>
      {!active ? (
        <div className="card-base p-5 text-center text-sm text-text-disabled">No activity yet — make predictions or join a game.</div>
      ) : (
        <div className="card-base p-4 space-y-4">
          {/* Predictions — the hero metric */}
          <div>
            <p className="text-[11px] font-semibold text-text-disabled uppercase tracking-wide flex items-center gap-1.5"><Target size={14} className={accent} /> Prediction accuracy</p>
            <div className="mt-1.5 flex items-end gap-3">
              {pct == null
                ? <span className="text-3xl font-bold text-text-disabled">—</span>
                : <span className={`text-4xl font-extrabold ${accColor(pct)}`}>{pct.toFixed(0)}<span className="text-2xl">%</span></span>}
              <span className="text-sm text-text-secondary pb-1">{s.predictions_correct}/{s.predictions_total} {predLabel}</span>
            </div>
            {pct != null && (
              <div className="mt-2 w-full bg-deep-navy rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-hot-red via-warm-yellow to-lime-glow h-2 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            )}
          </div>
          {/* Games played + Best rank */}
          <div className="grid grid-cols-2 gap-3">
            <MiniStat icon={<Gamepad2 size={16} className="text-neon-cyan" />} label="Games played" value={s.games_played.toLocaleString()} />
            <MiniStat icon={<Trophy size={16} className="text-warm-yellow" />} label="Best rank" value={s.best_rank != null ? `#${s.best_rank}` : '—'} />
          </div>
          {/* Average pick */}
          <div className="flex items-center justify-between border-t border-white/5 pt-3">
            <span className="text-sm font-semibold text-text-secondary flex items-center gap-2"><Coins size={16} className="text-warm-yellow" /> Average pick</span>
            <span className="text-lg font-bold text-text-primary tabular-nums">{s.average_pick.toLocaleString()} <span className="text-xs font-normal text-text-secondary">coins</span></span>
          </div>
        </div>
      )}
    </section>
  );
};

const MiniStat: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="bg-deep-navy rounded-xl p-3">
    <p className="text-[11px] font-semibold text-text-disabled uppercase tracking-wide flex items-center gap-1.5 mb-1">{icon} {label}</p>
    <p className="text-xl font-bold text-text-primary tabular-nums">{value}</p>
  </div>
);
