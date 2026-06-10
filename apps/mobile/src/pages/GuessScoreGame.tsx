import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Loader2, Minus, Plus, Flame, Snowflake, Share2, Trophy } from 'lucide-react';
import {
  getPuzzleToday, setPuzzleLevel, puzzleGuess, puzzleFinish, getPuzzleStats,
  PuzzleLevel, PuzzleToday, PuzzleRound,
} from '../services/puzzleService';

interface Props { userId: string; onBack: () => void; addToast: (m: string, t: 'success' | 'error' | 'info') => void; }

const HEAT: Record<string, { label: string; cls: string; emoji: string }> = {
  exact: { label: 'Exact!', cls: 'text-lime-glow', emoji: '🎯' },
  burning: { label: 'Burning', cls: 'text-hot-red', emoji: '🔥' },
  hot: { label: 'Hot', cls: 'text-orange-400', emoji: '♨️' },
  warm: { label: 'Warm', cls: 'text-amber-300', emoji: '🌤️' },
  cold: { label: 'Cold', cls: 'text-electric-blue', emoji: '❄️' },
};
const LEVELS: { key: PuzzleLevel; title: string; desc: string; emoji: string }[] = [
  { key: 'easy', title: 'Easy', desc: 'Casual fans who follow the big teams', emoji: '🟢' },
  { key: 'medium', title: 'Medium', desc: 'Fans who watch more than a game a week', emoji: '🟡' },
  { key: 'hard', title: 'Hard', desc: 'Experts who know it all', emoji: '🔴' },
];

export const GuessScoreGame: React.FC<Props> = ({ userId, onBack, addToast }) => {
  const [data, setData] = useState<PuzzleToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(false);
  const [idx, setIdx] = useState(0);
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  const firstUnsolved = (rounds?: PuzzleRound[]) => {
    if (!rounds) return 0;
    const i = rounds.findIndex(r => !(r.attempt?.solved) && !(r.reveal));
    return i === -1 ? rounds.length - 1 : i;
  };

  const load = useCallback(async (level?: PuzzleLevel) => {
    setLoading(true);
    const d = await getPuzzleToday(level);
    setData(d);
    setStats(await getPuzzleStats(d.level));
    if (!d.game) { setLoading(false); return; }
    if (d.play?.finished_at) { setSummary(await puzzleFinish(d.game.id)); }
    else {
      setIdx(firstUnsolved(d.rounds));
      startRef.current = d.play?.started_at ? new Date(d.play.started_at).getTime() : Date.now();
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (summary || !data?.game || data?.play?.finished_at) return;
    const t = setInterval(() => { if (startRef.current) setElapsed(Math.floor((Date.now() - startRef.current) / 1000)); }, 1000);
    return () => clearInterval(t);
  }, [summary, data]);

  const chooseLevel = async (lvl: PuzzleLevel) => { setPicker(false); await setPuzzleLevel(lvl); load(lvl); };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const submit = async () => {
    if (!data?.game || busy) return;
    setBusy(true);
    const round = data.rounds![idx];
    const r = await puzzleGuess(data.game.id, round.round_no, home, away);
    setBusy(false);
    if (!r?.ok) return addToast(r?.error === 'no_attempts_left' ? 'No attempts left' : 'Failed', 'error');
    // update local round attempt
    setData(prev => {
      if (!prev) return prev;
      const rounds = prev.rounds!.map(x => x.round_no === round.round_no ? {
        ...x,
        attempt: { guesses: [...(x.attempt?.guesses ?? []), { h: home, a: away, heat: r.heat }], solved: r.solved, attempts: r.attempts_used },
        reveal: r.reveal ?? x.reveal,
      } : x);
      return { ...prev, rounds };
    });
    if (r.solved) addToast('🎯 Exact!', 'success');
    setHome(0); setAway(0);
  };

  const next = async () => {
    const last = idx >= (data!.rounds!.length - 1);
    if (last) {
      const s = await puzzleFinish(data!.game!.id);
      setSummary(s);
    } else { setIdx(idx + 1); setHome(0); setAway(0); }
  };

  const share = async () => {
    if (!data?.rounds) return;
    const grid = data.rounds.map(r => {
      const g = r.attempt?.guesses ?? [];
      const last = g[g.length - 1];
      return r.attempt?.solved ? '🎯' : last ? (HEAT[last.heat]?.emoji ?? '❌') : '⬜';
    }).join('');
    const txt = `Sportime — Guess the Score (${data.level})\n${grid}  ${fmtTime(summary?.time_ms ? Math.floor(summary.time_ms / 1000) : elapsed)}\nTop ${Math.max(1, Math.round(summary?.percentile ?? 100))}%`;
    try { await navigator.clipboard.writeText(txt); addToast('Copied to clipboard', 'success'); } catch { addToast(txt, 'info'); }
  };

  if (loading) return <div className="fixed inset-0 bg-deep-navy z-40 flex items-center justify-center"><Loader2 className="animate-spin text-electric-blue" size={28} /></div>;

  const Header = () => (
    <div className="flex items-center justify-between sticky top-0 bg-deep-navy py-2 z-10">
      <button onClick={onBack} className="p-2 -ml-2 text-text-secondary"><ChevronLeft size={24} /></button>
      <div className="flex items-center gap-3 text-sm">
        {stats && <span className="flex items-center gap-1 text-hot-red font-bold"><Flame size={16} /> {stats.current_streak}</span>}
        {stats && <span className="flex items-center gap-1 text-electric-blue font-bold"><Snowflake size={14} /> {stats.freezes}</span>}
        {!summary && data?.game && <span className="font-mono text-text-primary tabular-nums">{fmtTime(elapsed)}</span>}
      </div>
    </div>
  );

  // level picker
  if (picker || (data && !stats?.games_played && !data.game)) {
    return (
      <div className="fixed inset-0 bg-deep-navy z-40 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 pt-[max(0.5rem,env(safe-area-inset-top))]"><Header />
          <h1 className="text-2xl font-extrabold text-text-primary mt-4 mb-1">Guess the Score</h1>
          <p className="text-text-secondary text-sm mb-5">Choose your level — change it anytime.</p>
          <div className="space-y-3">
            {LEVELS.map(l => (
              <button key={l.key} onClick={() => chooseLevel(l.key)}
                className={`w-full text-left p-4 rounded-xl border-2 ${data?.level === l.key ? 'border-electric-blue' : 'border-disabled'} bg-navy-accent/40`}>
                <p className="font-bold text-text-primary">{l.emoji} {l.title}</p>
                <p className="text-xs text-text-secondary mt-0.5">{l.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // no puzzle today
  if (data && !data.game) {
    return (
      <div className="fixed inset-0 bg-deep-navy z-40 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 pt-[max(0.5rem,env(safe-area-inset-top))]"><Header />
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🗓️</div>
            <p className="text-text-primary font-bold">No puzzle today ({data.level})</p>
            <p className="text-text-secondary text-sm mt-1">Come back tomorrow at 8:00.</p>
            <button onClick={() => setPicker(true)} className="mt-5 text-electric-blue font-semibold text-sm">Change level</button>
          </div>
        </div>
      </div>
    );
  }

  // end screen
  if (summary) {
    const pct = Math.max(1, Math.round(summary.percentile || 100));
    const bucket = pct <= 1 ? 'Top 1%' : pct <= 5 ? 'Top 5%' : pct <= 25 ? 'Top 25%' : pct <= 50 ? 'Top 50%' : 'Top 75%';
    return (
      <div className="fixed inset-0 bg-deep-navy z-40 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 pt-[max(0.5rem,env(safe-area-inset-top))]"><Header />
          <div className="text-center py-8">
            <Trophy size={44} className="text-warm-yellow mx-auto mb-3" />
            <h1 className="text-2xl font-extrabold text-text-primary">Done!</h1>
            <p className="text-text-secondary">{summary.rounds_solved}/{data?.rounds?.length} solved</p>
            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="card-base p-3"><p className="text-xs text-text-secondary">Time</p><p className="text-lg font-bold text-text-primary">{fmtTime(Math.floor((summary.time_ms || 0) / 1000))}</p></div>
              <div className="card-base p-3"><p className="text-xs text-text-secondary">Percentile</p><p className="text-lg font-bold text-lime-glow">{bucket}</p></div>
              <div className="card-base p-3"><p className="text-xs text-text-secondary">Streak</p><p className="text-lg font-bold text-hot-red">🔥 {summary.streak}</p></div>
            </div>
            <p className="text-text-disabled text-xs mt-3">Avg time: {fmtTime(Math.floor((summary.avg_time_ms || 0) / 1000))} · {summary.total_players} players</p>
            <button onClick={share} className="mt-6 w-full bg-lime-glow text-deep-navy font-extrabold py-3 rounded-xl flex items-center justify-center gap-2"><Share2 size={18} /> Share result</button>
            <button onClick={() => setPicker(true)} className="mt-3 text-electric-blue font-semibold text-sm">Change level</button>
          </div>
        </div>
      </div>
    );
  }

  // active round
  const round = data!.rounds![idx];
  const maxAtt = data!.config!.max_attempts;
  const att = round.attempt;
  const used = att?.attempts ?? 0;
  const done = att?.solved || (round.reveal != null);
  const visibleHints = round.hints.slice(0, Math.min(used, round.hints.length));

  return (
    <div className="fixed inset-0 bg-deep-navy z-40 overflow-y-auto">
      <div className="max-w-md mx-auto px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]"><Header />
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wide text-text-secondary">Round {idx + 1}/{data!.rounds!.length}</span>
          <span className="text-xs text-text-disabled">{maxAtt - used} tries left</span>
        </div>

        {/* match meta */}
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

        {/* hints */}
        {visibleHints.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {visibleHints.map((h, i) => <div key={i} className="bg-navy-accent/40 rounded-lg px-3 py-2 text-sm text-text-secondary">💡 {h}</div>)}
          </div>
        )}

        {/* guess history */}
        {att?.guesses?.length ? (
          <div className="mt-3 space-y-1.5">
            {att.guesses.map((g, i) => (
              <div key={i} className="flex items-center justify-between bg-navy-accent/30 rounded-lg px-3 py-2">
                <span className="font-bold text-text-primary tabular-nums">{g.h} - {g.a}</span>
                <span className={`text-sm font-bold ${HEAT[g.heat]?.cls}`}>{HEAT[g.heat]?.emoji} {HEAT[g.heat]?.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* reveal / steppers */}
        {done ? (
          <div className="mt-4 text-center">
            <p className="text-text-secondary text-sm">Actual score</p>
            <p className="text-3xl font-extrabold text-text-primary my-1">{round.reveal?.home} - {round.reveal?.away}</p>
            <button onClick={next} className="mt-4 w-full bg-electric-blue text-white font-bold py-3 rounded-xl">
              {idx >= data!.rounds!.length - 1 ? 'See results' : 'Next round'}
            </button>
          </div>
        ) : (
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
            <button onClick={submit} disabled={busy} className="mt-6 w-full bg-lime-glow text-deep-navy font-extrabold py-3.5 rounded-xl disabled:opacity-50">
              {busy ? '…' : 'Guess'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuessScoreGame;
