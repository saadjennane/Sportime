import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, Check, X, Crown } from 'lucide-react';
import { useHof, type HofKind, type HofCandidate } from '../features/f1/useHof';
import type { Profile } from '../types';

const initials = (n: string) => (n || '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const Avatar: React.FC<{ c?: HofCandidate | null; kind: HofKind; size?: number }> = ({ c, kind, size = 44 }) => {
  if (c?.image) return kind === 'constructor'
    ? <img src={c.image} alt="" style={{ width: size, height: size }} className="object-contain bg-white rounded-lg p-1 shrink-0" />
    : <img src={c.image} alt="" style={{ width: size, height: size }} className="rounded-full object-cover bg-navy-accent shrink-0" />;
  return <div style={{ width: size, height: size }} className="rounded-full bg-navy-accent flex items-center justify-center text-xs font-bold text-text-secondary shrink-0">{initials(c?.name || '')}</div>;
};

const TOP = 5;

export const F1FanPulsePage: React.FC<{ profile: Profile | null }> = ({ profile }) => {
  const userId = profile?.id ?? null;
  const [kind, setKind] = useState<HofKind>('driver');
  const [view, setView] = useState<'build' | 'pulse'>('build');
  const { candidates, picks, agg, loading, save } = useHof(kind, userId ?? undefined);
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
    setMsg(r.ok ? 'Saved ✓' : r.error || 'Could not save');
    if (r.ok) setView('pulse');
  };

  const label = kind === 'driver' ? 'drivers' : 'constructors';

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2">
        <Crown className="text-warm-yellow" size={22} />
        <div>
          <h1 className="text-lg font-bold text-text-primary">F1 Hall of Fame</h1>
          <p className="text-[11px] text-text-secondary">Rank your all-time top 5 — see the fans' consensus.</p>
        </div>
      </div>

      {/* Kind tabs */}
      <div className="flex bg-navy-accent rounded-xl p-1">
        {(['driver', 'constructor'] as HofKind[]).map((k) => (
          <button key={k} onClick={() => setKind(k)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${kind === k ? 'bg-electric-blue text-white' : 'text-text-secondary'}`}>
            {k === 'driver' ? 'Drivers' : 'Constructors'}
          </button>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        {(['build', 'pulse'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${view === v ? 'border-electric-blue text-electric-blue bg-electric-blue/10' : 'border-disabled text-text-secondary'}`}>
            {v === 'build' ? 'My Top 5' : `Consensus · ${agg.participants} fan${agg.participants === 1 ? '' : 's'}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card-base p-6 text-center text-text-secondary text-sm">Loading…</div>
      ) : view === 'build' ? (
        <>
          <div className="card-base p-3 space-y-2">
            {Array.from({ length: TOP }).map((_, i) => {
              const c = top[i] ? byKey.get(top[i]) : null;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={`w-6 text-center font-extrabold tabular-nums ${i === 0 ? 'text-warm-yellow' : i === 1 ? 'text-text-secondary' : i === 2 ? 'text-[#CD7F32]' : 'text-text-disabled'}`}>{i + 1}</span>
                  <button onClick={() => setPicker(i)} className="flex-1 flex items-center gap-3 p-2 rounded-lg bg-deep-navy border border-disabled text-left">
                    {c ? <><Avatar c={c} kind={kind} size={40} /><span className="text-sm font-bold text-text-primary truncate flex-1">{c.name}</span></>
                      : <span className="flex-1 text-sm text-text-disabled py-2">Tap to pick</span>}
                  </button>
                  {c && <button onClick={() => clear(i)} className="text-text-disabled p-1"><X size={16} /></button>}
                </div>
              );
            })}
          </div>
          <button onClick={onSave} disabled={saving || filled === 0}
            className="w-full py-3 rounded-xl font-bold bg-electric-blue text-white disabled:opacity-50 flex items-center justify-center gap-2">
            <Check size={18} /> {saving ? 'Saving…' : `Save my top ${label} (${filled}/${TOP})`}
          </button>
          {msg && <div className="text-center text-xs text-text-secondary">{msg}</div>}
        </>
      ) : (
        <div className="card-base divide-y divide-white/5">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary flex items-center gap-1"><Trophy size={13} className="text-warm-yellow" /> Fans' Hall of Fame</div>
          {agg.participants === 0 ? (
            <div className="p-6 text-center text-text-secondary text-sm">No fan has voted yet — be the first!</div>
          ) : agg.items.filter((it) => it.count > 0).map((it, i) => (
            <div key={it.key} className="flex items-center gap-3 px-3 py-2">
              <span className="w-5 text-center font-bold tabular-nums text-sm text-text-secondary">{i + 1}</span>
              <Avatar c={it} kind={kind} size={36} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-text-primary truncate">{it.name}</div>
                <div className="h-1.5 mt-1 rounded-full bg-navy-accent overflow-hidden"><div className="h-full bg-electric-blue" style={{ width: `${it.pct}%` }} /></div>
              </div>
              <span className="text-sm font-bold text-text-primary tabular-nums w-10 text-right">{it.pct}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Candidate picker */}
      {picker != null && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60" onClick={() => setPicker(null)}>
          <div className="w-full max-w-md bg-deep-navy rounded-t-2xl max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="font-bold text-text-primary">Pick a {kind}</div>
              <button onClick={() => setPicker(null)} className="p-1 text-text-secondary"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-2">
              {candidates.map((c) => {
                const used = top.includes(c.key) && top[picker] !== c.key;
                return (
                  <button key={c.key} onClick={() => !used && place(c.key)} disabled={used}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left ${used ? 'opacity-30' : 'hover:bg-navy-accent'}`}>
                    <Avatar c={c} kind={kind} size={40} />
                    <span className="text-sm font-semibold text-text-primary flex-1 truncate">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default F1FanPulsePage;
