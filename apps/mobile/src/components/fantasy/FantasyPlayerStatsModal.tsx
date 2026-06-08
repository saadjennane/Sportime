import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { FantasyPlayer } from '../../types';
import { CategoryIcon } from './CategoryIcon';
import { getFantasyPlayerStats } from '../../services/fantasyService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  player: FantasyPlayer | null;
}

const ratingColor = (r: number) => (r >= 7.5 ? 'bg-lime-glow text-deep-navy' : r >= 6.5 ? 'bg-warm-yellow text-deep-navy' : r > 0 ? 'bg-hot-red text-white' : 'bg-deep-navy text-text-disabled');

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="bg-deep-navy rounded-lg p-2.5 text-center">
    <p className="text-lg font-bold text-text-primary">{value}</p>
    <p className="text-[10px] text-text-disabled">{label}</p>
  </div>
);

export const FantasyPlayerStatsModal: React.FC<Props> = ({ isOpen, onClose, player }) => {
  const [data, setData] = useState<Awaited<ReturnType<typeof getFantasyPlayerStats>>>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !player) return;
    let cancelled = false;
    setLoading(true);
    getFantasyPlayerStats(player.id)
      .then(d => { if (!cancelled) setData(d); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, player?.id]);

  if (!isOpen || !player) return null;

  const age = player.birthdate ? Math.floor((Date.now() - new Date(player.birthdate).getTime()) / 31557600000) : null;
  const t = data?.totals;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-scale-in">
      <div className="bg-navy-accent rounded-3xl shadow-2xl max-w-sm w-full max-h-[85vh] flex flex-col border border-white/10">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-white/10">
          <img src={player.photo || `https://api.dicebear.com/8.x/bottts/svg?seed=${player.id}`} alt={player.name}
            className="w-14 h-14 rounded-full object-cover bg-deep-navy flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-text-primary truncate">{player.name}</p>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              {player.teamLogo && <img src={player.teamLogo} className="w-4 h-4 object-contain" alt="" />}
              <span className="truncate">{player.teamName}</span>{age && <span>· {age}y</span>}
            </div>
            <div className="flex gap-1 mt-1">
              {(player.eligiblePositions ?? [player.position]).map(p => (
                <span key={p} className="text-[9px] font-bold text-electric-blue bg-electric-blue/10 px-1.5 py-0.5 rounded">{p.slice(0, 3).toUpperCase()}</span>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full"><X size={22} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* PGS + fatigue */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-deep-navy rounded-lg p-2.5 text-center">
              <div className="flex items-center justify-center gap-1"><CategoryIcon category={player.status} size={16} /><span className="text-lg font-bold text-text-primary">{player.pgs.toFixed(1)}</span></div>
              <p className="text-[10px] text-text-disabled">PGS · {player.status}</p>
            </div>
            <Stat label="Fatigue" value={`${player.fatigue}%`} />
            <Stat label="Avg rating" value={t?.avg_rating ?? '—'} />
          </div>
          <p className="text-[10px] text-text-disabled text-center -mt-3">PGS calculé sur les 10 derniers matchs</p>

          {/* Recent form */}
          <div>
            <h3 className="text-xs font-semibold text-text-secondary mb-2">Recent form</h3>
            {loading ? <p className="text-xs text-text-disabled">Loading…</p> : (
              <div className="flex gap-1.5 flex-wrap">
                {(data?.recent ?? []).slice(0, 8).map((m, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold ${ratingColor(m.rating)}`}>{m.rating ? m.rating.toFixed(1) : '–'}</div>
                    <span className="text-[8px] text-text-disabled">{m.position}</span>
                  </div>
                ))}
                {(!data?.recent || data.recent.length === 0) && <p className="text-xs text-text-disabled">No recent matches.</p>}
              </div>
            )}
          </div>

          {/* Totals */}
          {t && (
            <div>
              <h3 className="text-xs font-semibold text-text-secondary mb-2">Last {t.matches} matches</h3>
              <div className="grid grid-cols-4 gap-2">
                <Stat label="Goals" value={t.goals} />
                <Stat label="Assists" value={t.assists} />
                <Stat label="Mins" value={t.minutes} />
                <Stat label="Clean sh." value={t.clean_sheets} />
                <Stat label="Shots OT" value={t.shots_on_target} />
                <Stat label="Key pass" value={t.key_passes} />
                <Stat label="Tackles" value={t.tackles} />
                <Stat label="Dribbles" value={t.dribbles} />
              </div>
              <div className="flex justify-center gap-3 mt-3 text-xs">
                <span className="text-warm-yellow font-semibold">🟨 {t.yellow}</span>
                <span className="text-hot-red font-semibold">🟥 {t.red}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
