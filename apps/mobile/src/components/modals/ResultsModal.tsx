import React, { useEffect, useState } from 'react';
import { X, ChevronRight, ChevronLeft, Crosshair, Trophy, Star, Loader2, Crown } from 'lucide-react';
import { getResultsIndex, getResults, GameType, ResultsIndexEntry, GameResults } from '../../services/resultsService';

interface ResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fixtureId: string | null;
  matchName: string | null;
}

const GAME_META: Record<GameType, { label: string; icon: React.ReactNode; ring: string; bg: string }> = {
  live_prediction: { label: 'Live Prediction', icon: <Crosshair size={22} className="text-electric-blue" />, ring: 'border-electric-blue/40 hover:border-electric-blue', bg: 'bg-electric-blue/15' },
  match_royale: { label: 'Match Royale', icon: <Trophy size={22} className="text-warm-yellow" />, ring: 'border-warm-yellow/40 hover:border-warm-yellow', bg: 'bg-warm-yellow/15' },
  live_fantasy: { label: 'Live Fantasy', icon: <Star size={22} className="text-lime-glow" />, ring: 'border-lime-glow/40 hover:border-lime-glow', bg: 'bg-lime-glow/15' },
};

const teaser = (e: ResultsIndexEntry) => {
  if (e.game_type === 'match_royale') return `${e.players} entered${e.winners ? ` · ${e.winners} winner${e.winners > 1 ? 's' : ''}` : ''}`;
  if (e.game_type === 'live_fantasy') return `${e.players} team${e.players > 1 ? 's' : ''}`;
  return `${e.players} prediction${e.players > 1 ? 's' : ''}`;
};

export const ResultsModal: React.FC<ResultsModalProps> = ({ isOpen, onClose, fixtureId, matchName }) => {
  const [index, setIndex] = useState<ResultsIndexEntry[]>([]);
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [selected, setSelected] = useState<GameType | null>(null);
  const [results, setResults] = useState<GameResults | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    if (!isOpen || !fixtureId) return;
    setSelected(null); setResults(null); setLoadingIndex(true);
    getResultsIndex(fixtureId).then(setIndex).catch(() => setIndex([])).finally(() => setLoadingIndex(false));
  }, [isOpen, fixtureId]);

  const openGame = async (gt: GameType) => {
    if (!fixtureId) return;
    setSelected(gt); setLoadingResults(true); setResults(null);
    const r = await getResults(gt, fixtureId).catch(() => null);
    setResults(r); setLoadingResults(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[70] animate-scale-in" onClick={onClose}>
      <div className="modal-base w-full sm:max-w-md max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-2 p-4 border-b border-white/10 flex-shrink-0">
          {selected ? (
            <button onClick={() => { setSelected(null); setResults(null); }} className="p-1.5 -ml-1.5 text-text-secondary hover:text-electric-blue"><ChevronLeft size={20} /></button>
          ) : null}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-text-primary">{selected ? GAME_META[selected].label : 'Results'}</h2>
            {matchName && <p className="text-xs text-text-secondary truncate">{matchName}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-text-secondary hover:bg-white/10 rounded-full"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!selected ? (
            // ── Chooser ──
            loadingIndex ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-electric-blue" size={26} /></div>
            ) : index.length === 0 ? (
              <p className="text-center text-text-secondary py-10 text-sm">No live games ran on this match.</p>
            ) : (
              <div className="space-y-3">
                {index.map(e => {
                  const m = GAME_META[e.game_type];
                  return (
                    <button key={e.game_type} onClick={() => openGame(e.game_type)}
                      className={`w-full flex items-center gap-3 p-4 bg-deep-navy rounded-xl border-2 transition-all text-left ${m.ring}`}>
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${m.bg}`}>{m.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-text-primary">{m.label}</p>
                        <p className="text-xs text-text-secondary">{teaser(e)}</p>
                      </div>
                      <ChevronRight size={20} className="text-text-disabled flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )
          ) : loadingResults ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-electric-blue" size={26} /></div>
          ) : !results ? (
            <p className="text-center text-text-secondary py-10 text-sm">Results not available yet.</p>
          ) : (
            <ResultsView results={results} />
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────── Per-game results view ───────────────────────────
const ResultsView: React.FC<{ results: GameResults }> = ({ results }) => {
  const { crowd_stats: cs, leaderboard, i_played, game_type } = results;
  return (
    <div className="space-y-4">
      {game_type === 'live_prediction' && <LpStats cs={cs} />}
      {game_type === 'match_royale' && <MrStats cs={cs} />}
      {game_type === 'live_fantasy' && <LfStats cs={cs} />}

      {!i_played && (
        <div className="bg-gradient-to-r from-warm-yellow/20 to-hot-red/20 border border-warm-yellow/30 rounded-xl p-3 text-center">
          <p className="text-sm font-bold text-warm-yellow">You missed this one 👀</p>
          <p className="text-xs text-text-secondary">Jump in next time and climb the board.</p>
        </div>
      )}

      <Leaderboard rows={leaderboard} game_type={game_type} />
    </div>
  );
};

const StatTile: React.FC<{ label: string; value: React.ReactNode; sub?: string; accent?: string }> = ({ label, value, sub, accent }) => (
  <div className="bg-navy-accent rounded-lg p-2.5">
    <p className="text-[11px] text-text-disabled uppercase tracking-wide leading-tight">{label}</p>
    <p className={`text-lg font-bold ${accent ?? 'text-text-primary'}`}>{value}</p>
    {sub && <p className="text-[11px] text-text-secondary leading-tight">{sub}</p>}
  </div>
);

const Bar: React.FC<{ pct: number; color?: string }> = ({ pct, color = 'bg-electric-blue' }) => (
  <div className="w-full bg-deep-navy rounded-full h-1.5 overflow-hidden"><div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
);

const LpStats: React.FC<{ cs: any }> = ({ cs }) => {
  if (!cs || cs.players === 0) return <Empty />;
  const a = cs.actual_score || {};
  return (
    <div className="space-y-3">
      <div className="text-center"><p className="text-xs text-text-disabled uppercase tracking-wider">Final</p><p className="text-3xl font-extrabold text-text-primary">{a.home} – {a.away}</p></div>
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Played" value={cs.players} />
        <StatTile label="Correct winner" value={`${cs.correct_winner_pct}%`} accent="text-lime-glow" />
        <StatTile label="Exact score" value={`${cs.exact_score_pct}%`} accent="text-warm-yellow" />
      </div>
      {Array.isArray(cs.top_predictions) && cs.top_predictions.length > 0 && (
        <div className="card-base p-3 space-y-2">
          <p className="text-xs font-semibold text-text-secondary">Most predicted scores</p>
          {cs.top_predictions.map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-primary w-10">{p.score}</span>
              <div className="flex-1"><Bar pct={p.pct} /></div>
              <span className="text-xs text-text-secondary w-9 text-right">{p.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MrStats: React.FC<{ cs: any }> = ({ cs }) => {
  if (!cs || cs.entered === 0) return <Empty />;
  return (
    <div className="space-y-3">
      {cs.pot > 0 && <div className="text-center"><p className="text-xs text-text-disabled uppercase tracking-wider">Pot</p><p className="text-2xl font-extrabold text-warm-yellow">{cs.pot.toLocaleString()} coins</p></div>}
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Entered" value={cs.entered} />
        <StatTile label="Survived" value={cs.survived} accent="text-lime-glow" sub={`${cs.survived_pct}%`} />
        {cs.elimination_peak ? <StatTile label="Carnage" value={`${cs.elimination_peak.count}`} sub={`out at Q${cs.elimination_peak.seq}`} accent="text-hot-red" /> : <StatTile label="Winners" value={(cs.winners || []).length} />}
      </div>
      {Array.isArray(cs.winners) && cs.winners.length > 0 && (
        <div className="card-base p-3 space-y-1.5">
          <p className="text-xs font-semibold text-text-secondary">Winners</p>
          {cs.winners.map((w: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-text-primary"><Crown size={14} className="text-warm-yellow" />{w.username}</span>
              {w.prize > 0 && <span className="font-bold text-lime-glow">+{w.prize.toLocaleString()}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LfStats: React.FC<{ cs: any }> = ({ cs }) => {
  if (!cs || cs.players === 0) return <Empty />;
  return (
    <div className="space-y-3">
      <div className="text-center"><p className="text-xs text-text-disabled uppercase tracking-wider">Top score</p><p className="text-3xl font-extrabold text-lime-glow">{cs.top_score} pts</p>{cs.winner && <p className="text-xs text-text-secondary">by {cs.winner.username}</p>}</div>
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Teams" value={cs.players} />
        {cs.most_picked && <StatTile label="Most picked" value={`${cs.most_picked.pct}%`} sub={cs.most_picked.name} accent="text-electric-blue" />}
        {cs.best_captain && <StatTile label="Top captain" value={`${cs.best_captain.pct}%`} sub={cs.best_captain.name} accent="text-warm-yellow" />}
      </div>
      {cs.gk_underdog && (
        <div className="card-base p-3 flex items-center justify-between">
          <div><p className="text-xs font-semibold text-text-secondary">🧤 GK underdog bonus</p><p className="text-sm font-bold text-text-primary">{cs.gk_underdog.name}</p></div>
          <div className="text-right"><p className="text-sm font-bold text-lime-glow">×{cs.gk_underdog.mult}</p><p className="text-[11px] text-text-secondary">only {cs.gk_underdog.pct}% picked</p></div>
        </div>
      )}
    </div>
  );
};

const Empty = () => <p className="text-center text-text-secondary py-6 text-sm">No participants on this one.</p>;

const Leaderboard: React.FC<{ rows: any[]; game_type: GameType }> = ({ rows, game_type }) => {
  if (!rows || rows.length === 0) return null;
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`);
  return (
    <div className="card-base divide-y divide-white/5">
      <p className="px-3 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">Leaderboard</p>
      {rows.slice(0, 50).map((r, i) => (
        <div key={r.user_id || i} className={`flex items-center gap-3 px-3 py-2 ${r.is_me ? 'bg-electric-blue/10' : ''}`}>
          <span className="w-7 text-center text-sm font-bold text-text-secondary">{medal(i)}</span>
          <span className="flex-1 min-w-0 truncate text-sm font-semibold text-text-primary">{r.username}{r.is_me && <span className="text-electric-blue"> · you</span>}</span>
          {game_type === 'match_royale' ? (
            <span className={`text-sm font-bold ${r.is_winner ? 'text-lime-glow' : 'text-text-disabled'}`}>{r.is_winner ? (r.prize > 0 ? `+${r.prize.toLocaleString()}` : 'Survived') : 'Out'}</span>
          ) : (
            <span className="text-sm font-bold text-text-primary">{game_type === 'live_fantasy' ? `${Math.round(r.score ?? 0)} pts` : `${r.points ?? 0} pts`}</span>
          )}
        </div>
      ))}
    </div>
  );
};

export default ResultsModal;
