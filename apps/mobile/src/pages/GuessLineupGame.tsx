import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Search, X, Flame, Snowflake, Trophy, Share2 } from 'lucide-react';
import { getLineupToday, prefetchLineupToday, finishPlayer, getPuzzleStats, LineupToday, LineupRoundPayload } from '../services/puzzleService';
import { getLineupIndex, searchPlayers, IndexedPlayer } from '../services/playerIndexService';
import { GuessLineupPitch, PitchCell } from '../components/GuessLineupPitch';

const maskName = (name: string, n: number) => name.split('').map((ch, i) => i < n ? ch : (/[\s.\-']/.test(ch) ? ch : '_')).join('');
const doneKey = (g: string) => `sportime_gl_done_${g}`;
const readDone = (g: string) => { try { const r = localStorage.getItem(doneKey(g)); return r ? JSON.parse(r) : null; } catch { return null; } };
const saveDone = (g: string, date: string, summary: any, prog: any) => {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith('sportime_gl_done_')) { try { if (JSON.parse(localStorage.getItem(k)!).date !== date) localStorage.removeItem(k); } catch { /**/ } } }
    localStorage.setItem(doneKey(g), JSON.stringify({ date, summary, prog }));
  } catch { /**/ }
};
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const teamLogo = (id: number) => `https://media.api-sports.io/football/teams/${id}.png`;

type HoleState = { solved: boolean; gaveUp: boolean; guesses: { id: number; name: string; correct: boolean }[]; hint: number; letters: number; masked: string };
const hk = (round: number, hole: number) => `${round}:${hole}`;

interface Props { userId: string; onBack: () => void; addToast: (m: string, t: 'success' | 'error' | 'info') => void }

const GuessLineupGame: React.FC<Props> = ({ onBack, addToast }) => {
  const [data, setData] = useState<LineupToday | null>(null);
  const dataRef = useRef<LineupToday | null>(null); dataRef.current = data;
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<number | null>(null);     // selected hole index in current round
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<IndexedPlayer[]>([]);
  const [prog, setProg] = useState<Record<string, HoleState>>({});
  const [pickScope, setPickScope] = useState<'big' | 'all'>('big');
  const [pickHoles, setPickHoles] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [, setNow] = useState(0);
  const startRef = useRef<number | null>(null);

  const round = data?.rounds?.[idx];
  const pl: LineupRoundPayload | undefined = round?.payload;
  const results = query.length >= 2 ? searchPlayers(index, query, 8) : [];

  const load = useCallback(async (scope?: 'big' | 'all', holes?: number) => {
    setLoading(true);
    try {
      const d = await getLineupToday(scope, holes);
      const local = d.game ? readDone(d.game.id) : null;
      setData(d); setPickScope(d.scope ?? 'big'); setPickHoles(d.holes ?? 1);
      getPuzzleStats(undefined as any, 'guess_lineup').then(setStats).catch(() => {});
      if (!d.has_prefs) { setConfig(true); return; }
      if (!d.game) return;
      if (d.play?.finished_at || local) {
        setSummary(local?.summary ?? { ok: true, rounds_solved: d.play?.rounds_solved ?? 0, pending: true });
        if (local?.prog) setProg(local.prog);
        if (!d.play?.finished_at && local) finishPlayer(d.game.id, local.summary.rounds_solved, local.summary.time_ms ?? 0).catch(() => {});
        return;
      }
      startRef.current = Date.now();
      setReady(true);
    } catch (e) {
      addToast('Could not load — tap to retry', 'error');
      setConfig(true);   // fall back to setup so the screen is never stuck
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { getLineupIndex().then(setIndex).catch(() => {}); }, []);
  useEffect(() => { if (summary && data?.game) saveDone(data.game.id, data.date, summary, prog); }, [summary]);
  useEffect(() => { setSel(null); setQuery(''); }, [idx]);
  useEffect(() => {
    if (summary || ready || config || !data?.game) return;
    const t = setInterval(() => { setNow(Date.now()); if (startRef.current) setElapsed(Math.floor((Date.now() - startRef.current) / 1000)); }, 500);
    return () => clearInterval(t);
  }, [summary, ready, config, data]);

  const startPlay = () => { startRef.current = Date.now(); setElapsed(0); setReady(false); };
  const confirmConfig = async () => { setConfig(false); setSummary(null); await load(pickScope, pickHoles); };

  const roundSolved = (rIdx: number) => {
    const r = data?.rounds?.[rIdx]; if (!r) return false;
    return r.payload.holes.every((_, h) => prog[hk(r.round_no, h)]?.solved);
  };
  const roundCleanSolved = (rIdx: number) => {   // all holes guessed (not given up)
    const r = data?.rounds?.[rIdx]; if (!r) return false;
    return r.payload.holes.every((_, h) => { const s = prog[hk(r.round_no, h)]; return s?.solved && !s.gaveUp; });
  };
  const cleanCount = () => (data?.rounds ?? []).reduce((n, _, i) => n + (roundCleanSolved(i) ? 1 : 0), 0);

  const doFinish = (finalSolved: number) => {
    if (!data?.game || summary) return;
    const timeMs = startRef.current ? Date.now() - startRef.current : elapsed * 1000;
    const score = Math.max(0, finalSolved) * 1000 - Math.min(900, Math.floor(Math.max(0, timeMs) / 1000));
    const dist = data.dist ?? [];
    const percentile = dist.length > 0 ? Math.round((1000 * dist.filter(s => s > score).length) / dist.length) / 10 : 0;
    const p = data.progress; const playedToday = p?.last_played === data.date;
    const streak = playedToday ? (p?.streak ?? 1) : ((p?.streak ?? 0) + 1);
    const localSummary = { ok: true, rounds_solved: finalSolved, time_ms: timeMs, score, percentile, streak };
    setSummary(localSummary);
    saveDone(data.game.id, data.date, localSummary, dataRef.current ? prog : prog);
    finishPlayer(data.game.id, finalSolved, timeMs).then(s => { if (s?.ok) { setSummary(s); getPuzzleStats(undefined as any, 'guess_lineup').then(setStats); } }).catch(() => {});
  };

  const afterHoleResolved = () => {
    if (!data) return;
    const isLast = idx >= (data.rounds!.length - 1);
    if (roundSolved(idx) && isLast) setTimeout(() => doFinish(cleanCount()), 700);
  };

  const pick = (player: IndexedPlayer) => {
    if (!pl || sel == null) return;
    setQuery('');
    const key = hk(round!.round_no, sel);
    const cur = prog[key];
    if (cur?.solved) return;
    const correct = player.id === pl.holes[sel].answer.id;
    setProg(prev => ({ ...prev, [key]: {
      solved: correct || !!cur?.solved, gaveUp: cur?.gaveUp ?? false,
      guesses: [...(cur?.guesses ?? []), { id: player.id, name: player.name, correct }],
      hint: cur?.hint ?? 0, letters: cur?.letters ?? 0, masked: cur?.masked ?? '',
    } }));
    if (correct) { addToast('🎯 Correct!', 'success'); setSel(null); setTimeout(afterHoleResolved, 0); }
    else addToast('Nope', 'error');
  };
  const revealHint = (hole: number) => {
    if (!pl) return; const key = hk(round!.round_no, hole); const cur = prog[key] ?? { solved: false, gaveUp: false, guesses: [], hint: 0, letters: 0, masked: '' };
    const ans = pl.holes[hole].answer;
    if (cur.hint < 2) { setProg(prev => ({ ...prev, [key]: { ...cur, hint: cur.hint + 1 } })); }
    else { const n = cur.letters + 1; setProg(prev => ({ ...prev, [key]: { ...cur, hint: 2, letters: n, masked: maskName(ans.name, n) } })); }
  };
  const giveUp = (hole: number) => {
    if (!pl) return; const key = hk(round!.round_no, hole); const cur = prog[key];
    setProg(prev => ({ ...prev, [key]: { solved: true, gaveUp: true, guesses: cur?.guesses ?? [], hint: 2, letters: 99, masked: pl.holes[hole].answer.name } }));
    setSel(null); setTimeout(afterHoleResolved, 0);
  };
  const next = () => { if (!data) return; if (idx < data.rounds!.length - 1) setIdx(idx + 1); else doFinish(cleanCount()); };

  // ---- build pitch cells ----
  const cells: PitchCell[] = pl ? [
    ...pl.starters.map(s => ({ grid: s.grid, kind: 'player' as const, name: s.name, number: s.number, pos: s.pos, photo: s.photo })),
    ...pl.holes.map((h, i) => {
      const st = prog[hk(round!.round_no, i)];
      return { grid: h.grid, kind: 'hole' as const, holeIdx: i, selected: sel === i, status: st?.solved ? 'solved' as const : 'open' as const, name: st?.solved ? h.answer.name : undefined, pos: h.answer.position };
    }),
  ] : [];

  const Shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-50 bg-deep-navy overflow-y-auto">
      <div className="max-w-md mx-auto px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-10">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack}><ArrowLeft className="text-text-primary" /></button>
          <div className="flex items-center gap-3 text-sm">
            {stats && <span className="flex items-center gap-1 text-hot-red font-bold"><Flame size={16} /> {stats.current_streak}</span>}
            {stats && <span className="flex items-center gap-1 text-electric-blue font-bold"><Snowflake size={16} /> {stats.freezes}</span>}
            {!summary && !ready && !config && data?.game && <span className="font-mono text-text-primary tabular-nums">{fmtTime(elapsed)}</span>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );

  if (loading) return Shell(<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-electric-blue border-t-transparent rounded-full animate-spin" /></div>);

  if (config) return Shell(
    <div className="py-4">
      <h1 className="text-2xl font-extrabold text-text-primary text-center mb-1">Guess the Lineup</h1>
      <p className="text-text-secondary text-center text-sm mb-6">Find the missing player(s) on the pitch.</p>
      <p className="text-xs font-bold text-text-secondary mb-2">TEAMS</p>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {(['big', 'all'] as const).map(s => (
          <button key={s} onClick={() => setPickScope(s)} className={`p-3 rounded-xl border text-sm font-bold ${pickScope === s ? 'border-electric-blue bg-electric-blue/10 text-text-primary' : 'border-white/10 text-text-secondary'}`}>
            {s === 'big' ? 'Only big clubs' : 'All teams'}</button>
        ))}
      </div>
      <p className="text-xs font-bold text-text-secondary mb-2">DIFFICULTY · missing players</p>
      <div className="grid grid-cols-3 gap-2 mb-8">
        {[1, 2, 3].map(h => (
          <button key={h} onClick={() => setPickHoles(h)} className={`p-3 rounded-xl border text-sm font-bold ${pickHoles === h ? 'border-electric-blue bg-electric-blue/10 text-text-primary' : 'border-white/10 text-text-secondary'}`}>
            {h === 1 ? 'Easy · 1' : h === 2 ? 'Medium · 2' : 'Hard · 3'}</button>
        ))}
      </div>
      <button onClick={confirmConfig} className="w-full bg-electric-blue text-white font-bold py-3 rounded-xl">Start</button>
    </div>
  );

  if (summary) {
    const hasPct = summary.percentile != null;
    const bucket = !hasPct ? '…' : summary.percentile <= 1 ? 'Top 1%' : summary.percentile <= 5 ? 'Top 5%' : summary.percentile <= 25 ? 'Top 25%' : summary.percentile <= 50 ? 'Top 50%' : 'Top 75%';
    return Shell(<div className="text-center py-8">
      <Trophy size={44} className="text-warm-yellow mx-auto mb-3" />
      <h1 className="text-2xl font-extrabold text-text-primary">Done!</h1>
      <p className="text-text-secondary">{summary.rounds_solved}/{data?.rounds?.length} clean</p>
      {summary.freeze_gained && <div className="mt-3 inline-flex items-center gap-2 bg-electric-blue/15 text-electric-blue rounded-full px-4 py-1.5 text-sm font-bold"><Snowflake size={14} /> +1 Freeze earned!</div>}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Time</p><p className="text-lg font-bold text-text-primary">{fmtTime(Math.floor((summary.time_ms || 0) / 1000))}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Percentile</p><p className="text-lg font-bold text-lime-glow">{bucket}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Streak</p><p className="text-lg font-bold text-hot-red">🔥 {summary.streak ?? '…'}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Difficulty</p><p className="text-lg font-bold text-text-primary">{data?.holes} hole{(data?.holes ?? 1) > 1 ? 's' : ''}</p></div>
      </div>
      <p className="text-text-secondary text-sm mt-4 font-medium">See you tomorrow! 👋</p>
      <button onClick={() => setConfig(true)} className="mt-5 text-electric-blue font-semibold text-sm">Change setup</button>
      <button onClick={onBack} className="mt-4 w-full bg-navy-accent text-text-primary font-bold py-3 rounded-xl">Go to FunZone</button>
    </div>);
  }

  if (!data?.game) return Shell(<div className="text-center py-20 text-text-secondary">No lineup puzzle today.</div>);

  if (ready) return Shell(
    <div className="text-center py-16">
      <div className="text-5xl mb-4">🧩</div>
      <h1 className="text-2xl font-extrabold text-text-primary mb-1">Guess the Lineup</h1>
      <p className="text-text-secondary mb-8">{data.rounds?.length} lineups · {data.holes} missing player{(data.holes ?? 1) > 1 ? 's' : ''} each · timed</p>
      <button onClick={startPlay} className="w-full bg-electric-blue text-white font-extrabold py-3.5 rounded-xl">Play</button>
    </div>
  );

  const done = roundSolved(idx);
  const filled = pl!.holes.filter((_, h) => prog[hk(round!.round_no, h)]?.solved).length;
  const selState = sel != null ? prog[hk(round!.round_no, sel)] : undefined;
  const selAns = sel != null ? pl!.holes[sel].answer : undefined;

  return Shell(<>
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-bold text-text-primary">Round {idx + 1}/{data.rounds!.length}</span>
      <span className="text-xs text-text-secondary">{filled}/{pl!.holes.length} found</span>
    </div>

    {/* match context */}
    <div className="card-base p-3 mb-3 flex items-center justify-center gap-3">
      <div className="flex items-center gap-1.5">
        <img src={teamLogo(pl!.team.id)} className="w-7 h-7 object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
        <span className="text-xs font-bold text-text-primary max-w-[80px] truncate">{pl!.team.name}</span>
      </div>
      <div className="text-center">
        <div className="text-lg font-extrabold text-text-primary tabular-nums">{pl!.score.team} – {pl!.score.opp}</div>
        <div className="text-[10px] text-text-secondary">{pl!.competition} · {pl!.date}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-text-secondary max-w-[80px] truncate">{pl!.opponent.name}</span>
        <img src={teamLogo(pl!.opponent.id)} className="w-7 h-7 object-contain opacity-70" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
      </div>
    </div>

    {/* per-hole guess panel — ABOVE the pitch (so the keyboard never covers it) */}
    {sel != null && !selState?.solved && (
      <div className="mb-3">
        <div className="relative">
          <div className="flex items-center gap-2 bg-navy-accent rounded-xl px-3 py-2.5">
            <Search size={18} className="text-text-disabled" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Player at ${selAns?.position} #${selAns?.number}…`} autoFocus
              className="flex-1 bg-transparent outline-none text-text-primary placeholder:text-text-disabled" />
            {query && <button onClick={() => setQuery('')}><X size={16} className="text-text-disabled" /></button>}
          </div>
          {results.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-navy-accent rounded-xl overflow-hidden divide-y divide-white/5 max-h-72 overflow-y-auto shadow-xl">
              {results.map(p => (
                <button key={p.id} onPointerDown={(e) => { e.preventDefault(); pick(p); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-white/5">
                  {p.photo ? <img src={p.photo} className="w-8 h-8 rounded-full object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />}
                  <span className="text-sm font-semibold text-text-primary truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}
          {query.length >= 2 && results.length === 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-navy-accent rounded-xl px-3 py-2.5 text-sm text-text-disabled shadow-xl">{index.length === 0 ? 'Loading players…' : 'No match'}</div>
          )}
        </div>
        {/* hints */}
        <div className="mt-2 space-y-1.5">
          {(selState?.hint ?? 0) >= 1 && <div className="bg-navy-accent/40 rounded-lg px-3 py-2 text-sm text-text-secondary">💡 <b className="text-text-primary">Position:</b> {selAns?.position} · <b className="text-text-primary">#</b>{selAns?.number}</div>}
          {(selState?.hint ?? 0) >= 2 && <div className="bg-navy-accent/40 rounded-lg px-3 py-2 text-sm text-text-secondary">💡 <b className="text-text-primary">Nationality:</b> {selAns?.nationality && selAns.nationality !== 'Unknown' ? selAns.nationality : '—'}</div>}
          {(selState?.letters ?? 0) > 0 && <div className="bg-navy-accent/40 rounded-lg px-3 py-2 text-base font-mono tracking-widest text-text-primary">{selState!.masked}</div>}
        </div>
        <button onClick={() => revealHint(sel)} className="mt-2 w-full bg-navy-accent text-electric-blue font-semibold py-2 rounded-xl text-sm">
          {(selState?.hint ?? 0) < 2 ? 'Reveal hint' : 'Reveal a letter'}
        </button>
        <button onClick={() => giveUp(sel)} className="mt-2 w-full text-text-disabled text-sm font-semibold py-2 active:opacity-60">Give up this player</button>
        {!!selState?.guesses?.length && <div className="mt-2 space-y-1">{selState.guesses.slice(-3).map((g, i) => <div key={i} className={`text-xs px-3 py-1.5 rounded-lg ${g.correct ? 'bg-lime-glow/15 text-lime-glow' : 'bg-hot-red/10 text-hot-red'}`}>{g.correct ? '✓' : '✗'} {g.name}</div>)}</div>}
      </div>
    )}

    {sel == null && !done && <p className="text-center text-text-secondary text-sm mb-2">Tap a <span className="text-warm-yellow font-bold">?</span> on the pitch to guess</p>}

    <GuessLineupPitch cells={cells} onSelectHole={(i) => setSel(prev => prev === i ? null : i)} />

    {done && (
      <button onClick={next} className="mt-4 w-full bg-electric-blue text-white font-bold py-3 rounded-xl">
        {idx >= data.rounds!.length - 1 ? 'See results' : 'Next lineup'}
      </button>
    )}
  </>);
};

export default GuessLineupGame;
