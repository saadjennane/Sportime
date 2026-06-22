import { useEffect, useState } from 'react';
import { Zap, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Spinner } from '../components/ui/States';
import { toast } from '../components/ui/Toast';

interface Gp { id: number; name: string; round: number | null; race_at: string | null }
interface FGame { id: string; race_id: number; condition: string; status: string; race?: { name: string; round: number | null; race_at: string | null } }
interface CatRow { category: string | null; names: string }

const CONDITIONS: [string, string][] = [
  ['standard', 'Standard (1E·1C·1O)'], ['no_stars', 'No Stars (2C·1O)'], ['double_star', 'Double Star (2E·1O)'],
  ['underdog', 'Underdog (1E·2O)'], ['constructor_chaos', 'Constructor Chaos'], ['free', 'Free Choice'],
];

export function F1FantasyAdmin() {
  const [games, setGames] = useState<FGame[]>([]);
  const [gps, setGps] = useState<Gp[]>([]);
  const [drivers, setDrivers] = useState<CatRow[]>([]);
  const [cons, setCons] = useState<CatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGp, setNewGp] = useState<number | null>(null);
  const [newCond, setNewCond] = useState('standard');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: g }, { data: races }, { data: dr }, { data: co }] = await Promise.all([
      supabase.from('f1_fantasy_games').select('id,race_id,condition,status,race:f1_races(name,round,race_at)').order('race_id'),
      supabase.from('f1_races').select('id,name,round,race_at').neq('status', 'Cancelled').gt('race_at', new Date().toISOString()).order('race_at'),
      supabase.rpc('f1_fantasy_cat_summary', { p_kind: 'driver' }),
      supabase.rpc('f1_fantasy_cat_summary', { p_kind: 'constructor' }),
    ]);
    const rows = (g ?? []) as any as FGame[];
    rows.sort((a, b) => new Date(a.race?.race_at ?? 0).getTime() - new Date(b.race?.race_at ?? 0).getTime());
    setGames(rows);
    const have = new Set(rows.map((r) => r.race_id));
    const avail = (races ?? []).filter((r: any) => !have.has(r.id)) as Gp[];
    setGps(avail);
    setNewGp(avail[0]?.id ?? null);
    setDrivers((dr ?? []) as CatRow[]);
    setCons((co ?? []) as CatRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const createOrUpdate = async (raceId: number, condition: string, key: string) => {
    setBusy(key);
    const { error } = await supabase.rpc('f1_fantasy_create_game', { p_race_id: raceId, p_condition: condition });
    setBusy(null);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else { toast('Saved', 'success'); load(); }
  };
  const recalc = async () => {
    setBusy('recalc');
    const { error } = await supabase.rpc('f1_fantasy_recalc_categories', {});
    setBusy(null);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else { toast('Categories recalculated', 'success'); load(); }
  };

  if (loading) return <Spinner label="Loading Fantasy F1…" />;

  const catRow = (label: string, color: string, rows: CatRow[], cat: string) => (
    <div className="text-xs"><span className={`font-bold ${color}`}>{label}:</span> <span className="text-text-secondary">{rows.find((r) => r.category === cat)?.names || '—'}</span></div>
  );

  return (
    <div>
      <p className="text-text-secondary mb-4">Fantasy F1 — one game per Grand Prix with a composition condition. Categories are dynamic (Performance Rating) and settle automatically from the F1 sync.</p>

      {/* Categories overview */}
      <div className="mb-5 p-3 bg-surface border border-border-subtle rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-sm">Current categories</div>
          <button onClick={recalc} disabled={busy === 'recalc'} className="flex items-center gap-2 text-xs bg-electric-blue/15 text-electric-blue px-3 py-1.5 rounded-lg font-semibold hover:bg-electric-blue/25 disabled:opacity-50">
            <RefreshCw size={13} className={busy === 'recalc' ? 'animate-spin' : ''} /> Recalculate
          </button>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-text-disabled">Drivers</div>
          {catRow('Elite', 'text-warm-yellow', drivers, 'elite')}
          {catRow('Confirmed', 'text-electric-blue', drivers, 'confirmed')}
          {catRow('Outsider', 'text-lime-glow', drivers, 'outsider')}
          <div className="text-[11px] uppercase tracking-wide text-text-disabled mt-2">Constructors</div>
          {catRow('Elite', 'text-warm-yellow', cons, 'elite')}
          {catRow('Confirmed', 'text-electric-blue', cons, 'confirmed')}
          {catRow('Outsider', 'text-lime-glow', cons, 'outsider')}
        </div>
      </div>

      {/* Create */}
      <div className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-surface border border-border-subtle rounded-xl">
        <span className="text-sm font-semibold">New game:</span>
        {gps.length === 0 ? <span className="text-sm text-text-secondary">All upcoming GPs have a game.</span> : (
          <>
            <select value={newGp ?? ''} onChange={(e) => setNewGp(Number(e.target.value))} className="bg-deep-navy border border-border-subtle rounded-lg px-3 py-2 text-sm">
              {gps.map((g) => <option key={g.id} value={g.id}>{g.round ? `R${g.round} · ` : ''}{g.name}</option>)}
            </select>
            <select value={newCond} onChange={(e) => setNewCond(e.target.value)} className="bg-deep-navy border border-border-subtle rounded-lg px-3 py-2 text-sm">
              {CONDITIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button onClick={() => newGp && createOrUpdate(newGp, newCond, 'new')} disabled={busy === 'new' || !newGp}
              className="flex items-center gap-2 bg-electric-blue/15 text-electric-blue px-4 py-2 rounded-lg font-semibold hover:bg-electric-blue/25 disabled:opacity-50">
              <Plus size={15} /> Create
            </button>
          </>
        )}
      </div>

      <div className="space-y-2">
        {games.map((g) => (
          <div key={g.id} className="p-3 bg-surface border border-border-subtle rounded-xl flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold flex items-center gap-2"><Zap className="w-4 h-4 text-warm-yellow" /> {g.race?.round ? `R${g.race.round} · ` : ''}{g.race?.name ?? `Race ${g.race_id}`}</div>
              <div className="text-xs text-text-secondary mt-0.5">status {g.status} · {g.race?.race_at ? new Date(g.race.race_at).toLocaleDateString() : ''}</div>
            </div>
            <select value={g.condition} onChange={(e) => createOrUpdate(g.race_id, e.target.value, g.id)} disabled={busy === g.id || g.status === 'settled'}
              className="bg-deep-navy border border-border-subtle rounded-lg px-3 py-2 text-sm shrink-0">
              {CONDITIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
