import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Spinner, EmptyState } from './ui/States';
import { toast } from './ui/Toast';

/** Available leagues + their Fantasy status (pool built or not), with a per-league enable/re-sync. */
export function FantasyLeagues() {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: lgs }, { data: flp }] = await Promise.all([
      supabase!.from('fb_leagues').select('id, name, logo, logo_url, is_visible').order('name'),
      supabase!.from('fantasy_league_players').select('league_id'),
    ]);
    const c: Record<string, number> = {};
    (flp ?? []).forEach((r: any) => { c[r.league_id] = (c[r.league_id] ?? 0) + 1; });
    setCounts(c);
    // Show the app-visible leagues (candidates) + any league that already has a pool.
    setLeagues((lgs ?? []).filter((l: any) => l.is_visible || c[l.id]));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const sync = async (league: any) => {
    setSyncing(league.id);
    const { error } = await supabase!.functions.invoke('sync-league-fantasy-players', { body: { league_id: league.id } });
    setSyncing(null);
    if (error) toast(`Sync failed: ${error.message}`, 'error');
    else { toast(`${league.name}: fantasy players synced`, 'success'); load(); }
  };

  if (loading) return <Spinner label="Loading leagues…" />;

  const enabledCount = leagues.filter((l) => (counts[l.id] ?? 0) > 0).length;

  return (
    <div className="space-y-2 max-w-2xl">
      <p className="text-sm text-text-secondary">
        A league is <span className="text-lime-glow font-medium">Enabled</span> once its Fantasy player pool is built (from season stats).
        Re-sync after each matchday to refresh PGS. <span className="font-semibold">{enabledCount}/{leagues.length} enabled.</span>
      </p>
      {leagues.length === 0 ? (
        <EmptyState title="No leagues" subtitle="Make a league visible (Leagues page) to use it for Fantasy." />
      ) : leagues.map((l) => {
        const n = counts[l.id] ?? 0;
        const enabled = n > 0;
        return (
          <div key={l.id} className="flex items-center gap-3 bg-surface border border-border-subtle rounded-xl px-4 py-3">
            {l.logo || l.logo_url
              ? <img src={l.logo || l.logo_url} alt="" className="w-7 h-7 object-contain shrink-0" />
              : <div className="w-7 h-7 bg-background-dark rounded shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{l.name}</div>
              <div className="text-xs text-text-secondary">{enabled ? `${n} players in pool` : 'No fantasy pool yet'}</div>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${enabled ? 'bg-lime-glow/15 text-lime-glow' : 'bg-background-dark text-text-secondary'}`}>
              {enabled ? 'Enabled' : 'Not enabled'}
            </span>
            <button onClick={() => sync(l)} disabled={syncing === l.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 shrink-0 ${enabled ? 'bg-surface-hover text-text-secondary border border-border-subtle' : 'bg-electric-blue text-white'}`}>
              <RefreshCw size={14} className={syncing === l.id ? 'animate-spin' : ''} /> {enabled ? 'Re-sync' : 'Enable'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
