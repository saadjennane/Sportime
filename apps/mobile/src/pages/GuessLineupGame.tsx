import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Flame, Snowflake, Trophy, Share2 } from 'lucide-react';
import { getLineupToday, finishPlayer, getPuzzleStats, LineupToday, LineupRoundPayload } from '../services/puzzleService';
import { GuessLineupPitch, PitchCell } from '../components/GuessLineupPitch';
import { WordleHole, wordleFeedback, fbEmoji } from '../components/WordleHole';

// normalized surname target for the Wordle (last word, A-Z, no accents)
const toWord = (name: string) => {
  const s = (name || '').replace(/^[A-Za-z]\.\s*/, '').trim().split(/\s+/).pop() || '';
  return s.toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Z]/g, '');
};
const SHIRT_KEY = 'sportime_gl_shirt';
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

type HoleState = { rows: string[]; solved: boolean; gaveUp: boolean };

interface Props { userId: string; onBack: () => void; addToast: (m: string, t: 'success' | 'error' | 'info') => void }

const GuessLineupGame: React.FC<Props> = ({ onBack, addToast }) => {
  const [data, setData] = useState<LineupToday | null>(null);
  const dataRef = useRef<LineupToday | null>(null); dataRef.current = data;
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [review, setReview] = useState(false);
  const [prog, setProg] = useState<Record<number, HoleState>>({});
  const progRef = useRef(prog); progRef.current = prog;
  const [pickScope, setPickScope] = useState<'big' | 'all'>('big');
  const [pickHoles, setPickHoles] = useState(3);
  const [showShirt, setShowShirt] = useState<boolean>(() => { try { return localStorage.getItem(SHIRT_KEY) === '1'; } catch { return false; } });
  const [elapsed, setElapsed] = useState(0);
  const [, setNow] = useState(0);
  const startRef = useRef<number | null>(null);

  const pl: LineupRoundPayload | undefined = data?.rounds?.[0]?.payload;
  const toggleShirt = () => setShowShirt(v => { const n = !v; try { localStorage.setItem(SHIRT_KEY, n ? '1' : '0'); } catch { /**/ } return n; });

  const load = useCallback(async (scope?: 'big' | 'all', holes?: number) => {
    setLoading(true);
    try {
      const d = await getLineupToday(scope, holes);
      const local = d.game ? readDone(d.game.id) : null;
      setData(d); setPickScope(d.scope ?? 'big'); setPickHoles(d.holes ?? 3);
      getPuzzleStats(undefined as any, 'guess_lineup').then(setStats).catch(() => {});
      if (!d.has_prefs) { setConfig(true); return; }
      if (!d.game) return;
      if (d.play?.finished_at || local) {
        setSummary(local?.summary ?? { ok: true, rounds_solved: d.play?.rounds_solved ?? 0, pending: true });
        if (local?.prog) setProg(local.prog);
        if (!d.play?.finished_at && local) finishPlayer(d.game.id, local.summary.rounds_solved, local.summary.time_ms ?? 0).catch(() => {});
        return;
      }
      startRef.current = Date.now(); setReady(true);
    } catch { addToast('Could not load — tap to retry', 'error'); setConfig(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (summary && data?.game) saveDone(data.game.id, data.date, summary, prog); }, [summary]);
  useEffect(() => {
    if (summary || ready || config || !data?.game) return;
    const t = setInterval(() => { setNow(Date.now()); if (startRef.current) setElapsed(Math.floor((Date.now() - startRef.current) / 1000)); }, 500);
    return () => clearInterval(t);
  }, [summary, ready, config, data]);

  const startPlay = () => { startRef.current = Date.now(); setElapsed(0); setReady(false); };
  const confirmConfig = async () => { setConfig(false); setSummary(null); setProg({}); setSel(null); await load(pickScope, pickHoles); };

  const holes = pl?.holes ?? [];
  const cleanCount = () => holes.reduce((n, _, i) => n + (progRef.current[i]?.solved && !progRef.current[i]?.gaveUp ? 1 : 0), 0);
  const allDone = () => holes.length > 0 && holes.every((_, i) => progRef.current[i]?.solved);

  const doFinish = () => {
    if (!data?.game || summary) return;
    const finalSolved = cleanCount();
    const timeMs = startRef.current ? Date.now() - startRef.current : elapsed * 1000;
    const score = Math.max(0, finalSolved) * 1000 - Math.min(900, Math.floor(Math.max(0, timeMs) / 1000));
    const dist = data.dist ?? [];
    const percentile = dist.length > 0 ? Math.round((1000 * dist.filter(s => s > score).length) / dist.length) / 10 : 0;
    const p = data.progress; const playedToday = p?.last_played === data.date;
    const streak = playedToday ? (p?.streak ?? 1) : ((p?.streak ?? 0) + 1);
    const localSummary = { ok: true, rounds_solved: finalSolved, time_ms: timeMs, score, percentile, streak };
    setSummary(localSummary);
    saveDone(data.game.id, data.date, localSummary, progRef.current);
    finishPlayer(data.game.id, finalSolved, timeMs).then(s => { if (s?.ok) { setSummary(s); getPuzzleStats(undefined as any, 'guess_lineup').then(setStats); } }).catch(() => {});
  };

  const onSubmit = (holeIdx: number, guess: string) => {
    const target = toWord(holes[holeIdx].answer.name);
    const correct = guess === target;
    setProg(prev => {
      const cur = prev[holeIdx] ?? { rows: [], solved: false, gaveUp: false };
      return { ...prev, [holeIdx]: { rows: [...cur.rows, guess], solved: correct || cur.solved, gaveUp: cur.gaveUp } };
    });
    if (correct) { addToast('🎯 Correct!', 'success'); setSel(null); setTimeout(() => { if (allDone()) doFinish(); }, 250); }
  };
  const onGiveUp = (holeIdx: number) => {
    setProg(prev => ({ ...prev, [holeIdx]: { rows: prev[holeIdx]?.rows ?? [], solved: true, gaveUp: true } }));
    setSel(null); setTimeout(() => { if (allDone()) doFinish(); }, 250);
  };

  const totalGuesses = () => holes.reduce((n, _, i) => n + (prog[i]?.rows?.length ?? 0), 0);
  const shareReview = async () => {
    if (!pl) return;
    const lines = holes.map((h, i) => { const st = prog[i]; if (!st) return '⬜';
      if (st.gaveUp) return `❌ ${toWord(h.answer.name)}`;
      const last = st.rows[st.rows.length - 1]; return `${fbEmoji(wordleFeedback(last, toWord(h.answer.name)))} (${st.rows.length})`;
    }).join('\n');
    const secs = Math.floor((summary?.time_ms || 0) / 1000);
    const txt = `Missing XI — ${pl.team.name} ${pl.score.team}-${pl.score.opp} ${pl.opponent.name} (${pl.competition})\n${lines}\n${cleanCount()} players found in ${secs}sec and ${totalGuesses()} guesses`;
    try { await navigator.clipboard.writeText(txt); addToast('Copied!', 'success'); } catch { /**/ }
  };

  // ---- pitch cells ----
  const cells: PitchCell[] = pl ? [
    ...pl.starters.map(s => ({ grid: s.grid, kind: 'player' as const, name: s.name, number: s.number, pos: s.pos, photo: s.photo, goal: s.goal, assist: s.assist })),
    ...holes.map((h, i) => {
      const st = prog[i];
      return { grid: h.grid, kind: 'hole' as const, holeIdx: i, selected: sel === i, status: st?.solved ? 'solved' as const : 'open' as const, number: h.answer.number, pos: h.answer.position, goal: h.answer.goal, assist: h.answer.assist, label: st?.solved ? toWord(h.answer.name) : undefined };
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
      <h1 className="text-2xl font-extrabold text-text-primary text-center mb-1">Missing XI</h1>
      <p className="text-text-secondary text-center text-sm mb-6">Rebuild the lineup — each player is a mini Wordle.</p>
      <p className="text-xs font-bold text-text-secondary mb-2">TEAMS</p>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {(['big', 'all'] as const).map(s => (
          <button key={s} onClick={() => setPickScope(s)} className={`p-3 rounded-xl border text-sm font-bold ${pickScope === s ? 'border-electric-blue bg-electric-blue/10 text-text-primary' : 'border-white/10 text-text-secondary'}`}>
            {s === 'big' ? 'Only big clubs' : 'All teams'}</button>
        ))}
      </div>
      <p className="text-xs font-bold text-text-secondary mb-2">DIFFICULTY · players to find</p>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[3, 6, 11].map(h => (
          <button key={h} onClick={() => setPickHoles(h)} className={`p-3 rounded-xl border text-sm font-bold ${pickHoles === h ? 'border-electric-blue bg-electric-blue/10 text-text-primary' : 'border-white/10 text-text-secondary'}`}>
            {h === 3 ? 'Easy · 3' : h === 6 ? 'Medium · 6' : 'Hard · 11'}</button>
        ))}
      </div>
      <button onClick={toggleShirt} className="w-full flex items-center justify-between p-3 rounded-xl border border-white/10 mb-8">
        <span className="text-sm font-bold text-text-primary">Show shirt numbers</span>
        <span className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${showShirt ? 'bg-electric-blue justify-end' : 'bg-navy-accent justify-start'}`}><span className="w-5 h-5 rounded-full bg-white" /></span>
      </button>
      <button onClick={confirmConfig} className="w-full bg-electric-blue text-white font-bold py-3 rounded-xl">Start</button>
    </div>
  );

  if (review && pl) {
    const reviewCells: PitchCell[] = [
      ...pl.starters.map(s => ({ grid: s.grid, kind: 'player' as const, name: s.name, number: s.number, pos: s.pos, photo: s.photo, goal: s.goal, assist: s.assist })),
      ...holes.map(h => ({ grid: h.grid, kind: 'player' as const, name: h.answer.name, number: h.answer.number, pos: h.answer.position, photo: h.answer.photo, goal: h.answer.goal, assist: h.answer.assist })),
    ];
    return Shell(<>
      <button onClick={() => setReview(false)} className="text-electric-blue text-sm font-semibold mb-2">← Results</button>
      <div className="card-base p-3 mb-3 flex items-center justify-center gap-3">
        <div className="flex items-center gap-1.5">
          <img src={teamLogo(pl.team.id)} className="w-7 h-7 object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
          <span className="text-xs font-bold text-text-primary max-w-[80px] truncate">{pl.team.name}</span>
        </div>
        <div className="text-center">
          <div className="text-lg font-extrabold text-text-primary tabular-nums">{pl.score.team} – {pl.score.opp}</div>
          <div className="text-[10px] text-text-secondary">{pl.competition} · {pl.date}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-text-secondary max-w-[80px] truncate">{pl.opponent.name}</span>
          <img src={teamLogo(pl.opponent.id)} className="w-7 h-7 object-contain opacity-70" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
        </div>
      </div>
      <GuessLineupPitch cells={reviewCells} showShirt={showShirt} onSelectHole={() => {}} />
      <p className="text-center text-text-secondary text-xs mt-3">⚽ scored · 👟 assisted</p>
    </>);
  }

  if (summary) {
    const hasPct = summary.percentile != null;
    const bucket = !hasPct ? '…' : summary.percentile <= 1 ? 'Top 1%' : summary.percentile <= 5 ? 'Top 5%' : summary.percentile <= 25 ? 'Top 25%' : summary.percentile <= 50 ? 'Top 50%' : 'Top 75%';
    return Shell(<div className="text-center py-8">
      <Trophy size={44} className="text-warm-yellow mx-auto mb-3" />
      <h1 className="text-2xl font-extrabold text-text-primary">Done!</h1>
      <p className="text-text-secondary">{summary.rounds_solved}/{holes.length} found</p>
      {summary.freeze_gained && <div className="mt-3 inline-flex items-center gap-2 bg-electric-blue/15 text-electric-blue rounded-full px-4 py-1.5 text-sm font-bold"><Snowflake size={14} /> +1 Freeze earned!</div>}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Time</p><p className="text-lg font-bold text-text-primary">{fmtTime(Math.floor((summary.time_ms || 0) / 1000))}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Percentile</p><p className="text-lg font-bold text-lime-glow">{bucket}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Streak</p><p className="text-lg font-bold text-hot-red">🔥 {summary.streak ?? '…'}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Guesses</p><p className="text-lg font-bold text-text-primary">{totalGuesses()}</p></div>
      </div>
      <button onClick={() => setReview(true)} className="mt-5 w-full border border-electric-blue/40 text-electric-blue font-bold py-2.5 rounded-xl">See lineup</button>
      <button onClick={shareReview} className="mt-3 w-full bg-lime-glow text-deep-navy font-extrabold py-3 rounded-xl flex items-center justify-center gap-2"><Share2 size={18} /> Share result</button>
      <button onClick={() => setConfig(true)} className="mt-3 text-electric-blue font-semibold text-sm">Change setup</button>
      <button onClick={onBack} className="mt-4 w-full bg-navy-accent text-text-primary font-bold py-3 rounded-xl">Go to FunZone</button>
    </div>);
  }

  if (!data?.game) return Shell(
    <div className="text-center py-20">
      <p className="text-text-secondary mb-4">No lineup puzzle for this setup today.</p>
      <button onClick={() => setConfig(true)} className="text-electric-blue font-bold">Change setup</button>
    </div>
  );

  if (ready) return Shell(
    <div className="text-center py-12">
      <div className="text-5xl mb-4">🧩</div>
      <h1 className="text-2xl font-extrabold text-text-primary mb-1">Missing XI</h1>
      <p className="text-text-secondary mb-5">{data.holes} player{(data.holes ?? 1) > 1 ? 's' : ''} to find · each is a mini Wordle · timed</p>
      <div className="inline-flex items-center gap-2 bg-navy-accent rounded-full px-4 py-1.5 text-sm font-bold text-text-primary mb-6">
        {data.scope === 'big' ? '🏆 Only big clubs' : '🌍 All teams'} · {data.holes} players{showShirt ? ' · #' : ''}
      </div>
      <button onClick={startPlay} className="w-full bg-electric-blue text-white font-extrabold py-3.5 rounded-xl">Play</button>
      <button onClick={() => setConfig(true)} className="mt-3 text-electric-blue font-semibold text-sm">Change setup</button>
    </div>
  );

  const found = holes.filter((_, i) => prog[i]?.solved).length;
  const done = allDone();

  return Shell(<>
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-bold text-text-primary">Missing XI</span>
      <button onClick={toggleShirt} className={`text-xs font-bold px-2.5 py-1 rounded-full ${showShirt ? 'bg-electric-blue/20 text-electric-blue' : 'bg-navy-accent text-text-secondary'}`}>Shirt #{showShirt ? ' ✓' : ''}</button>
      <span className="text-xs text-text-secondary">{found}/{holes.length} found</span>
    </div>

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

    {/* Wordle panel — ABOVE the pitch */}
    {sel != null && !prog[sel]?.solved && (
      <div className="card-base p-3 mb-3">
        <p className="text-[11px] text-text-secondary text-center mb-2">{pl!.formation} · {holes[sel].answer.position} {showShirt && holes[sel].answer.number != null ? `· #${holes[sel].answer.number}` : ''}</p>
        <WordleHole target={toWord(holes[sel].answer.name)} rows={prog[sel]?.rows ?? []} solved={false}
          onSubmit={(g) => onSubmit(sel, g)} onGiveUp={() => onGiveUp(sel)} />
      </div>
    )}

    {sel == null && !done && <p className="text-center text-text-secondary text-sm mb-2">Tap a <span className="text-warm-yellow font-bold">?</span> on the pitch to solve it</p>}

    <GuessLineupPitch cells={cells} showShirt={showShirt} onSelectHole={(i) => setSel(prev => prev === i ? null : i)} />

    {done && (
      <button onClick={doFinish} className="mt-4 w-full bg-electric-blue text-white font-bold py-3 rounded-xl">See results</button>
    )}
  </>);
};

export default GuessLineupGame;
