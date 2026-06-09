import React from 'react';
import { useMatchStatsEvents, MatchEvent } from '../../../features/matches/useMatchStatsEvents';
import { FormSkeleton } from './SkeletonLoaders';

interface Props { fixtureId?: number | null; homeTeamId?: number; }

const STAT_ORDER = [
  'Ball Possession', 'Total Shots', 'Shots on Goal', 'Shots off Goal', 'Blocked Shots',
  'Corner Kicks', 'Offsides', 'Fouls', 'Yellow Cards', 'Red Cards', 'Goalkeeper Saves',
  'Total passes', 'Passes accurate', 'Passes %', 'expected_goals',
];
const STAT_LABEL: Record<string, string> = { expected_goals: 'Expected goals (xG)', 'Passes %': 'Pass accuracy' };

const num = (v: any): number => { if (v == null) return 0; const n = parseFloat(String(v).replace('%', '')); return isNaN(n) ? 0 : n; };

function StatRow({ label, home, away }: { label: string; home: any; away: any }) {
  const h = num(home), a = num(away); const tot = h + a || 1;
  return (
    <div className="py-2">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-bold text-text-primary w-12 text-left">{home ?? 0}</span>
        <span className="text-text-secondary text-xs">{label}</span>
        <span className="font-bold text-text-primary w-12 text-right">{away ?? 0}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-white/5">
        <div className="bg-electric-blue" style={{ width: `${(h / tot) * 100}%` }} />
        <div className="bg-hot-red ml-auto" style={{ width: `${(a / tot) * 100}%` }} />
      </div>
    </div>
  );
}

function eventIcon(e: MatchEvent): string {
  if (e.type === 'Goal') return '⚽';
  if (e.type === 'Card') return e.detail.includes('Red') ? '🟥' : '🟨';
  if (e.type === 'subst') return '🔁';
  if (e.type === 'Var') return '📺';
  return '•';
}

function Timeline({ events, homeTeamId }: { events: MatchEvent[]; homeTeamId?: number }) {
  if (events.length === 0) return <p className="text-center text-text-disabled text-sm py-6">No events yet.</p>;
  return (
    <div className="relative pl-0">
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10 -translate-x-1/2" />
      <div className="space-y-3">
        {events.map((e, i) => {
          const isHome = e.teamId === homeTeamId;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex-1 ${isHome ? 'text-right pr-3' : 'order-3 text-left pl-3'}`}>
                <div className="text-sm font-semibold text-text-primary">{e.player ?? e.detail}</div>
                {e.assist && <div className="text-[11px] text-text-disabled">assist: {e.assist}</div>}
                {e.type === 'subst' && e.assist && <div className="text-[11px] text-text-disabled">↳ {e.player}</div>}
              </div>
              <div className="order-2 flex flex-col items-center w-12 flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-navy-accent border border-white/15 flex items-center justify-center text-sm">{eventIcon(e)}</div>
                <span className="text-[10px] text-text-disabled mt-0.5 font-bold">{e.elapsed}{e.extra ? `+${e.extra}` : ''}'</span>
              </div>
              {!isHome ? <div className="flex-1" /> : <div className="flex-1 order-3" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const StatsTab: React.FC<Props> = ({ fixtureId, homeTeamId }) => {
  const { stats, events, loading, error } = useMatchStatsEvents(fixtureId);
  if (loading) return <FormSkeleton />;
  if (error) return <p className="text-center text-text-disabled text-sm py-6">{error}</p>;

  const home = stats.find(s => s.teamId === homeTeamId) ?? stats[0];
  const away = stats.find(s => s.teamId !== homeTeamId) ?? stats[1];
  const keys = STAT_ORDER.filter(k => (home?.stats?.[k] != null) || (away?.stats?.[k] != null));

  return (
    <div className="space-y-5">
      {keys.length > 0 && (
        <div className="bg-navy-accent/40 rounded-xl p-3">
          {keys.map(k => <StatRow key={k} label={STAT_LABEL[k] ?? k} home={home?.stats?.[k]} away={away?.stats?.[k]} />)}
        </div>
      )}
      <div>
        <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-3">Timeline</h4>
        <Timeline events={events} homeTeamId={homeTeamId} />
      </div>
      {keys.length === 0 && events.length === 0 && (
        <p className="text-center text-text-disabled text-sm py-6">Stats appear once the match starts.</p>
      )}
    </div>
  );
};
