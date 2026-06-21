import React, { useEffect, useMemo, useState } from 'react';
import { Swords, Check, X, Crown, Trophy } from 'lucide-react';
import { useDuelGame, type DuelLine, type DuelDriver } from '../../features/f1/useDuelGame';
import type { GrandPrix } from '../../features/f1/useF1';

const SUFFIX = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
// Surname for the board — strips generational suffixes so "Carlos Sainz Jr" → "Sainz".
const last = (d: DuelDriver) => {
  const parts = (d.name || d.last_name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1 && SUFFIX.has(parts[parts.length - 1].toLowerCase())) parts.pop();
  return parts[parts.length - 1] || d.last_name || '?';
};

const DriverHalf: React.FC<{ d: DuelDriver; side: 'l' | 'r'; selected: boolean; isFav: boolean; locked: boolean; settled?: boolean; won?: boolean; picked?: boolean; onClick: () => void }>
  = ({ d, side, selected, isFav, locked, settled, won, picked, onClick }) => {
  const cls = settled
    ? (won ? 'border-lime-glow bg-lime-glow/15' : picked ? 'border-hot-red bg-hot-red/10' : 'border-disabled bg-deep-navy opacity-70')
    : (selected ? 'border-electric-blue bg-electric-blue/15' : 'border-disabled bg-deep-navy');
  return (
    <button onClick={onClick} disabled={locked}
      className={`flex-1 min-w-0 flex items-center gap-2 p-2 rounded-lg border transition-colors disabled:opacity-100 ${side === 'r' ? 'flex-row-reverse text-right' : ''} ${cls}`}>
      {d.image
        ? <img src={d.image} alt="" className="w-10 h-10 rounded-full object-cover bg-navy-accent shrink-0" />
        : <div className="w-10 h-10 rounded-full bg-navy-accent shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className={`text-xs font-bold text-text-primary truncate leading-tight flex items-center gap-1 ${side === 'r' ? 'flex-row-reverse' : ''}`}>
          {last(d)}{settled && won && <Check size={11} className="text-lime-glow shrink-0" />}
        </div>
        <div className={`flex items-center gap-1 ${side === 'r' ? 'justify-end' : ''}`}>
          <span className="text-[10px] text-text-secondary tabular-nums">{d.position != null ? `P${d.position}` : '–'}</span>
          {settled
            ? (picked ? <span className="text-[9px] font-bold text-electric-blue">YOUR PICK</span> : null)
            : (isFav ? <Crown size={10} className="text-warm-yellow" /> : <span className="text-[9px] font-bold text-lime-glow">+5</span>)}
        </div>
      </div>
    </button>
  );
};

/** Teammates Duels — pick which teammate finishes ahead on all 11 lines. */
export const F1Duels: React.FC<{ gp: GrandPrix; userId?: string }> = ({ gp, userId }) => {
  const { game, card, board, outcomes, loading, savePicks } = useDuelGame(gp.id, userId);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { setPicks(card?.picks ?? {}); }, [card]);

  const started = !!gp.raceAt && new Date(gp.raceAt).getTime() <= Date.now();
  const settled = game?.status === 'settled';
  const locked = settled || started;

  const chosen = useMemo(() => Object.keys(picks).length, [picks]);
  const pairs: DuelLine[] = game?.pairs ?? [];

  const pick = (teamId: number, driverId: number) => {
    if (locked) return;
    setPicks((p) => ({ ...p, [teamId]: driverId }));
    setMsg(null);
  };
  const save = async () => {
    setSaving(true); setMsg(null);
    const r = await savePicks(picks);
    setSaving(false);
    setMsg(r.ok ? 'Card saved ✓' : r.error || 'Could not save');
  };

  if (loading) return <div className="card-base p-6 text-center text-text-secondary text-sm">Loading duels…</div>;
  if (!game) return <div className="card-base p-6 text-center text-text-secondary text-sm">No Teammates Duels game for this Grand Prix yet.</div>;

  return (
    <div className="space-y-3">
      {/* Intro */}
      <div className="card-base p-4">
        <div className="flex items-center gap-2 text-electric-blue font-bold"><Swords size={18} /> Teammates Duels</div>
        <p className="text-xs text-text-secondary mt-1">Pick which teammate finishes ahead on all 11 lines. <span className="text-text-primary">+10</span> per correct duel. An <span className="text-lime-glow">upset</span> (backing the lower-ranked driver, <Crown size={10} className="inline text-warm-yellow" /> = favourite) scores <span className="text-lime-glow">+5</span>{game.upsetBonus > 0 && <> and pays <span className="text-lime-glow font-semibold">+{game.upsetBonus} coins</span></>}.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(game.rewards).sort((a, b) => Number(a[0]) - Number(b[0])).map(([f, c]) => (
            <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-navy-accent text-text-secondary">{f} fault{f === '1' ? '' : 's'} → <span className="text-warm-yellow font-bold">{c}</span></span>
          ))}
        </div>
      </div>

      {/* Settled — your scorecard + reward breakdown */}
      {settled && card && (() => {
        const upsetCoins = (card.upsets ?? 0) * (game.upsetBonus ?? 0);
        const baseCoins = Math.max(0, (card.reward ?? 0) - ((card.reward ?? 0) > 0 ? upsetCoins : 0));
        return (
          <div className="card-base p-4 space-y-2">
            <div className="flex items-center gap-2 font-bold text-text-primary"><Trophy size={16} className="text-warm-yellow" /> Your result</div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[['Correct', `${card.correct ?? 0}/11`], ['Upsets', card.upsets], ['Faults', card.faults], ['Score', card.score]].map(([k, v]) => (
                <div key={k as string} className="bg-deep-navy rounded-lg py-2">
                  <div className="text-lg font-extrabold text-text-primary tabular-nums">{v ?? '–'}</div>
                  <div className="text-[10px] uppercase tracking-wide text-text-secondary">{k}</div>
                </div>
              ))}
            </div>
            {(card.reward ?? 0) > 0 ? (
              <div className="text-center pt-1">
                <div className="text-lg font-extrabold text-lime-glow">+{card.reward?.toLocaleString()} coins</div>
                <div className="text-[11px] text-text-secondary">
                  palier {card.palier} fault{card.palier === 1 ? '' : 's'}: {baseCoins.toLocaleString()}
                  {upsetCoins > 0 && <> + {card.upsets} upset{card.upsets === 1 ? '' : 's'} × {game.upsetBonus} = <span className="text-lime-glow">+{upsetCoins.toLocaleString()}</span></>}
                </div>
              </div>
            ) : (
              <div className="text-center text-sm pt-1 text-text-secondary">No reward this time ({card.faults} faults — pays up to 3)</div>
            )}
          </div>
        );
      })()}

      {settled && board.length > 0 && (
        <div className="card-base divide-y divide-white/5">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Leaderboard</div>
          {board.slice(0, 20).map((r) => (
            <div key={r.user_id} className={`flex items-center gap-3 px-3 py-2 ${r.user_id === userId ? 'bg-electric-blue/10' : ''}`}>
              <span className="w-5 text-center font-bold tabular-nums text-sm text-text-secondary">{r.rank}</span>
              {r.avatar ? <img src={r.avatar} alt="" className="w-7 h-7 rounded-full object-cover bg-navy-accent" /> : <div className="w-7 h-7 rounded-full bg-navy-accent" />}
              <div className="flex-1 min-w-0 text-sm font-medium text-text-primary truncate">{r.username ?? 'Player'}</div>
              <div className="text-xs text-text-secondary tabular-nums">{r.correct}/11 · {r.upsets}↑</div>
              <div className="text-sm font-bold text-warm-yellow tabular-nums w-12 text-right">{r.score}</div>
            </div>
          ))}
        </div>
      )}

      {/* The 11 duel lines */}
      <div className="space-y-2">
        {pairs.map((line) => {
          const sel = picks[line.team_id];
          const myPick = settled ? card?.picks?.[line.team_id] : sel;
          const winner = settled ? outcomes[line.team_id] : undefined; // driver id, or null = void
          const voided = settled && winner == null;
          const pickedWon = settled && myPick != null && myPick === winner;
          const isUpset = pickedWon && myPick !== line.fav_id;
          return (
            <div key={line.team_id} className="card-base p-2">
              <div className="flex items-center gap-1.5">
                <DriverHalf d={line.a} side="l" selected={sel === line.a.id} isFav={line.fav_id === line.a.id} locked={locked}
                  settled={settled} won={settled && winner === line.a.id} picked={settled && myPick === line.a.id} onClick={() => pick(line.team_id, line.a.id)} />
                <div className="shrink-0 flex flex-col items-center gap-0.5 px-0.5 w-12">
                  {line.team_logo && <img src={line.team_logo} alt={line.team_name} className="w-7 h-7 object-contain bg-white rounded-md p-0.5" />}
                  {!settled
                    ? <span className="text-[8px] text-text-disabled uppercase">vs</span>
                    : voided ? <span className="text-[8px] text-text-disabled uppercase">void</span>
                      : isUpset ? <span className="text-[8px] font-bold text-lime-glow">UPSET</span>
                        : pickedWon ? <Check size={12} className="text-lime-glow" />
                          : <X size={12} className="text-hot-red" />}
                </div>
                <DriverHalf d={line.b} side="r" selected={sel === line.b.id} isFav={line.fav_id === line.b.id} locked={locked}
                  settled={settled} won={settled && winner === line.b.id} picked={settled && myPick === line.b.id} onClick={() => pick(line.team_id, line.b.id)} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Save bar */}
      {!locked && (
        <div className="sticky bottom-2 z-10">
          <button onClick={save} disabled={saving}
            className="w-full py-3 rounded-xl font-bold bg-electric-blue text-white disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg">
            <Check size={18} /> {saving ? 'Saving…' : `Save card (${chosen}/11)`}
          </button>
          {msg && <div className="text-center text-xs text-text-secondary mt-1">{msg}</div>}
        </div>
      )}
      {locked && !settled && <div className="card-base p-3 text-center text-text-secondary text-sm">Picks are locked — the race has started. Results after the finish.</div>}
    </div>
  );
};

export default F1Duels;
