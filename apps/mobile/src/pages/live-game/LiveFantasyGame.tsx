import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Star, Crown, RefreshCw } from 'lucide-react';
import { getLfGame, saveLfTeam, lfTransfer } from '../../services/liveFantasyService';

interface Props { fixtureId: string; userId: string; onBack: () => void; addToast: (m: string, t: 'success' | 'error' | 'info') => void }
interface PoolP { player_id: string; name: string; photo?: string; pos: string; side: string; shirt?: number; available: boolean; on_pitch: boolean }
const POS_ORDER = ['GK', 'D', 'M', 'A'];
const surname = (n: string) => (n || '').replace(/^[A-Za-z]\.\s*/, '');

export const LiveFantasyGame: React.FC<Props> = ({ fixtureId, onBack, addToast }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gk, setGk] = useState<string | null>(null);
  const [out, setOut] = useState<string[]>([]);
  const [cap, setCap] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [transferOut, setTransferOut] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await getLfGame(fixtureId);
    setData(d); setLoading(false);
  }, [fixtureId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Shell onBack={onBack}><div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-electric-blue border-t-transparent rounded-full animate-spin" /></div></Shell>;
  if (!data?.game) return <Shell onBack={onBack}><p className="text-center text-text-secondary py-20">Live Fantasy not available for this match.</p></Shell>;

  const pool: PoolP[] = data.pool ?? [];
  const cfg = data.config ?? {};
  const myTeam = data.my_team;
  const locked = data.game.status !== 'open' && data.game.status !== 'upcoming';
  const byId = (id: string) => pool.find(p => p.player_id === id);

  // ---------------- BUILDER ----------------
  if (!myTeam && !locked) {
    const nd = out.filter(id => byId(id)?.pos === 'D').length, nm = out.filter(id => byId(id)?.pos === 'M').length, na = out.filter(id => byId(id)?.pos === 'A').length;
    const nh = out.filter(id => byId(id)?.side === 'home').length, naway = out.filter(id => byId(id)?.side === 'away').length;
    const per = cfg.outfield_per_team ?? 3;
    const canPick = (p: PoolP) => {
      if (out.includes(p.player_id)) return true;
      const pc = p.pos === 'D' ? nd : p.pos === 'M' ? nm : na;
      const sc = p.side === 'home' ? nh : naway;
      return out.length < 6 && pc < 2 && sc < per;
    };
    const toggleOut = (p: PoolP) => { setOut(o => o.includes(p.player_id) ? o.filter(x => x !== p.player_id) : (canPick(p) ? [...o, p.player_id] : o)); };
    const valid = !!gk && out.length === 6 && nd === 2 && nm === 2 && na === 2 && nh === per && naway === per && !!cap;
    const all7 = gk ? [gk, ...out] : out;
    const gks = pool.filter(p => p.pos === 'GK');
    const homeName = '🏠'; const awayName = '✈️';

    const save = async () => {
      if (!valid) return; setSaving(true);
      const r = await saveLfTeam(data.game.id, gk!, out, cap!);
      setSaving(false);
      if (r?.ok) { addToast('Team saved! 🎯', 'success'); load(); } else addToast(r?.error ?? 'Invalid team', 'error');
    };

    return (
      <Shell onBack={onBack} title="Build your XI">
        <div className="text-[11px] text-text-secondary text-center mb-3">1 GK (any side) · 2 DEF · 2 MID · 2 ATT · {per} per team · pick a captain ⭐</div>
        {/* counters */}
        <div className="flex justify-center gap-1.5 mb-3 text-[11px] font-bold">
          {[['DEF', nd], ['MID', nm], ['ATT', na]].map(([l, n]) => <span key={l} className={`px-2 py-1 rounded-full ${n === 2 ? 'bg-lime-glow/20 text-lime-glow' : 'bg-navy-accent text-text-secondary'}`}>{l} {n}/2</span>)}
          <span className={`px-2 py-1 rounded-full ${nh === per ? 'bg-lime-glow/20 text-lime-glow' : 'bg-navy-accent text-text-secondary'}`}>🏠 {nh}/{per}</span>
          <span className={`px-2 py-1 rounded-full ${naway === per ? 'bg-lime-glow/20 text-lime-glow' : 'bg-navy-accent text-text-secondary'}`}>✈️ {naway}/{per}</span>
        </div>
        {/* GK */}
        <p className="text-xs font-bold text-text-secondary mb-1.5">GOALKEEPER</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {gks.map(p => <PlayerChip key={p.player_id} p={p} selected={gk === p.player_id} isCaptain={cap === p.player_id} onClick={() => setGk(g => g === p.player_id ? null : p.player_id)} onCaptain={gk === p.player_id ? () => setCap(c => c === p.player_id ? null : p.player_id) : undefined} />)}
        </div>
        {/* outfield grouped */}
        {(['D', 'M', 'A'] as const).map(pos => (
          <div key={pos} className="mb-3">
            <p className="text-xs font-bold text-text-secondary mb-1.5">{pos === 'D' ? 'DEFENDERS' : pos === 'M' ? 'MIDFIELDERS' : 'ATTACKERS'}</p>
            <div className="grid grid-cols-2 gap-2">
              {pool.filter(p => p.pos === pos).map(p => {
                const sel = out.includes(p.player_id);
                return <PlayerChip key={p.player_id} p={p} side={p.side === 'home' ? homeName : awayName} selected={sel} disabled={!sel && !canPick(p)} isCaptain={cap === p.player_id}
                  onClick={() => toggleOut(p)} onCaptain={sel ? () => setCap(c => c === p.player_id ? null : p.player_id) : undefined} />;
              })}
            </div>
          </div>
        ))}
        <button onClick={save} disabled={!valid || saving} className="sticky bottom-2 mt-2 w-full bg-electric-blue text-white font-extrabold py-3.5 rounded-xl disabled:opacity-40">
          {saving ? 'Saving…' : valid ? `Save team (C: ${cap ? surname(byId(cap)?.name ?? '') : '—'})` : `Pick ${7 - all7.length} more`}
        </button>
      </Shell>
    );
  }

  // ---------------- LIVE / SUBMITTED ----------------
  const tp = myTeam?.players ?? [];
  const transfersLeft = (cfg.max_transfers ?? 3) - (myTeam?.transfers_used ?? 0);
  const lb = data.leaderboard ?? [];

  const doTransfer = async (inId: string) => {
    if (!transferOut) return;
    const r = await lfTransfer(data.game.id, transferOut, inId);
    setTransferOut(null);
    if (r?.ok) { addToast('Transfer done 🔁', 'success'); load(); } else addToast(r?.error ?? 'Transfer failed', 'error');
  };
  const eligibleIn = (outPid: string) => {
    const o = tp.find((x: any) => x.player_id === outPid);
    return pool.filter(p => p.available && p.pos === o?.pos && p.side === o?.side && !tp.some((x: any) => x.player_id === p.player_id));
  };

  return (
    <Shell onBack={onBack} title="Live Fantasy">
      <div className="card-base p-3 mb-3 flex items-center justify-around text-center">
        <div><p className="text-xs text-text-secondary">Score</p><p className="text-2xl font-extrabold text-lime-glow">{Math.round(myTeam?.score ?? 0)}</p></div>
        <div><p className="text-xs text-text-secondary">Rank</p><p className="text-2xl font-extrabold text-text-primary">{myTeam?.rank ? `#${myTeam.rank}` : '—'}<span className="text-sm text-text-secondary">/{data.total_players}</span></p></div>
        <div><p className="text-xs text-text-secondary">Transfers</p><p className="text-2xl font-extrabold text-warm-yellow">{transfersLeft}</p></div>
      </div>

      <p className="text-xs font-bold text-text-secondary mb-1.5">YOUR XI {locked ? '' : '(tap to set captain not available — locked at kickoff)'}</p>
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

      {/* transfer picker */}
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

const PlayerChip: React.FC<{ p: PoolP; side?: string; selected?: boolean; disabled?: boolean; isCaptain?: boolean; onClick: () => void; onCaptain?: () => void }> = ({ p, side, selected, disabled, isCaptain, onClick, onCaptain }) => (
  <div className={`relative flex items-center gap-2 rounded-xl px-2 py-2 border ${selected ? 'border-electric-blue bg-electric-blue/10' : 'border-white/10'} ${disabled ? 'opacity-40' : ''}`}>
    <button onClick={onClick} disabled={disabled} className="flex items-center gap-2 flex-1 min-w-0 text-left">
      {p.photo ? <img src={p.photo} className="w-7 h-7 rounded-full object-cover flex-shrink-0" /> : <div className="w-7 h-7 rounded-full bg-white/10 flex-shrink-0" />}
      <span className="text-xs font-semibold text-text-primary truncate">{side && <span className="mr-0.5">{side}</span>}{surname(p.name)}</span>
    </button>
    {selected && onCaptain && <button onClick={onCaptain} className={isCaptain ? 'text-warm-yellow' : 'text-text-disabled'}><Crown size={15} /></button>}
  </div>
);

export default LiveFantasyGame;
