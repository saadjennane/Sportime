import { useEffect, useState } from 'react';
import { Crosshair, Save, Plus, Trash2, Crown, Flag } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Spinner, EmptyState } from '../components/ui/States';
import { toast } from '../components/ui/Toast';
import { EntryLockCell } from './EntryLockCell';

interface Gp { id: number; name: string; round: number | null; race_at: string | null }
interface SeasonGame { id: string; name: string; season: number | null; status: string; lock_at: string | null; is_active: boolean; rewards: { upto: number; coins: number }[]; entry_lock_at?: string | null }
interface PredGame {
  id: string; name: string; race_ids: number[]; status: string; entry_cost: number;
  scoring: Record<string, number>; rewards: { upto: number; coins: number }[];
  is_active: boolean; entry_lock_at?: string | null;
}
const SCORE_FIELDS: [string, string][] = [
  ['pole', 'Pole'], ['winner', 'Winner'], ['top5_exact', 'Top5 exact'],
  ['top5_partial', 'Top5 partial'], ['fastest_lap', 'Fastest lap'], ['first_dnf', 'First DNF'], ['sprint', 'Sprint'],
];

type Draft = { scoring: Record<string, string>; rewards: { upto: string; coins: string }[]; entry: string; active: boolean };

export function F1PredictorAdmin() {
  const [games, setGames] = useState<PredGame[]>([]);
  const [gps, setGps] = useState<Gp[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newRaces, setNewRaces] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  // Season Forecast
  const [seasonGames, setSeasonGames] = useState<SeasonGame[]>([]);
  const [sName, setSName] = useState('');
  const [sYear, setSYear] = useState('');
  const [sLock, setSLock] = useState('');
  const [sBusy, setSBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: g }, { data: races }, { data: sg }] = await Promise.all([
      supabase.from('f1_pred_games').select('id,name,race_ids,status,entry_cost,scoring,rewards,is_active,entry_lock_at').eq('kind', 'gp').order('created_at', { ascending: false }),
      supabase.from('f1_races').select('id,name,round,race_at').neq('status', 'Cancelled').gt('race_at', new Date().toISOString()).order('race_at'),
      supabase.from('f1_pred_games').select('id,name,season,status,lock_at,is_active,rewards,entry_lock_at').eq('kind', 'season').order('created_at', { ascending: false }),
    ]);
    const rows = (g ?? []) as any as PredGame[];
    setGames(rows);
    setGps((races ?? []) as Gp[]);
    setSeasonGames((sg ?? []) as any as SeasonGame[]);
    if (!sYear) setSYear(String((races ?? [])[0] ? new Date((races as any)[0].race_at).getFullYear() : new Date().getFullYear()));
    const d: Record<string, Draft> = {};
    rows.forEach((x) => {
      d[x.id] = {
        scoring: Object.fromEntries(SCORE_FIELDS.map(([k]) => [k, String(x.scoring?.[k] ?? 0)])),
        rewards: (x.rewards ?? []).map((t) => ({ upto: String(t.upto), coins: String(t.coins) })),
        entry: String(x.entry_cost ?? 0),
        active: x.is_active,
      };
    });
    setDraft(d);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (newRaces.size === 0) { toast('Pick at least one Grand Prix', 'error'); return; }
    setCreating(true);
    const { error } = await supabase.rpc('f1_pred_create_game', { p_name: newName, p_race_ids: Array.from(newRaces) });
    setCreating(false);
    if (error) toast(`Create failed: ${error.message}`, 'error');
    else { toast('Predictor game created', 'success'); setNewName(''); setNewRaces(new Set()); load(); }
  };

  const save = async (g: PredGame) => {
    const d = draft[g.id]; if (!d) return;
    setBusy(g.id);
    const scoring = Object.fromEntries(SCORE_FIELDS.map(([k]) => [k, Math.max(0, Math.floor(Number(d.scoring[k]) || 0))]));
    const rewards = d.rewards.map((t) => ({ upto: Math.max(1, Math.floor(Number(t.upto) || 1)), coins: Math.max(0, Math.floor(Number(t.coins) || 0)) }))
      .sort((a, b) => a.upto - b.upto);
    const { error } = await supabase.rpc('f1_pred_set_config', {
      p_game_id: g.id, p_scoring: scoring, p_rewards: rewards, p_entry_cost: Math.max(0, Math.floor(Number(d.entry) || 0)), p_is_active: d.active,
    });
    setBusy(null);
    if (error) toast(`Save failed: ${error.message}`, 'error');
    else { toast(`${g.name}: saved`, 'success'); load(); }
  };

  const createSeason = async () => {
    if (!sYear) { toast('Enter a season year', 'error'); return; }
    setSBusy('new');
    const { error } = await supabase.rpc('f1_pred_create_season', {
      p_name: sName, p_season: Math.floor(Number(sYear)), p_lock_at: sLock ? new Date(sLock).toISOString() : null,
    });
    setSBusy(null);
    if (error) toast(`Create failed: ${error.message}`, 'error');
    else { toast('Season Forecast created', 'success'); setSName(''); setSLock(''); load(); }
  };
  const settleSeason = async (g: SeasonGame) => {
    setSBusy(g.id);
    const { data, error } = await supabase.rpc('f1_pred_settle_season', { p_game_id: g.id });
    setSBusy(null);
    if (error) toast(`Settle failed: ${error.message}`, 'error');
    else { toast(`Settled ${data} forecast(s)`, 'success'); load(); }
  };

  const patch = (id: string, fn: (d: Draft) => void) =>
    setDraft((prev) => { const n = { ...prev, [id]: { ...prev[id], scoring: { ...prev[id].scoring }, rewards: prev[id].rewards.map((r) => ({ ...r })) } }; fn(n[id]); return n; });

  if (loading) return <Spinner label="Loading predictor games…" />;

  return (
    <div>
      {/* Season Forecast */}
      <div className="mb-6">
        <h3 className="font-bold flex items-center gap-2 mb-2"><Crown className="w-4 h-4 text-warm-yellow" /> Season Forecast</h3>
        <div className="p-3 bg-surface border border-border-subtle rounded-xl flex flex-wrap items-end gap-2 mb-3">
          <label className="text-xs text-text-secondary">Name
            <input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Season Forecast"
              className="mt-1 block bg-deep-navy border border-border-subtle rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-text-secondary">Season
            <input type="number" value={sYear} onChange={(e) => setSYear(e.target.value)}
              className="mt-1 block w-24 bg-deep-navy border border-border-subtle rounded-lg px-3 py-2 text-sm font-mono" />
          </label>
          <label className="text-xs text-text-secondary">Lock at (optional)
            <input type="datetime-local" value={sLock} onChange={(e) => setSLock(e.target.value)}
              className="mt-1 block bg-deep-navy border border-border-subtle rounded-lg px-3 py-2 text-sm" />
          </label>
          <button onClick={createSeason} disabled={sBusy === 'new'}
            className="flex items-center gap-2 bg-warm-yellow/15 text-warm-yellow px-4 py-2 rounded-lg font-semibold hover:bg-warm-yellow/25 disabled:opacity-50">
            <Plus size={15} /> {sBusy === 'new' ? 'Creating…' : 'Create'}
          </button>
        </div>
        {seasonGames.map((g) => (
          <div key={g.id} className="p-3 bg-surface border border-border-subtle rounded-xl flex items-center justify-between gap-3 mb-2">
            <div className="min-w-0">
              <div className="font-semibold flex items-center gap-2"><Flag className="w-4 h-4 text-warm-yellow" /> {g.name} <span className="text-text-secondary font-normal">· {g.season}</span></div>
              <div className="text-xs text-text-secondary mt-0.5">status {g.status}{g.lock_at ? ` · locks ${new Date(g.lock_at).toLocaleDateString()}` : ''}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {g.status !== 'settled' && (
                <button onClick={() => settleSeason(g)} disabled={sBusy === g.id}
                  className="bg-lime-glow/15 text-lime-glow px-4 py-2 rounded-lg font-semibold hover:bg-lime-glow/25 disabled:opacity-50">
                  {sBusy === g.id ? 'Settling…' : 'Settle from standings'}
                </button>
              )}
              <EntryLockCell kind="f1pred" id={g.id} value={g.entry_lock_at} onSaved={load} />
            </div>
          </div>
        ))}
      </div>

      <h3 className="font-bold flex items-center gap-2 mb-2"><Crosshair className="w-4 h-4 text-neon-cyan" /> GP Predictor</h3>
      <p className="text-text-secondary mb-4">A game spans one or more Grands Prix (cumulative leaderboard). Pole / Winner / Top 5 / Fastest lap / First DNF, settled automatically by the F1 sync.</p>

      {/* Create */}
      <div className="mb-5 p-3 bg-surface border border-border-subtle rounded-xl space-y-3">
        <div className="flex items-center gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Game name (e.g. June Predictor)"
            className="flex-1 bg-deep-navy border border-border-subtle rounded-lg px-3 py-2 text-sm" />
          <button onClick={create} disabled={creating || newRaces.size === 0}
            className="flex items-center gap-2 bg-electric-blue/15 text-electric-blue px-4 py-2 rounded-lg font-semibold hover:bg-electric-blue/25 disabled:opacity-50">
            <Plus size={15} /> {creating ? 'Creating…' : `Create (${newRaces.size})`}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {gps.length === 0 ? <span className="text-sm text-text-secondary">No upcoming Grands Prix.</span> : gps.map((r) => {
            const on = newRaces.has(r.id);
            return (
              <button key={r.id} onClick={() => setNewRaces((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })}
                className={`text-xs px-2.5 py-1.5 rounded-lg border ${on ? 'bg-electric-blue text-white border-electric-blue' : 'bg-deep-navy text-text-secondary border-border-subtle'}`}>
                {r.round ? `R${r.round} · ` : ''}{r.name}
              </button>
            );
          })}
        </div>
      </div>

      {!games.length && <EmptyState title="No predictor games yet" subtitle="Create one above by picking its Grands Prix." />}

      <div className="space-y-3">
        {games.map((g) => {
          const d = draft[g.id]; if (!d) return null;
          return (
            <div key={g.id} className="p-4 bg-surface border border-border-subtle rounded-xl">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-2"><Crosshair className="w-4 h-4 text-neon-cyan" /> {g.name}</div>
                  <div className="text-xs text-text-secondary mt-0.5">{g.race_ids?.length ?? 0} GP · status {g.status}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="flex items-center gap-2 text-xs text-text-secondary">
                    <input type="checkbox" checked={d.active} onChange={(e) => patch(g.id, (x) => { x.active = e.target.checked; })} /> Active
                  </label>
                  <EntryLockCell kind="f1pred" id={g.id} value={g.entry_lock_at} onSaved={load} />
                </div>
              </div>

              {/* Scoring */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                {SCORE_FIELDS.map(([k, label]) => (
                  <label key={k} className="text-xs text-text-secondary">{label}
                    <input type="number" min={0} value={d.scoring[k]} onChange={(e) => patch(g.id, (x) => { x.scoring[k] = e.target.value; })}
                      className="mt-1 w-full bg-deep-navy border border-border-subtle rounded-lg px-2 py-1.5 text-sm text-right font-mono" />
                  </label>
                ))}
              </div>

              {/* Rewards by rank */}
              <div className="mb-3">
                <div className="text-xs text-text-secondary mb-1">Rewards by rank (≤ rank → coins)</div>
                <div className="space-y-1.5">
                  {d.rewards.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary">≤ rank</span>
                      <input type="number" min={1} value={t.upto} onChange={(e) => patch(g.id, (x) => { x.rewards[i].upto = e.target.value; })}
                        className="w-20 bg-deep-navy border border-border-subtle rounded-lg px-2 py-1.5 text-sm text-right font-mono" />
                      <span className="text-xs text-text-secondary">→</span>
                      <input type="number" min={0} value={t.coins} onChange={(e) => patch(g.id, (x) => { x.rewards[i].coins = e.target.value; })}
                        className="w-24 bg-deep-navy border border-border-subtle rounded-lg px-2 py-1.5 text-sm text-right font-mono" />
                      <span className="text-xs text-text-secondary">coins</span>
                      <button onClick={() => patch(g.id, (x) => { x.rewards.splice(i, 1); })} className="text-hot-red p-1"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button onClick={() => patch(g.id, (x) => { x.rewards.push({ upto: '0', coins: '0' }); })}
                    className="text-xs text-electric-blue flex items-center gap-1"><Plus size={13} /> Add tier</button>
                </div>
              </div>

              <div className="flex items-end justify-between gap-3">
                <label className="text-xs text-text-secondary">Entry cost
                  <input type="number" min={0} value={d.entry} onChange={(e) => patch(g.id, (x) => { x.entry = e.target.value; })}
                    className="mt-1 w-28 block bg-deep-navy border border-border-subtle rounded-lg px-2 py-1.5 text-sm text-right font-mono" />
                </label>
                <button onClick={() => save(g)} disabled={busy === g.id}
                  className="flex items-center gap-2 bg-lime-glow/15 text-lime-glow px-4 py-2 rounded-lg font-semibold hover:bg-lime-glow/25 disabled:opacity-50">
                  <Save size={15} /> {busy === g.id ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
