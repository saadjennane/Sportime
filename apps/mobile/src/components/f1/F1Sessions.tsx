import React, { useEffect, useState } from 'react';
import { X, RefreshCw, ChevronDown, Radio } from 'lucide-react';
import { f1Api } from '../../lib/f1Api';
import { F1RankRow } from './F1RankRow';
import type { GrandPrix, F1Session } from '../../features/f1/useF1';

const LABEL: Record<string, string> = { FP1: 'Practice 1', FP2: 'Practice 2', FP3: 'Practice 3', Q1: 'Qualifying 1', Q2: 'Qualifying 2', Q3: 'Qualifying 3', Race: 'Race', Sprint: 'Sprint' };

const fmt = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

/** Live "Sessions" view — Q1/Q2/Q3/Race revealed as the weekend unfolds, newest first.
 *  The in-progress Race polls its live running order. */
export const F1Sessions: React.FC<{ gp: GrandPrix; onClose: () => void }> = ({ gp, onClose }) => {
  const now = Date.now();
  const all = [...(gp.sessions ?? [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const startedCount = all.filter((s) => new Date(s.date).getTime() <= now).length;
  const shown = all.slice(0, Math.min(all.length, startedCount + 1)).reverse(); // started sessions + the next one, newest first

  const isUpcoming = (s: F1Session) => new Date(s.date).getTime() > now;
  const liveRace = shown.find((s) => s.type === 'Race' && !isUpcoming(s) && s.status !== 'Completed');

  const [data, setData] = useState<Record<number, any[] | null>>({}); // null = loading
  const [open, setOpen] = useState<number | null>(shown[0]?.id ?? null);
  const [lap, setLap] = useState<{ cur: number | null; total: number | null } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadSession = async (s: F1Session) => {
    if (isUpcoming(s)) { setData((p) => ({ ...p, [s.id]: [] })); return; }
    setData((p) => ({ ...p, [s.id]: p[s.id] ?? null }));
    try { const rows = await f1Api('/rankings/races', { race: s.id }); setData((p) => ({ ...p, [s.id]: rows })); }
    catch { setData((p) => ({ ...p, [s.id]: [] })); }
  };
  const loadLap = async () => {
    if (!liveRace) return;
    try { const r = await f1Api('/races', { id: liveRace.id }); const lp = r[0]?.laps; if (lp) setLap({ cur: lp.current, total: lp.total }); } catch { /* ignore */ }
  };

  useEffect(() => { shown.forEach(loadSession); loadLap(); /* eslint-disable-next-line */ }, []);
  // Poll the live race.
  useEffect(() => {
    if (!liveRace) return;
    const t = window.setInterval(() => { loadSession(liveRace); loadLap(); }, 45000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line
  }, [liveRace?.id]);

  const refresh = async () => { setRefreshing(true); await Promise.all(shown.map(loadSession)); await loadLap(); setRefreshing(false); };

  return (
    <div className="fixed inset-0 z-[70] bg-deep-navy flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          {gp.round ? <div className="text-xs text-text-secondary">Round {gp.round}</div> : null}
          <div className="font-bold text-text-primary truncate">{gp.name}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={refresh} className="p-2 text-text-secondary"><RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} /></button>
          <button onClick={onClose} className="p-2 text-text-secondary"><X size={20} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {shown.length === 0 && <div className="card-base p-6 text-center text-text-secondary text-sm">No sessions scheduled yet.</div>}
        {shown.map((s) => {
          const up = isUpcoming(s);
          const rows = data[s.id];
          const isLive = liveRace?.id === s.id;
          const expanded = open === s.id;
          return (
            <div key={s.id} className="card-base overflow-hidden">
              <button onClick={() => setOpen(expanded ? null : s.id)} className="w-full flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-text-primary">{LABEL[s.type] ?? s.type}</span>
                  {isLive && <span className="flex items-center gap-1 text-[10px] font-bold text-hot-red bg-hot-red/15 px-1.5 py-0.5 rounded"><Radio size={10} /> LIVE{lap?.cur ? ` · Lap ${lap.cur}${lap.total ? '/' + lap.total : ''}` : ''}</span>}
                  {up && <span className="text-[11px] text-text-secondary truncate">Upcoming · {fmt(s.date)}</span>}
                  {!up && !isLive && <span className="text-[11px] text-lime-glow">Finished</span>}
                </div>
                <ChevronDown size={16} className={`text-text-secondary transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} />
              </button>
              {expanded && (
                <div className="px-2 pb-2">
                  {up ? <div className="px-2 py-3 text-sm text-text-secondary">Starts {fmt(s.date)}.</div>
                    : rows == null ? <div className="px-2 py-3 text-sm text-text-secondary">Loading…</div>
                      : rows.length === 0 ? <div className="px-2 py-3 text-sm text-text-secondary">No data yet.</div>
                        : rows.map((row: any, i: number) => <F1RankRow key={i} row={row} index={i} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default F1Sessions;
