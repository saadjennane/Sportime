import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import { MatchHeaderRow } from '../../components/matches/MatchHeaderRow';
import { ChevronLeft, ChevronDown, Loader2, Zap } from 'lucide-react';
import { listMyMRGames } from '../../services/matchRoyaleService';
import { listMyLFGames } from '../../services/liveFantasyService';
import { MatchRoyaleGame } from './MatchRoyaleGame';
import { LiveFantasyGame } from './LiveFantasyGame';
import { toLiveItem, sortForPhase, PHASE_ORDER, PHASE_META, TYPE_META, LiveItem, LivePhase } from '../../lib/liveGamePhase';

interface Props {
  userId: string;
  onOpenGame: (gameId: string, fixtureId: string, mode: 'free' | 'ranked') => void;
  onBack: () => void;
  addToast?: (m: string, t: 'success' | 'error' | 'info') => void;
}

const fmtTime = (d?: string) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'VS';

// Type-specific bottom line of a card.
const typeLine = (item: LiveItem): React.ReactNode => {
  const g = item.raw;
  if (item.type === 'prediction') {
    return g.predicted_score
      ? <>Your pick: <span className="font-bold text-text-primary">{g.predicted_score.home}-{g.predicted_score.away}</span></>
      : <span className="text-warm-yellow font-semibold">No prediction yet</span>;
  }
  if (item.type === 'match_royale') {
    return <span className="font-semibold text-warm-yellow">🏆 {g.pot_amount ?? '—'} coins</span>;
  }
  return <span className="font-semibold text-lime-glow">⭐ Live Fantasy</span>;
};

const LiveGameCard: React.FC<{ item: LiveItem; onClick: () => void }> = ({ item, onClick }) => {
  const fx = item.fixture;
  const t = TYPE_META[item.type];
  const p = PHASE_META[item.phase];
  const kicked = item.phase !== 'not_started';
  const center = kicked && fx?.goals_home != null ? `${fx.goals_home} - ${fx.goals_away}` : fmtTime(fx?.date);
  const tm = { teamA: { name: fx?.home.name ?? 'Home', logo: fx?.home.logo }, teamB: { name: fx?.away.name ?? 'Away', logo: fx?.away.logo } };
  return (
    <button onClick={onClick} className="w-full card-base p-4 text-left hover:border-electric-blue/40 transition-colors">
      <div className="flex items-center justify-between mb-2.5">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${t.badge}`}>{t.emoji} {t.label}</span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${p.chip}`}>{p.label}</span>
      </div>
      <MatchHeaderRow match={tm} center={center} />
      <div className="mt-3 text-xs text-text-secondary">{typeLine(item)}</div>
    </button>
  );
};

export const LiveGamesListPage: React.FC<Props> = ({ userId, onOpenGame, onBack, addToast }) => {
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<any[]>([]);
  const [mrGames, setMrGames] = useState<any[]>([]);
  const [lfGames, setLfGames] = useState<any[]>([]);
  const [openMR, setOpenMR] = useState<string | null>(null);
  const [openLF, setOpenLF] = useState<string | null>(null);
  const [finishedOpen, setFinishedOpen] = useState(false);

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

  // Unify the 3 sources, then bucket by phase.
  const grouped = useMemo(() => {
    const items: LiveItem[] = [
      ...games.map((g) => toLiveItem('prediction', g)),
      ...mrGames.map((g) => toLiveItem('match_royale', g)),
      ...lfGames.map((g) => toLiveItem('live_fantasy', g)),
    ].filter(Boolean) as LiveItem[];
    const by: Record<LivePhase, LiveItem[]> = { ongoing: [], not_started: [], results: [], finished: [] };
    items.forEach((it) => by[it.phase].push(it));
    (Object.keys(by) as LivePhase[]).forEach((ph) => { by[ph] = sortForPhase(by[ph], ph); });
    return by;
  }, [games, mrGames, lfGames]);

  const open = (item: LiveItem) => {
    if (item.type === 'match_royale') setOpenMR(item.gameId);
    else if (item.type === 'live_fantasy') setOpenLF(item.fixtureId);
    else onOpenGame(item.gameId, item.fixtureId, (item.raw.mode as 'free' | 'ranked') ?? 'free');
  };

  if (openMR) return <MatchRoyaleGame gameId={openMR} userId={userId} onBack={() => setOpenMR(null)} addToast={addToast ?? (() => {})} />;
  if (openLF) return <LiveFantasyGame fixtureId={openLF} userId={userId} onBack={() => setOpenLF(null)} addToast={addToast ?? (() => {})} />;

  const total = grouped.ongoing.length + grouped.not_started.length + grouped.results.length + grouped.finished.length;

  return (
    <div className="fixed inset-0 bg-deep-navy z-40 overflow-y-auto">
      <div className="max-w-md mx-auto px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] space-y-4">
        <div className="flex items-center gap-3 sticky top-0 bg-deep-navy py-2 z-10">
          <button onClick={onBack} className="p-2 -ml-2 text-text-secondary hover:text-text-primary"><ChevronLeft size={24} /></button>
          <h1 className="font-bold text-lg text-text-primary flex items-center gap-2"><Zap size={18} className="text-warm-yellow" /> Live Games</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-electric-blue" size={28} /></div>
        ) : total === 0 ? (
          <div className="card-base p-7 text-center">
            <div className="w-16 h-16 rounded-full bg-warm-yellow/10 flex items-center justify-center mb-4 mx-auto text-3xl">⚡</div>
            <p className="text-text-primary font-bold text-lg">No Live Games yet</p>
            <p className="text-text-secondary text-sm mt-1">
              Tap <span className="text-warm-yellow font-semibold">⚡ Play</span> on any match (Today tab) to join one.
            </p>
          </div>
        ) : (
          PHASE_ORDER.map((ph) => {
            const list = grouped[ph];
            if (list.length === 0) return null;
            const meta = PHASE_META[ph];
            // Finished is a collapsed accordion.
            if (ph === 'finished') {
              return (
                <div key={ph} className="space-y-2">
                  <button onClick={() => setFinishedOpen((v) => !v)} className="w-full flex items-center justify-between py-1">
                    <h2 className="text-xs font-bold uppercase tracking-wide text-text-secondary">{meta.emoji} {meta.label} ({list.length})</h2>
                    <ChevronDown size={18} className={`text-text-secondary transition-transform ${finishedOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {finishedOpen && <div className="space-y-2">{list.map((it) => <LiveGameCard key={it.gameId} item={it} onClick={() => open(it)} />)}</div>}
                </div>
              );
            }
            return (
              <div key={ph} className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wide text-text-secondary">{meta.emoji} {meta.label} ({list.length})</h2>
                {list.map((it) => <LiveGameCard key={it.gameId} item={it} onClick={() => open(it)} />)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LiveGamesListPage;
