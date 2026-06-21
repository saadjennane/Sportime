import React, { useEffect, useMemo, useState } from 'react';
import { Crosshair, Check, Trophy, X, ChevronRight } from 'lucide-react';
import { usePredGame, type PredDriver } from '../../features/f1/usePredGame';

const SUFFIX = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
const surname = (d?: PredDriver | null) => {
  if (!d) return '';
  const parts = (d.name || d.last_name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1 && SUFFIX.has(parts[parts.length - 1].toLowerCase())) parts.pop();
  return parts[parts.length - 1] || d.last_name || '?';
};

type Field = 'pole' | 'winner' | 'fastest_lap' | 'first_dnf' | `top5:${number}`;

const Avatar: React.FC<{ d?: PredDriver | null; size?: number }> = ({ d, size = 36 }) => (
  d?.image
    ? <img src={d.image} alt="" style={{ width: size, height: size }} className="rounded-full object-cover bg-navy-accent shrink-0" />
    : <div style={{ width: size, height: size }} className="rounded-full bg-navy-accent shrink-0" />
);

/** GP Predictor — Pole / Winner / Top 5 (ordered) / Fastest lap / First DNF, per GP. */
export const F1Predictor: React.FC<{ gameId: string; userId?: string }> = ({ gameId, userId }) => {
  const { game, races, drivers, cards, board, loading, savePicks } = usePredGame(gameId, userId);
  const [activeRid, setActiveRid] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ pole?: number | null; winner?: number | null; top5: number[]; fastest_lap?: number | null; first_dnf?: number | null }>({ top5: [] });
  const [picker, setPicker] = useState<Field | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const byId = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);

  useEffect(() => {
    if (activeRid == null && races.length) {
      const now = Date.now();
      const open = races.find((r) => !r.quali_start_at || new Date(r.quali_start_at).getTime() > now);
      setActiveRid((open ?? races[0]).id);
    }
  }, [races, activeRid]);

  useEffect(() => {
    if (activeRid == null) return;
    const c = cards[activeRid];
    setDraft(c ? { pole: c.pole, winner: c.winner, top5: c.top5 ?? [], fastest_lap: c.fastest_lap, first_dnf: c.first_dnf } : { top5: [] });
    setMsg(null);
  }, [activeRid, cards]);

  if (loading) return <div className="card-base p-6 text-center text-text-secondary text-sm">Loading predictor…</div>;
  if (!game) return <div className="card-base p-6 text-center text-text-secondary text-sm">Game not found.</div>;

  const activeRace = races.find((r) => r.id === activeRid) || null;
  const card = activeRid != null ? cards[activeRid] : undefined;
  const qualiLocked = !!activeRace?.quali_start_at && new Date(activeRace.quali_start_at).getTime() <= Date.now();
  const settled = card?.status === 'settled';
  const locked = qualiLocked || settled || game.status === 'settled';

  const pickDriver = (id: number) => {
    if (!picker) return;
    if (picker.startsWith('top5:')) {
      const idx = Number(picker.split(':')[1]);
      setDraft((d) => { const t = [...d.top5]; t[idx] = id; return { ...d, top5: t }; });
    } else {
      setDraft((d) => ({ ...d, [picker]: id }));
    }
    setPicker(null); setMsg(null);
  };

  const save = async () => {
    if (activeRid == null) return;
    setSaving(true); setMsg(null);
    const r = await savePicks(activeRid, draft);
    setSaving(false);
    setMsg(r.ok ? 'Predictions saved ✓' : r.error || 'Could not save');
  };

  const ptsFor = (k: string) => (settled && card?.breakdown?.[k] ? card.breakdown[k] : null);

  const FieldRow: React.FC<{ field: Field; label: string; value?: number | null; pts?: number | null }> = ({ field, label, value, pts }) => {
    const d = value != null ? byId.get(value) : null;
    return (
      <button onClick={() => !locked && setPicker(field)} disabled={locked}
        className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-deep-navy border border-disabled disabled:opacity-100 text-left">
        <span className="text-[11px] uppercase tracking-wide text-text-secondary w-20 shrink-0">{label}</span>
        {d ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Avatar d={d} size={32} />
            <span className="text-sm font-bold text-text-primary truncate">{surname(d)}</span>
            {d.team_logo && <img src={d.team_logo} alt="" className="w-5 h-5 object-contain bg-white rounded p-0.5" />}
          </div>
        ) : <span className="flex-1 text-sm text-text-disabled">Tap to pick</span>}
        {pts != null ? <span className="text-xs font-bold text-lime-glow shrink-0">+{pts}</span> : !locked && <ChevronRight size={16} className="text-text-disabled shrink-0" />}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {/* Intro */}
      <div className="card-base p-4">
        <div className="flex items-center gap-2 text-neon-cyan font-bold"><Crosshair size={18} /> {game.name}</div>
        <p className="text-xs text-text-secondary mt-1">Predict each GP before qualifying. Pole <b className="text-text-primary">+{game.scoring.pole}</b> · Winner <b className="text-text-primary">+{game.scoring.winner}</b> · Top 5 <b className="text-text-primary">+{game.scoring.top5_exact}</b>/slot (<b>+{game.scoring.top5_partial}</b> wrong place) · Fastest lap <b className="text-text-primary">+{game.scoring.fastest_lap}</b> · First DNF <b className="text-text-primary">+{game.scoring.first_dnf}</b>.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {game.rewards.map((t, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-navy-accent text-text-secondary">≤ rank {t.upto} → <span className="text-warm-yellow font-bold">{t.coins}</span></span>
          ))}
        </div>
      </div>

      {/* GP switcher (only if >1) */}
      {races.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {races.map((r) => {
            const c = cards[r.id];
            const done = c?.status === 'settled';
            const hasCard = !!c;
            return (
              <button key={r.id} onClick={() => setActiveRid(r.id)}
                className={`shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border ${activeRid === r.id ? 'bg-electric-blue text-white border-electric-blue' : 'bg-navy-accent text-text-secondary border-transparent'}`}>
                {r.round ? `R${r.round}` : r.name}{done ? ' ✓' : hasCard ? ' •' : ''}
              </button>
            );
          })}
        </div>
      )}

      {/* Active GP card */}
      {activeRace && (
        <div className="card-base p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-bold text-text-primary text-sm">{activeRace.name}</div>
            {settled ? <span className="text-xs font-bold text-lime-glow">Scored: {card?.score ?? 0} pts</span>
              : qualiLocked ? <span className="text-xs text-text-secondary">Locked</span>
                : activeRace.quali_start_at ? <span className="text-[11px] text-text-secondary">Locks at quali</span> : null}
          </div>

          <FieldRow field="pole" label="Pole" value={draft.pole} pts={ptsFor('pole')} />
          <FieldRow field="winner" label="Winner" value={draft.winner} pts={ptsFor('winner')} />
          <div className="rounded-lg bg-deep-navy border border-disabled p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-text-secondary">Top 5 (in order)</span>
              {ptsFor('top5') != null && <span className="text-xs font-bold text-lime-glow">+{ptsFor('top5')}</span>}
            </div>
            {[0, 1, 2, 3, 4].map((i) => {
              const d = draft.top5[i] != null ? byId.get(draft.top5[i]) : null;
              return (
                <button key={i} onClick={() => !locked && setPicker(`top5:${i}` as Field)} disabled={locked}
                  className="w-full flex items-center gap-2 disabled:opacity-100 text-left">
                  <span className="w-5 text-center text-xs font-bold text-text-secondary tabular-nums">P{i + 1}</span>
                  {d ? <><Avatar d={d} size={28} /><span className="text-sm font-semibold text-text-primary truncate flex-1">{surname(d)}</span>{d.team_logo && <img src={d.team_logo} className="w-4 h-4 object-contain bg-white rounded p-0.5" />}</>
                    : <span className="flex-1 text-sm text-text-disabled">Tap to pick</span>}
                </button>
              );
            })}
          </div>
          <FieldRow field="fastest_lap" label="Fastest lap" value={draft.fastest_lap} pts={ptsFor('fastest_lap')} />
          <FieldRow field="first_dnf" label="First DNF" value={draft.first_dnf} pts={ptsFor('first_dnf')} />

          {!locked && (
            <button onClick={save} disabled={saving}
              className="w-full py-3 rounded-xl font-bold bg-electric-blue text-white disabled:opacity-50 flex items-center justify-center gap-2">
              <Check size={18} /> {saving ? 'Saving…' : 'Save predictions'}
            </button>
          )}
          {msg && <div className="text-center text-xs text-text-secondary">{msg}</div>}
          {qualiLocked && !settled && <div className="text-center text-xs text-text-secondary">Locked — qualifying has started.</div>}
        </div>
      )}

      {/* Leaderboard */}
      {board.length > 0 && (
        <div className="card-base divide-y divide-white/5">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary flex items-center gap-1"><Trophy size={13} className="text-warm-yellow" /> Leaderboard {game.status === 'settled' ? '· final' : '· live'}</div>
          {board.slice(0, 20).map((r) => (
            <div key={r.user_id} className={`flex items-center gap-3 px-3 py-2 ${r.user_id === userId ? 'bg-electric-blue/10' : ''}`}>
              <span className="w-5 text-center font-bold tabular-nums text-sm text-text-secondary">{r.rank}</span>
              {r.avatar ? <img src={r.avatar} alt="" className="w-7 h-7 rounded-full object-cover bg-navy-accent" /> : <div className="w-7 h-7 rounded-full bg-navy-accent" />}
              <div className="flex-1 min-w-0 text-sm font-medium text-text-primary truncate">{r.username ?? 'Player'}</div>
              {game.status === 'settled' && r.reward > 0 && <span className="text-[11px] text-warm-yellow font-bold">+{r.reward}</span>}
              <div className="text-sm font-bold text-text-primary tabular-nums w-10 text-right">{r.score}</div>
            </div>
          ))}
        </div>
      )}

      {/* Driver picker */}
      {picker && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60" onClick={() => setPicker(null)}>
          <div className="w-full max-w-md bg-deep-navy rounded-t-2xl max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="font-bold text-text-primary">Pick a driver</div>
              <button onClick={() => setPicker(null)} className="p-1 text-text-secondary"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-2">
              {drivers.map((d) => {
                const usedInTop5 = picker.startsWith('top5:') && draft.top5.includes(d.id) && draft.top5[Number(picker.split(':')[1])] !== d.id;
                return (
                  <button key={d.id} onClick={() => !usedInTop5 && pickDriver(d.id)} disabled={usedInTop5}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left ${usedInTop5 ? 'opacity-30' : 'hover:bg-navy-accent'}`}>
                    <Avatar d={d} size={36} />
                    <span className="text-sm font-semibold text-text-primary flex-1 truncate">{surname(d)}</span>
                    {d.number != null && <span className="text-xs text-text-secondary tabular-nums">#{d.number}</span>}
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

export default F1Predictor;
