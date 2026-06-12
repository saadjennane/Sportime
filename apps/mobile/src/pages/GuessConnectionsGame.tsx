import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Flame, Snowflake, Trophy, Share2, Shuffle, Lightbulb } from 'lucide-react';
import { getConnectionsToday, finishPlayer, getPuzzleStats, replayGame, ConnectionsToday, ConnGroup } from '../services/puzzleService';

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const COLOR = { yellow: 'bg-warm-yellow', green: 'bg-lime-glow', blue: 'bg-electric-blue', purple: 'bg-purple-500' } as Record<string, string>;
const EMOJI = { yellow: '🟨', green: '🟩', blue: '🟦', purple: '🟪' } as Record<string, string>;
const shortName = (n: string) => { const p = n.replace(/^[A-Za-z]\.\s*/, '').trim(); return p.length > 13 ? (p.split(' ').pop() || p) : p; };
const doneKey = (g: string) => `sportime_cn_done_${g}`;
const readDone = (g: string) => { try { const r = localStorage.getItem(doneKey(g)); return r ? JSON.parse(r) : null; } catch { return null; } };
const saveDone = (g: string, date: string, st: any) => {
  try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith('sportime_cn_done_')) { try { if (JSON.parse(localStorage.getItem(k)!).date !== date) localStorage.removeItem(k); } catch { /**/ } } } localStorage.setItem(doneKey(g), JSON.stringify({ date, ...st })); } catch { /**/ }
};

interface Props { userId: string; onBack: () => void; addToast: (m: string, t: 'success' | 'error' | 'info') => void }
const MAX_MISTAKES = 4;

const GuessConnectionsGame: React.FC<Props> = ({ onBack, addToast }) => {
  const [data, setData] = useState<ConnectionsToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [solved, setSolved] = useState<ConnGroup[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [guesses, setGuesses] = useState<{ ids: number[]; correct: boolean }[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [, setNow] = useState(0);
  const startRef = useRef<number | null>(null);
  const stateRef = useRef<any>({}); stateRef.current = { solved, mistakes, guesses };

  const pl = data?.payload;
  const groupOf = (pid: number) => pl?.groups.find(g => g.playerIds.includes(pid));
  const nameOf = (pid: number) => pl?.players.find(p => p.id === pid)?.name ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getConnectionsToday();
      const local = d.game ? readDone(d.game.id) : null;
      setData(d);
      getPuzzleStats(undefined as any, 'connections').then(setStats).catch(() => {});
      if (!d.game || !d.payload) return;
      if (d.play?.finished_at || local) {
        setSolved(d.payload.groups);   // reveal all on a finished/persisted game
        setGuesses(local?.guesses ?? []); setMistakes(local?.mistakes ?? 0);
        setSummary(local?.summary ?? { ok: true, rounds_solved: d.play?.rounds_solved ?? 0, pending: true });
        if (!d.play?.finished_at && local) finishPlayer(d.game.id, local.summary.rounds_solved, local.summary.time_ms ?? 0).catch(() => {});
        return;
      }
      setOrder(d.payload.players.map(p => p.id));
      startRef.current = Date.now();
    } catch { addToast('Could not load', 'error'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (summary || loading || !data?.game) return;
    const t = setInterval(() => { setNow(Date.now()); if (startRef.current) setElapsed(Math.floor((Date.now() - startRef.current) / 1000)); }, 500);
    return () => clearInterval(t);
  }, [summary, loading, data]);

  const doFinish = (solvedCount: number) => {
    if (!data?.game || summary) return;
    const timeMs = startRef.current ? Date.now() - startRef.current : elapsed * 1000;
    const score = solvedCount * 1000 + Math.max(0, MAX_MISTAKES - stateRef.current.mistakes) * 100 - Math.min(500, Math.floor(timeMs / 1000));
    const dist = data.dist ?? [];
    const percentile = dist.length > 0 ? Math.round((1000 * dist.filter(s => s > score).length) / dist.length) / 10 : 0;
    const p = data.progress; const playedToday = p?.last_played === data.date;
    const streak = playedToday ? (p?.streak ?? 1) : ((p?.streak ?? 0) + 1);
    const localSummary = { ok: true, rounds_solved: solvedCount, time_ms: timeMs, score, percentile, streak };
    setSummary(localSummary);
    saveDone(data.game.id, data.date, { summary: localSummary, guesses: stateRef.current.guesses, mistakes: stateRef.current.mistakes });
    finishPlayer(data.game.id, solvedCount, timeMs).then(s => { if (s?.ok) { setSummary(s); getPuzzleStats(undefined as any, 'connections').then(setStats); } }).catch(() => {});
  };

  const toggle = (pid: number) => {
    if (selected.includes(pid)) setSelected(selected.filter(x => x !== pid));
    else if (selected.length < 4) setSelected([...selected, pid]);
  };

  const submit = () => {
    if (selected.length !== 4 || !pl) return;
    const sel = new Set(selected);
    const match = pl.groups.find(g => g.playerIds.length === 4 && g.playerIds.every(id => sel.has(id)));
    const newGuesses = [...guesses, { ids: [...selected], correct: !!match }];
    setGuesses(newGuesses);
    if (match) {
      const nsolved = [...solved, match];
      setSolved(nsolved); setOrder(order.filter(id => !sel.has(id))); setSelected([]); setHint(null);
      addToast('✅ ' + match.label, 'success');
      if (nsolved.length === 4) setTimeout(() => doFinish(4), 300);
    } else {
      const m = mistakes + 1; setMistakes(m);
      const oneAway = pl.groups.some(g => g.playerIds.filter(id => sel.has(id)).length === 3);
      addToast(oneAway ? 'One away…' : 'Not a group', 'error');
      setSelected([]);
      if (m >= MAX_MISTAKES) { setSolved(pl.groups); setTimeout(() => doFinish(solved.length), 400); }   // reveal all, game over
    }
  };

  const replay = async () => {
    if (!data?.game) return;
    try { localStorage.removeItem(doneKey(data.game.id)); } catch { /**/ }
    await replayGame(data.game.id);
    setSummary(null); setSolved([]); setSelected([]); setMistakes(0); setGuesses([]); setHint(null);
    load();
  };
  const useHint = () => {
    if (!pl || hint) return;
    const unsolved = pl.groups.filter(g => !solved.some(s => s.key === g.key));
    const easiest = unsolved.sort((a, b) => ['yellow', 'green', 'blue', 'purple'].indexOf(a.color) - ['yellow', 'green', 'blue', 'purple'].indexOf(b.color))[0];
    if (easiest) setHint(easiest.label);
  };

  const shareReview = async () => {
    if (!pl) return;
    const grid = guesses.map(g => g.ids.map(id => EMOJI[groupOf(id)?.color ?? 'yellow']).join('')).join('\n');
    const txt = `Football Connections — ${data?.date}\n${grid}\n${solved.filter(s => guesses.some(g => g.correct)).length >= 0 ? '' : ''}Solved ${stateRef.current.solved.length}/4`;
    try { await navigator.clipboard.writeText(`Football Connections — ${data?.date}\n${grid}\nSolved ${Math.min(4, solved.length)}/4`); addToast('Copied!', 'success'); } catch { /**/ }
  };

  const Shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-50 bg-deep-navy overflow-y-auto">
      <div className="max-w-md mx-auto px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-10">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack}><ArrowLeft className="text-text-primary" /></button>
          <div className="flex items-center gap-3 text-sm">
            {stats && <span className="flex items-center gap-1 text-hot-red font-bold"><Flame size={16} /> {stats.current_streak}</span>}
            {!summary && data?.game && <span className="font-mono text-text-primary tabular-nums">{fmtTime(elapsed)}</span>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );

  if (loading) return Shell(<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-electric-blue border-t-transparent rounded-full animate-spin" /></div>);
  if (!data?.game || !pl) return Shell(<div className="text-center py-20 text-text-secondary">No Connections puzzle today.</div>);

  if (summary) {
    const won = summary.rounds_solved >= 4;
    const hasPct = summary.percentile != null;
    const bucket = !hasPct ? '…' : summary.percentile <= 1 ? 'Top 1%' : summary.percentile <= 5 ? 'Top 5%' : summary.percentile <= 25 ? 'Top 25%' : summary.percentile <= 50 ? 'Top 50%' : 'Top 75%';
    return Shell(<div className="text-center py-6">
      <Trophy size={44} className={`mx-auto mb-3 ${won ? 'text-warm-yellow' : 'text-text-disabled'}`} />
      <h1 className="text-2xl font-extrabold text-text-primary">{won ? 'Solved!' : 'Out of lives'}</h1>
      <p className="text-text-secondary">{Math.min(4, summary.rounds_solved)}/4 groups</p>
      {/* the solution */}
      <div className="space-y-2 mt-5 text-left">
        {pl.groups.map(g => (
          <div key={g.key} className={`${COLOR[g.color]} rounded-xl px-3 py-2 text-deep-navy`}>
            <p className="text-[11px] font-extrabold uppercase">{g.label}</p>
            <p className="text-sm font-bold">{g.playerIds.map(nameOf).map(shortName).join(', ')}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 mt-6">
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Time</p><p className="text-base font-bold text-text-primary">{fmtTime(Math.floor((summary.time_ms || 0) / 1000))}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Percentile</p><p className="text-base font-bold text-lime-glow">{bucket}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Streak</p><p className="text-base font-bold text-hot-red">🔥 {summary.streak ?? '…'}</p></div>
      </div>
      <button onClick={shareReview} className="mt-5 w-full bg-lime-glow text-deep-navy font-extrabold py-3 rounded-xl flex items-center justify-center gap-2"><Share2 size={18} /> Share result</button>
      <button onClick={replay} className="mt-3 text-electric-blue font-semibold text-sm">🔄 Play again</button>
      <button onClick={onBack} className="mt-3 w-full bg-navy-accent text-text-primary font-bold py-3 rounded-xl">Go to FunZone</button>
    </div>);
  }

  return Shell(<>
    <h1 className="text-xl font-extrabold text-text-primary text-center mb-1">Football Connections</h1>
    <p className="text-text-secondary text-center text-xs mb-3">Make 4 groups of 4</p>

    {/* solved groups */}
    <div className="space-y-2 mb-2">
      {solved.map(g => (
        <div key={g.key} className={`${COLOR[g.color]} rounded-xl px-3 py-2 text-deep-navy text-center`}>
          <p className="text-[11px] font-extrabold uppercase">{g.label}</p>
          <p className="text-sm font-bold">{g.playerIds.map(nameOf).map(shortName).join(', ')}</p>
        </div>
      ))}
    </div>

    {/* grid of remaining players */}
    <div className="grid grid-cols-4 gap-1.5">
      {order.map(pid => {
        const isSel = selected.includes(pid);
        return (
          <button key={pid} onClick={() => toggle(pid)}
            className={`aspect-square rounded-lg flex items-center justify-center text-center p-1 text-[11px] font-bold leading-tight transition-all
              ${isSel ? 'bg-electric-blue text-white scale-95' : 'bg-navy-accent text-text-primary'}`}>
            {shortName(nameOf(pid))}
          </button>
        );
      })}
    </div>

    {hint && <p className="text-center text-warm-yellow text-sm font-bold mt-3">💡 {hint}</p>}

    {/* mistakes */}
    <div className="flex items-center justify-center gap-1.5 mt-4">
      <span className="text-xs text-text-secondary mr-1">Mistakes:</span>
      {Array.from({ length: MAX_MISTAKES }).map((_, i) => <span key={i} className={`w-3 h-3 rounded-full ${i < MAX_MISTAKES - mistakes ? 'bg-text-primary' : 'bg-white/15'}`} />)}
    </div>

    <div className="flex items-center gap-2 mt-4">
      <button onClick={() => setOrder([...order].sort(() => Math.random() - 0.5))} className="flex-1 py-2.5 rounded-xl bg-navy-accent text-text-primary font-bold flex items-center justify-center gap-1.5"><Shuffle size={15} /> Shuffle</button>
      <button onClick={useHint} disabled={!!hint} className="flex-1 py-2.5 rounded-xl bg-navy-accent text-warm-yellow font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"><Lightbulb size={15} /> Hint</button>
    </div>
    <button onClick={submit} disabled={selected.length !== 4}
      className="mt-2 w-full py-3 rounded-xl bg-electric-blue text-white font-extrabold disabled:opacity-40">Submit</button>
    {selected.length > 0 && <button onClick={() => setSelected([])} className="mt-2 w-full text-text-disabled text-sm font-semibold py-1.5">Deselect all</button>}
  </>);
};

export default GuessConnectionsGame;
