import React, { useEffect, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { f1Api } from '../../lib/f1Api';
import { F1RankRow } from './F1RankRow';
import type { GrandPrix } from '../../features/f1/useF1';

type SeasonState = any[] | null | 'none'; // null = loading, 'none' = no race found

/** Past editions of this Grand Prix — final classification of the 3 previous seasons,
 *  shown as season tabs. Same circuit (api_competition_id is stable across seasons). */
export const F1History: React.FC<{ gp: GrandPrix; onClose: () => void }> = ({ gp, onClose }) => {
  const baseSeason = gp.raceAt ? new Date(gp.raceAt).getFullYear() : new Date().getFullYear();
  const seasons = [baseSeason - 1, baseSeason - 2, baseSeason - 3];

  const [active, setActive] = useState(seasons[0]);
  const [data, setData] = useState<Record<number, SeasonState>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = async (season: number) => {
    if (!gp.apiCompetitionId) { setData((p) => ({ ...p, [season]: 'none' })); return; }
    setData((p) => ({ ...p, [season]: p[season] && p[season] !== 'none' ? p[season] : null }));
    try {
      const races = await f1Api('/races', { season, competition: gp.apiCompetitionId, type: 'Race' });
      const raceId = races[0]?.id;
      if (!raceId) { setData((p) => ({ ...p, [season]: 'none' })); return; }
      const rows = await f1Api('/rankings/races', { race: raceId });
      setData((p) => ({ ...p, [season]: rows }));
    } catch { setData((p) => ({ ...p, [season]: 'none' })); }
  };

  useEffect(() => { seasons.forEach(load); /* eslint-disable-next-line */ }, []);
  const refresh = async () => { setRefreshing(true); await Promise.all(seasons.map(load)); setRefreshing(false); };

  const rows = data[active];

  return (
    <div className="fixed inset-0 z-[70] bg-deep-navy flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <div className="text-xs text-text-secondary">Past editions</div>
          <div className="font-bold text-text-primary truncate">{gp.name}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={refresh} className="p-2 text-text-secondary"><RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} /></button>
          <button onClick={onClose} className="p-2 text-text-secondary"><X size={20} /></button>
        </div>
      </div>

      {/* Season tabs */}
      <div className="flex bg-navy-accent m-3 rounded-xl p-1">
        {seasons.map((s) => (
          <button key={s} onClick={() => setActive(s)}
            className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-all ${active === s ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {rows == null ? (
          <div className="card-base p-6 text-center text-text-secondary text-sm">Loading {active}…</div>
        ) : rows === 'none' ? (
          <div className="card-base p-6 text-center text-text-secondary text-sm">No race held here in {active}.</div>
        ) : rows.length === 0 ? (
          <div className="card-base p-6 text-center text-text-secondary text-sm">No classification available.</div>
        ) : (
          <div className="card-base overflow-hidden">
            {rows.map((row: any, i: number) => <F1RankRow key={i} row={row} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default F1History;
