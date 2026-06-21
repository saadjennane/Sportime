import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner, EmptyState } from '../components/ui/States';
import { toast } from '../components/ui/Toast';

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="bg-surface border border-border-subtle rounded-xl p-4">
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-sm text-text-secondary">{label}</div>
  </div>
);

export function F1DataPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [races, setRaces] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [d, t, r] = await Promise.all([
      supabase.from('f1_drivers').select('id,first_name,last_name,number,team_name,points,position').order('position', { nullsFirst: false }),
      supabase.from('f1_constructors').select('id,name,points,position').order('position', { nullsFirst: false }),
      supabase.from('f1_races').select('id,round,name,country,race_at,status').order('race_at'),
    ]);
    setDrivers(d.data ?? []); setTeams(t.data ?? []); setRaces(r.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    const { error } = await supabase.functions.invoke('sync-f1', { body: { withResults: true } });
    setSyncing(false);
    if (error) toast('F1 sync failed: ' + error.message, 'error');
    else { toast('F1 data synced from api-sports', 'success'); load(); }
  };

  return (
    <div>
      <PageHeader
        title="F1 Data"
        subtitle="Drivers, constructors and the race calendar synced from api-sports."
        actions={
          <button onClick={sync} disabled={syncing} className="flex items-center gap-2 bg-electric-blue text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50">
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        }
      />

      {loading ? (
        <Spinner label="Loading F1 data…" />
      ) : drivers.length === 0 && teams.length === 0 ? (
        <EmptyState title="No F1 data yet" subtitle="Run a sync to pull the current season from api-sports." />
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Drivers" value={drivers.length} />
            <Stat label="Constructors" value={teams.length} />
            <Stat label="Races" value={races.length} />
          </div>

          {/* Drivers standings */}
          <section>
            <h2 className="text-lg font-bold mb-3">Drivers</h2>
            <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-text-secondary text-left border-b border-border-subtle">
                  <tr><th className="px-4 py-2 font-medium w-10">#</th><th className="px-4 py-2 font-medium">Driver</th><th className="px-4 py-2 font-medium">Team</th><th className="px-4 py-2 font-medium text-right">Pts</th></tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d.id} className="border-b border-border-subtle/50 last:border-0">
                      <td className="px-4 py-2 text-text-secondary">{d.position ?? '—'}</td>
                      <td className="px-4 py-2 font-medium">{[d.first_name, d.last_name].filter(Boolean).join(' ')}{d.number ? <span className="text-text-disabled"> · {d.number}</span> : null}</td>
                      <td className="px-4 py-2 text-text-secondary">{d.team_name ?? '—'}</td>
                      <td className="px-4 py-2 text-right">{d.points ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Constructors + Races side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section>
              <h2 className="text-lg font-bold mb-3">Constructors</h2>
              <div className="bg-surface border border-border-subtle rounded-xl divide-y divide-border-subtle/50">
                {teams.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span><span className="text-text-secondary mr-2">{t.position ?? '—'}</span>{t.name}</span>
                    <span className="font-medium">{t.points ?? 0}</span>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h2 className="text-lg font-bold mb-3">Calendar</h2>
              <div className="bg-surface border border-border-subtle rounded-xl divide-y divide-border-subtle/50 max-h-[480px] overflow-y-auto">
                {races.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="truncate"><span className="text-text-secondary mr-2">R{r.round}</span>{r.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${r.status === 'Completed' ? 'bg-lime-glow/15 text-lime-glow' : r.status === 'Cancelled' ? 'bg-hot-red/15 text-hot-red' : 'bg-background-dark text-text-secondary'}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
