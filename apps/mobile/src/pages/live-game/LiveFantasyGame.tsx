import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Star, Crown, RefreshCw, ShieldQuestion } from 'lucide-react';
import { getLfGame, saveLfTeam, lfTransfer } from '../../services/liveFantasyService';
import { FantasyPitch } from '../../components/fantasy/FantasyPitch';
import { FantasyPlayer, PlayerPosition } from '../../types';

interface Props { fixtureId: string; userId: string; onBack: () => void; addToast: (m: string, t: 'success' | 'error' | 'info') => void }
interface PoolP { player_id: string; name: string; photo?: string; pos: string; side: string; shirt?: number; available: boolean; on_pitch: boolean }
const POS_ORDER = ['GK', 'D', 'M', 'A'];
const POSMAP: Record<string, PlayerPosition> = { GK: 'Goalkeeper', D: 'Defender', M: 'Midfielder', A: 'Attacker' };
const surname = (n: string) => (n || '').replace(/^[A-Za-z]\.\s*/, '');

export const LiveFantasyGame: React.FC<Props> = ({ fixtureId, onBack, addToast }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string[]>([]);   // selected player_ids (build)
  const [captain, setCaptain] = useState<string | null>(null);
  const [picker, setPicker] = useState<PlayerPosition | null>(null);
  const [saving, setSaving] = useState(false);
  const [transferOut, setTransferOut] = useState<string | null>(null);

  const load = useCallback(async () => { const d = await getLfGame(fixtureId); setData(d); setLoading(false); }, [fixtureId]);
  useEffect(() => { load(); }, [load]);

  const pool: PoolP[] = data?.pool ?? [];
  const byId = (id: string) => pool.find(p => p.player_id === id);
  const homeName = useMemo(() => '🏠', []); const awayName = useMemo(() => '✈️', []);

  if (loading) return <Shell onBack={onBack}><div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-electric-blue border-t-transparent rounded-full animate-spin" /></div></Shell>;
  if (!data?.game) return <Shell onBack={onBack}><p className="text-center text-text-secondary py-20">Live Fantasy not available for this match.</p></Shell>;

  const cfg = data.config ?? {}; const myTeam = data.my_team;
  const locked = data.game.status !== 'open' && data.game.status !== 'upcoming';
  const toFantasy = (p: PoolP): FantasyPlayer => ({ id: p.player_id, name: surname(p.name), photo: p.photo ?? '', position: POSMAP[p.pos] ?? 'Midfielder', status: 'Key', fatigue: 100, teamName: p.side === 'home' ? homeName : awayName, teamLogo: '', birthdate: '', pgs: 0 });

  // ---------------- BUILDER (pitch) ----------------
  if (!myTeam && !locked) {
    const sideOut = (side: string) => sel.filter(id => byId(id)?.side === side && byId(id)?.pos !== 'GK').length;
    const starters: FantasyPlayer[] = sel.map(id => toFantasy(byId(id)!));
    const valid = sel.length === 7 && sel.some(id => byId(id)?.pos === 'GK') && sideOut('home') === 3 && sideOut('away') === 3 && !!captain;

    const onSlot = (position: PlayerPosition, player: FantasyPlayer | null) => {
      if (player) setCaptain(c => c === player.id ? null : player.id);   // tap filled -> toggle captain
      else setPicker(position);
    };
    const eligible = picker ? pool.filter(p => POSMAP[p.pos] === picker && !sel.includes(p.player_id) && (picker === 'Goalkeeper' || sideOut(p.side) < (cfg.outfield_per_team ?? 3))) : [];
    const addPlayer = (pid: string) => { setSel(s => [...s, pid]); setPicker(null); };

    const save = async () => {
      if (!valid) return; setSaving(true);
      const gk = sel.find(id => byId(id)?.pos === 'GK')!; const out = sel.filter(id => id !== gk);
      const r = await saveLfTeam(data.game.id, gk, out, captain!); setSaving(false);
      if (r?.ok) { addToast('Team saved! 🎯', 'success'); load(); } else addToast(r?.error ?? 'Invalid team', 'error');
    };

    return (
      <Shell onBack={onBack} title="Build your XI">
        {/* conditions */}
        <div className="card-base p-3 mb-3 text-[11px] text-text-secondary space-y-0.5">
          <p className="font-bold text-text-primary text-xs mb-1">Game conditions</p>
          <p>• <b className="text-text-primary">3 players from each team</b> (GK is free)</p>
          <p>• 1 goalkeeper, 2 defenders, 2 midfielders, 2 attackers</p>
          <p>• Pick a captain ⭐ (points ×{cfg.captain_multiplier ?? 2})</p>
          <div className="flex gap-1.5 pt-1">
            <span className={`px-2 py-0.5 rounded-full font-bold ${sideOut('home') === 3 ? 'bg-lime-glow/20 text-lime-glow' : 'bg-navy-accent text-text-secondary'}`}>🏠 {sideOut('home')}/3</span>
            <span className={`px-2 py-0.5 rounded-full font-bold ${sideOut('away') === 3 ? 'bg-lime-glow/20 text-lime-glow' : 'bg-navy-accent text-text-secondary'}`}>✈️ {sideOut('away')}/3</span>
          </div>
        </div>

        <FantasyPitch starters={starters} onSlotClick={onSlot} captainId={captain} selectedForSwap={null} formation="2-2-2" isLive={false} />
        <p className="text-center text-[11px] text-text-secondary mt-1">Tap a slot to pick · tap a player to make him captain ⭐</p>

        <button onClick={save} disabled={!valid || saving} className="mt-3 w-full bg-electric-blue text-white font-extrabold py-3.5 rounded-xl disabled:opacity-40">
          {saving ? 'Saving…' : valid ? 'Save team' : `Pick ${7 - sel.length} more`}
        </button>

        {/* picker sheet */}
        {picker && (
          <div className="fixed inset-0 bg-deep-navy/70 backdrop-blur-sm flex items-end z-[70]" onClick={() => setPicker(null)}>
            <div className="bg-deep-navy w-full max-w-md mx-auto rounded-t-2xl p-4 max-h-[75vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <p className="font-bold text-text-primary mb-1">Pick a {picker.toLowerCase()}</p>
              {picker === 'Goalkeeper' && (
                <div className="flex items-start gap-2 bg-warm-yellow/10 rounded-xl p-3 mb-3">
                  <ShieldQuestion size={18} className="text-warm-yellow flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-text-secondary leading-snug">The <b className="text-text-primary">least-picked goalkeeper</b> gets a points boost at kickoff — up to <b className="text-warm-yellow">×1.5</b> if under 10% of players choose him. Go against the crowd for an edge!</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {eligible.map(p => (
                  <button key={p.player_id} onClick={() => addPlayer(p.player_id)} className="flex items-center gap-2 bg-navy-accent rounded-xl px-2 py-2 text-left">
                    {p.photo ? <img src={p.photo} className="w-8 h-8 rounded-full object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />}
                    <span className="text-xs font-semibold text-text-primary truncate">{p.side === 'home' ? homeName : awayName} {surname(p.name)}</span>
                  </button>
                ))}
                {eligible.length === 0 && <p className="text-xs text-text-disabled col-span-2 py-4 text-center">No eligible player (team quota reached).</p>}
              </div>
              <button onClick={() => setPicker(null)} className="mt-3 w-full text-text-disabled text-sm py-2">Cancel</button>
            </div>
          </div>
        )}
      </Shell>
    );
  }

  // ---------------- LIVE / SUBMITTED ----------------
  const tp = myTeam?.players ?? [];
  const transfersLeft = (cfg.max_transfers ?? 3) - (myTeam?.transfers_used ?? 0);
  const lb = data.leaderboard ?? [];
  const doTransfer = async (inId: string) => {
    if (!transferOut) return; const r = await lfTransfer(data.game.id, transferOut, inId); setTransferOut(null);
    if (r?.ok) { addToast('Transfer done 🔁', 'success'); load(); } else addToast(r?.error ?? 'Transfer failed', 'error');
  };
  const eligibleIn = (outPid: string) => { const o = tp.find((x: any) => x.player_id === outPid); return pool.filter(p => p.available && p.pos === o?.pos && p.side === o?.side && !tp.some((x: any) => x.player_id === p.player_id)); };

  return (
    <Shell onBack={onBack} title="Live Fantasy">
      <div className="card-base p-3 mb-3 flex items-center justify-around text-center">
        <div><p className="text-xs text-text-secondary">Score</p><p className="text-2xl font-extrabold text-lime-glow">{Math.round(myTeam?.score ?? 0)}</p></div>
        <div><p className="text-xs text-text-secondary">Rank</p><p className="text-2xl font-extrabold text-text-primary">{myTeam?.rank ? `#${myTeam.rank}` : '—'}<span className="text-sm text-text-secondary">/{data.total_players}</span></p></div>
        <div><p className="text-xs text-text-secondary">Transfers</p><p className="text-2xl font-extrabold text-warm-yellow">{transfersLeft}</p></div>
      </div>
      <p className="text-xs font-bold text-text-secondary mb-1.5">YOUR XI</p>
      <div className="space-y-1.5 mb-4">
        {[...tp].sort((a: any, b: any) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos)).map((x: any) => {
          const p = byId(x.player_id); const gone = p && !p.available;
          return (
            <div key={x.player_id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${gone ? 'bg-hot-red/10' : 'bg-navy-accent/50'}`}>
              <span className="text-[10px] font-bold text-text-secondary w-6">{x.pos}</span>
              {p?.photo ? <img src={p.photo} className="w-7 h-7 rounded-full object-cover" /> : <div className="w-7 h-7 rounded-full bg-white/10" />}
              <span className="flex-1 text-sm font-semibold text-text-primary truncate">{surname(p?.name ?? '')}{x.is_captain && <Crown size={12} className="inline ml-1 text-warm-yellow" />}</span>
              {gone && <span className="text-[10px] text-hot-red font-bold">OFF</span>}
              {locked && transfersLeft > 0 && <button onClick={() => setTransferOut(x.player_id)} className="text-electric-blue"><RefreshCw size={15} /></button>}
            </div>
          );
        })}
      </div>
      {transferOut && (
        <div className="card-base p-3 mb-4">
          <p className="text-xs font-bold text-text-secondary mb-2">Replace with (same team & position):</p>
          <div className="grid grid-cols-2 gap-2">
            {eligibleIn(transferOut).map(p => <button key={p.player_id} onClick={() => doTransfer(p.player_id)} className="flex items-center gap-2 bg-navy-accent rounded-lg px-2 py-1.5 text-left">
              {p.photo ? <img src={p.photo} className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-white/10" />}
              <span className="text-xs font-semibold text-text-primary truncate">{surname(p.name)}</span></button>)}
            {eligibleIn(transferOut).length === 0 && <p className="text-xs text-text-disabled col-span-2">No eligible replacement on the pitch yet.</p>}
          </div>
          <button onClick={() => setTransferOut(null)} className="mt-2 text-xs text-text-disabled">Cancel</button>
        </div>
      )}
      <p className="text-xs font-bold text-text-secondary mb-1.5">LEADERBOARD</p>
      <div className="space-y-1">
        {lb.map((r: any, i: number) => (
          <div key={i} className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${r.is_me ? 'bg-electric-blue/15' : 'bg-navy-accent/30'}`}>
            <span className="text-sm font-bold text-text-primary">#{r.rank} {r.is_me && '(you)'}</span>
            <span className="text-sm font-extrabold text-lime-glow">{Math.round(r.score)}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
};

const Shell: React.FC<{ onBack: () => void; title?: string; children: React.ReactNode }> = ({ onBack, title, children }) => (
  <div className="fixed inset-0 bg-deep-navy z-50 overflow-y-auto">
    <div className="max-w-md mx-auto px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-3 sticky top-0 bg-deep-navy py-2 z-10">
        <button onClick={onBack} className="p-2 -ml-2 text-text-secondary"><ChevronLeft size={24} /></button>
        <h1 className="font-bold text-lg text-text-primary flex items-center gap-2"><Star size={18} className="text-warm-yellow" /> {title ?? 'Live Fantasy'}</h1>
      </div>
      {children}
    </div>
  </div>
);

export default LiveFantasyGame;
