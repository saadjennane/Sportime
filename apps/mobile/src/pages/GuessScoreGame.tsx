import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Loader2, Minus, Plus, Flame, Snowflake, Share2, Trophy, Lightbulb, Lock } from 'lucide-react';
import {
  getPuzzleToday, setPuzzlePrefs, puzzleStart, puzzleGuess, puzzleFinish, getPuzzleStats,
  PuzzleHint, PuzzleScope, PuzzleToday, PuzzleRound,
} from '../services/puzzleService';

interface Props { userId: string; onBack: () => void; addToast: (m: string, t: 'success' | 'error' | 'info') => void; }

const HEAT: Record<string, { label: string; cls: string; emoji: string }> = {
  exact: { label: 'Exact!', cls: 'text-lime-glow', emoji: '🎯' },
  burning: { label: 'Burning', cls: 'text-hot-red', emoji: '🔥' },
  hot: { label: 'Hot', cls: 'text-orange-400', emoji: '♨️' },
  warm: { label: 'Warm', cls: 'text-amber-300', emoji: '🌤️' },
  cold: { label: 'Cold', cls: 'text-electric-blue', emoji: '❄️' },
};
const HINTS: { key: PuzzleHint; title: string; desc: string; emoji: string }[] = [
  { key: 'easy', title: 'Easy', desc: 'Arrows tell you which way to adjust ⬆️⬇️', emoji: '🟢' },
  { key: 'medium', title: 'Medium', desc: 'Only the total goal gap is shown', emoji: '🟡' },
  { key: 'hard', title: 'Hard', desc: 'Hot / cold only — nothing else', emoji: '🔴' },
];
const SCOPES: { key: PuzzleScope; title: string; desc: string; emoji: string }[] = [
  { key: 'big', title: 'Only big teams', desc: 'Marquee clubs you know well', emoji: '⭐' },
  { key: 'all', title: 'All teams', desc: 'The full league — wider variety', emoji: '🌍' },
];
const HINT_COOLDOWN = 5000;

const arrow = (v: string) => v === 'up' ? '⬆️' : v === 'down' ? '⬇️' : '✅';
function FbBadge({ fb, heat }: { fb?: any; heat?: string }) {
  if (fb?.kind === 'arrows') {
    return (
      <span className="text-sm font-bold text-text-primary flex items-center gap-3">
        <span className="flex items-center gap-1"><span className="text-[10px] text-text-disabled">H</span>{arrow(fb.home)}</span>
        <span className="flex items-center gap-1"><span className="text-[10px] text-text-disabled">A</span>{arrow(fb.away)}</span>
      </span>
    );
  }
  if (fb?.kind === 'distance') return <span className="text-sm font-bold text-amber-300">{fb.value === 0 ? '🎯 Exact!' : `${fb.value} goal${fb.value > 1 ? 's' : ''} away`}</span>;
  const key = fb?.kind === 'heat' ? fb.key : heat;
  const h = HEAT[key] ?? HEAT.cold;
  return <span className={`text-sm font-bold ${h.cls}`}>{h.emoji} {h.label}</span>;
}

export const GuessScoreGame: React.FC<Props> = ({ onBack, addToast }) => {
  const [data, setData] = useState<PuzzleToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(false);
  const [pickScope, setPickScope] = useState<PuzzleScope>('big');
  const [pickHint, setPickHint] = useState<PuzzleHint>('easy');
  const [ready, setReady] = useState(false);
  const [idx, setIdx] = useState(0);
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [unlocked, setUnlocked] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const startRef = useRef<number | null>(null);

  const firstUnsolved = (rounds?: PuzzleRound[]) => {
    if (!rounds) return 0;
    const i = rounds.findIndex(r => !(r.attempt?.solved) && !(r.reveal));
    return i === -1 ? rounds.length - 1 : i;
  };

  const load = useCallback(async (scope?: PuzzleScope) => {
    setLoading(true);
    const d = await getPuzzleToday(scope);
    setData(d);
    setPickScope(d.scope); setPickHint(d.hint);
    setStats(await getPuzzleStats(d.scope));
    if (!d.has_prefs) { setConfig(true); setLoading(false); return; }
    if (!d.game) { setLoading(false); return; }
    if (d.play?.finished_at) { setSummary(await puzzleFinish(d.game.id)); setLoading(false); return; }
    setIdx(firstUnsolved(d.rounds));
    const hasProgress = (d.rounds ?? []).some(r => r.attempt?.guesses?.length);
    startRef.current = d.play?.started_at ? new Date(d.play.started_at).getTime() : Date.now();
    setReady(!hasProgress);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (summary || ready || config || !data?.game) return;
    const t = setInterval(() => { setNow(Date.now()); if (startRef.current) setElapsed(Math.floor((Date.now() - startRef.current) / 1000)); }, 500);
    return () => clearInterval(t);
  }, [summary, ready, config, data]);
  useEffect(() => { setUnlocked(0); setCooldownUntil(0); }, [idx]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const startPlay = async () => {
    if (!data?.game) return;
    const r = await puzzleStart(data.game.id);
    if (r?.started_at) startRef.current = new Date(r.started_at).getTime();
    setElapsed(0); setReady(false);
  };
  const confirmConfig = async () => { setConfig(false); setSummary(null); await setPuzzlePrefs(pickScope, pickHint); load(pickScope); };

  const submit = async () => {
    if (!data?.game || busy) return;
    setBusy(true);
    const round = data.rounds![idx];
    const r = await puzzleGuess(data.game.id, round.round_no, home, away);
    setBusy(false);
    if (!r?.ok) return addToast(r?.error === 'no_attempts_left' ? 'No attempts left' : 'Failed', 'error');
    setData(prev => {
      if (!prev) return prev;
      const rounds = prev.rounds!.map(x => x.round_no === round.round_no ? {
        ...x,
        attempt: { guesses: [...(x.attempt?.guesses ?? []), { h: home, a: away, fb: r.fb }], solved: r.solved, attempts: r.attempts_used },
        reveal: r.reveal ?? x.reveal,
      } : x);
      return { ...prev, rounds };
    });
    if (r.solved) addToast('🎯 Exact!', 'success');
    setHome(0); setAway(0);
  };

  const next = async () => {
    if (!data?.game) return;
    const last = idx >= (data.rounds!.length - 1);
    if (!last) { setIdx(idx + 1); setHome(0); setAway(0); return; }
    setBusy(true);
    try {
      const s = await puzzleFinish(data.game.id);
      if (s?.ok) { setSummary(s); setStats(await getPuzzleStats(data.scope)); }
      else addToast('Could not finish — retry', 'error');
    } catch { addToast('Network error', 'error'); }
    setBusy(false);
  };

  const share = async () => {
    if (!data?.rounds) return;
    const grid = data.rounds.map(r => r.attempt?.solved ? '🎯' : (r.attempt?.guesses?.length ? '🟥' : '⬜')).join('');
    const txt = `Sportime — Guess the Score\n${grid}  ${fmtTime(summary?.time_ms ? Math.floor(summary.time_ms / 1000) : elapsed)}\nTop ${Math.max(1, Math.round(summary?.percentile ?? 100))}%`;
    try { await navigator.clipboard.writeText(txt); addToast('Copied to clipboard', 'success'); } catch { addToast(txt, 'info'); }
  };

  if (loading) return <div className="fixed inset-0 bg-deep-navy z-40 flex items-center justify-center"><Loader2 className="animate-spin text-electric-blue" size={28} /></div>;

  const Header = () => (
    <div className="flex items-center justify-between sticky top-0 bg-deep-navy py-2 z-10">
      <button onClick={onBack} className="p-2 -ml-2 text-text-secondary"><ChevronLeft size={24} /></button>
      <div className="flex items-center gap-3 text-sm">
        {stats && <span className="flex items-center gap-1 text-hot-red font-bold"><Flame size={16} /> {stats.current_streak}</span>}
        {stats && <span className="flex items-center gap-1 text-electric-blue font-bold"><Snowflake size={14} /> {stats.freezes}</span>}
        {!summary && !ready && !config && data?.game && <span className="font-mono text-text-primary tabular-nums">{fmtTime(elapsed)}</span>}
      </div>
    </div>
  );
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="fixed inset-0 bg-deep-navy z-40 overflow-y-auto">
      <div className="max-w-md mx-auto px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]"><Header />{children}</div>
    </div>
  );

  // config: scope + difficulty (hint)
  if (config) {
    return <Shell>
      <h1 className="text-2xl font-extrabold text-text-primary mt-3 mb-1">Set up your puzzle</h1>
      <p className="text-text-secondary text-sm mb-4">Pick the teams and how much help you want.</p>
      <p className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-2">Matches</p>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {SCOPES.map(s => (
          <button key={s.key} onClick={() => setPickScope(s.key)}
            className={`text-left p-3 rounded-xl border-2 ${pickScope === s.key ? 'border-electric-blue' : 'border-disabled'} bg-navy-accent/40`}>
            <p className="font-bold text-text-primary text-sm">{s.emoji} {s.title}</p>
            <p className="text-[11px] text-text-secondary mt-0.5">{s.desc}</p>
          </button>
        ))}
      </div>
      <p className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-2">Difficulty (how much the hints help)</p>
      <div className="space-y-2.5">
        {HINTS.map(h => (
          <button key={h.key} onClick={() => setPickHint(h.key)}
            className={`w-full text-left p-3.5 rounded-xl border-2 ${pickHint === h.key ? 'border-electric-blue' : 'border-disabled'} bg-navy-accent/40`}>
            <p className="font-bold text-text-primary">{h.emoji} {h.title}</p>
            <p className="text-xs text-warm-yellow/80 mt-0.5">💡 {h.desc}</p>
          </button>
        ))}
      </div>
      <button onClick={confirmConfig} className="mt-6 w-full bg-lime-glow text-deep-navy font-extrabold py-3.5 rounded-xl">Start</button>
    </Shell>;
  }

  if (data && !data.game) {
    return <Shell><div className="text-center py-20">
      <div className="text-4xl mb-3">🗓️</div>
      <p className="text-text-primary font-bold">No puzzle today</p>
      <p className="text-text-secondary text-sm mt-1">Come back tomorrow at 8:00.</p>
      <button onClick={() => setConfig(true)} className="mt-5 text-electric-blue font-semibold text-sm">Change setup</button>
    </div></Shell>;
  }

  if (ready && data?.game) {
    const sc = SCOPES.find(s => s.key === data.scope)!; const hn = HINTS.find(h => h.key === data.hint)!;
    return <Shell><div className="flex flex-col items-center justify-center text-center py-14">
      <div className="text-5xl mb-4">⚽</div>
      <h1 className="text-3xl font-extrabold text-text-primary">Get ready</h1>
      <p className="text-text-secondary text-sm mt-1">5 matches · beat the clock</p>
      <button onClick={() => setConfig(true)} className="mt-6 inline-flex items-center gap-2 bg-navy-accent/50 border border-disabled rounded-full px-4 py-1.5">
        <span className="font-bold text-text-primary text-sm">{sc.emoji} {sc.title} · {hn.emoji} {hn.title}</span>
        <span className="text-electric-blue text-xs font-semibold">change</span>
      </button>
      <button onClick={startPlay} className="mt-8 w-full max-w-xs bg-lime-glow text-deep-navy font-extrabold py-3.5 rounded-xl text-lg">Play</button>
    </div></Shell>;
  }

  if (summary) {
    const pct = Math.max(1, Math.round(summary.percentile ?? 100));
    const bucket = pct <= 1 ? 'Top 1%' : pct <= 5 ? 'Top 5%' : pct <= 25 ? 'Top 25%' : pct <= 50 ? 'Top 50%' : 'Top 75%';
    const totalGuesses = (data?.rounds ?? []).reduce((s, r) => s + (r.attempt?.attempts ?? 0), 0);
    return <Shell><div className="text-center py-8">
      <Trophy size={44} className="text-warm-yellow mx-auto mb-3" />
      <h1 className="text-2xl font-extrabold text-text-primary">Done!</h1>
      <p className="text-text-secondary">{summary.rounds_solved}/{data?.rounds?.length} solved</p>
      {summary.freeze_gained && <div className="mt-3 inline-flex items-center gap-2 bg-electric-blue/15 text-electric-blue rounded-full px-4 py-1.5 text-sm font-bold"><Snowflake size={14} /> +1 Freeze earned!</div>}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Time</p><p className="text-lg font-bold text-text-primary">{fmtTime(Math.floor((summary.time_ms || 0) / 1000))}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Guesses</p><p className="text-lg font-bold text-text-primary">{totalGuesses}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Percentile</p><p className="text-lg font-bold text-lime-glow">{bucket}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Streak</p><p className="text-lg font-bold text-hot-red">🔥 {summary.streak}</p></div>
      </div>
      <p className="text-text-disabled text-xs mt-3">Avg time: {fmtTime(Math.floor((summary.avg_time_ms || 0) / 1000))}</p>
      <p className="text-text-secondary text-sm mt-4 font-medium">You solved today's game — see you tomorrow! 👋</p>
      <button onClick={share} className="mt-5 w-full bg-lime-glow text-deep-navy font-extrabold py-3 rounded-xl flex items-center justify-center gap-2"><Share2 size={18} /> Share result</button>
      <button onClick={() => setConfig(true)} className="mt-3 text-electric-blue font-semibold text-sm">Change setup</button>
      <button onClick={onBack} className="mt-4 w-full bg-navy-accent text-text-primary font-bold py-3 rounded-xl">Go to FunZone</button>
    </div></Shell>;
  }

  const round = data!.rounds![idx];
  const maxAtt = data!.config!.max_attempts;
  const att = round.attempt;
  const used = att?.attempts ?? 0;
  const done = att?.solved || (round.reveal != null);
  const hintsTotal = round.hints.length;

  return <Shell>
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-bold uppercase tracking-wide text-text-secondary">Round {idx + 1}/{data!.rounds!.length}</span>
      <span className="text-xs text-text-disabled">{maxAtt - used} tries left</span>
    </div>
    <div className="card-base p-4 text-center">
      <p className="text-[11px] text-text-secondary mb-3">{round.competition}{round.stage ? ` · ${round.stage}` : ''}{round.match_date ? ` · ${new Date(round.match_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : ''}</p>
      <div className="flex items-center justify-center gap-3">
        <div className="flex-1 flex flex-col items-center gap-1">
          {round.home_logo && <img src={round.home_logo} className="w-12 h-12 object-contain" />}
          <span className="text-sm font-bold text-text-primary text-center">{round.home_name}</span>
        </div>
        <span className="text-text-disabled font-bold">vs</span>
        <div className="flex-1 flex flex-col items-center gap-1">
          {round.away_logo && <img src={round.away_logo} className="w-12 h-12 object-contain" />}
          <span className="text-sm font-bold text-text-primary text-center">{round.away_name}</span>
        </div>
      </div>
    </div>

    {hintsTotal > 0 && (
      <div className="mt-3 space-y-1.5">
        {round.hints.slice(0, unlocked).map((h, i) => <div key={i} className="bg-navy-accent/40 rounded-lg px-3 py-2 text-sm text-text-secondary">💡 {h}</div>)}
        {!done && unlocked < hintsTotal && (
          <button onClick={() => { if (cooldownLeft === 0) { setUnlocked(u => u + 1); setCooldownUntil(Date.now() + HINT_COOLDOWN); } }}
            disabled={cooldownLeft > 0}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-disabled rounded-lg px-3 py-2 text-sm text-text-secondary disabled:opacity-50">
            {cooldownLeft > 0 ? <><Lock size={14} /> Next hint in {cooldownLeft}s</> : <><Lightbulb size={14} className="text-warm-yellow" /> Reveal a hint ({unlocked}/{hintsTotal})</>}
          </button>
        )}
      </div>
    )}

    {!done && (
      <div className="mt-5">
        <div className="flex items-center justify-center gap-6">
          {[['home', home, setHome], ['away', away, setAway]].map(([k, val, set]: any) => (
            <div key={k} className="flex flex-col items-center gap-2">
              <button onClick={() => set(Math.min(9, val + 1))} className="w-12 h-10 rounded-lg bg-navy-accent flex items-center justify-center text-text-primary active:scale-90"><Plus size={20} /></button>
              <span className="text-4xl font-extrabold text-text-primary tabular-nums w-12 text-center">{val}</span>
              <button onClick={() => set(Math.max(0, val - 1))} className="w-12 h-10 rounded-lg bg-navy-accent flex items-center justify-center text-text-primary active:scale-90"><Minus size={20} /></button>
            </div>
          ))}
        </div>
        <button onClick={submit} disabled={busy} className="mt-5 w-full bg-lime-glow text-deep-navy font-extrabold py-3.5 rounded-xl disabled:opacity-50">{busy ? '…' : 'Guess'}</button>
      </div>
    )}

    {att?.guesses?.length ? (
      <div className="mt-4 space-y-1.5">
        {[...att.guesses].reverse().map((g: any, i) => (
          <div key={i} className="flex items-center justify-between bg-navy-accent/30 rounded-lg px-3 py-2">
            <span className="font-bold text-text-primary tabular-nums">{g.h} - {g.a}</span>
            <FbBadge fb={g.fb} heat={g.heat} />
          </div>
        ))}
      </div>
    ) : null}

    {done && (
      <div className="mt-4 text-center">
        <p className="text-text-secondary text-sm">Actual score</p>
        <p className="text-3xl font-extrabold text-text-primary my-1">{round.reveal?.home} - {round.reveal?.away}</p>
        <button onClick={next} disabled={busy} className="mt-4 w-full bg-electric-blue text-white font-bold py-3 rounded-xl disabled:opacity-50">
          {busy ? '…' : idx >= data!.rounds!.length - 1 ? 'See results' : 'Next round'}
        </button>
      </div>
    )}
  </Shell>;
};

export default GuessScoreGame;
