import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, X, Check, Star, BarChart3, Users as UsersIcon } from 'lucide-react';
import { Profile } from '../types';
import * as fp from '../services/fanPulseService';

// 4-3-3 — slot 0 GK · 1-4 DEF · 5-7 MID · 8-10 FWD
const BUCKETS: fp.Bucket[] = ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'];
const ROWS: { bucket: fp.Bucket; slots: number[] }[] = [
  { bucket: 'FWD', slots: [8, 9, 10] },
  { bucket: 'MID', slots: [5, 6, 7] },
  { bucket: 'DEF', slots: [1, 2, 3, 4] },
  { bucket: 'GK', slots: [0] },
];
const POS_GRAD: Record<fp.Bucket, string> = { GK: 'from-amber-400 to-amber-600', DEF: 'from-emerald-400 to-emerald-600', MID: 'from-blue-400 to-blue-600', FWD: 'from-red-400 to-red-600' };
const BUCKET_LABEL: Record<fp.Bucket, string> = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' };
const surname = (n: string) => (n || '').trim().split(' ').slice(-1)[0] || '';
const initials = (n: string) => (n || '').trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// ── Player token (photo or initials) ────────────────────────────────────────
const Token: React.FC<{ name?: string; photo?: string | null; bucket: fp.Bucket; empty?: boolean; onTap?: () => void; sub?: string }> = ({ name, photo, bucket, empty, onTap, sub }) => {
  const [err, setErr] = useState(false);
  return (
    <button onClick={onTap} className="flex flex-col items-center gap-0.5 w-[64px]">
      <div className="relative w-12 h-12">
        {empty ? (
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/40 bg-deep-navy/60 flex items-center justify-center text-white/50 text-xl font-bold">+</div>
        ) : photo && !err ? (
          <img src={photo} alt="" onError={() => setErr(true)} className="w-12 h-12 rounded-full object-cover border-2 border-white/50 shadow" />
        ) : (
          <div className={`w-12 h-12 rounded-full bg-gradient-to-b ${POS_GRAD[bucket]} border-2 border-white/50 shadow flex items-center justify-center text-white font-bold text-sm`}>{initials(name || '')}</div>
        )}
      </div>
      <span className={`text-[10px] font-semibold text-center leading-tight truncate max-w-[64px] ${empty ? 'text-white/50' : 'text-white'}`}>
        {empty ? bucket : surname(name || '')}
      </span>
      {sub && <span className="text-[9px] font-bold text-lime-glow leading-none">{sub}</span>}
    </button>
  );
};

// ── Pitch ───────────────────────────────────────────────────────────────────
const Pitch: React.FC<{ picks: (fp.PulsePick | null)[]; onSlot?: (i: number) => void; subOf?: (i: number) => string | undefined }> = ({ picks, onSlot, subOf }) => (
  <div className="rounded-2xl p-3 bg-gradient-to-b from-emerald-800/40 to-emerald-950/40 border border-emerald-500/20">
    <div className="relative rounded-xl overflow-hidden" style={{ background: 'repeating-linear-gradient(180deg,#0c4a3e22 0 28px,#0c4a3e11 28px 56px)' }}>
      <div className="flex flex-col gap-3 py-4">
        {ROWS.map(row => (
          <div key={row.bucket} className="flex justify-around items-center px-1">
            {row.slots.map(i => {
              const p = picks[i];
              return <Token key={i} name={p?.name} photo={p?.photo} bucket={BUCKETS[i]} empty={!p} onTap={onSlot ? () => onSlot(i) : undefined} sub={subOf?.(i)} />;
            })}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const FanPulsePage: React.FC<{ profile: Profile | null }> = ({ profile }) => {
  const userId = profile?.id ?? null;
  const [club, setClub] = useState<fp.Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [legends, setLegends] = useState<fp.Legend[]>([]);
  const [picks, setPicks] = useState<(fp.PulsePick | null)[]>(Array(11).fill(null));
  const [tab, setTab] = useState<'mine' | 'pulse'>('mine');
  const [agg, setAgg] = useState<{ participants: number; players: fp.AggPlayer[] }>({ participants: 0, players: [] });
  const [pickFor, setPickFor] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const first = useRef(true);

  // Load favorite club
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    fp.getFavoriteClub(userId).then(c => { setClub(c); setLoading(false); });
  }, [userId]);

  // Load legends + my XI for the club
  useEffect(() => {
    if (!club || !userId) return;
    setLoading(true);
    Promise.all([fp.getLegends(club.id), fp.getMyEntry(userId, 'legends', club.id)]).then(([lg, mine]) => {
      setLegends(lg);
      const arr: (fp.PulsePick | null)[] = Array(11).fill(null);
      for (const pk of mine) if (pk.slot >= 0 && pk.slot < 11) arr[pk.slot] = pk;
      setPicks(arr);
      first.current = true;
      setSaveState(mine.length ? 'saved' : 'idle');
      setLoading(false);
    });
  }, [club, userId]);

  // Auto-save XI (debounced, silent)
  useEffect(() => {
    if (!club || !userId) return;
    if (first.current) { first.current = false; return; }
    setSaveState('saving');
    const t = setTimeout(async () => {
      const list = picks.filter(Boolean) as fp.PulsePick[];
      const { error } = await fp.saveEntry(userId, 'legends', club.id, '4-3-3', list);
      setSaveState(error ? 'idle' : 'saved');
    }, 700);
    return () => clearTimeout(t);
  }, [picks]);

  const loadAgg = () => { if (club) fp.getAggregate('legends', club.id).then(setAgg); };
  useEffect(() => { if (tab === 'pulse') loadAgg(); }, [tab, club]);

  const usedKeys = useMemo(() => new Set(picks.filter(Boolean).map(p => (p as fp.PulsePick).player_key)), [picks]);

  const assign = (slot: number, legend: fp.Legend | null) => {
    setPicks(prev => {
      const next = [...prev];
      if (legend) {
        // remove this legend from any other slot, then place it
        for (let i = 0; i < next.length; i++) if (next[i]?.player_key === legend.player_key) next[i] = null;
        next[slot] = { player_key: legend.player_key, name: legend.name, photo: legend.photo_url, position: BUCKETS[slot], is_starter: true, slot };
      } else next[slot] = null;
      return next;
    });
    setPickFor(null);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-electric-blue" size={32} /></div>;
  if (!club) return <ClubPicker onPick={async (c) => { if (userId) { await fp.setFavoriteClub(userId, c.id); setClub(c); } }} />;

  const filledCount = picks.filter(Boolean).length;

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {club.logo ? <img src={club.logo} className="w-10 h-10 object-contain" alt="" /> : <div className="w-10 h-10 rounded-full bg-electric-blue/20 flex items-center justify-center text-electric-blue font-bold">{initials(club.name)}</div>}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-text-primary truncate">{club.name}</h1>
          <p className="text-xs text-text-secondary">Legends XI · build your all-time 4-3-3</p>
        </div>
        <button onClick={() => setClub(null)} className="text-xs text-text-disabled underline">change</button>
      </div>

      {/* Tabs */}
      <div className="flex bg-navy-accent rounded-xl p-1">
        {(['mine', 'pulse'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold ${tab === t ? 'bg-electric-blue text-white' : 'text-text-secondary'}`}>
            {t === 'mine' ? <><UsersIcon size={15} /> My XI</> : <><BarChart3 size={15} /> The Pulse</>}
          </button>
        ))}
      </div>

      {legends.length === 0 ? (
        <div className="card-base p-8 text-center"><div className="text-5xl mb-3">🏟️</div><p className="text-text-secondary font-medium">Legends coming soon for {club.name}</p></div>
      ) : tab === 'mine' ? (
        <>
          <Pitch picks={picks} onSlot={setPickFor} />
          <p className="text-center text-[11px] h-4">
            {saveState === 'saving' ? <span className="text-text-disabled">Saving…</span>
              : saveState === 'saved' && filledCount === 11 ? <span className="text-lime-glow">✓ Your XI is saved — see The Pulse</span>
              : <span className="text-text-disabled">{filledCount}/11 picked — tap a spot to choose a legend</span>}
          </p>
        </>
      ) : (
        <PulseView agg={agg} />
      )}

      {/* Legend picker */}
      {pickFor !== null && (
        <LegendPicker
          bucket={BUCKETS[pickFor]}
          legends={legends.filter(l => l.position === BUCKETS[pickFor])}
          usedKeys={usedKeys}
          currentKey={picks[pickFor]?.player_key}
          onClose={() => setPickFor(null)}
          onPick={(l) => assign(pickFor, l)}
          onClear={() => assign(pickFor, null)}
        />
      )}
    </div>
  );
};

// ── Legend picker bottom sheet (searchable, notability-sorted) ──────────────
const LegendPicker: React.FC<{ bucket: fp.Bucket; legends: fp.Legend[]; usedKeys: Set<string>; currentKey?: string; onClose: () => void; onPick: (l: fp.Legend) => void; onClear: () => void }> = ({ bucket, legends, usedKeys, currentKey, onClose, onPick, onClear }) => {
  const [q, setQ] = useState('');
  const list = useMemo(() => { const f = q.trim().toLowerCase(); return f ? legends.filter(l => l.name.toLowerCase().includes(f)) : legends; }, [q, legends]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md mx-auto bg-deep-navy rounded-t-2xl max-h-[80vh] flex flex-col p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-text-primary">Pick a {BUCKET_LABEL[bucket]}</h3>
          <button onClick={onClose}><X size={22} className="text-text-secondary" /></button>
        </div>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${legends.length} legends…`} className="w-full pl-9 pr-3 py-2 bg-navy-accent border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-electric-blue" />
        </div>
        <div className="overflow-y-auto space-y-1 flex-1">
          {currentKey && <button onClick={onClear} className="w-full text-left text-sm text-hot-red py-2">Clear this spot</button>}
          {list.slice(0, 80).map(l => {
            const used = usedKeys.has(l.player_key) && l.player_key !== currentKey;
            return (
              <button key={l.id} disabled={used} onClick={() => onPick(l)} className={`w-full flex items-center gap-3 p-2 rounded-lg ${l.player_key === currentKey ? 'bg-electric-blue/15' : 'hover:bg-white/5'} ${used ? 'opacity-40' : ''}`}>
                {l.photo_url ? <img src={l.photo_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                  : <div className={`w-9 h-9 rounded-full bg-gradient-to-b ${POS_GRAD[bucket]} flex items-center justify-center text-white font-bold text-xs`}>{initials(l.name)}</div>}
                <span className="flex-1 text-left text-text-primary text-sm font-medium">{l.name}</span>
                {l.player_key === currentKey ? <Check size={16} className="text-electric-blue" /> : used ? <span className="text-[10px] text-text-disabled">in XI</span> : null}
              </button>
            );
          })}
          {list.length > 80 && <p className="text-center text-[11px] text-text-disabled py-2">+{list.length - 80} more — refine your search</p>}
        </div>
      </div>
    </div>
  );
};

// ── The Pulse: % of fans per player, grouped by position ────────────────────
const PulseView: React.FC<{ agg: { participants: number; players: fp.AggPlayer[] } }> = ({ agg }) => {
  const order: fp.Bucket[] = ['GK', 'DEF', 'MID', 'FWD'];
  const topN: Record<fp.Bucket, number> = { GK: 1, DEF: 4, MID: 3, FWD: 3 };
  if (agg.participants === 0) return <div className="card-base p-8 text-center"><div className="text-4xl mb-2">📊</div><p className="text-text-secondary">No fan has voted yet. Be the first — build your XI!</p></div>;
  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-text-secondary"><b className="text-text-primary">{agg.participants}</b> fan{agg.participants > 1 ? 's' : ''} have voted</p>
      {order.map(b => {
        const list = agg.players.filter(p => p.position === b).sort((a, c) => c.pct - a.pct);
        if (!list.length) return null;
        return (
          <div key={b}>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">{BUCKET_LABEL[b]}s</p>
            <div className="space-y-1.5">
              {list.map((p, i) => (
                <div key={p.player_key} className="bg-navy-accent rounded-lg p-2 flex items-center gap-2">
                  {p.photo ? <img src={p.photo} className="w-8 h-8 rounded-full object-cover" alt="" />
                    : <div className={`w-8 h-8 rounded-full bg-gradient-to-b ${POS_GRAD[b]} flex items-center justify-center text-white font-bold text-[10px]`}>{initials(p.name)}</div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {i < topN[b] && <Star size={11} className="text-warm-yellow shrink-0" />}
                      <span className="text-sm text-text-primary font-medium truncate">{p.name}</span>
                    </div>
                    <div className="h-1.5 mt-1 rounded-full bg-deep-navy overflow-hidden"><div className="h-full bg-electric-blue rounded-full" style={{ width: `${p.pct}%` }} /></div>
                  </div>
                  <span className="text-sm font-bold text-electric-blue tabular-nums w-10 text-right">{p.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-center text-[11px] text-text-disabled">⭐ = part of the fans' consensus XI</p>
    </div>
  );
};

// ── Club picker (first run) ─────────────────────────────────────────────────
const ClubPicker: React.FC<{ onPick: (c: fp.Club) => void }> = ({ onPick }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<fp.Club[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    setBusy(true);
    const t = setTimeout(async () => { setResults(await fp.searchClubs(q.trim())); setBusy(false); }, 300);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="space-y-4 py-6">
      <div className="text-center"><div className="text-5xl mb-2">❤️</div><h1 className="text-2xl font-bold text-text-primary">Pick your club</h1><p className="text-text-secondary text-sm mt-1">Your team for Fan Pulse — build legend & dream XIs.</p></div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-disabled" />
        <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder="Search a club… (e.g. Barcelona)"
          className="w-full pl-10 pr-4 py-3 bg-navy-accent border border-white/10 rounded-xl text-text-primary focus:outline-none focus:border-electric-blue" />
      </div>
      {busy && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-electric-blue" size={22} /></div>}
      <div className="space-y-1.5">
        {results.map(c => (
          <button key={c.id} onClick={() => onPick(c)} className="w-full flex items-center gap-3 p-3 bg-navy-accent rounded-xl hover:bg-white/5">
            {c.logo ? <img src={c.logo} className="w-8 h-8 object-contain" alt="" /> : <div className="w-8 h-8 rounded-full bg-electric-blue/20 flex items-center justify-center text-electric-blue text-xs font-bold">{initials(c.name)}</div>}
            <span className="text-text-primary font-medium">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default FanPulsePage;
