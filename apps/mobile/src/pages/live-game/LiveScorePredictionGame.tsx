import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import { joinLiveGame, submitLivePrediction, editLivePrediction } from '../../services/liveGameService';
import { MatchHeaderRow } from '../../components/matches/MatchHeaderRow';
import { ChevronLeft, Minus, Plus, Trophy, Loader2, Pencil, AlertTriangle } from 'lucide-react';

interface Props {
  gameId: string;
  userId: string;
  onBack: () => void;
}

type Fmt = 'team' | 'yesno';
type DrawnQ = { key: string; points: number; label: string; format: Fmt };

// Pool + sub-pools per situation — must mirror the server (live_bonus_subpool).
const POOL: Record<string, { label: string; fmt: Fmt }> = {
  possession_most: { label: 'Most possession?', fmt: 'team' },
  both_carded:     { label: 'Both teams get a card?', fmt: 'yesno' },
  cards_4plus:     { label: '4 or more cards?', fmt: 'yesno' },
  cards_most:      { label: 'Most cards?', fmt: 'team' },
  red_card:        { label: 'A red card in the match?', fmt: 'yesno' },
  first_scorer:    { label: 'Which team scores first?', fmt: 'team' },
  first_goal_1h:   { label: 'First goal in the 1st half?', fmt: 'yesno' },
  corners_9plus:   { label: 'Over 9 total corners?', fmt: 'yesno' },
  corners_most:    { label: 'Most corners?', fmt: 'team' },
};
const SUBPOOL: Record<string, string[]> = {
  goalless:    ['possession_most','both_carded','cards_4plus','cards_most','red_card','corners_9plus','corners_most'],
  clean_sheet: ['possession_most','both_carded','cards_4plus','cards_most','red_card','first_goal_1h','corners_9plus','corners_most'],
  both_score:  ['first_scorer','first_goal_1h','possession_most','both_carded','cards_4plus','cards_most','red_card','corners_9plus','corners_most'],
};
const situationOf = (h: number, a: number) =>
  h === 0 && a === 0 ? 'goalless' : (h === 0 || a === 0 ? 'clean_sheet' : 'both_score');

const mkQ = (k: string, p: number): DrawnQ => ({ key: k, points: p, label: POOL[k].label, format: POOL[k].fmt });
function pickRandom(pool: string[], n: number, exclude: string[] = []): string[] {
  const avail = pool.filter(k => !exclude.includes(k));
  for (let i = avail.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [avail[i], avail[j]] = [avail[j], avail[i]];
  }
  return avail.slice(0, n);
}
// When goals are predicted, always favour the goal questions:
//  - both_score -> "who scores first" (20) + "first goal in 1st half" (10) + 1 random
//  - clean_sheet -> "first goal in 1st half" (20) + 2 random  (no "who scores first": forced)
//  - goalless   -> 3 random (no goal questions)
function draw3(sit: string): DrawnQ[] {
  if (sit === 'both_score') {
    const other = pickRandom(SUBPOOL.both_score, 1, ['first_scorer', 'first_goal_1h'])[0];
    return [mkQ('first_scorer', 20), mkQ('first_goal_1h', 10), mkQ(other, 10)];
  }
  if (sit === 'clean_sheet') {
    const o = pickRandom(SUBPOOL.clean_sheet, 2, ['first_goal_1h']);
    return [mkQ('first_goal_1h', 20), mkQ(o[0], 10), mkQ(o[1], 10)];
  }
  const k = pickRandom(SUBPOOL.goalless, 3);
  return [mkQ(k[0], 20), mkQ(k[1], 10), mkQ(k[2], 10)];
}

const FINISHED = ['FT', 'AET', 'PEN'];
const CANCELLED = ['CANC', 'ABD', 'WO', 'AWD', 'POST', 'PST'];

export const LiveScorePredictionGame: React.FC<Props> = ({ gameId, userId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [drawn, setDrawn] = useState<DrawnQ[]>([]);
  const [editing, setEditing] = useState(false);

  const myEntry = useMemo(() => entries.find(e => e.user_id === userId), [entries, userId]);

  const fetchAll = useCallback(async () => {
    if (!supabase) return { g: null, es: [] };
    const { data, error: e } = await supabase.rpc('get_live_game_state', { p_game_id: gameId });
    if (e) { setError(e.message); return { g: null, es: [] }; }
    const g = (data as any)?.game ?? null;
    const es = (data as any)?.entries ?? [];
    setGame(g);
    setEntries(es);
    return { g, es };
  }, [gameId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAll();
        const mine = res?.es.find((e: any) => e.user_id === userId);
        if (!mine && !cancelled) { await joinLiveGame(gameId); await fetchAll(); }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load game');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [gameId, userId, fetchAll]);

  // Seed steppers + answers from an existing submission.
  useEffect(() => {
    if (myEntry?.predicted_score) {
      setHome(myEntry.predicted_score.home ?? 0);
      setAway(myEntry.predicted_score.away ?? 0);
      setAnswers(myEntry.bonus_answers ?? {});
    }
  }, [myEntry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sit = useMemo(() => situationOf(home, away), [home, away]);

  // Reuse saved questions when the situation matches; otherwise draw fresh 3.
  useEffect(() => {
    const savedQs: DrawnQ[] | undefined = myEntry?.bonus_questions;
    const savedSit = myEntry?.predicted_score
      ? situationOf(myEntry.predicted_score.home, myEntry.predicted_score.away) : null;
    if (savedQs?.length && savedSit === sit) setDrawn(savedQs);
    else setDrawn(draw3(sit));
  }, [sit, myEntry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fx = game?.fixture;
  const phase: 'setup' | 'live' | 'results' = useMemo(() => {
    if (!fx) return 'setup';
    if (FINISHED.includes(fx.status) || CANCELLED.includes(fx.status) || game?.status === 'finished') return 'results';
    return fx.date && new Date(fx.date) <= new Date() ? 'live' : 'setup';
  }, [fx, game?.status]);

  useEffect(() => {
    if (phase !== 'live') return;
    const t = setInterval(fetchAll, 30000);
    return () => clearInterval(t);
  }, [phase, fetchAll]);

  const handleSubmit = async () => {
    if (drawn.some(q => !answers[q.key])) { setError('Answer all 3 bonus questions.'); return; }
    setBusy(true);
    setError(null);
    try {
      const questions = drawn.map(q => ({ key: q.key, points: q.points, label: q.label, format: q.format }));
      const finalAnswers: Record<string, string> = {};
      drawn.forEach(q => { finalAnswers[q.key] = answers[q.key]; });
      await submitLivePrediction(gameId, home, away, questions, finalAnswers);
      await fetchAll();
    } catch (e: any) {
      setError(e?.message === 'match_started' ? 'Kickoff passed — predictions are locked.' : (e?.message || 'Failed to submit'));
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async () => {
    setBusy(true);
    try {
      await editLivePrediction(gameId, home, away);
      setEditing(false);
      await fetchAll();
    } catch (e: any) {
      setError(e?.message || 'Failed to edit');
    } finally {
      setBusy(false);
    }
  };

  const center =
    fx && (new Date(fx.date) <= new Date() || FINISHED.includes(fx.status))
      ? `${fx.goals_home ?? 0} - ${fx.goals_away ?? 0}`
      : fx?.date ? new Date(fx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'VS';

  const teamMatch = fx ? { teamA: { name: fx.home?.name ?? 'Home', logo: fx.home?.logo }, teamB: { name: fx.away?.name ?? 'Away', logo: fx.away?.logo } } : null;
  const teamLabel = (val: string) => (val === 'home' ? (fx?.home?.name ?? 'Home') : (fx?.away?.name ?? 'Away'));

  if (loading) {
    return (
      <div className="fixed inset-0 bg-deep-navy flex items-center justify-center z-40">
        <Loader2 className="animate-spin text-electric-blue" size={32} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-deep-navy z-40 overflow-y-auto">
      <div className="max-w-md mx-auto px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] space-y-4">
        <div className="flex items-center gap-3 sticky top-0 bg-deep-navy py-2 z-10">
          <button onClick={onBack} className="p-2 -ml-2 text-text-secondary hover:text-text-primary"><ChevronLeft size={24} /></button>
          <h1 className="font-bold text-lg text-text-primary">Score Prediction</h1>
          {game?.mode === 'free' && <span className="ml-auto text-xs font-bold text-lime-glow bg-lime-glow/10 px-2 py-1 rounded-lg">FREE</span>}
        </div>

        {error && (
          <div className="bg-hot-red/10 border border-hot-red/30 text-hot-red text-sm p-3 rounded-xl flex items-center gap-2">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {teamMatch && (
          <div className="card-base p-4">
            <MatchHeaderRow match={teamMatch} center={center} centerClass="text-2xl" />
          </div>
        )}

        {/* SETUP */}
        {phase === 'setup' && (
          <div className="card-base p-4 space-y-5">
            <p className="text-sm font-bold text-text-primary text-center">Predict the final score</p>
            <div className="flex items-center justify-center gap-6">
              {[{ v: home, set: setHome, label: fx?.home?.name }, { v: away, set: setAway, label: fx?.away?.name }].map((s, i) => (
                <div key={i} className="text-center">
                  <p className="text-xs text-text-secondary mb-2 truncate max-w-[120px]">{s.label}</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => s.set(Math.max(0, s.v - 1))} className="w-9 h-9 rounded-full bg-navy-accent flex items-center justify-center text-text-primary"><Minus size={16} /></button>
                    <span className="text-3xl font-bold text-text-primary w-8">{s.v}</span>
                    <button onClick={() => s.set(s.v + 1)} className="w-9 h-9 rounded-full bg-navy-accent flex items-center justify-center text-text-primary"><Plus size={16} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wide">Bonus (40 pts)</p>
              {drawn.map(q => (
                <div key={q.key} className="space-y-1.5">
                  <p className="text-sm text-text-primary">{q.label} <span className="text-text-disabled">(+{q.points})</span></p>
                  <div className="flex gap-2">
                    {q.format === 'team'
                      ? ['home', 'away'].map(val => (
                          <button key={val} onClick={() => setAnswers(a => ({ ...a, [q.key]: val }))}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold truncate transition-colors ${answers[q.key] === val ? 'bg-electric-blue text-white' : 'bg-navy-accent text-text-secondary'}`}>
                            {teamLabel(val)}
                          </button>
                        ))
                      : ['yes', 'no'].map(opt => (
                          <button key={opt} onClick={() => setAnswers(a => ({ ...a, [q.key]: opt }))}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold capitalize transition-colors ${answers[q.key] === opt ? 'bg-electric-blue text-white' : 'bg-navy-accent text-text-secondary'}`}>
                            {opt}
                          </button>
                        ))}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={handleSubmit} disabled={busy} className="w-full py-3 primary-button disabled:opacity-50">
              {busy ? '...' : myEntry?.predicted_score ? 'Update prediction' : 'Submit prediction'}
            </button>
            {myEntry?.predicted_score && <p className="text-center text-xs text-lime-glow">✓ Prediction saved</p>}
          </div>
        )}

        {/* LIVE */}
        {phase === 'live' && (
          <div className="card-base p-4 space-y-4">
            {myEntry?.predicted_score ? (
              <>
                <div className="text-center">
                  <p className="text-xs text-text-secondary">Your prediction</p>
                  <p className="text-2xl font-bold text-text-primary">{myEntry.predicted_score.home} - {myEntry.predicted_score.away}</p>
                  {myEntry.midtime_edit && <p className="text-xs text-warm-yellow mt-1">Edited — −40% on result + écart</p>}
                </div>
                {!editing ? (
                  <button onClick={() => setEditing(true)} className="w-full py-2.5 bg-warm-yellow/15 text-warm-yellow rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                    <Pencil size={15} /> Edit score (−40% malus)
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-hot-red text-center bg-hot-red/10 p-2 rounded-lg">Editing applies a −40% malus to your result + écart points.</p>
                    <div className="flex items-center justify-center gap-6">
                      {[{ v: home, set: setHome }, { v: away, set: setAway }].map((s, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <button onClick={() => s.set(Math.max(0, s.v - 1))} className="w-9 h-9 rounded-full bg-navy-accent flex items-center justify-center text-text-primary"><Minus size={16} /></button>
                          <span className="text-2xl font-bold text-text-primary w-7 text-center">{s.v}</span>
                          <button onClick={() => s.set(s.v + 1)} className="w-9 h-9 rounded-full bg-navy-accent flex items-center justify-center text-text-primary"><Plus size={16} /></button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(false)} className="flex-1 py-2.5 bg-navy-accent text-text-secondary rounded-xl font-bold text-sm">Cancel</button>
                      <button onClick={handleEdit} disabled={busy} className="flex-1 py-2.5 primary-button text-sm disabled:opacity-50">Confirm edit</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-sm text-text-secondary">You didn't predict before kickoff — predictions are locked.</p>
            )}
          </div>
        )}

        <Leaderboard entries={entries} phase={phase} userId={userId} />
      </div>
    </div>
  );
};

const Leaderboard: React.FC<{ entries: any[]; phase: string; userId: string }> = ({ entries, phase, userId }) => {
  const sorted = [...entries].sort((a, b) =>
    (b.total_points ?? 0) - (a.total_points ?? 0) || (a.goal_diff_error ?? 99) - (b.goal_diff_error ?? 99));
  return (
    <div className="card-base p-4">
      <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2"><Trophy size={16} className="text-warm-yellow" /> Leaderboard</h3>
      {sorted.length === 0 ? (
        <p className="text-text-secondary text-sm text-center py-2">No players yet.</p>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((p, i) => {
            const me = p.user_id === userId;
            const name = me ? 'You' : (p.username || `Player ${String(p.user_id).slice(0, 4)}`);
            return (
              <div key={p.id} className={`flex items-center gap-3 p-2 rounded-lg ${me ? 'bg-electric-blue/10' : 'bg-deep-navy'}`}>
                <span className="w-5 text-center font-bold text-text-secondary text-sm">{i + 1}</span>
                <span className="flex-1 font-semibold text-text-primary text-sm truncate">{name}</span>
                {phase !== 'results' && p.predicted_score && (
                  <span className="text-xs text-text-disabled">{p.predicted_score.home}-{p.predicted_score.away}</span>
                )}
                <span className="font-bold text-warm-yellow text-sm">{p.total_points ?? 0} pts</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LiveScorePredictionGame;
