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

type BonusQ = { key: string; points: number; prompt: string };

// Same rule as the server (submit_live_prediction): questions depend on the pick.
function buildBonusQuestions(home: number, away: number): BonusQ[] {
  if (home !== away) {
    return [
      { key: 'clean_sheet_winner', points: 20, prompt: 'Clean sheet for your pick?' },
      { key: 'btts', points: 10, prompt: 'Both teams to score?' },
      { key: 'over25', points: 10, prompt: 'Over 2.5 goals?' },
    ];
  }
  return [
    { key: 'btts', points: 20, prompt: 'Both teams to score?' },
    { key: 'over25', points: 10, prompt: 'Over 2.5 goals?' },
    { key: 'nil_nil', points: 10, prompt: 'Will it be 0-0?' },
  ];
}

const FINISHED = ['FT', 'AET', 'PEN'];
const CANCELLED = ['CANC', 'ABD', 'WO', 'AWD', 'POST', 'PST'];

export const LiveScorePredictionGame: React.FC<Props> = ({ gameId, userId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  // Local setup state
  const [home, setHome] = useState(1);
  const [away, setAway] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

  const myEntry = useMemo(() => entries.find(e => e.user_id === userId), [entries, userId]);

  const fetchAll = useCallback(async () => {
    if (!supabase) return;
    const { data: g } = await supabase
      .from('live_games')
      .select(`id, mode, entry_cost, status,
        fixture:fb_fixtures(id, date, status, goals_home, goals_away,
          home:fb_teams!fb_fixtures_home_team_id_fkey(name, logo),
          away:fb_teams!fb_fixtures_away_team_id_fkey(name, logo))`)
      .eq('id', gameId)
      .single();
    setGame(g);

    const { data: es } = await supabase
      .from('live_game_entries')
      .select(`id, user_id, predicted_score, bonus_questions, bonus_answers, midtime_edit,
        total_points, goal_diff_error, rank, submitted_at, profile:profiles(username, display_name)`)
      .eq('live_game_id', gameId)
      .order('total_points', { ascending: false });
    setEntries(es ?? []);
    return { g, es: es ?? [] };
  }, [gameId]);

  // Ensure the user has an entry, then load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAll();
        const mine = res?.es.find((e: any) => e.user_id === userId);
        if (!mine && !cancelled) {
          await joinLiveGame(gameId);
          await fetchAll();
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load game');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [gameId, userId, fetchAll]);

  // Seed setup steppers from an existing prediction.
  useEffect(() => {
    if (myEntry?.predicted_score) {
      setHome(myEntry.predicted_score.home ?? 1);
      setAway(myEntry.predicted_score.away ?? 0);
      setAnswers(myEntry.bonus_answers ?? {});
    }
  }, [myEntry?.predicted_score]);

  const fx = game?.fixture;
  const phase: 'setup' | 'live' | 'results' = useMemo(() => {
    if (!fx) return 'setup';
    if (FINISHED.includes(fx.status) || CANCELLED.includes(fx.status) || game?.status === 'finished') return 'results';
    const started = fx.date && new Date(fx.date) <= new Date();
    return started ? 'live' : 'setup';
  }, [fx, game?.status]);

  // Poll while the match is live.
  useEffect(() => {
    if (phase !== 'live') return;
    const t = setInterval(fetchAll, 30000);
    return () => clearInterval(t);
  }, [phase, fetchAll]);

  const bonusQuestions = useMemo(() => buildBonusQuestions(home, away), [home, away]);

  const handleSubmit = async () => {
    setBusy(true);
    try {
      // default unanswered questions to "no"
      const finalAnswers: Record<string, string> = {};
      bonusQuestions.forEach(q => { finalAnswers[q.key] = answers[q.key] === 'yes' ? 'yes' : 'no'; });
      await submitLivePrediction(gameId, home, away, finalAnswers);
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
        {/* Header */}
        <div className="flex items-center gap-3 sticky top-0 bg-deep-navy py-2 z-10">
          <button onClick={onBack} className="p-2 -ml-2 text-text-secondary hover:text-text-primary">
            <ChevronLeft size={24} />
          </button>
          <h1 className="font-bold text-lg text-text-primary">Score Prediction</h1>
          {game?.mode === 'free' && <span className="ml-auto text-xs font-bold text-lime-glow bg-lime-glow/10 px-2 py-1 rounded-lg">FREE</span>}
        </div>

        {error && (
          <div className="bg-hot-red/10 border border-hot-red/30 text-hot-red text-sm p-3 rounded-xl flex items-center gap-2">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* Match */}
        {teamMatch && (
          <div className="card-base p-4">
            <MatchHeaderRow match={teamMatch} center={center} centerClass="text-2xl" />
          </div>
        )}

        {/* SETUP — predict the score + bonus before kickoff */}
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
              {bonusQuestions.map(q => (
                <div key={q.key} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-text-primary flex-1">{q.prompt} <span className="text-text-disabled">(+{q.points})</span></span>
                  <div className="flex gap-1">
                    {['yes', 'no'].map(opt => (
                      <button key={opt} onClick={() => setAnswers(a => ({ ...a, [q.key]: opt }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${answers[q.key] === opt ? 'bg-electric-blue text-white' : 'bg-navy-accent text-text-secondary'}`}>
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

        {/* LIVE — show prediction + allow halftime edit */}
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
                    <Pencil size={15} /> Edit prediction (−40% malus)
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-hot-red text-center bg-hot-red/10 p-2 rounded-lg">Editing now applies a −40% malus to your result + écart points.</p>
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

        {/* Leaderboard (always visible) */}
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
            const name = me ? 'You' : (p.profile?.display_name || p.profile?.username || `Player ${String(p.user_id).slice(0, 4)}`);
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
