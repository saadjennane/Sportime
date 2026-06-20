import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, X, Check, Star, BarChart3, Users as UsersIcon, ArrowLeft, ShoppingCart, Crown, Sparkles, Share2 } from 'lucide-react';
import { Profile } from '../types';
import * as fp from '../services/fanPulseService';

const POS_GRAD: Record<fp.Bucket, string> = { GK: 'from-amber-400 to-amber-600', DEF: 'from-emerald-400 to-emerald-600', MID: 'from-blue-400 to-blue-600', FWD: 'from-red-400 to-red-600' };
const BUCKET_LABEL: Record<fp.Bucket, string> = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' };
const surname = (n: string) => (n || '').trim().split(' ').slice(-1)[0] || '';
const initials = (n: string) => (n || '').trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
// Accent-insensitive: "sua" should match "Suárez".
const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Formations as ordered rows (bottom GK → top attack). Keeps slot→bucket stable
// while letting each shape render with its real rows — e.g. 4-2-3-1 = 4 DEF / 2 DM /
// 3 AM / 1 FWD instead of collapsing every midfielder into a single line.
type FRow = { bucket: fp.Bucket; slots: number[] };
const FORMATION_DEF: Record<string, { bucket: fp.Bucket; n: number }[]> = {
  '4-3-3':   [{ bucket: 'GK', n: 1 }, { bucket: 'DEF', n: 4 }, { bucket: 'MID', n: 3 }, { bucket: 'FWD', n: 3 }],
  '4-4-2':   [{ bucket: 'GK', n: 1 }, { bucket: 'DEF', n: 4 }, { bucket: 'MID', n: 4 }, { bucket: 'FWD', n: 2 }],
  '3-5-2':   [{ bucket: 'GK', n: 1 }, { bucket: 'DEF', n: 3 }, { bucket: 'MID', n: 5 }, { bucket: 'FWD', n: 2 }],
  '4-2-3-1': [{ bucket: 'GK', n: 1 }, { bucket: 'DEF', n: 4 }, { bucket: 'MID', n: 2 }, { bucket: 'MID', n: 3 }, { bucket: 'FWD', n: 1 }],
};
const buildFormation = (def: { bucket: fp.Bucket; n: number }[]) => {
  const flat: fp.Bucket[] = []; const rows: FRow[] = []; let slot = 0;
  for (const r of def) { const slots: number[] = []; for (let k = 0; k < r.n; k++) { flat.push(r.bucket); slots.push(slot++); } rows.push({ bucket: r.bucket, slots }); }
  return { flat, rows };
};
const BUILT: Record<string, { flat: fp.Bucket[]; rows: FRow[] }> =
  Object.fromEntries(Object.entries(FORMATION_DEF).map(([k, v]) => [k, buildFormation(v)]));
const FORMATIONS: Record<string, fp.Bucket[]> =
  Object.fromEntries(Object.entries(BUILT).map(([k, v]) => [k, v.flat]));
// Rows for rendering, top (attack) → bottom (GK).
const renderRows = (fname: string): FRow[] => [...(BUILT[fname] ?? BUILT['4-3-3']).rows].reverse();

// Format the XI as shareable text, e.g. "GK: Valdés / DEF: Abidal, Piqué, …".
const lineupText = (clubName: string, fname: string, picks: (fp.PulsePick | null)[], label: string): string => {
  const formation = FORMATIONS[fname] ?? FORMATIONS['4-3-3'];
  const lines = (['GK', 'DEF', 'MID', 'FWD'] as fp.Bucket[]).map(b => {
    const ns = formation.map((bk, i) => bk === b ? picks[i] : null).filter(Boolean).map(p => surname((p as fp.PulsePick).name));
    return ns.length ? `${b}: ${ns.join(', ')}` : null;
  }).filter(Boolean);
  return `${clubName} — ${label} (${fname})\n${lines.join('\n')}\n\nBuilt on Sportime · Fan Pulse`;
};

// Build share text for the aggregated consensus XI (laid out by slot).
const consensusText = (clubName: string, fname: string, agg: fp.Aggregate, label: string): string => {
  const picks: (fp.PulsePick | null)[] = Array(11).fill(null);
  agg.slots.forEach(s => { if (s.slot >= 0 && s.slot < 11) picks[s.slot] = { player_key: s.player_key, name: s.name, photo: s.photo, position: s.position, is_starter: true, slot: s.slot }; });
  return lineupText(clubName, fname, picks, label);
};

// Native share sheet (iOS WKWebView supports the Web Share API); clipboard fallback.
const shareLineup = async (text: string) => {
  try { if ((navigator as any).share) { await (navigator as any).share({ title: 'My Fan Pulse XI', text }); return; } } catch { return; /* user cancelled */ }
  try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
};

// ── Player token ────────────────────────────────────────────────────────────
const Token: React.FC<{ name?: string; photo?: string | null; bucket: fp.Bucket; empty?: boolean; onTap?: () => void; buy?: boolean; badge?: string; injured?: boolean }> = ({ name, photo, bucket, empty, onTap, buy, badge, injured }) => {
  const [err, setErr] = useState(false);
  return (
    <button onClick={onTap} className="flex flex-col items-center gap-1 w-[72px]">
      <div className="relative w-14 h-14">
        {empty ? (
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-neon-cyan/40 bg-deep-navy/50 flex items-center justify-center text-neon-cyan/60 text-xl font-bold">+</div>
        ) : photo && !err ? (
          <img src={photo} alt="" onError={() => setErr(true)} className="w-14 h-14 rounded-full object-cover border-2 border-white/60 shadow-lg" />
        ) : (
          <div className={`w-14 h-14 rounded-full bg-gradient-to-b ${POS_GRAD[bucket]} border-2 border-white/60 shadow-lg flex items-center justify-center text-white font-bold text-base`}>{initials(name || '')}</div>
        )}
        {buy && <span className="absolute -top-1 -right-1 bg-warm-yellow text-deep-navy text-[8px] font-extrabold rounded-full w-4 h-4 flex items-center justify-center">€</span>}
      </div>
      {/* name pill (with an injury cross beside it when injured) */}
      <span className={`px-1.5 py-[3px] rounded-md text-[10px] font-bold text-center leading-none truncate max-w-[72px] border inline-flex items-center gap-1 ${empty ? 'bg-deep-navy/40 border-white/10 text-white/45' : 'bg-deep-navy/90 border-neon-cyan/35 text-white shadow'}`}>
        <span className="truncate">{empty ? bucket : surname(name || '')}</span>
        {injured && <span className="text-hot-red font-extrabold shrink-0" title="Injured">✕</span>}
      </span>
      {badge && <span className="px-1.5 py-[2px] rounded-md bg-electric-blue/20 border border-electric-blue/40 text-[9px] font-extrabold text-electric-blue leading-none">{badge}</span>}
    </button>
  );
};

// Shared pitch chrome — a clean "lineup builder" field: dark charcoal stripes with
// crisp Sportime-cyan markings (center circle, halfway line, boxes + D-arcs).
const PitchMarkings: React.FC = () => (
  <svg className="absolute inset-0 w-full h-full text-neon-cyan/30" viewBox="0 0 100 150" preserveAspectRatio="none"
    fill="none" stroke="currentColor" strokeWidth="0.5" style={{ vectorEffect: 'non-scaling-stroke' } as any}>
    <rect x="1" y="1" width="98" height="148" rx="2" />
    {/* halfway line + centre circle/spot */}
    <line x1="1" y1="75" x2="99" y2="75" />
    <circle cx="50" cy="75" r="13" />
    <circle cx="50" cy="75" r="0.8" fill="currentColor" stroke="none" />
    {/* top goal: penalty box, six-yard box, penalty arc */}
    <path d="M26 1 V25 H74 V1" />
    <path d="M39 1 V9 H61 V1" />
    <path d="M40 25 A 12 12 0 0 0 60 25" />
    <circle cx="50" cy="17" r="0.8" fill="currentColor" stroke="none" />
    {/* bottom goal (mirrored) */}
    <path d="M26 149 V125 H74 V149" />
    <path d="M39 149 V141 H61 V149" />
    <path d="M40 125 A 12 12 0 0 1 60 125" />
    <circle cx="50" cy="133" r="0.8" fill="currentColor" stroke="none" />
  </svg>
);

// Coach badge shown top-left of the pitch — selectable on My XI, read-only (with %)
// on The Pulse.
const CoachChip: React.FC<{ coach?: { name: string; photo: string | null } | null; onTap?: () => void; badge?: string }> = ({ coach, onTap, badge }) => {
  const [err, setErr] = useState(false);
  return (
    <button onClick={onTap} disabled={!onTap} className="flex flex-col items-center gap-0.5 pointer-events-auto active:scale-95">
      <div className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center bg-deep-navy/70 border-2 ${coach ? 'border-warm-yellow/70' : 'border-dashed border-warm-yellow/50'}`}>
        {coach?.photo && !err ? <img src={coach.photo} alt="" onError={() => setErr(true)} className="w-full h-full object-cover" />
          : coach ? <span className="text-warm-yellow font-bold text-sm">{initials(coach.name)}</span>
          : <span className="text-warm-yellow/70 text-lg font-bold">+</span>}
      </div>
      <span className="px-1.5 py-[2px] rounded-md bg-deep-navy/85 border border-warm-yellow/30 text-[9px] font-bold tracking-wide text-warm-yellow/90 max-w-[60px] truncate">{coach ? surname(coach.name) : 'COACH'}</span>
      {badge && <span className="px-1.5 py-[2px] rounded-md bg-warm-yellow/20 border border-warm-yellow/40 text-[9px] font-extrabold text-warm-yellow leading-none">{badge}</span>}
    </button>
  );
};

const PitchField: React.FC<{ children: React.ReactNode; onShare?: () => void; tall?: boolean; topRight?: React.ReactNode; coach?: { name: string; photo: string | null } | null; onCoach?: () => void; coachBadge?: string; hideCoach?: boolean }> = ({ children, onShare, tall, topRight, coach, onCoach, coachBadge, hideCoach }) => (
  <div className="relative rounded-2xl overflow-hidden border border-neon-cyan/20 bg-[#0c1828]">
    {/* field layer — stripes + markings + watermark tilted together for a subtle,
        coherent perspective (the goal recedes); tokens stay upright above it */}
    <div className="absolute inset-0" style={{ perspective: '680px' }}>
      <div className="absolute -inset-x-10 -top-12 bottom-0" style={{ transformOrigin: 'center bottom', transform: 'rotateX(24deg)' }}>
        <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(180deg,#13243a 0 12.5%,#0f1d30 12.5% 25%)' }} />
        <PitchMarkings />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(120% 60% at 50% 0%, rgba(34,211,238,0.08), transparent 55%)' }} />
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-white/[0.05] font-extrabold tracking-[0.25em] text-base select-none pointer-events-none" style={{ writingMode: 'vertical-rl' }}>SPORTIME</span>
        <span className="absolute right-1 top-1/2 text-white/[0.05] font-extrabold tracking-[0.25em] text-base select-none pointer-events-none" style={{ writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}>SPORTIME</span>
      </div>
    </div>
    {/* top bar: coach (left) · info + share (right) */}
    <div className="absolute top-2 inset-x-2 z-10 flex items-start justify-between pointer-events-none">
      {hideCoach ? <div /> : <CoachChip coach={coach} onTap={onCoach} badge={coachBadge} />}
      <div className="flex items-center gap-2 pointer-events-auto">
        {topRight}
        {onShare && (
          <button onClick={onShare} aria-label="Share XI" className="w-8 h-8 rounded-full bg-deep-navy/85 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan active:scale-95">
            <Share2 size={15} />
          </button>
        )}
      </div>
    </div>
    {/* upright tokens — The Pulse (tall) sits a bit longer than My XI */}
    <div className={`relative flex flex-col px-2 ${tall ? 'gap-11 py-12' : 'gap-9 py-10'}`}>{children}</div>
  </div>
);

// Match the tilted field: top (far) rows sit narrower and a touch smaller so the
// upright tokens read as receding into the distance.
const rowDepth = (ri: number, total: number): React.CSSProperties => {
  const t = total <= 1 ? 1 : ri / (total - 1); // 0 = far/top, 1 = near/bottom
  return { paddingInline: `${(1 - t) * 15}%`, transform: `scale(${0.86 + 0.14 * t})` };
};

const Pitch: React.FC<{ fname: string; picks: (fp.PulsePick | null)[]; onSlot?: (i: number) => void; isBuy?: (key: string) => boolean; onShare?: () => void; coach?: fp.CoachPick | null; onCoach?: () => void; hideCoach?: boolean; injuredKeys?: Set<string> }> = ({ fname, picks, onSlot, isBuy, onShare, coach, onCoach, hideCoach, injuredKeys }) => {
  const formation = FORMATIONS[fname] ?? FORMATIONS['4-3-3'];
  const rows = renderRows(fname);
  return (
    <PitchField onShare={onShare} coach={coach} onCoach={onCoach} hideCoach={hideCoach}>
      {rows.map((row, ri) => (
        <div key={ri} className="flex justify-around items-center px-1" style={rowDepth(ri, rows.length)}>
          {row.slots.map(i => { const p = picks[i]; return <Token key={i} name={p?.name} photo={p?.photo} bucket={formation[i]} empty={!p} onTap={onSlot ? () => onSlot(i) : undefined} buy={p && isBuy ? isBuy(p.player_key) : false} injured={!!(p && injuredKeys?.has(p.player_key))} />; })}
        </div>
      ))}
    </PitchField>
  );
};

// ── Consensus XI on a pitch — the fan-favourite player per *slot*, so the layout
// stays coherent with how fans picked (and mirrors a single voter exactly). Falls
// back to filling each row by pick % when a slot has no data (legacy entries).
const ConsensusXI: React.FC<{ agg: fp.Aggregate; fname: string; squadIds?: Set<string>; onShare?: () => void; topRight?: React.ReactNode; hideCoach?: boolean }> = ({ agg, fname, squadIds, onShare, topRight, hideCoach }) => {
  const formation = FORMATIONS[fname] ?? FORMATIONS['4-3-3'];
  const bySlot = new Map<number, fp.AggSlot>(agg.slots.map(s => [s.slot, s]));
  const placed = new Set(agg.slots.map(s => s.player_key));
  const leftover: Record<fp.Bucket, fp.AggPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  agg.players.filter(p => !placed.has(p.player_key)).forEach(p => leftover[p.position]?.push(p));
  (Object.keys(leftover) as fp.Bucket[]).forEach(b => leftover[b].sort((a, c) => c.pct - a.pct));
  const rows = renderRows(fname);
  return (
    <PitchField tall onShare={onShare} topRight={topRight} hideCoach={hideCoach}
      coach={agg.coach ? { name: agg.coach.name, photo: agg.coach.photo } : null}
      coachBadge={agg.coach ? `${agg.coach.pct}%` : undefined}>
      {rows.map((row, ri) => (
        <div key={ri} className="flex justify-around items-center px-1" style={rowDepth(ri, rows.length)}>
          {row.slots.map(i => { const p = bySlot.get(i) ?? leftover[formation[i]].shift(); return <Token key={i} name={p?.name} photo={p?.photo} bucket={formation[i]} empty={!p} badge={p ? `${p.pct}%` : undefined} buy={p && squadIds ? !squadIds.has(p.player_key) : false} />; })}
        </div>
      ))}
    </PitchField>
  );
};

// ── Aggregated pulse ────────────────────────────────────────────────────────
const PulseView: React.FC<{ agg: fp.Aggregate; fname: string; clubName: string; label: string; squadIds?: Set<string>; hideCoach?: boolean }> = ({ agg, fname, clubName, label, squadIds, hideCoach }) => {
  if (agg.participants === 0) return <div className="card-base p-8 text-center"><div className="text-4xl mb-2">📊</div><p className="text-text-secondary">No fan has voted yet. Be the first — build your XI!</p></div>;
  const voted = <span className="px-2 py-1 rounded-full bg-deep-navy/85 border border-white/10 text-[11px] text-text-secondary"><b className="text-text-primary">{agg.participants}</b> voted</span>;
  return (
    <div className="space-y-3">
      <ConsensusXI agg={agg} fname={fname} squadIds={squadIds} topRight={voted} hideCoach={hideCoach} onShare={() => shareLineup(consensusText(clubName, fname, agg, label))} />
      <p className="text-center text-[11px] text-text-disabled font-semibold">⚡ The fans' consensus XI — % who picked each player{squadIds ? ' · €  = not in the current squad' : ''}</p>
    </div>
  );
};

// ── Shared builder shell (pitch + auto-save + pulse) ────────────────────────
const usePulseEntry = (userId: string | null, scope: 'legends' | 'dream', teamId: string, defaultFormation: string) => {
  const [formation, setFormation] = useState(defaultFormation);
  const [picks, setPicks] = useState<(fp.PulsePick | null)[]>(Array(11).fill(null));
  const [coach, setCoach] = useState<fp.CoachPick | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const first = useRef(true);
  useEffect(() => {
    if (!userId) return;
    fp.getMyEntry(userId, scope, teamId).then(({ formation: f, picks: mine, coach: c }) => {
      const fr = FORMATIONS[f] ? f : defaultFormation;
      setFormation(fr);
      const arr: (fp.PulsePick | null)[] = Array(11).fill(null);
      for (const pk of mine) if (pk.slot >= 0 && pk.slot < 11) arr[pk.slot] = pk;
      setPicks(arr); setCoach(c); first.current = true; setSaveState(mine.length ? 'saved' : 'idle');
    });
  }, [userId, teamId]);
  useEffect(() => {
    if (!userId || first.current) { first.current = false; return; }
    setSaveState('saving');
    const t = setTimeout(async () => {
      const { error } = await fp.saveEntry(userId, scope, teamId, formation, picks.filter(Boolean) as fp.PulsePick[], undefined, coach);
      setSaveState(error ? 'idle' : 'saved');
    }, 700);
    return () => clearTimeout(t);
  }, [picks, formation, coach]);
  return { formation, setFormation, picks, setPicks, coach, setCoach, saveState };
};

// ── Legends builder ─────────────────────────────────────────────────────────
const LegendsBuilder: React.FC<{ club: fp.Club; userId: string }> = ({ club, userId }) => {
  const [legends, setLegends] = useState<fp.Legend[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [tab, setTab] = useState<'mine' | 'pulse'>('mine');
  const [agg, setAgg] = useState<fp.Aggregate>({ participants: 0, players: [], slots: [], coach: null });
  const [pickFor, setPickFor] = useState<number | null>(null);
  const { picks, setPicks, coach, setCoach, saveState } = usePulseEntry(userId, 'legends', club.id, '4-3-3');
  const [coaches, setCoaches] = useState<fp.Coach[]>([]);
  const [coachPick, setCoachPick] = useState(false);
  const formation = FORMATIONS['4-3-3'];

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setSeeding(false);
    fp.getLegends(club.id).then(async l => {
      if (l.length) { if (!cancelled) { setLegends(l); setLoading(false); } return; }
      // No legends yet for this club → seed them on the fly.
      if (cancelled) return;
      setSeeding(true);
      await fp.seedLegends(club.id, club.name);
      const fresh = await fp.getLegends(club.id);
      if (!cancelled) { setLegends(fresh); setSeeding(false); setLoading(false); }
    });
    fp.getCoaches(club.id).then(setCoaches);
    return () => { cancelled = true; };
  }, [club.id]);
  useEffect(() => { if (tab === 'pulse') fp.getAggregate('legends', club.id).then(setAgg); }, [tab, club.id]);
  const usedKeys = useMemo(() => new Set(picks.filter(Boolean).map(p => (p as fp.PulsePick).player_key)), [picks]);

  const assign = (slot: number, l: fp.Legend | null) => {
    setPicks(prev => { const next = [...prev]; if (l) { for (let i = 0; i < next.length; i++) if (next[i]?.player_key === l.player_key) next[i] = null; next[slot] = { player_key: l.player_key, name: l.name, photo: l.photo_url, position: formation[slot], is_starter: true, slot }; } else next[slot] = null; return next; });
    setPickFor(null);
  };
  if (seeding) return (
    <div className="card-base p-8 text-center">
      {club.logo ? <img src={club.logo} className="w-12 h-12 object-contain mx-auto mb-3" alt="" /> : <div className="text-5xl mb-3">🏟️</div>}
      <Loader2 className="animate-spin text-electric-blue mx-auto mb-3" size={26} />
      <p className="text-text-primary font-bold">Setting up your team…</p>
      <p className="text-text-secondary text-sm mt-1">Gathering {club.name}'s all-time legends.</p>
    </div>
  );
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-electric-blue" size={28} /></div>;
  if (!legends.length) return <div className="card-base p-8 text-center"><div className="text-5xl mb-3">🏟️</div><p className="text-text-secondary font-medium">No all-time legends found for {club.name} yet.</p></div>;
  const filled = picks.filter(Boolean).length;
  return (
    <div className="space-y-3">
      <Tabs tab={tab} setTab={setTab} />
      {tab === 'mine' ? (
        <>
          <Pitch fname="4-3-3" picks={picks} onSlot={setPickFor} coach={coach} onCoach={() => setCoachPick(true)} onShare={() => shareLineup(lineupText(club.name, '4-3-3', picks, 'All-time Legends XI'))} />
          <SaveLine state={saveState} filled={filled} done="✓ Your all-time XI is saved — see The Pulse" />
        </>
      ) : <PulseView agg={agg} fname="4-3-3" clubName={club.name} label="Fans' Legends XI" />}
      {coachPick && <CoachPicker coaches={coaches} currentKey={coach?.coach_key} onClose={() => setCoachPick(false)} onPick={c => { setCoach({ coach_key: c.coach_key, name: c.name, photo: c.photo }); setCoachPick(false); }} onClear={() => { setCoach(null); setCoachPick(false); }} />}
      {pickFor !== null && (
        <LegendPicker bucket={formation[pickFor]} legends={formation[pickFor] === 'GK' ? legends.filter(l => l.position === 'GK') : legends.filter(l => l.position !== 'GK')} usedKeys={usedKeys} currentKey={picks[pickFor]?.player_key} onClose={() => setPickFor(null)} onPick={l => assign(pickFor, l)} onClear={() => assign(pickFor, null)} />
      )}
    </div>
  );
};

// ── Dream builder (XI + bench up to 14 = 25-man squad + sell list) ──────────
const DreamBuilder: React.FC<{ club: fp.Club; userId: string }> = ({ club, userId }) => {
  const [squad, setSquad] = useState<fp.SquadPlayer[]>([]);
  const [tab, setTab] = useState<'mine' | 'pulse'>('mine');
  const [agg, setAgg] = useState<fp.Aggregate>({ participants: 0, players: [], slots: [], coach: null });
  const [sellAgg, setSellAgg] = useState<fp.Aggregate>({ participants: 0, players: [], slots: [], coach: null });
  const [pickFor, setPickFor] = useState<number | 'bench' | null>(null);
  const [fname, setFname] = useState('4-3-3');
  const [starters, setStarters] = useState<(fp.PulsePick | null)[]>(Array(11).fill(null));
  const [bench, setBench] = useState<fp.PulsePick[]>([]);
  const [sell, setSell] = useState<fp.SellItem[]>([]);
  const [coach, setCoach] = useState<fp.CoachPick | null>(null);
  const [coaches, setCoaches] = useState<fp.Coach[]>([]);
  const [coachPick, setCoachPick] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const first = useRef(true);
  const formation = FORMATIONS[fname] ?? FORMATIONS['4-3-3'];
  const squadIds = useMemo(() => new Set(squad.map(s => s.id)), [squad]);
  const sellIds = useMemo(() => new Set(sell.map(s => s.player_key)), [sell]);

  useEffect(() => {
    fp.getCurrentSquad(club.id).then(setSquad);
    fp.getCoaches(club.id).then(setCoaches);
    fp.getMyEntry(userId, 'dream', club.id).then(({ formation: f, picks, sell: sl, coach: c }) => {
      setFname(FORMATIONS[f] ? f : '4-3-3');
      const st: (fp.PulsePick | null)[] = Array(11).fill(null); const bn: fp.PulsePick[] = [];
      for (const p of picks) { if (p.is_starter && p.slot >= 0 && p.slot < 11) st[p.slot] = p; else bn.push(p); }
      setStarters(st); setBench(bn); setSell(sl); setCoach(c); first.current = true; setSaveState(picks.length ? 'saved' : 'idle');
    });
  }, [club.id, userId]);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaveState('saving');
    const t = setTimeout(async () => {
      const picks = [
        ...(starters.filter(Boolean) as fp.PulsePick[]).map(p => ({ ...p, is_starter: true })),
        ...bench.map((p, i) => ({ ...p, is_starter: false, slot: 11 + i })),
      ];
      const { error } = await fp.saveEntry(userId, 'dream', club.id, fname, picks, sell, coach);
      setSaveState(error ? 'idle' : 'saved');
    }, 700);
    return () => clearTimeout(t);
  }, [starters, bench, sell, fname, coach]);

  useEffect(() => { if (tab === 'pulse') { fp.getAggregate('dream', club.id).then(setAgg); fp.getSellAggregate(club.id).then(setSellAgg); } }, [tab, club.id]);

  const usedKeys = useMemo(() => new Set([...(starters.filter(Boolean) as fp.PulsePick[]), ...bench].map(p => p.player_key)), [starters, bench]);
  const changeFormation = (f: string) => {
    const nf = FORMATIONS[f]; const pools: Record<fp.Bucket, fp.PulsePick[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    starters.forEach(p => { if (p) pools[p.position].push(p); });
    const next: (fp.PulsePick | null)[] = Array(11).fill(null);
    nf.forEach((b, slot) => { const pl = pools[b].shift(); if (pl) next[slot] = { ...pl, slot, position: b }; });
    setFname(f); setStarters(next);
  };
  const place = (pl: fp.SquadPlayer) => {
    if (typeof pickFor === 'number') {
      const slot = pickFor;
      setStarters(prev => { const next = [...prev]; for (let i = 0; i < next.length; i++) if (next[i]?.player_key === pl.id) next[i] = null; next[slot] = { player_key: pl.id, name: pl.name, photo: pl.photo, position: formation[slot], is_starter: true, slot }; return next; });
      setBench(prev => prev.filter(b => b.player_key !== pl.id));
    } else {
      setBench(prev => (prev.some(b => b.player_key === pl.id) || prev.length >= 14) ? prev : [...prev, { player_key: pl.id, name: pl.name, photo: pl.photo, position: pl.position, is_starter: false, slot: 11 + prev.length }]);
    }
    setPickFor(null);
  };
  const filled = starters.filter(Boolean).length;
  const buys = [...(starters.filter(Boolean) as fp.PulsePick[]), ...bench].filter(p => !squadIds.has(p.player_key)).length;
  const toggleSell = (p: fp.SquadPlayer) => setSell(prev => prev.some(s => s.player_key === p.id) ? prev.filter(s => s.player_key !== p.id) : [...prev, { player_key: p.id, name: p.name, photo: p.photo }]);

  return (
    <div className="space-y-3">
      <Tabs tab={tab} setTab={setTab} />
      {tab === 'mine' ? (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {Object.keys(FORMATIONS).map(f => <button key={f} onClick={() => changeFormation(f)} className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap ${fname === f ? 'bg-electric-blue text-white' : 'bg-navy-accent text-text-secondary'}`}>{f}</button>)}
          </div>
          <Pitch fname={fname} picks={starters} onSlot={i => setPickFor(i)} isBuy={k => !squadIds.has(k)} coach={coach} onCoach={() => setCoachPick(true)} onShare={() => shareLineup(lineupText(club.name, fname, starters, 'Dream XI · next season'))} />

          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Bench · {bench.length}/14</p>
            <div className="flex flex-wrap gap-2">
              {bench.map(b => (
                <button key={b.player_key} onClick={() => setBench(prev => prev.filter(x => x.player_key !== b.player_key))} className="relative">
                  <Token name={b.name} photo={b.photo} bucket={b.position} buy={!squadIds.has(b.player_key)} />
                  <span className="absolute -top-0.5 right-1 bg-hot-red text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center font-bold">×</span>
                </button>
              ))}
              {bench.length < 14 && (
                <button onClick={() => setPickFor('bench')} className="flex flex-col items-center gap-0.5 w-[60px]">
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/40 bg-deep-navy/60 flex items-center justify-center text-white/50 text-xl font-bold">+</div>
                  <span className="text-[10px] font-semibold text-white/50">Add</span>
                </button>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Players to sell <span className="text-text-disabled normal-case lowercase">· tap to flag</span></p>
            {squad.length === 0 ? <span className="text-xs text-text-disabled">Current squad not seeded for this club.</span>
              : (
                <div className="grid grid-cols-2 gap-1.5">
                  {squad.map(s => <button key={s.id} onClick={() => toggleSell(s)} className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border text-left truncate ${sellIds.has(s.id) ? 'border-hot-red bg-hot-red/15 text-hot-red line-through' : 'border-white/10 text-text-secondary'}`}>{s.name}</button>)}
                </div>
              )}
          </div>

          <p className="text-center text-[11px] text-warm-yellow h-4">{buys > 0 ? `€ ${buys} signing${buys > 1 ? 's' : ''} from outside` : ''}</p>
          <SaveLine state={saveState} filled={filled} done="✓ Saved — see what every fan wants in The Pulse" />
        </>
      ) : (
        <div className="space-y-4">
          <PulseView agg={agg} fname={fname} clubName={club.name} label="Fans' Dream XI" squadIds={squadIds} />
          {sellAgg.players.length > 0 && (
            <div>
              <p className="text-xs font-bold text-hot-red uppercase tracking-wider mb-1.5">Fans want to sell</p>
              <div className="space-y-1.5">
                {sellAgg.players.slice(0, 8).map(p => (
                  <div key={p.player_key} className="bg-navy-accent rounded-lg p-2 flex items-center gap-2">
                    {p.photo ? <img src={p.photo} className="w-8 h-8 rounded-full object-cover" alt="" /> : <div className="w-8 h-8 rounded-full bg-hot-red/30 flex items-center justify-center text-white font-bold text-[10px]">{initials(p.name)}</div>}
                    <span className="flex-1 text-sm text-text-primary truncate">{p.name}</span>
                    <div className="h-1.5 w-20 rounded-full bg-deep-navy overflow-hidden"><div className="h-full bg-hot-red rounded-full" style={{ width: `${p.pct}%` }} /></div>
                    <span className="text-sm font-bold text-hot-red tabular-nums w-10 text-right">{p.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {pickFor !== null && (
        <SquadPicker bucket={typeof pickFor === 'number' && formation[pickFor] === 'GK' ? 'GK' : undefined} defaults={typeof pickFor === 'number' ? (formation[pickFor] === 'GK' ? squad.filter(s => s.position === 'GK') : squad.filter(s => s.position !== 'GK')) : squad} clubName={club.name} usedKeys={usedKeys} currentKey={typeof pickFor === 'number' ? starters[pickFor]?.player_key : undefined} onClose={() => setPickFor(null)} onPick={place} onClear={() => { if (typeof pickFor === 'number') { const slot = pickFor; setStarters(prev => { const n = [...prev]; n[slot] = null; return n; }); } setPickFor(null); }} />
      )}
      {coachPick && <CoachPicker coaches={coaches} currentKey={coach?.coach_key} onClose={() => setCoachPick(false)} onPick={c => { setCoach({ coach_key: c.coach_key, name: c.name, photo: c.photo }); setCoachPick(false); }} onClear={() => { setCoach(null); setCoachPick(false); }} />}
    </div>
  );
};

// ── Upcoming match builder (squad-only XI for the next fixture) ─────────────
const MatchBuilder: React.FC<{ club: fp.Club; userId: string }> = ({ club, userId }) => {
  const [fixture, setFixture] = useState<fp.MatchFixture | null | undefined>(undefined);
  const [squad, setSquad] = useState<fp.SquadPlayer[]>([]);
  useEffect(() => { fp.getMatchFixture(club.id).then(setFixture); fp.getCurrentSquad(club.id).then(setSquad); }, [club.id]);
  if (fixture === undefined) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-electric-blue" size={28} /></div>;
  if (!fixture) return (
    <div className="card-base p-8 text-center"><div className="text-5xl mb-3">📅</div>
      <p className="text-text-secondary font-medium">No match scheduled yet</p>
      <p className="text-sm text-text-disabled mt-1">The matchday XI pulse opens as soon as the new season's fixtures are out.</p></div>
  );
  return <MatchXI club={club} userId={userId} fixture={fixture} squad={squad} />;
};

const MatchXI: React.FC<{ club: fp.Club; userId: string; fixture: fp.MatchFixture; squad: fp.SquadPlayer[] }> = ({ club, userId, fixture, squad }) => {
  const [tab, setTab] = useState<'mine' | 'pulse'>('mine');
  const [agg, setAgg] = useState<fp.Aggregate>({ participants: 0, players: [], slots: [], coach: null });
  const [pickFor, setPickFor] = useState<number | null>(null);
  const { picks, setPicks, saveState } = usePulseEntry(userId, 'match', fixture.id, '4-3-3');
  const formation = FORMATIONS['4-3-3'];
  const pool = useMemo<fp.Legend[]>(() => squad.map(s => ({ id: s.id, player_key: s.id, name: s.name, position: s.position, photo_url: s.photo })), [squad]);
  const injuredKeys = useMemo(() => new Set(squad.filter(s => s.injured).map(s => s.id)), [squad]);
  useEffect(() => { if (tab === 'pulse') fp.getAggregate('match', fixture.id).then(setAgg); }, [tab, fixture.id]);
  const usedKeys = useMemo(() => new Set(picks.filter(Boolean).map(p => (p as fp.PulsePick).player_key)), [picks]);
  const assign = (slot: number, l: fp.Legend | null) => { setPicks(prev => { const next = [...prev]; if (l) { for (let i = 0; i < next.length; i++) if (next[i]?.player_key === l.player_key) next[i] = null; next[slot] = { player_key: l.player_key, name: l.name, photo: l.photo_url, position: formation[slot], is_starter: true, slot }; } else next[slot] = null; return next; }); setPickFor(null); };
  const filled = picks.filter(Boolean).length;
  return (
    <div className="space-y-3">
      <div className="bg-navy-accent rounded-xl p-3 text-center text-sm">
        <span className="font-bold text-text-primary">{fixture.home ? club.name : fixture.opponent}</span>
        <span className="text-text-disabled mx-2">vs</span>
        <span className="font-bold text-text-primary">{fixture.home ? fixture.opponent : club.name}</span>
        <p className="text-[11px] text-text-secondary mt-1">{new Date(fixture.date).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
      </div>
      <Tabs tab={tab} setTab={setTab} />
      {tab === 'mine' ? (
        <>
          <Pitch fname="4-3-3" picks={picks} onSlot={setPickFor} hideCoach injuredKeys={injuredKeys} onShare={() => shareLineup(lineupText(club.name, '4-3-3', picks, 'Matchday XI'))} />
          <SaveLine state={saveState} filled={filled} done="✓ Your matchday XI is saved — see The Pulse" />
        </>
      ) : <PulseView agg={agg} fname="4-3-3" clubName={club.name} label="Fans' Matchday XI" hideCoach />}
      {pickFor !== null && (
        <LegendPicker title={`Pick a ${BUCKET_LABEL[formation[pickFor]]}`} bucket={formation[pickFor]} legends={formation[pickFor] === 'GK' ? pool.filter(l => l.position === 'GK') : pool.filter(l => l.position !== 'GK')} usedKeys={usedKeys} currentKey={picks[pickFor]?.player_key} injuredKeys={injuredKeys} onClose={() => setPickFor(null)} onPick={l => assign(pickFor, l)} onClear={() => assign(pickFor, null)} />
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
const LegendPicker: React.FC<{ bucket: fp.Bucket; legends: fp.Legend[]; usedKeys: Set<string>; currentKey?: string; title?: string; injuredKeys?: Set<string>; onClose: () => void; onPick: (l: fp.Legend) => void; onClear: () => void }> = ({ bucket, legends, usedKeys, currentKey, title, injuredKeys, onClose, onPick, onClear }) => {
  const [q, setQ] = useState('');
  const list = useMemo(() => { const f = norm(q.trim()); return f ? legends.filter(l => norm(l.name).includes(f)) : legends; }, [q, legends]);
  return (
    <Sheet title={title ?? (bucket === 'GK' ? 'Pick a Goalkeeper' : 'Pick an outfield legend')} onClose={onClose}>
      <SearchBox q={q} setQ={setQ} placeholder={`Search ${legends.length} legends…`} />
      <div className="overflow-y-auto space-y-1 flex-1 min-h-0">
        {currentKey && <button onClick={onClear} className="w-full text-left text-sm text-hot-red py-2">Clear this spot</button>}
        {list.length === 0 && <p className="text-center text-sm text-text-disabled py-6">No player</p>}
        {list.slice(0, 80).map(l => <Row key={l.id} name={l.name} photo={l.photo_url} bucket={bucket} current={l.player_key === currentKey} used={usedKeys.has(l.player_key) && l.player_key !== currentKey} injured={injuredKeys?.has(l.player_key)} onClick={() => onPick(l)} />)}
        {list.length > 80 && <p className="text-center text-[11px] text-text-disabled py-2">+{list.length - 80} more — refine your search</p>}
      </div>
    </Sheet>
  );
};

// ── Squad / transfer picker (async search any player) ───────────────────────
const SquadPicker: React.FC<{ bucket?: fp.Bucket; defaults: fp.SquadPlayer[]; clubName: string; usedKeys: Set<string>; currentKey?: string; onClose: () => void; onPick: (p: fp.SquadPlayer) => void; onClear: () => void }> = ({ bucket, defaults, clubName, usedKeys, currentKey, onClose, onPick, onClear }) => {
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
    <Sheet title={bucket ? `Pick a ${BUCKET_LABEL[bucket]}` : 'Add to the bench'} onClose={onClose}>
      <SearchBox q={q} setQ={setQ} placeholder={`${clubName} squad · or search any player to buy…`} />
      {busy && <div className="flex justify-center py-2"><Loader2 className="animate-spin text-electric-blue" size={18} /></div>}
      <div className="overflow-y-auto space-y-1 flex-1 min-h-0">
        {currentKey && <button onClick={onClear} className="w-full text-left text-sm text-hot-red py-2">Clear this spot</button>}
        {q.trim().length < 2 && <p className="text-[11px] text-text-disabled px-1">Current squad — or type a name to sign anyone</p>}
        {!busy && q.trim().length >= 2 && list.length === 0 && <p className="text-center text-sm text-text-disabled py-6">No player</p>}
        {list.slice(0, 60).map(p => <Row key={p.id} name={p.name} photo={p.photo} bucket={bucket ?? p.position} sub={p.club && p.club !== clubName ? `€ ${p.club}` : undefined} current={p.id === currentKey} used={usedKeys.has(p.id) && p.id !== currentKey} onClick={() => onPick(p)} />)}
      </div>
    </Sheet>
  );
};

const Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  // Anchored to the TOP so the search field stays visible above the keyboard.
  <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]" onClick={onClose}>
    <div className="w-full max-w-md bg-deep-navy rounded-2xl max-h-[82vh] flex flex-col p-4" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2"><h3 className="font-bold text-text-primary">{title}</h3><button onClick={onClose}><X size={22} className="text-text-secondary" /></button></div>
      {children}
    </div>
  </div>
);
const SearchBox: React.FC<{ q: string; setQ: (s: string) => void; placeholder: string }> = ({ q, setQ, placeholder }) => (
  <div className="relative mb-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
    <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} className="w-full pl-9 pr-3 py-2 bg-navy-accent border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-electric-blue" /></div>
);
const Row: React.FC<{ name: string; photo?: string | null; bucket: fp.Bucket; sub?: string; current: boolean; used: boolean; injured?: boolean; onClick: () => void }> = ({ name, photo, bucket, sub, current, used, injured, onClick }) => (
  <button disabled={used} onClick={onClick} className={`w-full flex items-center gap-3 p-2 rounded-lg ${current ? 'bg-electric-blue/15' : 'hover:bg-white/5'} ${used ? 'opacity-40' : ''}`}>
    {photo ? <img src={photo} className="w-9 h-9 rounded-full object-cover" alt="" /> : <div className={`w-9 h-9 rounded-full bg-gradient-to-b ${POS_GRAD[bucket]} flex items-center justify-center text-white font-bold text-xs`}>{initials(name)}</div>}
    <div className="flex-1 text-left min-w-0"><div className="text-text-primary text-sm font-medium truncate flex items-center gap-1.5"><span className="truncate">{name}</span>{injured && <span className="text-hot-red font-extrabold shrink-0" title="Injured">✕</span>}</div>{sub && <div className="text-[10px] text-warm-yellow truncate">{sub}</div>}</div>
    {current ? <Check size={16} className="text-electric-blue" /> : used ? <span className="text-[10px] text-text-disabled">in XI</span> : null}
  </button>
);

const CoachPicker: React.FC<{ coaches: fp.Coach[]; currentKey?: string; onClose: () => void; onPick: (c: fp.Coach) => void; onClear: () => void }> = ({ coaches, currentKey, onClose, onPick, onClear }) => {
  const [q, setQ] = useState('');
  const list = q.trim() ? coaches.filter(c => norm(c.name).includes(norm(q.trim()))) : coaches;
  return (
    <Sheet title="Pick a coach" onClose={onClose}>
      <SearchBox q={q} setQ={setQ} placeholder="Search a coach…" />
      <div className="overflow-y-auto space-y-1">
        {currentKey && <button onClick={onClear} className="w-full text-left text-xs font-semibold text-hot-red px-2 py-1.5">✕ Clear coach</button>}
        {list.map(c => (
          <button key={c.coach_key} onClick={() => onPick(c)} className={`w-full flex items-center gap-3 p-2 rounded-lg ${currentKey === c.coach_key ? 'bg-electric-blue/15' : 'hover:bg-white/5'}`}>
            {c.photo ? <img src={c.photo} className="w-9 h-9 rounded-full object-cover" alt="" /> : <div className="w-9 h-9 rounded-full bg-warm-yellow/30 flex items-center justify-center text-white font-bold text-xs">{initials(c.name)}</div>}
            <div className="flex-1 text-left min-w-0"><div className="text-text-primary text-sm font-medium truncate">{c.name}</div><div className="text-[10px] text-warm-yellow">{c.matches} matches managed</div></div>
            {currentKey === c.coach_key && <Check size={16} className="text-electric-blue" />}
          </button>
        ))}
      </div>
    </Sheet>
  );
};

// ── Page shell ──────────────────────────────────────────────────────────────
export const FanPulsePage: React.FC<{ profile: Profile | null }> = ({ profile }) => {
  const userId = profile?.id ?? null;
  const [club, setClub] = useState<fp.Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'home' | 'legends' | 'dream' | 'match'>('home');
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => { if (!userId) { setLoading(false); return; } fp.getFavoriteClub(userId).then(c => { setClub(c); setLoading(false); }); }, [userId]);

  const picker = pickerOpen && (
    <ClubPicker
      onClose={() => setPickerOpen(false)}
      onPick={async c => { if (userId) { await fp.setFavoriteClub(userId, c.id); } setClub(c); setMode('home'); setPickerOpen(false); }}
    />
  );

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-electric-blue" size={32} /></div>;

  // No club yet → show the "Select your favorite club" block at the top; picking
  // is done in a modal, then we land on the home screen below.
  if (!club) return (
    <div className="space-y-4 pb-4">
      <button onClick={() => setPickerOpen(true)} className="w-full text-left bg-navy-accent rounded-2xl p-4 flex items-center gap-4 border border-electric-blue/30 hover:bg-white/5">
        <div className="w-11 h-11 rounded-xl bg-deep-navy flex items-center justify-center text-2xl">❤️</div>
        <div className="flex-1 min-w-0"><h3 className="font-bold text-text-primary">Select your favorite club</h3><p className="text-xs text-text-secondary">Build legend & dream XIs and see the fans' pulse.</p></div>
        <span className="text-xs text-electric-blue font-semibold shrink-0">Choose</span>
      </button>
      {picker}
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-3">
        {mode !== 'home' && <button onClick={() => setMode('home')} className="text-text-secondary"><ArrowLeft size={20} /></button>}
        {club.logo ? <img src={club.logo} className="w-9 h-9 object-contain" alt="" /> : <div className="w-9 h-9 rounded-full bg-electric-blue/20 flex items-center justify-center text-electric-blue font-bold text-sm">{initials(club.name)}</div>}
        <div className="flex-1 min-w-0"><h1 className="text-lg font-bold text-text-primary truncate">{club.name}</h1><p className="text-[11px] text-text-secondary">{mode === 'home' ? 'Fan Pulse' : mode === 'legends' ? 'All-time Legends XI' : mode === 'dream' ? 'Dream XI · next season' : 'Upcoming match XI'}</p></div>
        {mode === 'home' && <button onClick={() => setPickerOpen(true)} className="text-xs text-text-disabled underline">change</button>}
      </div>

      {mode === 'home' ? (
        <div className="space-y-3">
          <HomeCard icon={<Crown className="text-warm-yellow" />} title="Legends XI" desc="Build the club's all-time 4-3-3 — and see the fans' consensus." onClick={() => setMode('legends')} />
          <HomeCard icon={<Sparkles className="text-electric-blue" />} title="Dream XI · next season" desc="The team you want to see — pick anyone, sign new players, vote the pulse." onClick={() => setMode('dream')} />
          <HomeCard icon={<span className="text-xl">📅</span>} title="Upcoming match XI" desc="The XI you want for the next game — and the fans' consensus." onClick={() => setMode('match')} />
        </div>
      ) : !userId ? null : mode === 'legends' ? <LegendsBuilder club={club} userId={userId} /> : mode === 'dream' ? <DreamBuilder club={club} userId={userId} /> : mode === 'match' ? <MatchBuilder club={club} userId={userId} /> : null}

      {picker}
    </div>
  );
};

const HomeCard: React.FC<{ icon: React.ReactNode; title: string; desc: string; onClick: () => void }> = ({ icon, title, desc, onClick }) => (
  <button onClick={onClick} className="w-full text-left bg-navy-accent rounded-2xl p-4 flex items-center gap-4 hover:bg-white/5 border border-white/5">
    <div className="w-11 h-11 rounded-xl bg-deep-navy flex items-center justify-center">{icon}</div>
    <div className="flex-1 min-w-0"><h3 className="font-bold text-text-primary">{title}</h3><p className="text-xs text-text-secondary">{desc}</p></div>
  </button>
);

const ClubPicker: React.FC<{ onPick: (c: fp.Club) => void; onClose: () => void }> = ({ onPick, onClose }) => {
  const [q, setQ] = useState(''); const [results, setResults] = useState<fp.Club[]>([]); const [busy, setBusy] = useState(false);
  const [suggested, setSuggested] = useState<fp.Club[]>([]);
  useEffect(() => { fp.getSuggestedClubs().then(setSuggested); }, []);
  useEffect(() => { if (q.trim().length < 2) { setResults([]); return; } setBusy(true); const t = setTimeout(async () => { setResults(await fp.searchClubs(q.trim())); setBusy(false); }, 300); return () => clearTimeout(t); }, [q]);
  const showing = q.trim().length < 2 ? suggested : results;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[max(1rem,env(safe-area-inset-top))]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-deep-navy border border-white/10 rounded-3xl p-5 max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-text-primary">Pick your club</h2>
          <button onClick={onClose} className="text-text-secondary p-1"><X size={20} /></button>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-disabled" />
          <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder="Search a club… (e.g. Barcelona)" className="w-full pl-10 pr-4 py-3 bg-navy-accent border border-white/10 rounded-xl text-text-primary focus:outline-none focus:border-electric-blue" /></div>
        {busy && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-electric-blue" size={22} /></div>}
        {q.trim().length < 2 && showing.length > 0 && <p className="text-[11px] uppercase tracking-wide text-text-disabled mt-3 mb-1">Popular clubs</p>}
        <div className="space-y-1.5 overflow-y-auto">{showing.map(c => (
          <button key={c.id} onClick={() => onPick(c)} className="w-full flex items-center gap-3 p-3 bg-navy-accent rounded-xl hover:bg-white/5">
            {c.logo ? <img src={c.logo} className="w-8 h-8 object-contain" alt="" /> : <div className="w-8 h-8 rounded-full bg-electric-blue/20 flex items-center justify-center text-electric-blue text-xs font-bold">{initials(c.name)}</div>}
            <span className="text-text-primary font-medium">{c.name}</span>
          </button>))}</div>
      </div>
    </div>
  );
};

export default FanPulsePage;
