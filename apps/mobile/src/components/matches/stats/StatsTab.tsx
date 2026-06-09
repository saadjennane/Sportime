import React from 'react';
import { useMatchStatsEvents } from '../../../features/matches/useMatchStatsEvents';
import { FormSkeleton } from './SkeletonLoaders';

interface Props { fixtureId?: number | null; homeTeamId?: number; }

const num = (v: any): number => { if (v == null) return 0; const n = parseFloat(String(v).replace('%', '')); return isNaN(n) ? 0 : n; };

// FotMob-style row: the leading value sits in a filled pill.
function StatRow({ label, home, away }: { label: string; home: any; away: any }) {
  const h = num(home), a = num(away);
  const homeLead = h > a, awayLead = a > h;
  const pill = 'inline-block min-w-[2.5rem] text-center px-2.5 py-0.5 rounded-full font-bold';
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className={homeLead ? `${pill} bg-electric-blue text-white` : 'min-w-[2.5rem] text-center font-semibold text-text-primary'}>{home ?? 0}</span>
      <span className="text-text-secondary text-[13px] text-center flex-1 px-2">{label}</span>
      <span className={awayLead ? `${pill} bg-hot-red text-white` : 'min-w-[2.5rem] text-center font-semibold text-text-primary'}>{away ?? 0}</span>
    </div>
  );
}

function Possession({ home, away }: { home: any; away: any }) {
  const h = num(home) || 50, a = num(away) || 50; const tot = h + a || 100;
  return (
    <div className="py-3">
      <p className="text-center text-[13px] text-text-secondary mb-2">Ball possession</p>
      <div className="flex h-7 rounded-full overflow-hidden text-sm font-bold">
        <div className="bg-electric-blue text-white flex items-center pl-3" style={{ width: `${(h / tot) * 100}%` }}>{home ?? '50%'}</div>
        <div className="bg-hot-red text-white flex items-center justify-end pr-3 flex-1">{away ?? '50%'}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  if (rows.length === 0) return null;
  return (
    <div className="bg-navy-accent/40 rounded-2xl p-4">
      <h4 className="text-center font-bold text-text-primary mb-1">{title}</h4>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}

const GROUPS: { title: string; keys: [string, string][] }[] = [
  { title: 'Shots', keys: [['Total Shots', 'Total shots'], ['Shots on Goal', 'Shots on target'], ['Shots off Goal', 'Shots off target'], ['Blocked Shots', 'Blocked shots'], ['Shots insidebox', 'Shots inside box'], ['Shots outsidebox', 'Shots outside box']] },
  { title: 'Passes', keys: [['Total passes', 'Total passes'], ['Passes accurate', 'Accurate passes'], ['Passes %', 'Pass accuracy']] },
  { title: 'Discipline', keys: [['Fouls', 'Fouls'], ['Yellow Cards', 'Yellow cards'], ['Red Cards', 'Red cards']] },
  { title: 'Goalkeeping', keys: [['Goalkeeper Saves', 'Keeper saves']] },
];

export const StatsTab: React.FC<Props> = ({ fixtureId, homeTeamId }) => {
  const { stats, loading, error } = useMatchStatsEvents(fixtureId);
  if (loading) return <FormSkeleton />;
  if (error) return <p className="text-center text-text-disabled text-sm py-6">{error}</p>;

  const home = stats.find(s => s.teamId === homeTeamId) ?? stats[0];
  const away = stats.find(s => s.teamId !== homeTeamId) ?? stats[1];
  if (!home && !away) return <p className="text-center text-text-disabled text-sm py-8">Stats appear once the match kicks off.</p>;

  const get = (k: string) => [home?.stats?.[k], away?.stats?.[k]] as const;
  const has = (k: string) => home?.stats?.[k] != null || away?.stats?.[k] != null;

  return (
    <div className="space-y-3">
      {/* Top stats */}
      <div className="bg-navy-accent/40 rounded-2xl p-4">
        <h4 className="text-center font-bold text-text-primary mb-1">Top stats</h4>
        {has('Ball Possession') && <Possession home={get('Ball Possession')[0]} away={get('Ball Possession')[1]} />}
        <div className="divide-y divide-white/5">
          {has('Total Shots') && <StatRow label="Total shots" home={get('Total Shots')[0]} away={get('Total Shots')[1]} />}
          {has('Shots on Goal') && <StatRow label="Shots on target" home={get('Shots on Goal')[0]} away={get('Shots on Goal')[1]} />}
          {has('expected_goals') && <StatRow label="Expected goals (xG)" home={get('expected_goals')[0]} away={get('expected_goals')[1]} />}
          {has('Corner Kicks') && <StatRow label="Corners" home={get('Corner Kicks')[0]} away={get('Corner Kicks')[1]} />}
          {has('Passes accurate') && <StatRow label="Accurate passes" home={get('Passes accurate')[0]} away={get('Passes accurate')[1]} />}
          {has('Fouls') && <StatRow label="Fouls" home={get('Fouls')[0]} away={get('Fouls')[1]} />}
          {has('Offsides') && <StatRow label="Offsides" home={get('Offsides')[0]} away={get('Offsides')[1]} />}
        </div>
      </div>

      {GROUPS.map(g => (
        <Section key={g.title} title={g.title}>
          {g.keys.filter(([k]) => has(k)).map(([k, label]) => <StatRow key={k} label={label} home={get(k)[0]} away={get(k)[1]} />)}
        </Section>
      ))}
    </div>
  );
};
