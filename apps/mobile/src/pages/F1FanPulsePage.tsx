import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, Check, X, Crown, Users, Star, Flag } from 'lucide-react';
import { useHof, type HofKind, type HofCandidate } from '../features/f1/useHof';
import { track } from '../services/analytics';
import * as f1Fan from '../services/f1FanService';
import type { Profile } from '../types';

const TOP = 5;
const initials = (n: string) => (n || '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const Avatar: React.FC<{ name?: string | null; image?: string | null; round?: boolean; size?: number }> = ({ name, image, round = true, size = 44 }) => {
  if (image) return round
    ? <img src={image} alt="" style={{ width: size, height: size }} className="rounded-full object-cover bg-navy-accent shrink-0" />
    : <img src={image} alt="" style={{ width: size, height: size }} className="object-contain bg-white rounded-lg p-1 shrink-0" />;
  return <div style={{ width: size, height: size }} className={`${round ? 'rounded-full' : 'rounded-lg'} bg-navy-accent flex items-center justify-center text-xs font-bold text-text-secondary shrink-0`}>{initials(name || '')}</div>;
};

// ── Bottom-sheet picker (shared by favourites + grid slots) ───────────────────
interface PickItem { key: string; name: string; image: string | null; sub?: string | null; }
const PickerSheet: React.FC<{ title: string; items: PickItem[]; round?: boolean; usedKeys?: Set<string>; onSelect: (key: string) => void; onClose: () => void }> = ({ title, items, round = true, usedKeys, onSelect, onClose }) => {
  const [q, setQ] = useState('');
  const filtered = items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md bg-deep-navy rounded-t-2xl max-h-[78vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="font-bold text-text-primary">{title}</div>
          <button onClick={onClose} className="p-1 text-text-secondary"><X size={20} /></button>
        </div>
        <div className="px-3 pt-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full bg-navy-accent border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled" />
        </div>
        <div className="overflow-y-auto p-2">
          {filtered.map((c) => {
            const used = usedKeys?.has(c.key) ?? false;
            return (
              <button key={c.key} onClick={() => !used && onSelect(c.key)} disabled={used}
                className={`w-full flex items-center gap-3 p-2 rounded-lg text-left ${used ? 'opacity-30' : 'hover:bg-navy-accent'}`}>
                <Avatar name={c.name} image={c.image} round={round} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-text-primary truncate">{c.name}</div>
                  {c.sub && <div className="text-[11px] text-text-disabled truncate">{c.sub}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Favourites (Pilot + Team) with fan counts ────────────────────────────────
const FavCard: React.FC<{ label: string; icon: React.ReactNode; item: PickItem | null; round: boolean; fans: number | null; onPick: () => void }> = ({ label, icon, item, round, fans, onPick }) => (
  <button onClick={onPick} className="flex-1 card-base p-3 text-left flex flex-col gap-2 active:scale-[0.98] transition-transform">
    <span className="text-[11px] font-bold uppercase tracking-wide text-text-secondary flex items-center gap-1.5">{icon} {label}</span>
    <div className="flex items-center gap-2.5 min-h-[44px]">
      {item ? <Avatar name={item.name} image={item.image} round={round} size={44} />
            : <div className="w-11 h-11 rounded-xl border border-dashed border-disabled flex items-center justify-center text-text-disabled text-lg">+</div>}
      <div className="min-w-0">
        <div className="text-sm font-bold text-text-primary truncate">{item?.name ?? 'Pick'}</div>
        <div className="text-[11px] text-text-disabled flex items-center gap-1">
          <Users size={11} /> {fans == null ? '—' : `${fans} fan${fans === 1 ? '' : 's'}`}
        </div>
      </div>
    </div>
  </button>
);

const Favourites: React.FC<{ userId: string }> = ({ userId }) => {
  const [drivers, setDrivers] = useState<f1Fan.F1Driver[]>([]);
  const [constructors, setConstructors] = useState<f1Fan.F1Constructor[]>([]);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [constructorId, setConstructorId] = useState<string | null>(null);
  const [driverFans, setDriverFans] = useState<number | null>(null);
  const [constructorFans, setConstructorFans] = useState<number | null>(null);
  const [picking, setPicking] = useState<null | 'driver' | 'constructor'>(null);

  useEffect(() => {
    f1Fan.getCurrentDrivers().then(setDrivers);
    f1Fan.getCurrentConstructors().then(setConstructors);
    f1Fan.getFavourites(userId).then((f) => { setDriverId(f.driverId); setConstructorId(f.constructorId); });
  }, [userId]);
  useEffect(() => { if (driverId) f1Fan.getDriverFanCount(driverId).then(setDriverFans); else setDriverFans(null); }, [driverId]);
  useEffect(() => { if (constructorId) f1Fan.getConstructorFanCount(constructorId).then(setConstructorFans); else setConstructorFans(null); }, [constructorId]);

  const driver = useMemo(() => drivers.find((d) => d.id === driverId) ?? null, [drivers, driverId]);
  const constructor = useMemo(() => constructors.find((c) => c.id === constructorId) ?? null, [constructors, constructorId]);

  const pickDriver = async (id: string) => { setPicking(null); setDriverId(id); await f1Fan.setFavouriteDriver(userId, id); track('f1_fav_driver', { id }); };
  const pickConstructor = async (id: string) => { setPicking(null); setConstructorId(id); await f1Fan.setFavouriteConstructor(userId, id); track('f1_fav_constructor', { id }); };

  return (
    <>
      <div className="flex gap-3">
        <FavCard label="Favourite Pilot" icon={<Star size={12} className="text-warm-yellow" />}
          item={driver ? { key: driver.id, name: driver.name, image: driver.image } : null} round fans={driverFans} onPick={() => setPicking('driver')} />
        <FavCard label="Favourite Team" icon={<Flag size={12} className="text-hot-red" />}
          item={constructor ? { key: constructor.id, name: constructor.name, image: constructor.logo } : null} round={false} fans={constructorFans} onPick={() => setPicking('constructor')} />
      </div>

      {picking === 'driver' && (
        <PickerSheet title="Pick your favourite pilot" round
          items={drivers.map((d) => ({ key: d.id, name: d.name, image: d.image, sub: d.team }))}
          onSelect={pickDriver} onClose={() => setPicking(null)} />
      )}
      {picking === 'constructor' && (
        <PickerSheet title="Pick your favourite team" round={false}
          items={constructors.map((c) => ({ key: c.id, name: c.name, image: c.logo }))}
          onSelect={pickConstructor} onClose={() => setPicking(null)} />
      )}
    </>
  );
};

// ── F1 starting-grid ranker (one section: Hall of Fame OR Current Grid) ───────
const POS_COLOR = (i: number) => i === 0 ? 'text-warm-yellow' : i === 1 ? 'text-text-secondary' : i === 2 ? 'text-[#CD7F32]' : 'text-text-disabled';

const GridRanker: React.FC<{ title: string; subtitle: string; icon: React.ReactNode; kind: HofKind; userId: string | null; round: boolean }> = ({ title, subtitle, icon, kind, userId, round }) => {
  const { candidates, picks, agg, loading, save } = useHof(kind, userId ?? undefined);
  const [view, setView] = useState<'build' | 'pulse'>('build');
  const [top, setTop] = useState<string[]>([]);
  const [picker, setPicker] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { setTop(picks.slice(0, TOP)); setMsg(null); }, [picks]);
  const byKey = useMemo(() => new Map(candidates.map((c) => [c.key, c])), [candidates]);
  const filled = top.filter(Boolean).length;

  const place = (key: string) => {
    if (picker == null) return;
    setTop((prev) => { const n = [...prev]; while (n.length < TOP) n.push(''); n[picker] = key; return n; });
    setPicker(null); setMsg(null);
  };
  const clear = (i: number) => setTop((prev) => { const n = [...prev]; n[i] = ''; return n; });

  const onSave = async () => {
    setSaving(true); setMsg(null);
    const clean = top.filter(Boolean);
    const r = await save(clean);
    setSaving(false);
    if (r.ok) { track('f1_hof_saved', { kind, count: clean.length }); setView('pulse'); }
    setMsg(r.ok ? 'Saved ✓' : r.error || 'Could not save');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h2 className="text-base font-bold text-text-primary">{title}</h2>
            <p className="text-[11px] text-text-secondary">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* My pick / The pulse toggle */}
      <div className="flex gap-2">
        <button onClick={() => setView('build')} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${view === 'build' ? 'border-electric-blue text-electric-blue bg-electric-blue/10' : 'border-disabled text-text-secondary'}`}>My pick</button>
        <button onClick={() => setView('pulse')} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${view === 'pulse' ? 'border-electric-blue text-electric-blue bg-electric-blue/10' : 'border-disabled text-text-secondary'}`}>The Pulse · {agg.participants}</button>
      </div>

      {loading ? (
        <div className="card-base p-6 text-center text-text-secondary text-sm">Loading…</div>
      ) : view === 'build' ? (
        <>
          {/* Starting grid — staggered slots evoke an F1 grid */}
          <div className="card-base p-3">
            <div className="h-2 -mx-3 -mt-3 mb-3 rounded-t-2xl bg-[repeating-linear-gradient(90deg,#0b0e14_0,#0b0e14_10px,#e5e7eb_10px,#e5e7eb_20px)] opacity-60" />
            <div className="space-y-2">
              {Array.from({ length: TOP }).map((_, i) => {
                const c = top[i] ? byKey.get(top[i]) : null;
                const offset = i % 2 === 0 ? 'mr-auto' : 'ml-auto';
                return (
                  <div key={i} className={`flex items-center gap-2 w-[88%] ${offset}`}>
                    <span className={`w-7 text-center text-[15px] font-extrabold tabular-nums ${POS_COLOR(i)}`}>P{i + 1}</span>
                    <button onClick={() => setPicker(i)} className="flex-1 flex items-center gap-3 p-2 rounded-lg bg-deep-navy border border-disabled text-left">
                      {c ? <><Avatar name={c.name} image={c.image} round={round} size={38} /><span className="text-sm font-bold text-text-primary truncate flex-1">{c.name}</span></>
                         : <span className="flex-1 text-sm text-text-disabled py-1.5">Tap to pick</span>}
                    </button>
                    {c && <button onClick={() => clear(i)} className="text-text-disabled p-1"><X size={15} /></button>}
                  </div>
                );
              })}
            </div>
          </div>
          <button onClick={onSave} disabled={saving || filled === 0}
            className="w-full py-2.5 rounded-xl font-bold bg-electric-blue text-white disabled:opacity-50 flex items-center justify-center gap-2">
            <Check size={17} /> {saving ? 'Saving…' : `Save my grid (${filled}/${TOP})`}
          </button>
          {msg && <div className="text-center text-xs text-text-secondary">{msg}</div>}
        </>
      ) : (
        <div className="card-base divide-y divide-white/5">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary flex items-center gap-1"><Trophy size={13} className="text-warm-yellow" /> Fans' consensus</div>
          {agg.participants === 0 ? (
            <div className="p-6 text-center text-text-secondary text-sm">No fan has voted yet — be the first!</div>
          ) : agg.items.filter((it) => it.count > 0).map((it, i) => (
            <div key={it.key} className="flex items-center gap-3 px-3 py-2">
              <span className={`w-7 text-center font-extrabold tabular-nums text-sm ${POS_COLOR(i)}`}>P{i + 1}</span>
              <Avatar name={it.name} image={it.image} round={round} size={34} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-text-primary truncate">{it.name}</div>
                <div className="h-1.5 mt-1 rounded-full bg-navy-accent overflow-hidden"><div className="h-full bg-electric-blue" style={{ width: `${it.pct}%` }} /></div>
              </div>
              <span className="text-sm font-bold text-text-primary tabular-nums w-10 text-right">{it.pct}%</span>
            </div>
          ))}
        </div>
      )}

      {picker != null && (
        <PickerSheet title={`Pick P${picker + 1}`} round={round}
          items={candidates.map((c: HofCandidate) => ({ key: c.key, name: c.name, image: c.image }))}
          usedKeys={new Set(top.filter((k, idx) => k && idx !== picker))}
          onSelect={place} onClose={() => setPicker(null)} />
      )}
    </div>
  );
};

export const F1FanPulsePage: React.FC<{ profile: Profile | null }> = ({ profile }) => {
  const userId = profile?.id ?? null;
  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center gap-2">
        <Crown className="text-warm-yellow" size={22} />
        <div>
          <h1 className="text-lg font-bold text-text-primary">F1 Fan Pulse</h1>
          <p className="text-[11px] text-text-secondary">Your favourites & your all-time / current grids — see the fans' pulse.</p>
        </div>
      </div>

      {userId && <Favourites userId={userId} />}

      <GridRanker title="Hall of Fame" subtitle="Rank the 5 greatest drivers of all time" icon={<Trophy size={20} className="text-warm-yellow" />} kind="driver" userId={userId} round />
      <div className="h-px bg-white/5" />
      <GridRanker title="Current Grid" subtitle="Rank your top 5 from this season's drivers" icon={<Flag size={20} className="text-electric-blue" />} kind="current_driver" userId={userId} round />
    </div>
  );
};

export default F1FanPulsePage;
