import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Search, X, Flame, Trophy, Share2, Clock } from 'lucide-react';
import { getRapidToday, finishPlayer, getPuzzleStats, replayGame, RapidToday } from '../services/puzzleService';
import { getGridIndex, searchPlayers, fits, GridPlayer, GridCrit } from '../services/gridService';
import { IndexedPlayer } from '../services/playerIndexService';

const START = 100, BONUS = 5;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const doneKey = (g: string) => `sportime_rf_done_${g}`;
const readDone = (g: string) => { try { const r = localStorage.getItem(doneKey(g)); return r ? JSON.parse(r) : null; } catch { return null; } };
const saveDone = (g: string, date: string, st: any) => { try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith('sportime_rf_done_')) { try { if (JSON.parse(localStorage.getItem(k)!).date !== date) localStorage.removeItem(k); } catch { /**/ } } } localStorage.setItem(doneKey(g), JSON.stringify({ date, ...st })); } catch { /**/ } };

interface Props { userId: string; onBack: () => void; addToast: (m: string, t: 'success' | 'error' | 'info') => void }

const RapidFireGame: React.FC<Props> = ({ onBack, addToast }) => {
  const [data, setData] = useState<RapidToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(false);
  const [pickLevel, setPickLevel] = useState('medium');
  const [ready, setReady] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [index, setIndex] = useState<GridPlayer[]>([]);
  const [named, setNamed] = useState<{ id: number; name: string }[]>([]);
  const namedRef = useRef(named); namedRef.current = named;
  const [query, setQuery] = useState('');
  const [left, setLeft] = useState(START);
  const endRef = useRef<number>(0);
  const [dev, setDev] = useState(false); const devTaps = useRef(0);

  const pl = data?.payload;
  const crit: GridCrit | null = pl ? { type: pl.type as any, value: pl.value, label: pl.label } : null;
  const results = query.length >= 2 ? searchPlayers(index as unknown as IndexedPlayer[], query, 8) : [];

  const load = useCallback(async (level?: string) => {
    setLoading(true);
    try {
      const d = await getRapidToday(level);
      const local = d.game ? readDone(d.game.id) : null;
      setData(d); if (d.level) setPickLevel(d.level);
      getPuzzleStats(undefined as any, 'rapid').then(setStats).catch(() => {});
      if (!d.has_prefs) { setConfig(true); return; }
      if (!d.game || !d.payload) return;
      if (d.play?.finished_at || local) {
        setNamed(local?.named ?? []);
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
      const rem = Math.ceil((endRef.current - Date.now()) / 1000); setLeft(rem);
      if (rem <= 0) { clearInterval(t); doFinish(); }
    }, 250);
    return () => clearInterval(t);
  }, [summary, ready]);

  const kickoff = () => { endRef.current = Date.now() + START * 1000; setLeft(START); setReady(true); };
  const confirmConfig = async () => { setConfig(false); setSummary(null); setNamed([]); setReady(false); await load(pickLevel); };

  const doFinish = () => {
    if (!data?.game || summary) return;
    const n = namedRef.current.length;
    const score = n * 1000;
    const dist = data.dist ?? [];
    const percentile = dist.length > 0 ? Math.round((1000 * dist.filter(s => s > score).length) / dist.length) / 10 : 0;
    const p = data.progress; const playedToday = p?.last_played === data.date;
    const streak = playedToday ? (p?.streak ?? 1) : ((p?.streak ?? 0) + 1);
    const localSummary = { ok: true, rounds_solved: n, time_ms: 0, score, percentile, streak };
    setSummary(localSummary);
    saveDone(data.game.id, data.date, { summary: localSummary, named: namedRef.current });
    finishPlayer(data.game.id, n, 0).then(s => { if (s?.ok) { setSummary(s); getPuzzleStats(undefined as any, 'rapid').then(setStats); } }).catch(() => {});
  };

  const pick = (p: IndexedPlayer) => {
    setQuery('');
    if (named.some(x => x.id === p.id)) { addToast('Already named', 'info'); return; }
    const gp = index.find(x => x.id === p.id); if (!gp || !crit) return;
    if (fits(gp, crit)) { endRef.current += BONUS * 1000; setNamed(prev => [{ id: p.id, name: p.name }, ...prev]); addToast(`✅ +${BONUS}s`, 'success'); }
    else addToast('Not a match', 'error');
  };
  const replay = async () => { if (!data?.game) return; try { localStorage.removeItem(doneKey(data.game.id)); } catch { /**/ } await replayGame(data.game.id); setSummary(null); setNamed([]); setReady(false); load(); };

  const shareReview = async () => {
    try { await navigator.clipboard.writeText(`Rapid Fire — ${pl?.label}\n⚡ Named ${summary?.rounds_solved ?? named.length}/${pl?.total}`); addToast('Copied!', 'success'); } catch { /**/ }
  };

  const Shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-50 bg-deep-navy overflow-y-auto">
      <div className="max-w-md mx-auto px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-10">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack}><ArrowLeft className="text-text-primary" /></button>
          <div className="flex items-center gap-3 text-sm">
            {stats && <span className="flex items-center gap-1 text-hot-red font-bold"><Flame size={16} /> {stats.current_streak}</span>}
            {ready && !summary && <span className={`flex items-center gap-1 font-mono font-bold tabular-nums ${left <= 10 ? 'text-hot-red' : 'text-text-primary'}`}><Clock size={15} /> {fmt(left)}</span>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );

  if (loading) return Shell(<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-electric-blue border-t-transparent rounded-full animate-spin" /></div>);

  if (config) return Shell(
    <div className="py-4">
      <h1 className="text-2xl font-extrabold text-text-primary text-center mb-1">Rapid Fire</h1>
      <p className="text-text-secondary text-center text-sm mb-6">Name as many as you can · +5s per answer</p>
      <p className="text-xs font-bold text-text-secondary mb-2">DIFFICULTY</p>
      <div className="grid grid-cols-3 gap-2 mb-8">
        {[['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].map(([k, lbl]) => (
          <button key={k} onClick={() => setPickLevel(k)} className={`p-3 rounded-xl border text-sm font-bold ${pickLevel === k ? 'border-electric-blue bg-electric-blue/10 text-text-primary' : 'border-white/10 text-text-secondary'}`}>{lbl}</button>
        ))}
      </div>
      <button onClick={confirmConfig} className="w-full bg-electric-blue text-white font-bold py-3 rounded-xl">Start</button>
    </div>
  );

  if (!data?.game || !pl) return Shell(<div className="text-center py-20 text-text-secondary">
    No question for this difficulty today.<br /><button onClick={() => setConfig(true)} className="mt-3 text-electric-blue font-bold">Change difficulty</button>
  </div>);

  if (summary) {
    const hasPct = summary.percentile != null;
    const bucket = !hasPct ? '…' : summary.percentile <= 1 ? 'Top 1%' : summary.percentile <= 5 ? 'Top 5%' : summary.percentile <= 25 ? 'Top 25%' : summary.percentile <= 50 ? 'Top 50%' : 'Top 75%';
    return Shell(<div className="text-center py-8">
      <Trophy size={44} className="text-warm-yellow mx-auto mb-3" />
      <h1 onClick={() => { devTaps.current += 1; if (devTaps.current >= 4) setDev(true); }} className="text-2xl font-extrabold text-text-primary">Time!</h1>
      <p className="text-text-secondary">{summary.rounds_solved} / {pl.total} named</p>
      <div className="grid grid-cols-3 gap-3 mt-6">
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Named</p><p className="text-base font-bold text-lime-glow">{summary.rounds_solved}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Percentile</p><p className="text-base font-bold text-lime-glow">{bucket}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Streak</p><p className="text-base font-bold text-hot-red">🔥 {summary.streak ?? '…'}</p></div>
      </div>
      {named.length > 0 && <div className="mt-5 flex flex-wrap gap-1.5 justify-center">{named.map(p => <span key={p.id} className="text-xs bg-lime-glow/15 text-lime-glow rounded-full px-2.5 py-1 font-semibold">{p.name}</span>)}</div>}
      <button onClick={shareReview} className="mt-5 w-full bg-lime-glow text-deep-navy font-extrabold py-3 rounded-xl flex items-center justify-center gap-2"><Share2 size={18} /> Share result</button>
      {dev && <button onClick={replay} className="mt-3 text-electric-blue font-semibold text-sm">🔄 Play again</button>}
      <button onClick={onBack} className="mt-3 w-full bg-navy-accent text-text-primary font-bold py-3 rounded-xl">Go to FunZone</button>
    </div>);
  }

  if (!ready) return Shell(
    <div className="text-center py-14">
      <div className="text-5xl mb-4">⚡</div>
      <h1 className="text-2xl font-extrabold text-text-primary mb-1">Rapid Fire</h1>
      <p className="text-text-secondary mb-5">{START}s · +{BONUS}s per correct answer · no penalty</p>
      <div className="inline-flex items-center gap-2 bg-navy-accent rounded-full px-4 py-1.5 text-sm font-bold text-text-primary mb-6 capitalize">{data.level} difficulty</div>
      <button onClick={kickoff} className="w-full bg-electric-blue text-white font-extrabold py-3.5 rounded-xl">Kick Off ⚽</button>
      <button onClick={() => setConfig(true)} className="mt-3 text-electric-blue font-semibold text-sm">Change difficulty</button>
    </div>
  );

  return Shell(<>
    <div className="card-base p-4 mb-3 text-center">
      <p className="text-lg font-extrabold text-text-primary leading-tight">{pl.label}</p>
      <p className="text-xs text-text-secondary mt-1">{named.length} named</p>
    </div>
    <div className="relative">
      <div className="flex items-center gap-2 bg-navy-accent rounded-xl px-3 py-2.5">
        <Search size={18} className="text-text-disabled" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Type a player name…" autoFocus
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
    {named.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{named.map(p => <span key={p.id} className="text-xs bg-lime-glow/15 text-lime-glow rounded-full px-2.5 py-1 font-semibold">{p.name}</span>)}</div>}
  </>);
};

export default RapidFireGame;
