import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, X, Check, Star, BarChart3, Users as UsersIcon, ArrowLeft, ShoppingCart, Crown, Sparkles } from 'lucide-react';
import { Profile } from '../types';
import * as fp from '../services/fanPulseService';

const POS_GRAD: Record<fp.Bucket, string> = { GK: 'from-amber-400 to-amber-600', DEF: 'from-emerald-400 to-emerald-600', MID: 'from-blue-400 to-blue-600', FWD: 'from-red-400 to-red-600' };
const BUCKET_LABEL: Record<fp.Bucket, string> = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' };
const surname = (n: string) => (n || '').trim().split(' ').slice(-1)[0] || '';
const initials = (n: string) => (n || '').trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
// Accent-insensitive: "sua" should match "Suárez".
const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Formations (slot buckets). Slot order is arbitrary; rows are derived for rendering.
const FORMATIONS: Record<string, fp.Bucket[]> = {
  '4-3-3': ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'],
  '4-4-2': ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD'],
  '3-5-2': ['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD'],
  '4-2-3-1': ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD'],
};
const rowsOf = (formation: fp.Bucket[]) =>
  (['FWD', 'MID', 'DEF', 'GK'] as fp.Bucket[]).map(b => ({ bucket: b, slots: formation.map((x, i) => x === b ? i : -1).filter(i => i >= 0) })).filter(r => r.slots.length);

// ── Player token ────────────────────────────────────────────────────────────
const Token: React.FC<{ name?: string; photo?: string | null; bucket: fp.Bucket; empty?: boolean; onTap?: () => void; buy?: boolean }> = ({ name, photo, bucket, empty, onTap, buy }) => {
  const [err, setErr] = useState(false);
  return (
    <button onClick={onTap} className="flex flex-col items-center gap-0.5 w-[60px]">
      <div className="relative w-12 h-12">
        {empty ? (
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/40 bg-deep-navy/60 flex items-center justify-center text-white/50 text-xl font-bold">+</div>
        ) : photo && !err ? (
          <img src={photo} alt="" onError={() => setErr(true)} className="w-12 h-12 rounded-full object-cover border-2 border-white/50 shadow" />
        ) : (
          <div className={`w-12 h-12 rounded-full bg-gradient-to-b ${POS_GRAD[bucket]} border-2 border-white/50 shadow flex items-center justify-center text-white font-bold text-sm`}>{initials(name || '')}</div>
        )}
        {buy && <span className="absolute -top-1 -right-1 bg-warm-yellow text-deep-navy text-[8px] font-extrabold rounded-full w-4 h-4 flex items-center justify-center">€</span>}
      </div>
      <span className={`text-[10px] font-semibold text-center leading-tight truncate max-w-[60px] ${empty ? 'text-white/50' : 'text-white'}`}>{empty ? bucket : surname(name || '')}</span>
    </button>
  );
};

const Pitch: React.FC<{ formation: fp.Bucket[]; picks: (fp.PulsePick | null)[]; onSlot?: (i: number) => void; isBuy?: (key: string) => boolean }> = ({ formation, picks, onSlot, isBuy }) => (
  <div className="rounded-2xl p-3 bg-gradient-to-b from-emerald-800/40 to-emerald-950/40 border border-emerald-500/20">
    <div className="rounded-xl" style={{ background: 'repeating-linear-gradient(180deg,#0c4a3e22 0 28px,#0c4a3e11 28px 56px)' }}>
      <div className="flex flex-col gap-3 py-4">
        {rowsOf(formation).map(row => (
          <div key={row.bucket} className="flex justify-around items-center px-1">
            {row.slots.map(i => { const p = picks[i]; return <Token key={i} name={p?.name} photo={p?.photo} bucket={formation[i]} empty={!p} onTap={onSlot ? () => onSlot(i) : undefined} buy={p && isBuy ? isBuy(p.player_key) : false} />; })}
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── Aggregated pulse ────────────────────────────────────────────────────────
const PulseView: React.FC<{ agg: { participants: number; players: fp.AggPlayer[] }; squadIds?: Set<string> }> = ({ agg, squadIds }) => {
  const order: fp.Bucket[] = ['GK', 'DEF', 'MID', 'FWD'];
  const topN: Record<fp.Bucket, number> = { GK: 1, DEF: 4, MID: 3, FWD: 3 };
  if (agg.participants === 0) return <div className="card-base p-8 text-center"><div className="text-4xl mb-2">📊</div><p className="text-text-secondary">No fan has voted yet. Be the first — build your XI!</p></div>;
  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-text-secondary"><b className="text-text-primary">{agg.participants}</b> fan{agg.participants > 1 ? 's' : ''} voted</p>
      {order.map(b => {
        const list = agg.players.filter(p => p.position === b).sort((a, c) => c.pct - a.pct);
        if (!list.length) return null;
        return (
          <div key={b}>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">{BUCKET_LABEL[b]}s</p>
            <div className="space-y-1.5">
              {list.map((p, i) => {
                const buy = squadIds && !squadIds.has(p.player_key);
                return (
                  <div key={p.player_key} className="bg-navy-accent rounded-lg p-2 flex items-center gap-2">
                    {p.photo ? <img src={p.photo} className="w-8 h-8 rounded-full object-cover" alt="" /> : <div className={`w-8 h-8 rounded-full bg-gradient-to-b ${POS_GRAD[b]} flex items-center justify-center text-white font-bold text-[10px]`}>{initials(p.name)}</div>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        {i < topN[b] && <Star size={11} className="text-warm-yellow shrink-0" />}
                        <span className="text-sm text-text-primary font-medium truncate">{p.name}</span>
                        {buy && <span className="text-[9px] font-bold text-warm-yellow bg-warm-yellow/15 px-1 rounded shrink-0">BUY</span>}
                      </div>
                      <div className="h-1.5 mt-1 rounded-full bg-deep-navy overflow-hidden"><div className="h-full bg-electric-blue rounded-full" style={{ width: `${p.pct}%` }} /></div>
                    </div>
                    <span className="text-sm font-bold text-electric-blue tabular-nums w-10 text-right">{p.pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-center text-[11px] text-text-disabled">⭐ consensus XI{squadIds ? ' · €/BUY = not in the current squad' : ''}</p>
    </div>
  );
};

// ── Shared builder shell (pitch + auto-save + pulse) ────────────────────────
const usePulseEntry = (userId: string | null, scope: 'legends' | 'dream', teamId: string, defaultFormation: string) => {
  const [formation, setFormation] = useState(defaultFormation);
  const [picks, setPicks] = useState<(fp.PulsePick | null)[]>(Array(11).fill(null));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const first = useRef(true);
  useEffect(() => {
    if (!userId) return;
    fp.getMyEntry(userId, scope, teamId).then(({ formation: f, picks: mine }) => {
      const fr = FORMATIONS[f] ? f : defaultFormation;
      setFormation(fr);
      const arr: (fp.PulsePick | null)[] = Array(11).fill(null);
      for (const pk of mine) if (pk.slot >= 0 && pk.slot < 11) arr[pk.slot] = pk;
      setPicks(arr); first.current = true; setSaveState(mine.length ? 'saved' : 'idle');
    });
  }, [userId, teamId]);
  useEffect(() => {
    if (!userId || first.current) { first.current = false; return; }
    setSaveState('saving');
    const t = setTimeout(async () => {
      const { error } = await fp.saveEntry(userId, scope, teamId, formation, picks.filter(Boolean) as fp.PulsePick[]);
      setSaveState(error ? 'idle' : 'saved');
    }, 700);
    return () => clearTimeout(t);
  }, [picks, formation]);
  return { formation, setFormation, picks, setPicks, saveState };
};

// ── Legends builder ─────────────────────────────────────────────────────────
const LegendsBuilder: React.FC<{ club: fp.Club; userId: string }> = ({ club, userId }) => {
  const [legends, setLegends] = useState<fp.Legend[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mine' | 'pulse'>('mine');
  const [agg, setAgg] = useState<{ participants: number; players: fp.AggPlayer[] }>({ participants: 0, players: [] });
  const [pickFor, setPickFor] = useState<number | null>(null);
  const { picks, setPicks, saveState } = usePulseEntry(userId, 'legends', club.id, '4-3-3');
  const formation = FORMATIONS['4-3-3'];

  useEffect(() => { fp.getLegends(club.id).then(l => { setLegends(l); setLoading(false); }); }, [club.id]);
  useEffect(() => { if (tab === 'pulse') fp.getAggregate('legends', club.id).then(setAgg); }, [tab, club.id]);
  const usedKeys = useMemo(() => new Set(picks.filter(Boolean).map(p => (p as fp.PulsePick).player_key)), [picks]);

  const assign = (slot: number, l: fp.Legend | null) => {
    setPicks(prev => { const next = [...prev]; if (l) { for (let i = 0; i < next.length; i++) if (next[i]?.player_key === l.player_key) next[i] = null; next[slot] = { player_key: l.player_key, name: l.name, photo: l.photo_url, position: formation[slot], is_starter: true, slot }; } else next[slot] = null; return next; });
    setPickFor(null);
  };
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-electric-blue" size={28} /></div>;
  if (!legends.length) return <div className="card-base p-8 text-center"><div className="text-5xl mb-3">🏟️</div><p className="text-text-secondary font-medium">Legends coming soon for {club.name}</p></div>;
  const filled = picks.filter(Boolean).length;
  return (
    <div className="space-y-3">
      <Tabs tab={tab} setTab={setTab} />
      {tab === 'mine' ? (
        <>
          <Pitch formation={formation} picks={picks} onSlot={setPickFor} />
          <SaveLine state={saveState} filled={filled} done="✓ Your all-time XI is saved — see The Pulse" />
        </>
      ) : <PulseView agg={agg} />}
      {pickFor !== null && (
        <LegendPicker bucket={formation[pickFor]} legends={formation[pickFor] === 'GK' ? legends.filter(l => l.position === 'GK') : legends.filter(l => l.position !== 'GK')} usedKeys={usedKeys} currentKey={picks[pickFor]?.player_key} onClose={() => setPickFor(null)} onPick={l => assign(pickFor, l)} onClear={() => assign(pickFor, null)} />
      )}
    </div>
  );
};

// ── Dream builder ───────────────────────────────────────────────────────────
const DreamBuilder: React.FC<{ club: fp.Club; userId: string }> = ({ club, userId }) => {
  const [squad, setSquad] = useState<fp.SquadPlayer[]>([]);
  const [tab, setTab] = useState<'mine' | 'pulse'>('mine');
  const [agg, setAgg] = useState<{ participants: number; players: fp.AggPlayer[] }>({ participants: 0, players: [] });
  const [pickFor, setPickFor] = useState<number | null>(null);
  const { formation: fname, setFormation, picks, setPicks, saveState } = usePulseEntry(userId, 'dream', club.id, '4-3-3');
  const formation = FORMATIONS[fname] ?? FORMATIONS['4-3-3'];
  const squadIds = useMemo(() => new Set(squad.map(s => s.id)), [squad]);

  useEffect(() => { fp.getCurrentSquad(club.id).then(setSquad); }, [club.id]);
  useEffect(() => { if (tab === 'pulse') fp.getAggregate('dream', club.id).then(setAgg); }, [tab, club.id]);
  const usedKeys = useMemo(() => new Set(picks.filter(Boolean).map(p => (p as fp.PulsePick).player_key)), [picks]);

  const changeFormation = (f: string) => {
    const nf = FORMATIONS[f]; const pools: Record<fp.Bucket, fp.PulsePick[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    picks.forEach(p => { if (p) pools[p.position].push(p); });
    const next: (fp.PulsePick | null)[] = Array(11).fill(null);
    nf.forEach((b, slot) => { const pl = pools[b].shift(); if (pl) next[slot] = { ...pl, slot, position: b }; });
    setFormation(f); setPicks(next);
  };
  const assign = (slot: number, pl: fp.SquadPlayer | null) => {
    setPicks(prev => { const next = [...prev]; if (pl) { for (let i = 0; i < next.length; i++) if (next[i]?.player_key === pl.id) next[i] = null; next[slot] = { player_key: pl.id, name: pl.name, photo: pl.photo, position: formation[slot], is_starter: true, slot }; } else next[slot] = null; return next; });
    setPickFor(null);
  };
  const filled = picks.filter(Boolean).length;
  const buys = picks.filter(p => p && !squadIds.has(p.player_key)).length;
  return (
    <div className="space-y-3">
      <Tabs tab={tab} setTab={setTab} />
      {tab === 'mine' ? (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {Object.keys(FORMATIONS).map(f => (
              <button key={f} onClick={() => changeFormation(f)} className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap ${fname === f ? 'bg-electric-blue text-white' : 'bg-navy-accent text-text-secondary'}`}>{f}</button>
            ))}
          </div>
          <Pitch formation={formation} picks={picks} onSlot={setPickFor} isBuy={k => !squadIds.has(k)} />
          <p className="text-center text-[11px] text-warm-yellow h-4">{buys > 0 ? `€ ${buys} signing${buys > 1 ? 's' : ''} from outside the club` : ''}</p>
          <SaveLine state={saveState} filled={filled} done="✓ Saved — see what every fan wants in The Pulse" />
        </>
      ) : <PulseView agg={agg} squadIds={squadIds} />}
      {pickFor !== null && (
        <SquadPicker bucket={formation[pickFor]} defaults={squad.filter(s => s.position === formation[pickFor])} clubName={club.name} usedKeys={usedKeys} currentKey={picks[pickFor]?.player_key} onClose={() => setPickFor(null)} onPick={p => assign(pickFor, p)} onClear={() => assign(pickFor, null)} />
      )}
    </div>
  );
};

// ── Small shared bits ───────────────────────────────────────────────────────
const Tabs: React.FC<{ tab: 'mine' | 'pulse'; setTab: (t: 'mine' | 'pulse') => void }> = ({ tab, setTab }) => (
  <div className="flex bg-navy-accent rounded-xl p-1">
    {(['mine', 'pulse'] as const).map(t => (
      <button key={t} onClick={() => setTab(t)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold ${tab === t ? 'bg-electric-blue text-white' : 'text-text-secondary'}`}>
        {t === 'mine' ? <><UsersIcon size={15} /> My XI</> : <><BarChart3 size={15} /> The Pulse</>}
      </button>
    ))}
  </div>
);
const SaveLine: React.FC<{ state: 'idle' | 'saving' | 'saved'; filled: number; done: string }> = ({ state, filled, done }) => (
  <p className="text-center text-[11px] h-4">
    {state === 'saving' ? <span className="text-text-disabled">Saving…</span>
      : state === 'saved' && filled === 11 ? <span className="text-lime-glow">{done}</span>
      : <span className="text-text-disabled">{filled}/11 picked — tap a spot to choose</span>}
  </p>
);

// ── Legend picker (searchable static) ───────────────────────────────────────
const LegendPicker: React.FC<{ bucket: fp.Bucket; legends: fp.Legend[]; usedKeys: Set<string>; currentKey?: string; onClose: () => void; onPick: (l: fp.Legend) => void; onClear: () => void }> = ({ bucket, legends, usedKeys, currentKey, onClose, onPick, onClear }) => {
  const [q, setQ] = useState('');
  const list = useMemo(() => { const f = norm(q.trim()); return f ? legends.filter(l => norm(l.name).includes(f)) : legends; }, [q, legends]);
  return (
    <Sheet title={bucket === 'GK' ? 'Pick a Goalkeeper' : 'Pick an outfield legend'} onClose={onClose}>
      <SearchBox q={q} setQ={setQ} placeholder={`Search ${legends.length} legends…`} />
      <div className="overflow-y-auto space-y-1 flex-1">
        {currentKey && <button onClick={onClear} className="w-full text-left text-sm text-hot-red py-2">Clear this spot</button>}
        {list.slice(0, 80).map(l => <Row key={l.id} name={l.name} photo={l.photo_url} bucket={bucket} current={l.player_key === currentKey} used={usedKeys.has(l.player_key) && l.player_key !== currentKey} onClick={() => onPick(l)} />)}
        {list.length > 80 && <p className="text-center text-[11px] text-text-disabled py-2">+{list.length - 80} more — refine your search</p>}
      </div>
    </Sheet>
  );
};

// ── Squad / transfer picker (async search any player) ───────────────────────
const SquadPicker: React.FC<{ bucket: fp.Bucket; defaults: fp.SquadPlayer[]; clubName: string; usedKeys: Set<string>; currentKey?: string; onClose: () => void; onPick: (p: fp.SquadPlayer) => void; onClear: () => void }> = ({ bucket, defaults, clubName, usedKeys, currentKey, onClose, onPick, onClear }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<fp.SquadPlayer[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    setBusy(true);
    const t = setTimeout(async () => { setResults(await fp.searchPlayers(q.trim(), bucket)); setBusy(false); }, 300);
    return () => clearTimeout(t);
  }, [q, bucket]);
  const list = q.trim().length >= 2 ? results : defaults;
  return (
    <Sheet title={`Pick a ${BUCKET_LABEL[bucket]}`} onClose={onClose}>
      <SearchBox q={q} setQ={setQ} placeholder={`${clubName} squad · or search any player to buy…`} />
      {busy && <div className="flex justify-center py-2"><Loader2 className="animate-spin text-electric-blue" size={18} /></div>}
      <div className="overflow-y-auto space-y-1 flex-1">
        {currentKey && <button onClick={onClear} className="w-full text-left text-sm text-hot-red py-2">Clear this spot</button>}
        {q.trim().length < 2 && <p className="text-[11px] text-text-disabled px-1">Current squad — or type a name to sign anyone</p>}
        {list.slice(0, 60).map(p => <Row key={p.id} name={p.name} photo={p.photo} bucket={bucket} sub={p.club && p.club !== clubName ? `€ ${p.club}` : undefined} current={p.id === currentKey} used={usedKeys.has(p.id) && p.id !== currentKey} onClick={() => onPick(p)} />)}
      </div>
    </Sheet>
  );
};

const Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[80] flex items-end bg-black/60" onClick={onClose}>
    <div className="w-full max-w-md mx-auto bg-deep-navy rounded-t-2xl max-h-[80vh] flex flex-col p-4" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2"><h3 className="font-bold text-text-primary">{title}</h3><button onClick={onClose}><X size={22} className="text-text-secondary" /></button></div>
      {children}
    </div>
  </div>
);
const SearchBox: React.FC<{ q: string; setQ: (s: string) => void; placeholder: string }> = ({ q, setQ, placeholder }) => (
  <div className="relative mb-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
    <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} className="w-full pl-9 pr-3 py-2 bg-navy-accent border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-electric-blue" /></div>
);
const Row: React.FC<{ name: string; photo?: string | null; bucket: fp.Bucket; sub?: string; current: boolean; used: boolean; onClick: () => void }> = ({ name, photo, bucket, sub, current, used, onClick }) => (
  <button disabled={used} onClick={onClick} className={`w-full flex items-center gap-3 p-2 rounded-lg ${current ? 'bg-electric-blue/15' : 'hover:bg-white/5'} ${used ? 'opacity-40' : ''}`}>
    {photo ? <img src={photo} className="w-9 h-9 rounded-full object-cover" alt="" /> : <div className={`w-9 h-9 rounded-full bg-gradient-to-b ${POS_GRAD[bucket]} flex items-center justify-center text-white font-bold text-xs`}>{initials(name)}</div>}
    <div className="flex-1 text-left min-w-0"><div className="text-text-primary text-sm font-medium truncate">{name}</div>{sub && <div className="text-[10px] text-warm-yellow truncate">{sub}</div>}</div>
    {current ? <Check size={16} className="text-electric-blue" /> : used ? <span className="text-[10px] text-text-disabled">in XI</span> : null}
  </button>
);

// ── Page shell ──────────────────────────────────────────────────────────────
export const FanPulsePage: React.FC<{ profile: Profile | null }> = ({ profile }) => {
  const userId = profile?.id ?? null;
  const [club, setClub] = useState<fp.Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'home' | 'legends' | 'dream'>('home');

  useEffect(() => { if (!userId) { setLoading(false); return; } fp.getFavoriteClub(userId).then(c => { setClub(c); setLoading(false); }); }, [userId]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-electric-blue" size={32} /></div>;
  if (!club) return <ClubPicker onPick={async c => { if (userId) { await fp.setFavoriteClub(userId, c.id); setClub(c); } }} />;

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-3">
        {mode !== 'home' && <button onClick={() => setMode('home')} className="text-text-secondary"><ArrowLeft size={20} /></button>}
        {club.logo ? <img src={club.logo} className="w-9 h-9 object-contain" alt="" /> : <div className="w-9 h-9 rounded-full bg-electric-blue/20 flex items-center justify-center text-electric-blue font-bold text-sm">{initials(club.name)}</div>}
        <div className="flex-1 min-w-0"><h1 className="text-lg font-bold text-text-primary truncate">{club.name}</h1><p className="text-[11px] text-text-secondary">{mode === 'home' ? 'Fan Pulse' : mode === 'legends' ? 'All-time Legends XI' : 'Dream XI · next season'}</p></div>
        {mode === 'home' && <button onClick={() => setClub(null)} className="text-xs text-text-disabled underline">change</button>}
      </div>

      {mode === 'home' ? (
        <div className="space-y-3">
          <HomeCard icon={<Crown className="text-warm-yellow" />} title="Legends XI" desc="Build the club's all-time 4-3-3 — and see the fans' consensus." onClick={() => setMode('legends')} />
          <HomeCard icon={<Sparkles className="text-electric-blue" />} title="Dream XI · next season" desc="The team you want to see — pick anyone, sign new players, vote the pulse." onClick={() => setMode('dream')} />
        </div>
      ) : mode === 'legends' && userId ? <LegendsBuilder club={club} userId={userId} /> : userId ? <DreamBuilder club={club} userId={userId} /> : null}
    </div>
  );
};

const HomeCard: React.FC<{ icon: React.ReactNode; title: string; desc: string; onClick: () => void }> = ({ icon, title, desc, onClick }) => (
  <button onClick={onClick} className="w-full text-left bg-navy-accent rounded-2xl p-4 flex items-center gap-4 hover:bg-white/5 border border-white/5">
    <div className="w-11 h-11 rounded-xl bg-deep-navy flex items-center justify-center">{icon}</div>
    <div className="flex-1 min-w-0"><h3 className="font-bold text-text-primary">{title}</h3><p className="text-xs text-text-secondary">{desc}</p></div>
  </button>
);

const ClubPicker: React.FC<{ onPick: (c: fp.Club) => void }> = ({ onPick }) => {
  const [q, setQ] = useState(''); const [results, setResults] = useState<fp.Club[]>([]); const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.trim().length < 2) { setResults([]); return; } setBusy(true); const t = setTimeout(async () => { setResults(await fp.searchClubs(q.trim())); setBusy(false); }, 300); return () => clearTimeout(t); }, [q]);
  return (
    <div className="space-y-4 py-6">
      <div className="text-center"><div className="text-5xl mb-2">❤️</div><h1 className="text-2xl font-bold text-text-primary">Pick your club</h1><p className="text-text-secondary text-sm mt-1">Your team for Fan Pulse — build legend & dream XIs.</p></div>
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-disabled" />
        <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder="Search a club… (e.g. Barcelona)" className="w-full pl-10 pr-4 py-3 bg-navy-accent border border-white/10 rounded-xl text-text-primary focus:outline-none focus:border-electric-blue" /></div>
      {busy && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-electric-blue" size={22} /></div>}
      <div className="space-y-1.5">{results.map(c => (
        <button key={c.id} onClick={() => onPick(c)} className="w-full flex items-center gap-3 p-3 bg-navy-accent rounded-xl hover:bg-white/5">
          {c.logo ? <img src={c.logo} className="w-8 h-8 object-contain" alt="" /> : <div className="w-8 h-8 rounded-full bg-electric-blue/20 flex items-center justify-center text-electric-blue text-xs font-bold">{initials(c.name)}</div>}
          <span className="text-text-primary font-medium">{c.name}</span>
        </button>))}</div>
    </div>
  );
};

export default FanPulsePage;
