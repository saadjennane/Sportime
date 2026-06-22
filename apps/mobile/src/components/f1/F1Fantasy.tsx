import React, { useEffect, useMemo, useState } from 'react';
import { Zap, Star, Flag, Battery, Check, X, Trophy, Shirt, Radio } from 'lucide-react';
import { useFantasyGame, type Cat, type FDriver, type FConstructor, type FRule } from '../../features/f1/useFantasyGame';
import { track } from '../../services/analytics';

const SUF = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
const surname = (d?: FDriver | null) => {
  if (!d) return '';
  const p = (d.name || d.last_name || '').trim().split(/\s+/).filter(Boolean);
  if (p.length > 1 && SUF.has(p[p.length - 1].toLowerCase())) p.pop();
  return p[p.length - 1] || d.last_name || '?';
};
const CAT_LABEL: Record<string, string> = { elite: 'Elite', confirmed: 'Confirmed', outsider: 'Outsider', any: 'Any' };
const CAT_COLOR: Record<string, string> = { elite: 'text-warm-yellow', confirmed: 'text-electric-blue', outsider: 'text-lime-glow', any: 'text-text-secondary' };
const CONDITION_LABEL: Record<string, string> = {
  standard: 'Standard · 1 Elite + 1 Confirmed + 1 Outsider', no_stars: 'No Stars · 2 Confirmed + 1 Outsider',
  double_star: 'Double Star · 2 Elite + 1 Outsider', underdog: 'Underdog · 1 Elite + 2 Outsiders',
  constructor_chaos: 'Constructor Chaos · no Elite constructor', free: 'Free Choice',
};

const slotCats = (rule: FRule): (Cat | 'any')[] => {
  if (!rule?.drivers) return ['any', 'any', 'any'];
  const out: (Cat | 'any')[] = [];
  for (let i = 0; i < rule.drivers.elite; i++) out.push('elite');
  for (let i = 0; i < rule.drivers.confirmed; i++) out.push('confirmed');
  for (let i = 0; i < rule.drivers.outsider; i++) out.push('outsider');
  while (out.length < 3) out.push('any');
  return out.slice(0, 3);
};

const EnergyBar: React.FC<{ pct: number; shot?: boolean }> = ({ pct, shot }) => (
  <div className="flex items-center gap-1">
    <div className="h-1.5 w-12 rounded-full bg-navy-accent overflow-hidden">
      <div className={`h-full ${pct >= 60 ? 'bg-lime-glow' : pct >= 30 ? 'bg-warm-yellow' : 'bg-hot-red'}`} style={{ width: `${pct}%` }} />
    </div>
    <span className="text-[10px] text-text-secondary tabular-nums">{pct}%{shot ? ' +' : ''}</span>
  </div>
);

export const F1Fantasy: React.FC<{ gameId: string; userId?: string }> = ({ gameId, userId }) => {
  const { game, drivers, constructors, driversByCat, roster, energyOf, board, loading, saveRoster } = useFantasyGame(gameId, userId);
  const [picks, setPicks] = useState<(number | null)[]>([null, null, null]);
  const [constructor, setConstructor] = useState<number | null>(null);
  const [captain, setCaptain] = useState<number | null>(null);
  const [flp, setFlp] = useState<number | null>(null);
  const [shots, setShots] = useState<{ type: 'driver' | 'constructor'; id: number }[]>([]);
  const [picker, setPicker] = useState<null | { kind: 'driver'; slot: number; cat: Cat | 'any' } | { kind: 'constructor' }>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (roster) {
      const ds = roster.drivers ?? [];
      setPicks([ds[0] ?? null, ds[1] ?? null, ds[2] ?? null]);
      setConstructor(roster.constructor_id ?? null);
      setCaptain(roster.captain_driver_id ?? null);
      setFlp(roster.flp_driver_id ?? null);
      setShots(roster.energy_shots ?? []);
    }
  }, [roster]);

  const dById = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);
  const cById = useMemo(() => new Map(constructors.map((c) => [c.id, c])), [constructors]);

  if (loading) return <div className="card-base p-6 text-center text-text-secondary text-sm">Loading…</div>;
  if (!game) return <div className="card-base p-6 text-center text-text-secondary text-sm">Game not found.</div>;

  const cats = slotCats(game.rule);
  const settled = roster?.status === 'settled' || game.status === 'settled';
  const live = game.status === 'live' && !settled;
  const locked = settled || live || (!!game.qualiStartAt && new Date(game.qualiStartAt).getTime() <= Date.now());
  const hasShot = (type: 'driver' | 'constructor', id: number) => shots.some((s) => s.type === type && s.id === id);
  const toggleShot = (type: 'driver' | 'constructor', id: number) =>
    setShots((s) => hasShot(type, id) ? s.filter((x) => !(x.type === type && x.id === id)) : [...s, { type, id }]);

  const pickInto = (id: number) => {
    if (!picker) return;
    if (picker.kind === 'driver') setPicks((p) => { const n = [...p]; n[picker.slot] = id; return n; });
    else setConstructor(id);
    setPicker(null); setMsg(null);
  };

  const filled = picks.filter(Boolean).length;
  const ready = filled === 3 && constructor != null;

  const save = async () => {
    if (!ready) return;
    setSaving(true); setMsg(null);
    const r = await saveRoster({ drivers: picks.filter(Boolean) as number[], constructor: constructor!, captain, flp, energyShots: shots });
    setSaving(false);
    if (r.ok) track('f1_fantasy_roster_saved', { game: gameId, condition: game.condition, captain: !!captain });
    setMsg(r.ok ? 'Team saved ✓' : r.error || 'Could not save');
  };

  const ToggleBtn: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode; color: string }> = ({ on, onClick, children, color }) => (
    <button onClick={onClick} disabled={locked} className={`p-1.5 rounded-lg border ${on ? `${color} border-current` : 'text-text-disabled border-disabled'}`}>{children}</button>
  );

  return (
    <div className="space-y-3">
      <div className="card-base p-4">
        <div className="flex items-center gap-2 text-warm-yellow font-bold"><Zap size={18} /> Fantasy F1 · {game.raceName}</div>
        <p className="text-xs text-text-secondary mt-1">{CONDITION_LABEL[game.condition] ?? game.condition}. Pick 3 drivers + 1 constructor. Score × <b className="text-text-primary">energy</b>; <Star size={10} className="inline text-warm-yellow" /> Captain ×2, <Flag size={10} className="inline text-electric-blue" /> Fastest-lap +15, <Battery size={10} className="inline text-lime-glow" /> Energy Shot +10%.</p>
      </div>

      {(settled || live) && roster?.breakdown && (
        <div className="card-base p-4 space-y-1">
          <div className="flex items-center justify-between font-bold text-text-primary">
            <span className="flex items-center gap-2">
              {live ? <span className="flex items-center gap-1 text-[10px] font-bold text-hot-red bg-hot-red/15 px-1.5 py-0.5 rounded"><Radio size={10} /> LIVE</span> : <Trophy size={16} className="text-warm-yellow" />}
              {live ? 'Live score' : 'Your score'}
            </span>
            <span className="text-lime-glow text-lg">{roster.breakdown.total}</span>
          </div>
          {(roster.breakdown.drivers ?? []).map((b: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs text-text-secondary"><span>{surname(dById.get(b.driver))}{b.captain ? ' (C)' : ''}{b.pos ? ` · P${b.pos}` : ''} · base {b.base} · {b.energy}%</span><span className="text-text-primary font-semibold">{b.score}</span></div>
          ))}
          <div className="flex items-center justify-between text-xs text-text-secondary"><span>Constructor (incl. bonus {roster.breakdown.constructor_bonus})</span><span className="text-text-primary font-semibold">{roster.breakdown.constructor}</span></div>
          {roster.breakdown.flp > 0 && <div className="flex items-center justify-between text-xs text-text-secondary"><span>Fastest-lap prediction</span><span className="text-lime-glow font-semibold">+{roster.breakdown.flp}</span></div>}
        </div>
      )}

      {/* Driver slots */}
      <div className="space-y-2">
        {cats.map((cat, i) => {
          const d = picks[i] != null ? dById.get(picks[i]!) : null;
          const en = d ? energyOf('driver', d.id) : 100;
          return (
            <div key={i} className="card-base p-2.5">
              <div className="flex items-center gap-3">
                <button onClick={() => !locked && setPicker({ kind: 'driver', slot: i, cat })} disabled={locked} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  {d?.image ? <img src={d.image} alt="" className="w-11 h-11 rounded-full object-cover bg-navy-accent" /> : <div className="w-11 h-11 rounded-full bg-navy-accent flex items-center justify-center"><span className={`text-[10px] font-bold uppercase ${CAT_COLOR[cat]}`}>{CAT_LABEL[cat]}</span></div>}
                  <div className="min-w-0 flex-1">
                    {d ? <><div className="text-sm font-bold text-text-primary truncate">{surname(d)}</div><EnergyBar pct={en} shot={hasShot('driver', d.id)} /></>
                      : <div className="text-sm text-text-disabled">Pick <span className={CAT_COLOR[cat]}>{CAT_LABEL[cat]}</span> driver</div>}
                  </div>
                </button>
                {d && (
                  <div className="flex items-center gap-1 shrink-0">
                    <ToggleBtn on={captain === d.id} onClick={() => setCaptain(captain === d.id ? null : d.id)} color="text-warm-yellow"><Star size={14} /></ToggleBtn>
                    <ToggleBtn on={flp === d.id} onClick={() => setFlp(flp === d.id ? null : d.id)} color="text-electric-blue"><Flag size={14} /></ToggleBtn>
                    <ToggleBtn on={hasShot('driver', d.id)} onClick={() => toggleShot('driver', d.id)} color="text-lime-glow"><Battery size={14} /></ToggleBtn>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Constructor */}
        <div className="card-base p-2.5">
          <div className="flex items-center gap-3">
            <button onClick={() => !locked && setPicker({ kind: 'constructor' })} disabled={locked} className="flex items-center gap-3 flex-1 min-w-0 text-left">
              {constructor != null && cById.get(constructor)?.logo ? <img src={cById.get(constructor)!.logo!} alt="" className="w-11 h-11 object-contain bg-white rounded-lg p-1" /> : <div className="w-11 h-11 rounded-lg bg-navy-accent flex items-center justify-center"><Shirt size={18} className="text-text-disabled" /></div>}
              <div className="min-w-0 flex-1">
                {constructor != null ? <><div className="text-sm font-bold text-text-primary truncate">{cById.get(constructor)?.name}</div><EnergyBar pct={energyOf('constructor', constructor)} shot={hasShot('constructor', constructor)} /></>
                  : <div className="text-sm text-text-disabled">Pick a constructor</div>}
              </div>
            </button>
            {constructor != null && <ToggleBtn on={hasShot('constructor', constructor)} onClick={() => toggleShot('constructor', constructor)} color="text-lime-glow"><Battery size={14} /></ToggleBtn>}
          </div>
        </div>
      </div>

      {!locked && (
        <button onClick={save} disabled={saving || !ready} className="w-full py-3 rounded-xl font-bold bg-electric-blue text-white disabled:opacity-50 flex items-center justify-center gap-2">
          <Check size={18} /> {saving ? 'Saving…' : `Save team (${filled}/3${constructor != null ? ' + C' : ''})`}
        </button>
      )}
      {msg && <div className="text-center text-xs text-text-secondary">{msg}</div>}
      {locked && !settled && !live && <div className="card-base p-3 text-center text-text-secondary text-sm">Locked — qualifying has started. Live scoring during the race.</div>}
      {live && <div className="text-center text-[11px] text-text-secondary">Updating every ~minute · progression banked every 10 laps</div>}

      {/* Leaderboard */}
      {board.length > 0 && (
        <div className="card-base divide-y divide-white/5">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary flex items-center gap-1"><Trophy size={13} className="text-warm-yellow" /> Leaderboard</div>
          {board.slice(0, 20).map((r) => (
            <div key={r.user_id} className={`flex items-center gap-3 px-3 py-2 ${r.user_id === userId ? 'bg-electric-blue/10' : ''}`}>
              <span className="w-5 text-center font-bold tabular-nums text-sm text-text-secondary">{r.rank}</span>
              {r.avatar ? <img src={r.avatar} alt="" className="w-7 h-7 rounded-full object-cover bg-navy-accent" /> : <div className="w-7 h-7 rounded-full bg-navy-accent" />}
              <div className="flex-1 min-w-0 text-sm font-medium text-text-primary truncate">{r.username ?? 'Player'}</div>
              <div className="text-sm font-bold text-text-primary tabular-nums">{Math.round(r.score)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Picker */}
      {picker && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60" onClick={() => setPicker(null)}>
          <div className="w-full max-w-md bg-deep-navy rounded-t-2xl max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="font-bold text-text-primary">{picker.kind === 'driver' ? `Pick ${CAT_LABEL[picker.cat]} driver` : 'Pick a constructor'}</div>
              <button onClick={() => setPicker(null)} className="p-1 text-text-secondary"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-2">
              {picker.kind === 'driver'
                ? (picker.cat === 'any' ? drivers : driversByCat[picker.cat] ?? []).map((d) => {
                  const used = picks.includes(d.id) && picks[picker.slot] !== d.id;
                  return (
                    <button key={d.id} onClick={() => !used && pickInto(d.id)} disabled={used} className={`w-full flex items-center gap-3 p-2 rounded-lg text-left ${used ? 'opacity-30' : 'hover:bg-navy-accent'}`}>
                      {d.image ? <img src={d.image} alt="" className="w-10 h-10 rounded-full object-cover bg-navy-accent" /> : <div className="w-10 h-10 rounded-full bg-navy-accent" />}
                      <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-text-primary truncate">{surname(d)}</div><div className={`text-[10px] font-bold uppercase ${CAT_COLOR[d.category ?? 'any']}`}>{CAT_LABEL[d.category ?? 'any']}</div></div>
                      <EnergyBar pct={energyOf('driver', d.id)} />
                    </button>
                  );
                })
                : constructors.filter((c) => !(game.rule.constructor_block && c.category === game.rule.constructor_block)).map((c) => (
                  <button key={c.id} onClick={() => pickInto(c.id)} className="w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-navy-accent">
                    {c.logo ? <img src={c.logo} alt="" className="w-10 h-10 object-contain bg-white rounded p-1" /> : <div className="w-10 h-10 rounded bg-navy-accent" />}
                    <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-text-primary truncate">{c.name}</div><div className={`text-[10px] font-bold uppercase ${CAT_COLOR[c.category ?? 'any']}`}>{CAT_LABEL[c.category ?? 'any']}</div></div>
                    <EnergyBar pct={energyOf('constructor', c.id)} />
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default F1Fantasy;
