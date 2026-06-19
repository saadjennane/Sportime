import React, { useEffect, useState } from 'react';
import { X, Check, Sparkles } from 'lucide-react';
import { getPuzzleStats } from '../../services/puzzleService';

export interface SetupOption {
  label: string;
  value: string | number;   // passed to the game on launch
  statsLevel?: string;       // when set, drives the per-level stats query
}
export interface SetupGroup {
  title: string;
  options: SetupOption[];
}

export interface PreviewGameMeta {
  icon: string;
  label: string;
  accent: string;        // header gradient classes
  gameType: string;      // puzzle_my_stats game_type
  xp: number;            // displayed reward badge
  statsLevel?: string;   // fallback level when no group provides one
  setups?: SetupGroup[];
}

interface Props {
  meta: PreviewGameMeta;
  done: boolean;
  onClose: () => void;
  onPlay: (values: (string | number)[]) => void;
}

const StatRow: React.FC<{ color: string; label: string; value: string | number }> = ({ color, label, value }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-white/10 last:border-0">
    <div className="flex items-center gap-2.5">
      <span className={`w-3.5 h-3.5 rounded-sm ${color}`} />
      <span className="text-sm text-text-primary">{label}</span>
    </div>
    <span className="text-sm font-bold text-text-primary tabular-nums">{value}</span>
  </div>
);

export const GamePreviewModal: React.FC<Props> = ({ meta, done, onClose, onPlay }) => {
  const groups = meta.setups ?? [];
  const [sel, setSel] = useState<number[]>(() => groups.map(() => 0));

  const selectedOptions = groups.map((g, i) => g.options[sel[i] ?? 0]);
  // Stats level = first selected option that defines one, else the game fallback.
  const statsLevel = selectedOptions.find(o => o?.statsLevel)?.statsLevel ?? meta.statsLevel;

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Per-level stats: re-fetch whenever the stats-driving setup changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPuzzleStats(statsLevel as any, meta.gameType)
      .then(s => { if (!cancelled) setStats(s); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [statsLevel, meta.gameType]);

  const played = stats?.games_played ?? 0;
  const won = stats?.games_won ?? 0;
  const winPct = played > 0 ? Math.round((won / played) * 100) : 0;
  const cur = stats?.current_streak ?? 0;
  const best = stats?.best_streak ?? 0;

  const pick = (groupIdx: number, optIdx: number) =>
    setSel(prev => prev.map((v, i) => (i === groupIdx ? optIdx : v)));

  return (
    <div className="fixed inset-0 z-[70] bg-deep-navy/80 backdrop-blur-sm flex items-center justify-center p-4 animate-scale-in" onClick={onClose}>
      <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-3xl bg-navy-accent shadow-2xl scrollbar-hide" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`sticky top-0 flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r ${meta.accent}`}>
          <div className="w-10 h-10 rounded-xl bg-deep-navy/40 flex items-center justify-center text-2xl flex-shrink-0">{meta.icon}</div>
          <h2 className="flex-1 font-extrabold text-text-primary text-lg leading-tight">{meta.label}</h2>
          <button onClick={onClose} className="p-1.5 text-text-primary/80 hover:bg-black/15 rounded-full"><X size={22} /></button>
        </div>

        <div className="p-5">
          {/* Hero streak */}
          <div className="text-center py-3">
            <p className={`text-5xl font-extrabold tabular-nums ${cur > 0 ? 'text-lime-glow' : 'text-text-primary'}`}>{cur}</p>
            <p className="text-xs text-text-secondary mt-1 uppercase tracking-wide">Current streak</p>
          </div>

          {/* Stats */}
          <div className={loading ? 'opacity-50' : ''}>
            <StatRow color="bg-electric-blue" label="Current Streak" value={cur} />
            <StatRow color="bg-warm-yellow" label="Best Streak" value={best} />
            <StatRow color="bg-text-disabled" label="Win %" value={`${winPct}%`} />
            <StatRow color="bg-lime-glow" label="Games Played" value={played} />
          </div>

          {/* Setup groups */}
          {groups.map((g, gi) => (
            <div key={g.title} className="mt-4">
              <p className="text-[11px] font-bold text-text-secondary mb-2 uppercase tracking-wide">{g.title}</p>
              <div className="grid grid-cols-2 gap-2">
                {g.options.map((o, oi) => (
                  <button
                    key={o.label}
                    onClick={() => pick(gi, oi)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-colors ${
                      oi === sel[gi] ? 'border-electric-blue bg-electric-blue/10 text-text-primary' : 'border-white/10 text-text-secondary'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Play CTA */}
          <button
            onClick={() => onPlay(selectedOptions.map(o => o.value))}
            className="relative mt-5 w-full primary-button py-3.5 rounded-xl font-extrabold flex items-center justify-center gap-2"
          >
            {done && <Check size={18} strokeWidth={3} />}
            {done ? 'Play again' : 'Play Daily Puzzle'}
            <span className="absolute -top-2 right-3 flex items-center gap-1 bg-warm-yellow text-deep-navy text-[11px] font-extrabold px-2 py-0.5 rounded-full shadow">
              <Sparkles size={11} /> +{meta.xp} xp
            </span>
          </button>
          {done && <p className="text-center text-[11px] text-lime-glow font-semibold mt-2">✓ Completed today</p>}
        </div>
      </div>
    </div>
  );
};
