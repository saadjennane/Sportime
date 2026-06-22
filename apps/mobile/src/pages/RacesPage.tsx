import React, { useMemo, useState } from 'react';
import { Settings, Flag, MapPin, Clock, ListOrdered, History, ChevronRight, ChevronUp, ChevronDown, X } from 'lucide-react';
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
  const [showOrder, setShowOrder] = useState(false);
  const [order, setOrder] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('f1.marketOrder') || '[]'); } catch { return []; } });

  // Apply the user's saved market order (unknown markets fall to the end).
  const orderedMarkets = useMemo(() => {
    const idx = (k: string) => { const i = order.indexOf(k); return i < 0 ? 999 : i; };
    return [...markets].sort((a, b) => idx(a.key) - idx(b.key));
  }, [markets, order]);
  const moveMarket = (i: number, dir: -1 | 1) => {
    const keys = orderedMarkets.map((m) => m.key);
    const j = i + dir;
    if (j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    setOrder(keys);
    try { localStorage.setItem('f1.marketOrder', JSON.stringify(keys)); } catch { /* ignore */ }
  };

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
      <div className="flex items-center gap-2">
        <div className="flex-1 flex bg-navy-accent rounded-xl p-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 p-2 rounded-lg font-semibold transition-all text-sm ${tab === t.key ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowOrder(true)} disabled={tab !== 'gp' || orderedMarkets.length === 0}
          className="p-3 bg-navy-accent rounded-xl text-text-secondary hover:text-electric-blue disabled:opacity-40 disabled:hover:text-text-secondary" aria-label="Reorder markets">
          <Settings size={20} />
        </button>
      </div>

      {tab === 'gp' && (
        <>
          <GpHeader gp={gp} loading={gpLoading} onOpenSessions={() => gp && setSessionsGp(gp)} onOpenHistory={() => gp && setHistoryGp(gp)} />
          {loading ? (
            <div className="card-base p-6 text-center text-text-secondary text-sm">Loading markets…</div>
          ) : markets.length === 0 ? (
            <div className="card-base p-6 text-center text-text-secondary text-sm">No markets open yet for this Grand Prix.</div>
          ) : (
            orderedMarkets.map((m) => <F1MarketCard key={m.key} market={m} bets={bets} betKey={betKey} onPick={(sel) => setPicked({ market: m, sel })} />)
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

      {showOrder && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setShowOrder(false)}>
          <div className="w-full sm:max-w-md bg-deep-navy rounded-t-2xl sm:rounded-2xl border-t sm:border border-white/10 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="font-bold text-text-primary">Reorder markets</div>
              <button onClick={() => setShowOrder(false)} className="p-1 text-text-secondary"><X size={20} /></button>
            </div>
            <div className="p-3 space-y-2 overflow-y-auto">
              {orderedMarkets.map((m, i) => (
                <div key={m.key} className="flex items-center gap-3 px-3 py-2.5 card-base">
                  <span className="w-5 text-text-secondary tabular-nums text-sm">{i + 1}</span>
                  <span className="flex-1 text-sm font-medium text-text-primary truncate">{m.label}</span>
                  <button onClick={() => moveMarket(i, -1)} disabled={i === 0}
                    className="p-1.5 rounded-lg bg-navy-accent text-text-secondary disabled:opacity-30"><ChevronUp size={16} /></button>
                  <button onClick={() => moveMarket(i, 1)} disabled={i === orderedMarkets.length - 1}
                    className="p-1.5 rounded-lg bg-navy-accent text-text-secondary disabled:opacity-30"><ChevronDown size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RacesPage;
