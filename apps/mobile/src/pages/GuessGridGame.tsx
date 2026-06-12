import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Search, X, Flame, Trophy, Share2 } from 'lucide-react';
import { getGridToday, finishPlayer, getPuzzleStats, replayGame, GridToday } from '../services/puzzleService';
import { getGridIndex, searchPlayers, fits, GridPlayer, GridCrit } from '../services/gridService';
import { IndexedPlayer } from '../services/playerIndexService';

const DURATION = 180;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const surname = (n: string) => { let p = (n || '').replace(/^[A-Za-z]\.\s*/, '').trim().split(/\s+/); if (p.length > 1 && /^(jr|junior|júnior)$/i.test(p[p.length - 1])) p = p.slice(0, -1); return p.length === 1 ? p[0] : p[p.length - 1]; };
const doneKey = (g: string) => `sportime_gd_done_${g}`;
const readDone = (g: string) => { try { const r = localStorage.getItem(doneKey(g)); return r ? JSON.parse(r) : null; } catch { return null; } };
const saveDone = (g: string, date: string, st: any) => { try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith('sportime_gd_done_')) { try { if (JSON.parse(localStorage.getItem(k)!).date !== date) localStorage.removeItem(k); } catch { /**/ } } } localStorage.setItem(doneKey(g), JSON.stringify({ date, ...st })); } catch { /**/ } };

interface Props { userId: string; onBack: () => void; addToast: (m: string, t: 'success' | 'error' | 'info') => void }

const GuessGridGame: React.FC<Props> = ({ onBack, addToast }) => {
  const [data, setData] = useState<GridToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [index, setIndex] = useState<GridPlayer[]>([]);
  const [cells, setCells] = useState<Record<string, { id: number; name: string }[]>>({});
  const cellsRef = useRef(cells); cellsRef.current = cells;
  const [query, setQuery] = useState('');
  const [left, setLeft] = useState(DURATION);
  const startRef = useRef<number | null>(null);
  const [dev, setDev] = useState(false); const devTaps = useRef(0);

  const pl = data?.payload;
  const rows = (pl?.rows ?? []) as GridCrit[];
  const cols = (pl?.cols ?? []) as GridCrit[];
  const results = query.length >= 2 ? searchPlayers(index as unknown as IndexedPlayer[], query, 8) : [];
  const filled = Object.values(cells).filter(a => a.length > 0).length;
  const distinct = new Set(Object.values(cells).flat().map(p => p.id)).size;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getGridToday();
      const local = d.game ? readDone(d.game.id) : null;
      setData(d);
      getPuzzleStats(undefined as any, 'grid').then(setStats).catch(() => {});
      if (!d.game || !d.payload) return;
      if (d.play?.finished_at || local) {
        setCells(local?.cells ?? {});
        setSummary(local?.summary ?? { ok: true, rounds_solved: d.play?.rounds_solved ?? 0, pending: true });
        if (!d.play?.finished_at && local) finishPlayer(d.game.id, local.summary.rounds_solved, local.summary.time_ms ?? 0).catch(() => {});
        return;
      }
    } catch { addToast('Could not load', 'error'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { getGridIndex().then(setIndex).catch(() => {}); }, []);
  useEffect(() => {
    if (summary || !ready) return;
    const t = setInterval(() => {
      const el = startRef.current ? Math.floor((Date.now() - startRef.current) / 1000) : 0;
      const rem = Math.max(0, DURATION - el); setLeft(rem);
      if (rem <= 0) { clearInterval(t); doFinish(); }
    }, 500);
    return () => clearInterval(t);
  }, [summary, ready]);

  const kickoff = () => { startRef.current = Date.now(); setLeft(DURATION); setReady(true); };

  const doFinish = () => {
    if (!data?.game || summary) return;
    const done = Object.values(cellsRef.current).filter(a => a.length > 0).length;
    const dist2 = new Set(Object.values(cellsRef.current).flat().map(p => p.id)).size;
    const timeMs = startRef.current ? Math.min(DURATION * 1000, Date.now() - startRef.current) : 0;
    const score = done * 1000 - Math.min(900, Math.floor(timeMs / 1000));
    const dist = data.dist ?? [];
    const percentile = dist.length > 0 ? Math.round((1000 * dist.filter(s => s > score).length) / dist.length) / 10 : 0;
    const p = data.progress; const playedToday = p?.last_played === data.date;
    const streak = playedToday ? (p?.streak ?? 1) : ((p?.streak ?? 0) + 1);
    const localSummary = { ok: true, rounds_solved: done, players: dist2, time_ms: timeMs, score, percentile, streak };
    setSummary(localSummary);
    saveDone(data.game.id, data.date, { summary: localSummary, cells: cellsRef.current });
    finishPlayer(data.game.id, done, timeMs).then(s => { if (s?.ok) { setSummary({ ...s, players: dist2 }); getPuzzleStats(undefined as any, 'grid').then(setStats); } }).catch(() => {});
  };

  const pick = (p: IndexedPlayer) => {
    setQuery('');
    const gp = index.find(x => x.id === p.id); if (!gp) return;
    let added = 0;
    setCells(prev => {
      const next = { ...prev };
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        if (fits(gp, rows[r]) && fits(gp, cols[c])) {
          const key = `${r}_${c}`; const arr = next[key] ?? [];
          if (!arr.some(x => x.id === gp.id)) { next[key] = [...arr, { id: gp.id, name: gp.name }]; added++; }
        }
      }
      return next;
    });
    setTimeout(() => { if (added > 0) addToast(`✅ ${surname(gp.name)} · ${added} box${added > 1 ? 'es' : ''}`, 'success'); else addToast(`${surname(gp.name)} fits no box`, 'error'); }, 0);
  };

  const replay = async () => { if (!data?.game) return; try { localStorage.removeItem(doneKey(data.game.id)); } catch { /**/ } await replayGame(data.game.id); setSummary(null); setCells({}); setReady(false); load(); };

  const shareReview = async () => {
    const grid = [0, 1, 2].map(r => [0, 1, 2].map(c => (cells[`${r}_${c}`]?.length ? '🟩' : '⬜')).join('')).join('\n');
    try { await navigator.clipboard.writeText(`Box2Box — ${data?.date}\n${grid}\n${filled}/9 boxes · ${distinct} players · ⏱️ ${fmt(Math.floor((summary?.time_ms || 0) / 1000))}`); addToast('Copied!', 'success'); } catch { /**/ }
  };

  const Shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-50 bg-deep-navy overflow-y-auto">
      <div className="max-w-md mx-auto px-3 pt-[calc(env(safe-area-inset-top)+12px)] pb-10">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack}><ArrowLeft className="text-text-primary" /></button>
          <div className="flex items-center gap-3 text-sm">
            {stats && <span className="flex items-center gap-1 text-hot-red font-bold"><Flame size={16} /> {stats.current_streak}</span>}
            {ready && !summary && <span className="font-mono font-bold text-text-primary tabular-nums">{fmt(left)}</span>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );

  if (loading) return Shell(<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-electric-blue border-t-transparent rounded-full animate-spin" /></div>);
  if (!data?.game || !pl) return Shell(<div className="text-center py-20 text-text-secondary">No grid puzzle today.</div>);

  if (summary) {
    const hasPct = summary.percentile != null;
    const bucket = !hasPct ? '…' : summary.percentile <= 1 ? 'Top 1%' : summary.percentile <= 5 ? 'Top 5%' : summary.percentile <= 25 ? 'Top 25%' : summary.percentile <= 50 ? 'Top 50%' : 'Top 75%';
    return Shell(<div className="text-center py-8">
      <Trophy size={44} className="text-warm-yellow mx-auto mb-3" />
      <h1 onClick={() => { devTaps.current += 1; if (devTaps.current >= 4) setDev(true); }} className="text-2xl font-extrabold text-text-primary">Time!</h1>
      <p className="text-text-secondary">{summary.rounds_solved}/9 boxes · {summary.players ?? distinct} players</p>
      <div className="grid grid-cols-3 gap-3 mt-6">
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Boxes</p><p className="text-base font-bold text-lime-glow">{summary.rounds_solved}/9</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Percentile</p><p className="text-base font-bold text-lime-glow">{bucket}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Streak</p><p className="text-base font-bold text-hot-red">🔥 {summary.streak ?? '…'}</p></div>
      </div>
      <button onClick={shareReview} className="mt-5 w-full bg-lime-glow text-deep-navy font-extrabold py-3 rounded-xl flex items-center justify-center gap-2"><Share2 size={18} /> Share result</button>
      {dev && <button onClick={replay} className="mt-3 text-electric-blue font-semibold text-sm">🔄 Play again</button>}
      <button onClick={onBack} className="mt-3 w-full bg-navy-accent text-text-primary font-bold py-3 rounded-xl">Go to FunZone</button>
    </div>);
  }

  if (!ready) return Shell(
    <div className="text-center py-16">
      <div className="text-5xl mb-4">⬛</div>
      <h1 className="text-2xl font-extrabold text-text-primary mb-1">Box2Box</h1>
      <p className="text-text-secondary mb-8">Fill the 3×3 grid · 3 minutes · name as many players as you can</p>
      <button onClick={kickoff} className="w-full bg-electric-blue text-white font-extrabold py-3.5 rounded-xl">Kick Off ⚽</button>
    </div>
  );

  const Crit = ({ c }: { c: GridCrit }) => <div className="flex items-center justify-center text-center text-[10px] font-extrabold text-text-primary leading-tight p-1 h-full">{c.label}</div>;

  return Shell(<>
    <div className="flex items-center gap-2 mb-3">
      <div className="flex-1 relative">
        <div className="flex items-center gap-2 bg-navy-accent rounded-xl px-3 py-2.5">
          <Search size={18} className="text-text-disabled" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search player…" autoFocus
            className="flex-1 bg-transparent outline-none text-text-primary placeholder:text-text-disabled" />
          {query && <button onClick={() => setQuery('')}><X size={16} className="text-text-disabled" /></button>}
        </div>
        {results.length > 0 && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-navy-accent rounded-xl overflow-hidden divide-y divide-white/5 max-h-72 overflow-y-auto shadow-xl">
            {results.map(p => (
              <button key={p.id} onPointerDown={(e) => { e.preventDefault(); pick(p); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-white/5">
                {p.photo ? <img src={p.photo} className="w-8 h-8 rounded-full object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />}
                <span className="text-sm font-semibold text-text-primary truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={doFinish} className="bg-lime-glow text-deep-navy font-extrabold px-4 py-2.5 rounded-xl text-sm">DONE?</button>
    </div>

    {/* grid */}
    <div className="grid grid-cols-4 gap-1">
      <div className="aspect-square bg-electric-blue/30 rounded-lg flex items-center justify-center text-[9px] font-extrabold text-text-primary">BOX2BOX</div>
      {cols.map((c, i) => <div key={i} className="aspect-square bg-navy-accent rounded-lg"><Crit c={c} /></div>)}
      {rows.map((rc, r) => (
        <React.Fragment key={r}>
          <div className="aspect-square bg-navy-accent rounded-lg"><Crit c={rc} /></div>
          {cols.map((_, c) => {
            const arr = cells[`${r}_${c}`] ?? [];
            return (
              <div key={c} className={`aspect-square rounded-lg flex flex-col items-center justify-center p-1 ${arr.length ? 'bg-emerald-700/40' : 'bg-emerald-900/30'}`}>
                {arr.length ? (<>
                  <div className="relative text-white"><span className="text-2xl">👕</span><span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-deep-navy">{arr.length}</span></div>
                  <span className="text-[8px] font-bold text-text-primary text-center leading-tight truncate max-w-full">{surname(arr[arr.length - 1].name)}</span>
                </>) : <span className="text-[8px] text-text-disabled font-bold">FIND PLAYER</span>}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
    <p className="text-center text-text-secondary text-xs mt-3">{filled}/9 boxes · {distinct} players</p>
  </>);
};

export default GuessGridGame;
