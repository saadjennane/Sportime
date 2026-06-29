import React, { useEffect, useMemo, useState } from 'react';
import { Flag, MapPin, Clock, ListOrdered, History, ChevronRight, X } from 'lucide-react';
import { format } from 'date-fns';
import { useNextGrandPrix, usePastGrandPrix, type GrandPrix } from '../features/f1/useF1';
import { useRaceBetting, type F1Selection, type F1MarketView } from '../features/f1/useRaceBetting';
import { useF1Results } from '../features/f1/useF1Results';
import { useAuth } from '../contexts/AuthContext';
import { getLevelBetLimit } from '../config/constants';
import { F1MarketCard } from '../components/f1/F1MarketCard';
import { F1BetModal } from '../components/f1/F1BetModal';
import { F1Sessions } from '../components/f1/F1Sessions';
import { F1History } from '../components/f1/F1History';
import { F1Standings } from '../components/f1/F1Standings';
import { track } from '../services/analytics';

type RaceTab = 'gp' | 'picks' | 'results';
const TABS: { key: RaceTab; label: string }[] = [
  { key: 'gp', label: 'GP' },
  { key: 'picks', label: 'Picks' },
  { key: 'results', label: 'Results' },
];

const GpHeader: React.FC<{ gp: GrandPrix | null; loading: boolean; onOpenSessions: () => void; onOpenHistory: () => void }> = ({ gp, loading, onOpenSessions, onOpenHistory }) => {
  if (loading) return <div className="card-base p-6 text-center text-text-secondary text-sm">Loading next Grand Prix…</div>;
  if (!gp) return <div className="card-base p-6 text-center text-text-secondary text-sm">No upcoming Grand Prix scheduled.</div>;
  const fmt = (iso: string | null) => (iso ? format(new Date(iso), 'EEE MMM d · HH:mm') : 'TBD');
  return (
    <div className="card-base p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-electric-blue text-xs font-semibold">
            <Flag size={13} /> {gp.round ? `ROUND ${gp.round}` : 'NEXT'}
          </div>
          <div className="mt-1 text-text-primary font-bold text-lg leading-tight truncate">{gp.name}</div>
          {(gp.circuitName || gp.country) && (
            <div className="mt-0.5 flex items-center gap-1 text-text-secondary text-xs truncate">
              <MapPin size={12} /> {[gp.circuitName, gp.country].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        {gp.circuitImage && <img src={gp.circuitImage} alt="" className="w-16 h-16 object-contain shrink-0 opacity-80" />}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="bg-deep-navy rounded-lg p-2">
          <div className="text-[10px] uppercase tracking-wide text-text-secondary">Qualifying</div>
          <div className="text-sm font-semibold text-text-primary">{fmt(gp.qualiStartAt)}</div>
        </div>
        <div className="bg-deep-navy rounded-lg p-2">
          <div className="text-[10px] uppercase tracking-wide text-text-secondary flex items-center gap-1"><Clock size={10} /> Race</div>
          <div className="text-sm font-semibold text-text-primary">{fmt(gp.raceAt)}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={onOpenHistory} className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-navy-accent text-sm font-semibold text-electric-blue">
          <History size={15} /> History
        </button>
        <button onClick={onOpenSessions} className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-navy-accent text-sm font-semibold text-electric-blue">
          <ListOrdered size={15} /> Sessions
        </button>
      </div>
    </div>
  );
};

const RacesPage: React.FC = () => {
  const [tab, setTab] = useState<RaceTab>('gp');
  const { gp, loading: gpLoading } = useNextGrandPrix();
  const { gps: pastGps } = usePastGrandPrix();
  const { profile, refreshProfile } = useAuth();
  const { markets, bets, betKey, loading, placeBet, cancelBet } = useRaceBetting(gp?.id, profile?.id);
  const { groups: resultGroups, loading: resultsLoading } = useF1Results(profile?.id);

  const [picked, setPicked] = useState<{ market: F1MarketView; sel: F1Selection } | null>(null);
  const [sessionsGp, setSessionsGp] = useState<GrandPrix | null>(null);
  const [historyGp, setHistoryGp] = useState<GrandPrix | null>(null);
  const [standings, setStandings] = useState<'drivers' | 'teams' | null>(null);

  // Results-tab badge: number of settled F1 picks not yet seen (clears on opening Results).
  const settledCount = useMemo(() => resultGroups.reduce((n, g) => n + g.bets.length, 0), [resultGroups]);
  const [seenResults, setSeenResults] = useState<number>(() => { try { return Number(localStorage.getItem('f1.resultsSeen') || 0); } catch { return 0; } });
  useEffect(() => {
    if (tab === 'results' && settledCount !== seenResults) {
      setSeenResults(settledCount);
      try { localStorage.setItem('f1.resultsSeen', String(settledCount)); } catch { /* ignore */ }
    }
  }, [tab, settledCount, seenResults]);
  const resultsBadge = settledCount > seenResults ? settledCount : 0;

  const balance = profile?.coins_balance ?? 0;
  const maxBet = useMemo(() => getLevelBetLimit((profile as any)?.level ?? (profile as any)?.current_level), [profile]);

  const pickedSelections = useMemo(() => {
    const out: { market: F1MarketView; sel: F1Selection }[] = [];
    for (const m of markets) for (const s of m.selections) if (bets.has(betKey(m.key, s.entityId, s.selection))) out.push({ market: m, sel: s });
    return out;
  }, [markets, bets, betKey]);

  const existingStake = picked ? bets.get(betKey(picked.market.key, picked.sel.entityId, picked.sel.selection))?.stake ?? 0 : 0;

  const onPlace = async (stake: number) => {
    if (!picked) return { ok: false, error: 'No selection' };
    const r = await placeBet(picked.market.key, picked.sel.entityId, picked.sel.selection, stake);
    if (r.ok) { refreshProfile(); track('f1_bet_placed', { market: picked.market.key, stake }); }
    return r;
  };

  const onCancel = async () => {
    if (!picked) return { ok: false, error: 'No selection' };
    const r = await cancelBet(picked.market.key, picked.sel.entityId, picked.sel.selection);
    if (r.ok) refreshProfile();
    return r;
  };

  return (
    <div className="space-y-4">
      <div className="flex bg-navy-accent rounded-xl p-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`relative flex-1 p-2 rounded-lg font-semibold transition-all text-sm ${tab === t.key ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}>
            {t.label}
            {t.key === 'results' && resultsBadge > 0 && (
              <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-hot-red text-white text-[10px] font-bold leading-none">{resultsBadge > 9 ? '9+' : resultsBadge}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'gp' && (
        <>
          {/* Championship standings */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setStandings('drivers')} className="py-2.5 rounded-xl bg-navy-accent text-sm font-bold text-electric-blue active:scale-[0.99] transition">Drivers</button>
            <button onClick={() => setStandings('teams')} className="py-2.5 rounded-xl bg-navy-accent text-sm font-bold text-electric-blue active:scale-[0.99] transition">Teams</button>
          </div>
          <GpHeader gp={gp} loading={gpLoading} onOpenSessions={() => gp && setSessionsGp(gp)} onOpenHistory={() => gp && setHistoryGp(gp)} />
          {loading ? (
            <div className="card-base p-6 text-center text-text-secondary text-sm">Loading picks…</div>
          ) : markets.length === 0 ? (
            <div className="card-base p-6 text-center text-text-secondary text-sm">No picks open yet for this Grand Prix.</div>
          ) : (
            markets.map((m) => <F1MarketCard key={m.key} market={m} bets={bets} betKey={betKey} onPick={(sel) => setPicked({ market: m, sel })} />)
          )}

          {/* Past Grands Prix — tap to see each weekend's sessions / results */}
          {pastGps.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary px-1 mb-2">Past Grands Prix</div>
              <div className="card-base divide-y divide-white/5">
                {pastGps.map((p) => (
                  <button key={p.id} onClick={() => setSessionsGp(p)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                    {p.circuitImage ? <img src={p.circuitImage} alt="" className="w-8 h-8 object-contain opacity-70 shrink-0" /> : <Flag size={16} className="text-text-disabled shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-text-primary truncate">{p.round ? `R${p.round} · ` : ''}{p.name}</div>
                      <div className="text-[11px] text-text-secondary">{p.raceAt ? format(new Date(p.raceAt), 'MMM d, yyyy') : ''}</div>
                    </div>
                    <ChevronRight size={16} className="text-text-disabled shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'picks' && (
        pickedSelections.length === 0 ? (
          <div className="card-base p-6 text-center text-text-secondary text-sm">No F1 picks yet. Tap odds in the GP tab to bet.</div>
        ) : (
          <div className="space-y-2">
            {pickedSelections.map(({ market, sel }) => {
              const bet = bets.get(betKey(market.key, sel.entityId, sel.selection))!;
              const net = Math.ceil(bet.stake * bet.odds) - bet.stake;
              return (
                <button key={market.key + sel.key} onClick={() => { setTab('gp'); setPicked({ market, sel }); }}
                  className="w-full card-base p-3 flex items-center gap-3 text-left">
                  {sel.image
                    ? <img src={sel.image} alt="" className="w-9 h-9 rounded-full object-cover bg-navy-accent shrink-0" />
                    : <div className="w-9 h-9 rounded-full bg-navy-accent flex items-center justify-center text-[11px] font-bold text-text-secondary shrink-0">{sel.label.slice(0, 2).toUpperCase()}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-text-primary truncate flex items-center gap-1.5">
                      {sel.label}{sel.teamLogo && <img src={sel.teamLogo} alt="" className="w-3.5 h-3.5 object-contain" />}
                    </div>
                    <div className="text-[11px] text-text-secondary">{market.label} · @{bet.odds.toFixed(2)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-text-primary">{bet.stake.toLocaleString()}</div>
                    <div className="text-[11px] text-lime-glow">+{net.toLocaleString()}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}

      {tab === 'results' && (
        resultsLoading ? (
          <div className="card-base p-6 text-center text-text-secondary text-sm">Loading results…</div>
        ) : resultGroups.length === 0 ? (
          <div className="card-base p-6 text-center text-text-secondary text-sm">No settled F1 bets yet.</div>
        ) : (
          <div className="space-y-3">
            {resultGroups.map((g) => (
              <div key={g.raceId} className="card-base p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-text-primary text-sm">{g.round ? `R${g.round} · ` : ''}{g.name}</div>
                  <div className={`text-sm font-bold ${g.totalNet > 0 ? 'text-lime-glow' : g.totalNet < 0 ? 'text-hot-red' : 'text-text-secondary'}`}>
                    {g.totalNet > 0 ? '+' : ''}{g.totalNet.toLocaleString()}
                  </div>
                </div>
                {g.bets.map((b) => (
                  <div key={b.key} className="flex items-center gap-2.5 py-1.5 border-t border-white/5">
                    {b.image
                      ? <img src={b.image} alt="" className="w-7 h-7 rounded-full object-cover bg-navy-accent shrink-0" />
                      : <div className="w-7 h-7 rounded-full bg-navy-accent flex items-center justify-center text-[9px] font-bold text-text-secondary shrink-0">{b.label.slice(0, 2).toUpperCase()}</div>}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-text-primary truncate flex items-center gap-1.5">
                        {b.label}{b.teamLogo && <img src={b.teamLogo} alt="" className="w-3.5 h-3.5 object-contain" />}
                      </div>
                      <div className="text-[11px] text-text-secondary">{b.marketLabel} · @{b.odds.toFixed(2)} · {b.stake.toLocaleString()}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                        b.status === 'won' ? 'bg-lime-glow/15 text-lime-glow' : b.status === 'void' ? 'bg-navy-accent text-text-secondary' : 'bg-hot-red/15 text-hot-red'
                      }`}>
                        {b.status === 'won' ? `WON +${b.net.toLocaleString()}` : b.status === 'void' ? 'VOID' : `LOST ${b.net.toLocaleString()}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      )}

      <F1BetModal
        open={!!picked}
        marketLabel={picked?.market.label ?? ''}
        sel={picked?.sel ?? null}
        balance={balance}
        maxBet={maxBet}
        existingStake={existingStake}
        onClose={() => setPicked(null)}
        onPlace={onPlace}
        onCancel={onCancel}
      />

      {sessionsGp && <F1Sessions gp={sessionsGp} onClose={() => setSessionsGp(null)} />}
      {historyGp && <F1History gp={historyGp} onClose={() => setHistoryGp(null)} />}
      {standings && <F1Standings type={standings} onClose={() => setStandings(null)} />}
    </div>
  );
};

export default RacesPage;
