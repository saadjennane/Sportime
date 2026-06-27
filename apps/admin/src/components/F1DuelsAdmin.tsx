import { useEffect, useState } from 'react';
import { Swords, Save, Plus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Spinner, EmptyState } from '../components/ui/States';
import { toast } from '../components/ui/Toast';
import { EntryLockCell } from './EntryLockCell';

interface Gp { id: number; name: string; round: number | null; race_at: string | null }

interface DuelGame {
  id: string;
  race_id: number;
  status: string;
  entry_lock_at?: string | null;
  entry_cost: number;
  rewards: Record<string, number>;
  upset_bonus: number;
  pairs: any[] | null;
  is_active: boolean;
  race?: { name: string; round: number | null; race_at: string | null };
}

const FAULTS = ['0', '1', '2', '3'];

export function F1DuelsAdmin() {
  const [games, setGames] = useState<DuelGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, { rewards: Record<string, string>; entry: string; bonus: string; active: boolean }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [gps, setGps] = useState<Gp[]>([]);
  const [newGp, setNewGp] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('f1_duel_games')
      .select('id,race_id,status,entry_cost,rewards,upset_bonus,pairs,is_active,entry_lock_at,race:f1_races(name,round,race_at)')
      .neq('status', 'settled')
      .order('race_id');
    const rows = (data ?? []) as any as DuelGame[];
    // order by race date
    rows.sort((a, b) => new Date(a.race?.race_at ?? 0).getTime() - new Date(b.race?.race_at ?? 0).getTime());
    setGames(rows);

    // Upcoming GPs that don't yet have a duel game (for manual creation)
    const { data: races } = await supabase
      .from('f1_races')
      .select('id,name,round,race_at')
      .neq('status', 'Cancelled')
      .gt('race_at', new Date().toISOString())
      .order('race_at');
    const have = new Set(rows.map((r) => r.race_id));
    const avail = (races ?? []).filter((r: any) => !have.has(r.id)) as Gp[];
    setGps(avail);
    setNewGp(avail[0]?.id ?? null);
    const d: typeof draft = {};
    rows.forEach((g) => {
      d[g.id] = {
        rewards: Object.fromEntries(FAULTS.map((f) => [f, String(g.rewards?.[f] ?? 0)])),
        entry: String(g.entry_cost ?? 0),
        bonus: String(g.upset_bonus ?? 0),
        active: g.is_active,
      };
    });
    setDraft(d);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async (g: DuelGame) => {
    const d = draft[g.id];
    if (!d) return;
    setBusy(g.id);
    const rewards = Object.fromEntries(FAULTS.map((f) => [f, Math.max(0, Math.floor(Number(d.rewards[f]) || 0))]));
    const { error } = await supabase.rpc('f1_duel_set_config', {
      p_game_id: g.id, p_rewards: rewards, p_entry_cost: Math.max(0, Math.floor(Number(d.entry) || 0)),
      p_is_active: d.active, p_upset_bonus: Math.max(0, Math.floor(Number(d.bonus) || 0)),
    });
    setBusy(null);
    if (error) toast(`Save failed: ${error.message}`, 'error');
    else { toast(`${g.race?.name ?? 'Game'}: config saved`, 'success'); load(); }
  };

  const createGame = async () => {
    if (!newGp) return;
    setCreating(true);
    const { error } = await supabase.rpc('f1_duel_create_game', { p_race_id: newGp });
    setCreating(false);
    if (error) toast(`Create failed: ${error.message}`, 'error');
    else { toast('Duel game created', 'success'); load(); }
  };

  const patch = (id: string, fn: (d: { rewards: Record<string, string>; entry: string; active: boolean }) => void) =>
    setDraft((prev) => { const next = { ...prev, [id]: { ...prev[id], rewards: { ...prev[id].rewards } } }; fn(next[id]); return next; });

  if (loading) return <Spinner label="Loading duel games…" />;

  return (
    <div>
      <p className="text-text-secondary mb-4">
        Teammates Duels — 11 lines, pick who finishes ahead. Create a game per Grand Prix, then set the coin reward per fault count (0–3 faults paid). Settlement runs automatically from the F1 sync.
      </p>

      {/* Create a game for a Grand Prix */}
      <div className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-surface border border-border-subtle rounded-xl">
        <span className="text-sm font-semibold">New game:</span>
        {gps.length === 0 ? (
          <span className="text-sm text-text-secondary">All upcoming Grands Prix already have a game.</span>
        ) : (
          <>
            <select value={newGp ?? ''} onChange={(e) => setNewGp(Number(e.target.value))}
              className="bg-deep-navy border border-border-subtle rounded-lg px-3 py-2 text-sm">
              {gps.map((g) => <option key={g.id} value={g.id}>{g.round ? `R${g.round} · ` : ''}{g.name}</option>)}
            </select>
            <button onClick={createGame} disabled={creating || !newGp}
              className="flex items-center gap-2 bg-electric-blue/15 text-electric-blue px-4 py-2 rounded-lg font-semibold hover:bg-electric-blue/25 disabled:opacity-50">
              <Plus size={15} /> {creating ? 'Creating…' : 'Create'}
            </button>
          </>
        )}
      </div>

      {!games.length && <EmptyState title="No duel games yet" subtitle="Create one for an upcoming Grand Prix above." />}

      <div className="space-y-3">
        {games.map((g) => {
          const d = draft[g.id];
          if (!d) return null;
          return (
            <div key={g.id} className="p-4 bg-surface border border-border-subtle rounded-xl">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    <Swords className="w-4 h-4 text-electric-blue" />
                    {g.race?.round ? `R${g.race.round} · ` : ''}{g.race?.name ?? `Race ${g.race_id}`}
                  </div>
                  <div className="text-xs text-text-secondary mt-0.5">
                    {g.pairs?.length ?? 0} duels · status {g.status} · {g.race?.race_at ? new Date(g.race.race_at).toLocaleDateString() : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="flex items-center gap-2 text-xs text-text-secondary">
                    <input type="checkbox" checked={d.active} onChange={(e) => patch(g.id, (x) => { x.active = e.target.checked; })} />
                    Active
                  </label>
                  <EntryLockCell kind="f1duel" id={g.id} value={g.entry_lock_at} onSaved={load} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                {FAULTS.map((f) => (
                  <label key={f} className="text-xs text-text-secondary">
                    {f} fault{f === '1' ? '' : 's'}
                    <input type="number" min={0} value={d.rewards[f]}
                      onChange={(e) => patch(g.id, (x) => { x.rewards[f] = e.target.value; })}
                      className="mt-1 w-full bg-deep-navy border border-border-subtle rounded-lg px-2 py-1.5 text-sm text-right font-mono" />
                  </label>
                ))}
                <label className="text-xs text-text-secondary">
                  Entry cost
                  <input type="number" min={0} value={d.entry}
                    onChange={(e) => patch(g.id, (x) => { x.entry = e.target.value; })}
                    className="mt-1 w-full bg-deep-navy border border-border-subtle rounded-lg px-2 py-1.5 text-sm text-right font-mono" />
                </label>
                <label className="text-xs text-text-secondary">
                  Upset bonus
                  <input type="number" min={0} value={d.bonus}
                    onChange={(e) => patch(g.id, (x) => { x.bonus = e.target.value; })}
                    className="mt-1 w-full bg-deep-navy border border-border-subtle rounded-lg px-2 py-1.5 text-sm text-right font-mono" />
                </label>
              </div>
              <p className="text-[11px] text-text-secondary mt-2">Reward = palier coins + (upsets × upset bonus), only within a paying palier.</p>

              <div className="mt-3 flex justify-end">
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
