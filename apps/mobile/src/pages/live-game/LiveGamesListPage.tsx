import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { MatchHeaderRow } from '../../components/matches/MatchHeaderRow';
import { ChevronLeft, Loader2, Zap, Trophy } from 'lucide-react';
import { listMyMRGames } from '../../services/matchRoyaleService';
import { listMyLFGames } from '../../services/liveFantasyService';
import { MatchRoyaleGame } from './MatchRoyaleGame';
import { LiveFantasyGame } from './LiveFantasyGame';

interface Props {
  userId: string;
  onOpenGame: (gameId: string, fixtureId: string, mode: 'free' | 'ranked') => void;
  onBack: () => void;
  addToast?: (m: string, t: 'success' | 'error' | 'info') => void;
}

const FINISHED = ['FT', 'AET', 'PEN'];

export const LiveGamesListPage: React.FC<Props> = ({ userId, onOpenGame, onBack, addToast }) => {
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<any[]>([]);
  const [mrGames, setMrGames] = useState<any[]>([]);
  const [lfGames, setLfGames] = useState<any[]>([]);
  const [openMR, setOpenMR] = useState<string | null>(null);
  const [openLF, setOpenLF] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) { setLoading(false); return; }
      const [{ data }, mr, lf] = await Promise.all([
        supabase.rpc('get_user_live_games', { p_user_id: userId }),
        listMyMRGames(userId).catch(() => []),
        listMyLFGames(userId).catch(() => []),
      ]);
      if (!cancelled) { setGames(Array.isArray(data) ? data : []); setMrGames(mr); setLfGames(lf); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (openMR) {
    return <MatchRoyaleGame gameId={openMR} userId={userId} onBack={() => setOpenMR(null)} addToast={addToast ?? (() => {})} />;
  }
  if (openLF) {
    return <LiveFantasyGame fixtureId={openLF} userId={userId} onBack={() => setOpenLF(null)} addToast={addToast ?? (() => {})} />;
  }

  return (
    <div className="fixed inset-0 bg-deep-navy z-40 overflow-y-auto">
      <div className="max-w-md mx-auto px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] space-y-4">
        <div className="flex items-center gap-3 sticky top-0 bg-deep-navy py-2 z-10">
          <button onClick={onBack} className="p-2 -ml-2 text-text-secondary hover:text-text-primary"><ChevronLeft size={24} /></button>
          <h1 className="font-bold text-lg text-text-primary flex items-center gap-2"><Zap size={18} className="text-warm-yellow" /> Live Games</h1>
        </div>

        {mrGames.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-text-secondary flex items-center gap-1.5"><Trophy size={14} className="text-warm-yellow" /> Match Royale</h2>
            {mrGames.map((g) => {
              const fx = g.fixture;
              const center = (fx?.goals_home != null) ? `${fx.goals_home} - ${fx.goals_away}` : (fx?.date ? new Date(fx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'VS');
              const tm = { teamA: { name: fx?.home?.name ?? 'Home', logo: fx?.home?.logo_url }, teamB: { name: fx?.away?.name ?? 'Away', logo: fx?.away?.logo_url } };
              return (
                <button key={g.id} onClick={() => setOpenMR(g.id)} className="w-full card-base p-4 text-left hover:border-warm-yellow/40 transition-colors">
                  <MatchHeaderRow match={tm} center={center} />
                  <div className="flex items-center justify-between mt-3 text-xs">
                    <span className="font-semibold px-2 py-0.5 rounded-lg bg-warm-yellow/15 text-warm-yellow">🏆 {g.pot_amount ?? '—'} coins</span>
                    <span className="text-text-secondary capitalize">{String(g.status).replace('_', ' ')}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {lfGames.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-text-secondary flex items-center gap-1.5"><Trophy size={14} className="text-lime-glow" /> Live Fantasy</h2>
            {lfGames.map((g) => {
              const fx = g.fixture;
              const center = (fx?.goals_home != null) ? `${fx.goals_home} - ${fx.goals_away}` : (fx?.date ? new Date(fx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'VS');
              const tm = { teamA: { name: fx?.home?.name ?? 'Home', logo: fx?.home?.logo_url }, teamB: { name: fx?.away?.name ?? 'Away', logo: fx?.away?.logo_url } };
              return (
                <button key={g.id} onClick={() => setOpenLF(g.fixture_id)} className="w-full card-base p-4 text-left hover:border-lime-glow/40 transition-colors">
                  <MatchHeaderRow match={tm} center={center} />
                  <div className="flex items-center justify-between mt-3 text-xs">
                    <span className="font-semibold px-2 py-0.5 rounded-lg bg-lime-glow/15 text-lime-glow">⭐ Live Fantasy</span>
                    <span className="text-text-secondary capitalize">{String(g.status)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-electric-blue" size={28} /></div>
        ) : games.length === 0 ? (
          <div className="card-base p-7 text-center">
            <div className="w-16 h-16 rounded-full bg-warm-yellow/10 flex items-center justify-center mb-4 mx-auto text-3xl">⚡</div>
            <p className="text-text-primary font-bold text-lg">No current Live Games</p>
            <p className="text-text-secondary text-sm mt-1">
              Tap <span className="text-warm-yellow font-semibold">⚡ Play</span> on any match (Today tab) to start one.
            </p>
            <div className="mt-5 text-left space-y-2.5 text-sm text-text-secondary">
              <p className="text-xs font-bold text-text-primary uppercase tracking-wide">How it works</p>
              <p>🔮 <span className="text-text-primary font-medium">Predict the final score</span> before kickoff.</p>
              <p>🎯 Answer <span className="text-text-primary font-medium">3 bonus questions</span> based on your prediction.</p>
              <p>🏆 Earn points (<span className="text-text-primary font-medium">200 max</span>): goal difference + result + bonus.</p>
              <p>👥 Compete with everyone who joins the <span className="text-text-primary font-medium">same match</span>.</p>
              <p>⏱️ You can edit your score at half‑time (−40% malus).</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map((g) => {
              const fx = g.fixture;
              const started = fx?.date && new Date(fx.date) <= new Date();
              const finished = FINISHED.includes(fx?.status);
              const center = started || finished
                ? `${fx?.goals_home ?? 0} - ${fx?.goals_away ?? 0}`
                : fx?.date ? new Date(fx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'VS';
              const teamMatch = { teamA: { name: fx?.home?.name ?? 'Home', logo: fx?.home?.logo }, teamB: { name: fx?.away?.name ?? 'Away', logo: fx?.away?.logo } };
              return (
                <button key={g.id} onClick={() => onOpenGame(g.id, g.fixture_id, g.mode)}
                  className="w-full card-base p-4 text-left hover:border-electric-blue/40 transition-colors">
                  <MatchHeaderRow match={teamMatch} center={center} />
                  <div className="flex items-center justify-between mt-3 text-xs">
                    <span className={`font-semibold px-2 py-0.5 rounded-lg ${started ? 'bg-hot-red/15 text-hot-red' : 'bg-electric-blue/15 text-electric-blue'}`}>
                      {finished ? 'Finished' : started ? 'Live' : 'Upcoming'}
                    </span>
                    <span className="text-text-secondary">
                      {g.predicted_score
                        ? <>Your pick: <span className="font-bold text-text-primary">{g.predicted_score.home}-{g.predicted_score.away}</span></>
                        : <span className="text-warm-yellow font-semibold">No prediction yet</span>}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveGamesListPage;
