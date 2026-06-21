import React, { useEffect, useMemo, useState } from 'react';
import { Crown, Check, Trophy, X } from 'lucide-react';
import { usePredSeason, type PredConstructor } from '../../features/f1/usePredSeason';
import type { PredDriver } from '../../features/f1/usePredGame';

const SUFFIX = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
const surname = (d?: PredDriver | null) => {
  if (!d) return '';
  const parts = (d.name || d.last_name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1 && SUFFIX.has(parts[parts.length - 1].toLowerCase())) parts.pop();
  return parts[parts.length - 1] || d.last_name || '?';
};

type Slot = 'champion' | `d:${number}` | `c:${number}`;

export const F1SeasonForecast: React.FC<{ gameId: string; userId?: string }> = ({ gameId, userId }) => {
  const { game, drivers, constructors, card, board, loading, savePicks } = usePredSeason(gameId, userId);
  const [champion, setChampion] = useState<number | null>(null);
  const [td, setTd] = useState<number[]>([]);
  const [tc, setTc] = useState<number[]>([]);
  const [picker, setPicker] = useState<Slot | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const dById = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);
  const cById = useMemo(() => new Map(constructors.map((c) => [c.id, c])), [constructors]);

  useEffect(() => {
    setChampion(card?.champion ?? null);
    setTd(card?.top3_drivers ?? []);
    setTc(card?.top3_constructors ?? []);
  }, [card]);

  if (loading) return <div className="card-base p-6 text-center text-text-secondary text-sm">Loading forecast…</div>;
  if (!game) return <div className="card-base p-6 text-center text-text-secondary text-sm">Game not found.</div>;

  const settled = game.status === 'settled' || card?.status === 'settled';
  const lockedByTime = !!game.lockAt && new Date(game.lockAt).getTime() <= Date.now();
  const locked = settled || lockedByTime;

  const choose = (id: number) => {
    if (!picker) return;
    if (picker === 'champion') setChampion(id);
    else if (picker.startsWith('d:')) { const i = Number(picker.slice(2)); setTd((a) => { const n = [...a]; n[i] = id; return n; }); }
    else { const i = Number(picker.slice(2)); setTc((a) => { const n = [...a]; n[i] = id; return n; }); }
    setPicker(null); setMsg(null);
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    const r = await savePicks({ champion, top3_drivers: td, top3_constructors: tc });
    setSaving(false);
    setMsg(r.ok ? 'Forecast saved ✓' : r.error || 'Could not save');
  };

  const isConstructorPicker = picker?.startsWith('c:');
  const ptsFor = (k: string) => (settled && card?.breakdown?.[k] ? card.breakdown[k] : null);

  const Slot1: React.FC<{ slot: Slot; label: string; id?: number | null; kind: 'd' | 'c' }> = ({ slot, label, id, kind }) => {
    const d = kind === 'd' && id != null ? dById.get(id) : null;
    const c = kind === 'c' && id != null ? cById.get(id) : null;
    return (
      <button onClick={() => !locked && setPicker(slot)} disabled={locked}
        className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-deep-navy border border-disabled disabled:opacity-100 text-left">
        <span className="text-[11px] uppercase tracking-wide text-text-secondary w-8 shrink-0">{label}</span>
        {d ? <><img src={d.image ?? ''} alt="" className="w-8 h-8 rounded-full object-cover bg-navy-accent" /><span className="text-sm font-bold text-text-primary truncate flex-1">{surname(d)}</span>{d.team_logo && <img src={d.team_logo} className="w-5 h-5 object-contain bg-white rounded p-0.5" />}</>
          : c ? <><img src={c.logo ?? ''} alt="" className="w-8 h-8 object-contain bg-white rounded p-0.5" /><span className="text-sm font-bold text-text-primary truncate flex-1">{c.name}</span></>
            : <span className="flex-1 text-sm text-text-disabled">Tap to pick</span>}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="card-base p-4">
        <div className="flex items-center gap-2 text-warm-yellow font-bold"><Crown size={18} /> {game.name}</div>
        <p className="text-xs text-text-secondary mt-1">Forecast the season: Champion <b className="text-text-primary">+{game.scoring.champion}</b>, Top 3 drivers <b className="text-text-primary">+{game.scoring.driver_exact}</b>/slot (<b>+{game.scoring.driver_partial}</b> wrong place), Top 3 constructors <b className="text-text-primary">+{game.scoring.constructor_exact}</b>/slot.</p>
        {game.lockAt && !settled && <div className="text-[11px] text-text-secondary mt-1">{lockedByTime ? 'Locked — season under way.' : `Locks ${new Date(game.lockAt).toLocaleDateString()}`}</div>}
        {settled && card && <div className="text-sm font-bold text-lime-glow mt-1">Final score: {card.score ?? 0} pts</div>}
      </div>

      <div className="card-base p-3 space-y-3">
        <div>
          <div className="text-xs font-bold text-text-primary mb-1.5 flex items-center justify-between">Champion {ptsFor('champion') != null && <span className="text-lime-glow">+{ptsFor('champion')}</span>}</div>
          <Slot1 slot="champion" label="🏆" id={champion} kind="d" />
        </div>
        <div>
          <div className="text-xs font-bold text-text-primary mb-1.5 flex items-center justify-between">Top 3 drivers {ptsFor('drivers') != null && <span className="text-lime-glow">+{ptsFor('drivers')}</span>}</div>
          <div className="space-y-1.5">{[0, 1, 2].map((i) => <Slot1 key={i} slot={`d:${i}`} label={`P${i + 1}`} id={td[i]} kind="d" />)}</div>
        </div>
        <div>
          <div className="text-xs font-bold text-text-primary mb-1.5 flex items-center justify-between">Top 3 constructors {ptsFor('constructors') != null && <span className="text-lime-glow">+{ptsFor('constructors')}</span>}</div>
          <div className="space-y-1.5">{[0, 1, 2].map((i) => <Slot1 key={i} slot={`c:${i}`} label={`P${i + 1}`} id={tc[i]} kind="c" />)}</div>
        </div>

        {!locked && (
          <button onClick={save} disabled={saving}
            className="w-full py-3 rounded-xl font-bold bg-electric-blue text-white disabled:opacity-50 flex items-center justify-center gap-2">
            <Check size={18} /> {saving ? 'Saving…' : 'Save forecast'}
          </button>
        )}
        {msg && <div className="text-center text-xs text-text-secondary">{msg}</div>}
      </div>

      {board.length > 0 && (
        <div className="card-base divide-y divide-white/5">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary flex items-center gap-1"><Trophy size={13} className="text-warm-yellow" /> Leaderboard {settled ? '· final' : '· live'}</div>
          {board.slice(0, 20).map((r) => (
            <div key={r.user_id} className={`flex items-center gap-3 px-3 py-2 ${r.user_id === userId ? 'bg-electric-blue/10' : ''}`}>
              <span className="w-5 text-center font-bold tabular-nums text-sm text-text-secondary">{r.rank}</span>
              {r.avatar ? <img src={r.avatar} alt="" className="w-7 h-7 rounded-full object-cover bg-navy-accent" /> : <div className="w-7 h-7 rounded-full bg-navy-accent" />}
              <div className="flex-1 min-w-0 text-sm font-medium text-text-primary truncate">{r.username ?? 'Player'}</div>
              {settled && r.reward > 0 && <span className="text-[11px] text-warm-yellow font-bold">+{r.reward}</span>}
              <div className="text-sm font-bold text-text-primary tabular-nums w-10 text-right">{r.score}</div>
            </div>
          ))}
        </div>
      )}

      {picker && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60" onClick={() => setPicker(null)}>
          <div className="w-full max-w-md bg-deep-navy rounded-t-2xl max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="font-bold text-text-primary">Pick {isConstructorPicker ? 'a constructor' : 'a driver'}</div>
              <button onClick={() => setPicker(null)} className="p-1 text-text-secondary"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-2">
              {isConstructorPicker
                ? constructors.map((c) => {
                  const idx = Number(picker!.slice(2)); const used = tc.includes(c.id) && tc[idx] !== c.id;
                  return (
                    <button key={c.id} onClick={() => !used && choose(c.id)} disabled={used} className={`w-full flex items-center gap-3 p-2 rounded-lg text-left ${used ? 'opacity-30' : 'hover:bg-navy-accent'}`}>
                      <img src={c.logo ?? ''} alt="" className="w-9 h-9 object-contain bg-white rounded p-0.5" />
                      <span className="text-sm font-semibold text-text-primary flex-1 truncate">{c.name}</span>
                    </button>
                  );
                })
                : drivers.map((d) => {
                  const used = picker!.startsWith('d:') && td.includes(d.id) && td[Number(picker!.slice(2))] !== d.id;
                  return (
                    <button key={d.id} onClick={() => !used && choose(d.id)} disabled={used} className={`w-full flex items-center gap-3 p-2 rounded-lg text-left ${used ? 'opacity-30' : 'hover:bg-navy-accent'}`}>
                      <img src={d.image ?? ''} alt="" className="w-9 h-9 rounded-full object-cover bg-navy-accent" />
                      <span className="text-sm font-semibold text-text-primary flex-1 truncate">{surname(d)}</span>
                      {d.team_logo && <img src={d.team_logo} alt="" className="w-6 h-6 object-contain bg-white rounded p-0.5" />}
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

export default F1SeasonForecast;
