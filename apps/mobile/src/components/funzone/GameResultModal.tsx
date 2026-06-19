import React, { useEffect, useState } from 'react';
import { Trophy, Share2, Sparkles, RotateCcw } from 'lucide-react';
import { getPuzzleStats } from '../../services/puzzleService';

export interface ResultMeta { icon: string; label: string; accent: string }

interface Props {
  meta: ResultMeta;
  gameType: string;
  statsLevel?: string;            // level just played → per-level lifetime stats
  xp: number;                     // xp earned (display)
  hero: { primary: string; sub?: string; win?: boolean };
  percentile?: number | null;
  detail?: React.ReactNode;       // optional game-specific extras (shown under the hero)
  extraActions?: React.ReactNode; // optional game-specific buttons (e.g. "See players", "Change setup")
  onShare: () => void;
  onReplay?: () => void;
  onBack: () => void;
  onHeroTap?: () => void;         // optional (preserves games' dev-unlock easter egg)
}

const bucketOf = (p?: number | null): string =>
  p == null ? '…' : p <= 1 ? 'Top 1%' : p <= 5 ? 'Top 5%' : p <= 25 ? 'Top 25%' : p <= 50 ? 'Top 50%' : 'Top 75%';

const StatRow: React.FC<{ color: string; label: string; value: string | number }> = ({ color, label, value }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-white/10 last:border-0">
    <div className="flex items-center gap-2.5">
      <span className={`w-3.5 h-3.5 rounded-sm ${color}`} />
      <span className="text-sm text-text-primary">{label}</span>
    </div>
    <span className="text-sm font-bold text-text-primary tabular-nums">{value}</span>
  </div>
);

export const GameResultModal: React.FC<Props> = ({ meta, gameType, statsLevel, xp, hero, percentile, detail, extraActions, onShare, onReplay, onBack, onHeroTap }) => {
  const [stats, setStats] = useState<any>(null);

  // Lifetime stats refreshed post-game (includes the streak just earned).
  useEffect(() => {
    let cancelled = false;
    getPuzzleStats(statsLevel as any, gameType).then(s => { if (!cancelled) setStats(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [statsLevel, gameType]);

  const played = stats?.games_played ?? 0;
  const won = stats?.games_won ?? 0;
  const winPct = played > 0 ? Math.round((won / played) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[70] bg-deep-navy/90 backdrop-blur-sm flex items-center justify-center p-4 animate-scale-in">
      <div className="w-full max-w-sm max-h-[92vh] overflow-y-auto rounded-3xl bg-navy-accent shadow-2xl scrollbar-hide">
        {/* Header */}
        <div className={`sticky top-0 flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r ${meta.accent}`}>
          <div className="w-10 h-10 rounded-xl bg-deep-navy/40 flex items-center justify-center text-2xl flex-shrink-0">{meta.icon}</div>
          <h2 className="flex-1 font-extrabold text-text-primary text-lg leading-tight">{meta.label}</h2>
        </div>

        <div className="p-5">
          {/* Hero result */}
          <div className="text-center py-2">
            <Trophy size={40} className={`mx-auto mb-2 ${hero.win === false ? 'text-text-disabled' : 'text-warm-yellow'}`} />
            <p onClick={onHeroTap} className="text-3xl font-extrabold text-text-primary leading-tight">{hero.primary}</p>
            {hero.sub && <p className="text-sm text-text-secondary mt-1">{hero.sub}</p>}
          </div>

          {/* Today: percentile + xp earned */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="card-base p-3 text-center">
              <p className="text-[11px] text-text-secondary">Percentile</p>
              <p className="text-base font-extrabold text-lime-glow">{bucketOf(percentile)}</p>
            </div>
            <div className="card-base p-3 text-center">
              <p className="text-[11px] text-text-secondary">Earned</p>
              <p className="text-base font-extrabold text-warm-yellow flex items-center justify-center gap-1"><Sparkles size={14} /> +{xp} xp</p>
            </div>
          </div>

          {/* Optional game-specific detail */}
          {detail && <div className="mt-4">{detail}</div>}

          {/* Lifetime stats (same rows as the pre-game modal) */}
          <div className="mt-4">
            <StatRow color="bg-electric-blue" label="Current Streak" value={stats?.current_streak ?? 0} />
            <StatRow color="bg-warm-yellow" label="Best Streak" value={stats?.best_streak ?? 0} />
            <StatRow color="bg-text-disabled" label="Win %" value={`${winPct}%`} />
            <StatRow color="bg-lime-glow" label="Games Played" value={played} />
          </div>

          {/* Actions */}
          <button onClick={onShare} className="mt-5 w-full bg-lime-glow text-deep-navy font-extrabold py-3 rounded-xl flex items-center justify-center gap-2">
            <Share2 size={18} /> Share result
          </button>
          {extraActions}
          {onReplay && (
            <button onClick={onReplay} className="mt-3 w-full bg-navy-accent border border-white/10 text-text-primary font-bold py-3 rounded-xl flex items-center justify-center gap-2">
              <RotateCcw size={16} /> Play again
            </button>
          )}
          <button onClick={onBack} className="mt-3 w-full bg-navy-accent text-text-primary font-bold py-3 rounded-xl">Back to FunZone</button>
        </div>
      </div>
    </div>
  );
};
