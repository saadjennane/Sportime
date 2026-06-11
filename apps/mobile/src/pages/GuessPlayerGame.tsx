import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Loader2, Flame, Snowflake, Share2, Trophy, Lightbulb, Search, X } from 'lucide-react';
import {
  getPlayerToday, setPuzzlePrefs, puzzleStart, finishPlayer, getPuzzleStats,
  PuzzleHint, PuzzleScope, PlayerToday, PlayerRound,
} from '../services/puzzleService';

// reveal the first n characters of a name; mask the rest (keep spaces/punctuation)
const maskName = (name: string, n: number) => name.split('').map((ch, i) => i < n ? ch : (/[\s.\-']/.test(ch) ? ch : '_')).join('');

// Local persistence of "today's game played" (survives if the background finish never reached the server).
const doneKey = (gameId: string) => `sportime_gp_done_${gameId}`;
const readDone = (gameId: string) => { try { const r = localStorage.getItem(doneKey(gameId)); return r ? JSON.parse(r) : null; } catch { return null; } };
const saveDone = (gameId: string, date: string, summary: any, rounds: any) => {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {   // drop previous days' entries
      const k = localStorage.key(i);
      if (k?.startsWith('sportime_gp_done_')) { try { if (JSON.parse(localStorage.getItem(k)!).date !== date) localStorage.removeItem(k); } catch { /* ignore */ } }
    }
    localStorage.setItem(doneKey(gameId), JSON.stringify({ date, summary, rounds }));
  } catch { /* quota */ }
};
import { getPlayerIndex, searchPlayers, IndexedPlayer } from '../services/playerIndexService';

interface Props { userId: string; onBack: () => void; addToast: (m: string, t: 'success' | 'error' | 'info') => void; }

const HINTS: { key: PuzzleHint; title: string; desc: string; emoji: string }[] = [
  { key: 'easy', title: 'Easy', desc: 'Full career trail shown', emoji: '🟢' },
  { key: 'medium', title: 'Medium', desc: 'Shorter trail (5 clubs)', emoji: '🟡' },
  { key: 'hard', title: 'Hard', desc: 'Only the last 3 clubs', emoji: '🔴' },
];
const SCOPES: { key: PuzzleScope; title: string; desc: string; emoji: string }[] = [
  { key: 'big', title: 'Only Big Clubs', desc: 'Played La Liga + a top European club', emoji: '⭐' },
  { key: 'all', title: 'All players', desc: 'Anyone who played in La Liga', emoji: '🌍' },
];
const HINT_COOLDOWN = 5000;
const clubLogo = (id: number) => `https://media.api-sports.io/football/teams/${id}.png`;

export const GuessPlayerGame: React.FC<Props> = ({ onBack, addToast }) => {
  const [data, setData] = useState<PlayerToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(false);
  const [pickScope, setPickScope] = useState<PuzzleScope>('big');
  const [pickHint, setPickHint] = useState<PuzzleHint>('easy');
  const [ready, setReady] = useState(false);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [review, setReview] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [unlocked, setUnlocked] = useState(0);
  const [letters, setLetters] = useState(0);
  const [masked, setMasked] = useState('');
  const [nameLen, setNameLen] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [index, setIndex] = useState<IndexedPlayer[]>([]);
  const [query, setQuery] = useState('');
  const startRef = useRef<number | null>(null);
  const dataRef = useRef<PlayerToday | null>(null); dataRef.current = data;   // always-fresh data for callbacks

  const firstUnsolved = (rounds?: PlayerRound[]) => {
    if (!rounds) return 0;
    const i = rounds.findIndex(r => !(r.attempt?.solved) && !(r.reveal));
    return i === -1 ? rounds.length - 1 : i;
  };
  const load = useCallback(async (scope?: PuzzleScope) => {
    setLoading(true);
    const d = await getPlayerToday(scope);     // only this blocks the screen
    const local = d.game ? readDone(d.game.id) : null;   // played-today, persisted locally
    setData(local?.rounds ? { ...d, rounds: local.rounds } : d);   // restore guesses for the review
    setPickScope(d.scope); setPickHint(d.hint);
    getPuzzleStats(d.scope, 'guess_player').then(setStats);   // background
    if (!d.has_prefs) { setConfig(true); setLoading(false); return; }
    if (!d.game) { setLoading(false); return; }
    if (d.play?.finished_at || local) {                 // already played today -> results, no restart
      setSummary(local?.summary ?? await finishPlayer(d.game.id, d.play!.rounds_solved ?? 0, 0));
      if (!d.play?.finished_at && local) finishPlayer(d.game.id, local.summary.rounds_solved, local.summary.time_ms ?? 0).catch(() => {});   // re-sync server
      setLoading(false); return;
    }
    setIdx(firstUnsolved(d.rounds));
    startRef.current = d.play?.started_at ? new Date(d.play.started_at).getTime() : Date.now();
    setReady(!(d.rounds ?? []).some(r => r.attempt?.guesses?.length));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { getPlayerIndex().then(setIndex).catch(() => {}); }, []);   // autocomplete index, non-blocking
  useEffect(() => { if (summary && data?.game) saveDone(data.game.id, data.date, summary, data.rounds); }, [summary]);   // persist "played today"
  useEffect(() => {
    if (summary || ready || config || !data?.game) return;
    const t = setInterval(() => { setNow(Date.now()); if (startRef.current) setElapsed(Math.floor((Date.now() - startRef.current) / 1000)); }, 500);
    return () => clearInterval(t);
  }, [summary, ready, config, data]);
  useEffect(() => { setUnlocked(0); setCooldownUntil(0); setQuery(''); setLetters(0); setMasked(''); setNameLen(0); }, [idx]);

  const revealLetter = () => {   // fully local
    if (!data?.game) return;
    const name = data.rounds![idx].answer?.name || '';
    const n = letters + 1;
    setNameLen(name.length); setMasked(maskName(name, n)); setLetters(n);
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const startPlay = async () => {
    if (!data?.game) return;
    const r = await puzzleStart(data.game.id);
    if (r?.started_at) startRef.current = new Date(r.started_at).getTime();
    setElapsed(0); setReady(false);
  };
  const confirmConfig = async () => { setConfig(false); setSummary(null); await setPuzzlePrefs(pickScope, pickHint, 'guess_player'); load(pickScope); };

  const solvedCount = () => (data?.rounds ?? []).filter(r => r.attempt?.solved).length;
  // Optimistic: show Results instantly from local data; submit in the background
  // (streak/percentile fill in when the network responds — never blocks the user).
  const doFinish = (finalSolved: number) => {
    if (!data?.game || summary) return;
    const timeMs = startRef.current ? Date.now() - startRef.current : elapsed * 1000;
    const score = Math.max(0, finalSolved) * 1000 - Math.min(900, Math.floor(Math.max(0, timeMs) / 1000));
    // percentile + streak computed locally from data preloaded at start -> instant, no network wait
    const dist = data.dist ?? [];
    const percentile = dist.length > 0 ? Math.round((1000 * dist.filter(s => s > score).length) / dist.length) / 10 : 0;
    const prog = data.progress;
    const playedToday = prog?.last_played === data.date;
    const streak = playedToday ? (prog?.streak ?? 1) : ((prog?.streak ?? 0) + 1);
    const localSummary = { ok: true, rounds_solved: finalSolved, time_ms: timeMs, score, percentile, streak };
    setSummary(localSummary);
    saveDone(data.game.id, data.date, localSummary, (dataRef.current ?? data).rounds);   // persist "played today" now (synchronous)
    finishPlayer(data.game.id, finalSolved, timeMs)   // reconcile authoritatively in the background (retries)
      .then(s => { if (s?.ok) { setSummary(s); getPuzzleStats(data.scope, 'guess_player').then(setStats); } })
      .catch(() => { /* offline — local values stand */ });
  };

  const pick = (player: IndexedPlayer) => {   // 100% local validation
    if (!data?.game) return;
    setQuery('');
    const round = data.rounds![idx];
    if (round.attempt?.solved || round.reveal) return;
    const used = (round.attempt?.attempts ?? 0) + 1;
    const solved = player.id === round.answer.id;
    const maxAtt = data.config!.max_attempts;
    const exhausted = maxAtt > 0 && used >= maxAtt;
    setData(prev => {
      if (!prev) return prev;
      const rounds = prev.rounds!.map(x => x.round_no === round.round_no ? {
        ...x,
        attempt: { guesses: [...(x.attempt?.guesses ?? []), { pid: player.id, name: player.name, correct: solved }], solved, attempts: used },
        reveal: (solved || exhausted) ? x.answer : x.reveal,
      } : x);
      return { ...prev, rounds };
    });
    if (solved) addToast('🎯 Correct!', 'success');
    const isLast = idx >= (data.rounds!.length - 1);
    if (isLast && (solved || exhausted)) {   // last round done -> auto-advance to Results
      const final = data.rounds!.filter(r => r.round_no !== round.round_no && r.attempt?.solved).length + (solved ? 1 : 0);
      setTimeout(() => doFinish(final), 900);   // brief beat to show the reveal
    }
  };
  const giveUp = () => {   // local reveal
    if (!data?.game) return;
    setQuery('');
    const round = data.rounds![idx];
    setData(prev => prev ? { ...prev, rounds: prev.rounds!.map(x => x.round_no === round.round_no ? { ...x, reveal: x.answer } : x) } : prev);
    const isLast = idx >= (data.rounds!.length - 1);
    if (isLast) setTimeout(() => doFinish(data.rounds!.filter(r => r.round_no !== round.round_no && r.attempt?.solved).length), 900);
  };
  const next = () => {
    if (!data?.game) return;
    if (idx < data.rounds!.length - 1) { setIdx(idx + 1); return; }
    doFinish(solvedCount());
  };
  const shareReview = async () => {
    if (!data?.rounds) return;
    const lines = data.rounds.map(r => `${r.attempt?.solved ? '🎯' : '❌'} ${r.reveal?.name ?? '?'} · ${r.attempt?.attempts ?? 0}🎲`).join('\n');
    const txt = `Sportime — Guess the Player\n${lines}\n⏱️ ${fmtTime(Math.floor((summary?.time_ms || 0) / 1000))} · Top ${Math.max(1, Math.round(summary?.percentile ?? 100))}%`;
    try { await navigator.clipboard.writeText(txt); addToast('Copied to clipboard', 'success'); } catch { addToast(txt, 'info'); }
  };

  if (loading) return <div className="fixed inset-0 bg-deep-navy z-40 flex items-center justify-center"><Loader2 className="animate-spin text-electric-blue" size={28} /></div>;

  const wrap = (content: React.ReactNode) => (
    <div className="fixed inset-0 bg-deep-navy z-40 overflow-y-auto">
      <div className="max-w-md mx-auto px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between sticky top-0 bg-deep-navy py-2 z-10">
          <button onClick={onBack} className="p-2 -ml-2 text-text-secondary"><ChevronLeft size={24} /></button>
          <div className="flex items-center gap-3 text-sm">
            {stats && <span className="flex items-center gap-1 text-hot-red font-bold"><Flame size={16} /> {stats.current_streak}</span>}
            {stats && <span className="flex items-center gap-1 text-electric-blue font-bold"><Snowflake size={14} /> {stats.freezes}</span>}
            {!summary && !ready && !config && data?.game && <span className="font-mono text-text-primary tabular-nums">{fmtTime(elapsed)}</span>}
          </div>
        </div>
        {content}
      </div>
    </div>
  );

  if (config) {
    return wrap(<>
      <h1 className="text-2xl font-extrabold text-text-primary mt-3 mb-1">Guess the Player</h1>
      <p className="text-text-secondary text-sm mb-4">Pick the player pool and how much of the trail you see.</p>
      <p className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-2">Players</p>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {SCOPES.map(s => (
          <button key={s.key} onClick={() => setPickScope(s.key)} className={`text-left p-3 rounded-xl border-2 ${pickScope === s.key ? 'border-electric-blue' : 'border-disabled'} bg-navy-accent/40`}>
            <p className="font-bold text-text-primary text-sm">{s.emoji} {s.title}</p>
            <p className="text-[11px] text-text-secondary mt-0.5">{s.desc}</p>
          </button>
        ))}
      </div>
      <p className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-2">Difficulty (trail length)</p>
      <div className="space-y-2.5">
        {HINTS.map(h => (
          <button key={h.key} onClick={() => setPickHint(h.key)} className={`w-full text-left p-3.5 rounded-xl border-2 ${pickHint === h.key ? 'border-electric-blue' : 'border-disabled'} bg-navy-accent/40`}>
            <p className="font-bold text-text-primary">{h.emoji} {h.title}</p>
            <p className="text-xs text-warm-yellow/80 mt-0.5">🧭 {h.desc}</p>
          </button>
        ))}
      </div>
      <button onClick={confirmConfig} className="mt-6 w-full bg-lime-glow text-deep-navy font-extrabold py-3.5 rounded-xl">Start</button>
    </>);
  }

  if (data && !data.game) {
    return wrap(<div className="text-center py-20">
      <div className="text-4xl mb-3">🗓️</div>
      <p className="text-text-primary font-bold">No puzzle today</p>
      <p className="text-text-secondary text-sm mt-1">Come back tomorrow at 8:00.</p>
      <button onClick={() => setConfig(true)} className="mt-5 text-electric-blue font-semibold text-sm">Change setup</button>
    </div>);
  }

  if (ready && data?.game) {
    const sc = SCOPES.find(s => s.key === data.scope)!; const hn = HINTS.find(h => h.key === data.hint)!;
    return wrap(<div className="flex flex-col items-center justify-center text-center py-14">
      <div className="text-5xl mb-4">🕵️</div>
      <h1 className="text-3xl font-extrabold text-text-primary">Get ready</h1>
      <p className="text-text-secondary text-sm mt-1">5 players · beat the clock</p>
      <button onClick={() => setConfig(true)} className="mt-6 inline-flex items-center gap-2 bg-navy-accent/50 border border-disabled rounded-full px-4 py-1.5">
        <span className="font-bold text-text-primary text-sm">{sc.emoji} {sc.title} · {hn.emoji} {hn.title}</span>
        <span className="text-electric-blue text-xs font-semibold">change</span>
      </button>
      <button onClick={startPlay} className="mt-8 w-full max-w-xs bg-lime-glow text-deep-navy font-extrabold py-3.5 rounded-xl text-lg">Play</button>
    </div>);
  }

  if (review && data?.rounds) {
    return wrap(<>
      <div className="flex items-center justify-between mt-1 mb-3">
        <button onClick={() => setReview(false)} className="text-electric-blue text-sm font-semibold">← Results</button>
        <button onClick={shareReview} className="flex items-center gap-1.5 text-electric-blue text-sm font-semibold"><Share2 size={16} /> Share</button>
      </div>
      <h1 className="text-xl font-extrabold text-text-primary mb-3">Today's players</h1>
      <div className="space-y-2">
        {data.rounds.map(r => (
          <div key={r.round_no} className="flex items-center justify-between card-base p-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex-shrink-0">{r.attempt?.solved ? '🎯' : '❌'}</span>
              {r.reveal?.photo && <img src={r.reveal.photo} className="w-7 h-7 rounded-full object-cover" />}
              <span className="text-sm text-text-primary truncate font-bold">{r.reveal?.name ?? '?'}</span>
            </div>
            <span className="text-xs text-text-secondary flex-shrink-0 ml-2">{r.attempt?.attempts ?? 0} {(r.attempt?.attempts ?? 0) > 1 ? 'guesses' : 'guess'}</span>
          </div>
        ))}
      </div>
    </>);
  }

  if (summary) {
    const hasPct = summary.percentile != null;
    const pct = hasPct ? Math.max(1, Math.round(summary.percentile)) : 0;
    const bucket = !hasPct ? '…' : pct <= 1 ? 'Top 1%' : pct <= 5 ? 'Top 5%' : pct <= 25 ? 'Top 25%' : pct <= 50 ? 'Top 50%' : 'Top 75%';
    const totalGuesses = (data?.rounds ?? []).reduce((s, r) => s + (r.attempt?.attempts ?? 0), 0);
    return wrap(<div className="text-center py-8">
      <Trophy size={44} className="text-warm-yellow mx-auto mb-3" />
      <h1 className="text-2xl font-extrabold text-text-primary">Done!</h1>
      <p className="text-text-secondary">{summary.rounds_solved}/{data?.rounds?.length} solved</p>
      {summary.freeze_gained && <div className="mt-3 inline-flex items-center gap-2 bg-electric-blue/15 text-electric-blue rounded-full px-4 py-1.5 text-sm font-bold"><Snowflake size={14} /> +1 Freeze earned!</div>}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Time</p><p className="text-lg font-bold text-text-primary">{fmtTime(Math.floor((summary.time_ms || 0) / 1000))}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Guesses</p><p className="text-lg font-bold text-text-primary">{totalGuesses}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Percentile</p><p className="text-lg font-bold text-lime-glow">{bucket}</p></div>
        <div className="card-base p-3"><p className="text-xs text-text-secondary">Streak</p><p className="text-lg font-bold text-hot-red">🔥 {summary.streak ?? '…'}</p></div>
      </div>
      <p className="text-text-secondary text-sm mt-4 font-medium">You solved today's game — see you tomorrow! 👋</p>
      <button onClick={() => setReview(true)} className="mt-5 w-full border border-electric-blue/40 text-electric-blue font-bold py-2.5 rounded-xl">See players</button>
      <button onClick={shareReview} className="mt-3 w-full bg-lime-glow text-deep-navy font-extrabold py-3 rounded-xl flex items-center justify-center gap-2"><Share2 size={18} /> Share result</button>
      <button onClick={() => setConfig(true)} className="mt-3 text-electric-blue font-semibold text-sm">Change setup</button>
      <button onClick={onBack} className="mt-4 w-full bg-navy-accent text-text-primary font-bold py-3 rounded-xl">Go to FunZone</button>
    </div>);
  }

  // active round
  const round = data!.rounds![idx];
  const maxAtt = data!.config!.max_attempts;
  const att = round.attempt;
  const used = att?.attempts ?? 0;
  const done = att?.solved || (round.reveal != null);
  const hintsTotal = round.hints.length;
  const results = query.length >= 2 ? searchPlayers(index, query) : [];

  return wrap(<>
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-bold uppercase tracking-wide text-text-secondary">Round {idx + 1}/{data!.rounds!.length}</span>
      {maxAtt > 0 ? (
        <div className="flex items-center gap-1.5">
          {Array.from({ length: maxAtt }).map((_, i) => <span key={i} className={`w-2 h-2 rounded-full ${i < used ? 'bg-hot-red' : 'bg-white/20'}`} />)}
          <span className="text-xs text-text-disabled ml-1">{maxAtt - used} left</span>
        </div>
      ) : <span className="text-xs text-text-disabled">∞ · {used} {used === 1 ? 'guess' : 'guesses'}</span>}
    </div>

    {/* answer slot (top): ? / revealed letters / final answer */}
    <div className="card-base p-4 flex flex-col items-center">
      {done && round.reveal ? (<>
        {round.reveal.photo && <img src={round.reveal.photo} className="w-16 h-16 rounded-full object-cover mb-1" />}
        <p className="text-xl font-extrabold text-text-primary text-center">{round.reveal.name}</p>
      </>) : letters > 0 ? (<>
        <p className="text-2xl font-extrabold text-text-primary font-mono tracking-[0.15em] text-center break-all">{masked}</p>
        <p className="text-[11px] text-text-disabled mt-1">{letters}/{nameLen} letters</p>
      </>) : (<>
        <div className="w-16 h-16 rounded-full bg-electric-blue/15 flex items-center justify-center text-3xl text-electric-blue mb-1">?</div>
        <p className="text-sm font-bold text-electric-blue">Who is this player?</p>
      </>)}
    </div>

    {/* guess input — ABOVE the trail */}
    {!done && (
      <div className="mt-3 relative">
        <div className="flex items-center gap-2 bg-navy-accent rounded-xl px-3 py-2.5">
          <Search size={18} className="text-text-disabled" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Type a player name…" autoFocus
            className="flex-1 bg-transparent outline-none text-text-primary placeholder:text-text-disabled" />
          {query && <button onClick={() => setQuery('')}><X size={16} className="text-text-disabled" /></button>}
        </div>
        {results.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-navy-accent rounded-xl overflow-hidden divide-y divide-white/5 max-h-72 overflow-y-auto shadow-xl">
            {results.map(p => (
              // onPointerDown + preventDefault: select on the FIRST tap, before the input
              // blurs (otherwise the first tap just dismisses the keyboard and is lost).
              <button key={p.id} onPointerDown={(e) => { e.preventDefault(); if (!busy) pick(p); }} disabled={busy}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-white/5">
                {p.photo ? <img src={p.photo} className="w-8 h-8 rounded-full object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />}
                <span className="text-sm font-semibold text-text-primary truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}
        {query.length >= 2 && results.length === 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-navy-accent rounded-xl px-3 py-2.5 text-sm text-text-disabled shadow-xl">
            {index.length === 0 ? 'Loading players…' : 'No match'}
          </div>
        )}
      </div>
    )}

    {/* trail */}
    <div className="card-base p-4 mt-3">
      <p className="text-[11px] text-text-secondary text-center mb-2">Transfer trail{round.trail_total > round.trail.length ? ` · last ${round.trail.length} clubs` : ''}</p>
      <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2">
        {round.trail.map((c, i) => (
          <React.Fragment key={i}>
            <div className="flex items-center gap-1 bg-navy-accent/40 rounded-full px-2.5 py-1">
              {c.id ? <img src={clubLogo(c.id)} className="w-5 h-5 object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} /> : null}
              <span className="text-xs font-semibold text-text-primary">{c.name}</span>
            </div>
            {i < round.trail.length - 1 && <span className="text-text-disabled text-xs">→</span>}
          </React.Fragment>
        ))}
      </div>
    </div>

    {/* revealed hints */}
    {unlocked > 0 && (
      <div className="mt-3 space-y-1.5">
        {round.hints.slice(0, unlocked).map((h, i) => <div key={i} className="bg-navy-accent/40 rounded-lg px-3 py-2 text-sm text-text-secondary">💡 <b className="text-text-primary">{h.k}:</b> {h.v}</div>)}
      </div>
    )}

    {/* reveal hints (5s cooldown) */}
    {!done && unlocked < hintsTotal && (
      <button onClick={() => { if (cooldownLeft === 0) { setUnlocked(u => u + 1); setCooldownUntil(Date.now() + HINT_COOLDOWN); } }} disabled={cooldownLeft > 0}
        className="relative overflow-hidden w-full mt-2 flex items-center justify-center gap-2 border border-dashed border-disabled rounded-lg px-3 py-2 text-sm text-text-secondary disabled:opacity-80">
        {cooldownLeft > 0 && <span key={cooldownUntil} className="absolute inset-y-0 left-0 bg-warm-yellow/20" style={{ animation: `hintFill ${HINT_COOLDOWN}ms linear forwards` }} />}
        <span className="relative flex items-center gap-2"><Lightbulb size={14} className="text-warm-yellow" /> Reveal a hint ({unlocked}/{hintsTotal})</span>
      </button>
    )}
    {/* then reveal the name letter by letter (instant, one per tap) */}
    {!done && unlocked >= hintsTotal && (nameLen === 0 || letters < nameLen) && (
      <button onClick={revealLetter} disabled={revealing}
        className="w-full mt-2 flex items-center justify-center gap-2 border border-dashed border-disabled rounded-lg px-3 py-2 text-sm text-text-secondary disabled:opacity-60 active:bg-white/5">
        <Lightbulb size={14} className="text-warm-yellow" /> Reveal a letter{nameLen > 0 ? ` (${letters}/${nameLen})` : ''}
      </button>
    )}
    <style>{`@keyframes hintFill{from{width:0%}to{width:100%}}`}</style>

    {!done && (
      <button onClick={giveUp} disabled={busy} className="mt-3 w-full text-text-disabled text-sm font-semibold py-2 active:opacity-60">I give up — reveal answer</button>
    )}

    {/* guesses (latest on top) */}
    {att?.guesses?.length ? (
      <div className="mt-4 space-y-1.5">
        {[...att.guesses].reverse().map((g: any, i) => (
          <div key={i} className="flex items-center justify-between bg-navy-accent/30 rounded-lg px-3 py-2">
            <span className="font-bold text-text-primary">{g.name}</span>
            <span className={g.correct ? 'text-lime-glow' : 'text-hot-red'}>{g.correct ? '🎯 Correct' : '❌'}</span>
          </div>
        ))}
      </div>
    ) : null}

    {done && (
      <button onClick={next} disabled={busy} className="mt-4 w-full bg-electric-blue text-white font-bold py-3 rounded-xl disabled:opacity-50">
        {busy ? '…' : idx >= data!.rounds!.length - 1 ? 'See results' : 'Next round'}
      </button>
    )}
  </>);
};

export default GuessPlayerGame;
