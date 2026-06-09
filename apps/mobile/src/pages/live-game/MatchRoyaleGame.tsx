import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Loader2, Heart, Trophy, Users } from 'lucide-react';
import {
  getMRGame, getMyParticipant, joinMR, listMRQuestions, getMyMRAnswers, answerMR,
  getMRQuestionStats, getMRGameCounts, MRQuestion,
} from '../../services/matchRoyaleService';

interface Props { gameId: string; userId: string; onBack: () => void; addToast: (m: string, t: 'success' | 'error' | 'info') => void; }

export const MatchRoyaleGame: React.FC<Props> = ({ gameId, userId, onBack, addToast }) => {
  const [game, setGame] = useState<any>(null);
  const [part, setPart] = useState<any>(null);
  const [qs, setQs] = useState<MRQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<Record<string, Record<string, number>>>({});
  const [counts, setCounts] = useState({ total: 0, alive: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [g, p, q, a, c] = await Promise.all([
      getMRGame(gameId), getMyParticipant(gameId, userId), listMRQuestions(gameId), getMyMRAnswers(gameId, userId), getMRGameCounts(gameId),
    ]);
    setGame(g); setPart(p); setQs(q); setAnswers(a); setCounts(c);
    // community % for locked/resolved questions
    const locked = q.filter(x => x.status !== 'open' || !((x.phase === 'pre_match' && g?.status === 'open') || (x.phase === 'half_time' && g?.status === 'half_time')));
    const entries = await Promise.all(locked.map(async x => [x.id, await getMRQuestionStats(x.id)] as const));
    setStats(Object.fromEntries(entries));
    setLoading(false);
  }, [gameId, userId]);

  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const join = async () => {
    const r = await joinMR(gameId);
    if (!(r as any)?.ok) return addToast((r as any)?.error === 'insufficient_coins' ? 'Not enough coins' : ((r as any)?.error || 'Could not join'), 'error');
    addToast('Joined! Make your predictions 🎯', 'success'); load();
  };
  const pick = async (q: MRQuestion, key: string) => {
    setAnswers(a => ({ ...a, [q.id]: key })); // optimistic
    const r = await answerMR(q.id, key);
    if (!(r as any)?.ok) { addToast((r as any)?.error === 'locked' ? 'Answers are locked' : 'Failed', 'error'); load(); }
  };

  if (loading || !game) return <div className="fixed inset-0 bg-deep-navy z-40 flex items-center justify-center"><Loader2 className="animate-spin text-electric-blue" size={28} /></div>;

  const fx = game.fixture;
  const joined = !!part;
  const eliminated = part?.status === 'eliminated';
  const answerable = (q: MRQuestion) => joined && !eliminated &&
    ((q.phase === 'pre_match' && game.status === 'open') || (q.phase === 'half_time' && game.status === 'half_time'));
  const phaseQuestions = (phase: string) => qs.filter(q => q.phase === phase);
  const homeName = fx?.home?.name ?? 'Home', awayName = fx?.away?.name ?? 'Away';

  const Hearts = () => (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: game.hearts }).map((_, i) => (
        <Heart key={i} size={18} className={i < (part?.lives ?? 0) ? 'text-hot-red fill-hot-red' : 'text-white/20'} />
      ))}
    </div>
  );

  const QuestionCard = ({ q }: { q: MRQuestion }) => {
    const can = answerable(q);
    const mine = answers[q.id];
    const s = stats[q.id] || {};
    const tot = Object.values(s).reduce((a, b) => a + b, 0) || 0;
    const resolved = q.status === 'resolved';
    return (
      <div className={`card-base p-4 ${q.is_tie_break ? 'border-warm-yellow/40' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-text-primary text-sm">{q.prompt}</p>
          {q.is_tie_break && <span className="text-[10px] font-bold bg-warm-yellow/20 text-warm-yellow px-2 py-0.5 rounded-full">TIE‑BREAK</span>}
          {q.status === 'void' && <span className="text-[10px] text-text-disabled">voided</span>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {q.options.map(o => {
            const picked = mine === o.key;
            const isCorrect = resolved && q.correct_key === o.key;
            const pct = tot ? Math.round((s[o.key] ?? 0) / tot * 100) : 0;
            return (
              <button key={o.key} disabled={!can} onClick={() => pick(q, o.key)}
                className={`relative overflow-hidden rounded-xl p-3 text-sm font-bold border-2 transition-all ${
                  isCorrect ? 'border-lime-glow text-lime-glow' :
                  resolved && picked ? 'border-hot-red text-hot-red' :
                  picked ? 'border-electric-blue text-electric-blue' : 'border-disabled text-text-primary'} ${can ? 'active:scale-95' : ''}`}>
                {!can && tot > 0 && <div className="absolute inset-0 bg-electric-blue/10" style={{ width: `${pct}%` }} />}
                <span className="relative">{o.label}{!can && tot > 0 && <span className="block text-xs font-semibold opacity-70">{pct}%</span>}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-deep-navy z-40 overflow-y-auto">
      <div className="max-w-md mx-auto px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
        {/* header */}
        <div className="flex items-center gap-2 sticky top-0 bg-deep-navy py-2 z-10">
          <button onClick={onBack} className="p-2 -ml-2 text-text-secondary"><ChevronLeft size={24} /></button>
          <h1 className="font-bold text-text-primary flex items-center gap-1.5"><Trophy size={18} className="text-warm-yellow" /> Match Royale</h1>
        </div>

        <div className="card-base p-4 mb-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm font-bold text-text-primary">
            <span className="flex-1 text-right truncate">{homeName}</span>
            <span className="text-base">{(fx?.goals_home != null) ? `${fx.goals_home} - ${fx.goals_away}` : 'vs'}</span>
            <span className="flex-1 text-left truncate">{awayName}</span>
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-text-secondary">
            <span className="flex items-center gap-1"><Trophy size={14} className="text-warm-yellow" /> {game.pot_amount ?? '—'} coins</span>
            <span className="flex items-center gap-1"><Users size={14} /> {counts.alive}/{counts.total} alive</span>
            {joined && <Hearts />}
          </div>
        </div>

        {!joined && game.status === 'open' && (
          <button onClick={join} className="w-full bg-lime-glow text-deep-navy font-extrabold py-3.5 rounded-xl mb-4">
            Join Match Royale {game.pot_amount ? `· ${game.pot_amount} coins pot` : ''}
          </button>
        )}
        {!joined && game.status !== 'open' && (
          <div className="card-base p-4 text-center text-text-secondary text-sm mb-4">Entries are closed — the match has started.</div>
        )}
        {eliminated && <div className="bg-hot-red/15 border border-hot-red/30 text-hot-red rounded-xl p-3 text-center font-bold mb-4">💀 Eliminated</div>}
        {game.status === 'finished' && part?.is_winner && <div className="bg-lime-glow/15 border border-lime-glow/30 text-lime-glow rounded-xl p-3 text-center font-bold mb-4">🏆 You won {part.prize_amount} coins!</div>}
        {game.status === 'finished' && joined && !part?.is_winner && <div className="card-base p-3 text-center text-text-secondary mb-4">Match over — better luck next time!</div>}

        {/* pre-match phase */}
        {phaseQuestions('pre_match').length > 0 && (
          <div className="space-y-3 mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-text-secondary">
              First half {game.status === 'open' ? '· answer before kickoff' : '· locked'}
            </h2>
            {phaseQuestions('pre_match').map(q => <QuestionCard key={q.id} q={q} />)}
          </div>
        )}
        {/* half-time phase */}
        {phaseQuestions('half_time').length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-text-secondary">
              Second half {game.status === 'half_time' ? '· answer now' : '· locked'}
            </h2>
            {phaseQuestions('half_time').map(q => <QuestionCard key={q.id} q={q} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchRoyaleGame;
