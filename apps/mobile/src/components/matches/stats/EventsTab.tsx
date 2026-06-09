import React from 'react';
import { useMatchStatsEvents, MatchEvent } from '../../../features/matches/useMatchStatsEvents';
import { FormSkeleton } from './SkeletonLoaders';

interface Props { fixtureId?: number | null; homeTeamId?: number; }

function icon(e: MatchEvent): string {
  if (e.type === 'Goal') return e.detail?.includes('Penalty') ? '🥅' : e.detail?.includes('Own') ? '⚽' : '⚽';
  if (e.type === 'Card') return e.detail?.includes('Red') ? '🟥' : '🟨';
  if (e.type === 'subst') return '🔁';
  if (e.type === 'Var') return '📺';
  return '•';
}

function Marker({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-[11px] font-bold uppercase tracking-wider text-text-disabled">{label}</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

function Row({ e, isHome, score }: { e: MatchEvent; isHome: boolean; score?: string }) {
  const isGoal = e.type === 'Goal';
  const content = (
    <div className={`flex-1 min-w-0 ${isHome ? 'text-right pr-3' : 'pl-3'}`}>
      <div className={`text-sm font-bold ${isGoal ? 'text-lime-glow' : 'text-text-primary'} truncate`}>
        {isGoal && score ? `${score}  ` : ''}{e.player ?? e.detail}
      </div>
      {e.assist && e.type === 'Goal' && <div className="text-[11px] text-text-disabled truncate">assist: {e.assist}</div>}
      {e.type === 'subst' && <div className="text-[11px] text-text-disabled truncate">{isHome ? '' : '↳ '}{e.assist}{isHome ? ' ↲' : ''}</div>}
      {(e.type === 'Card' || e.type === 'Var') && <div className="text-[11px] text-text-disabled truncate">{e.detail}</div>}
    </div>
  );
  const node = (
    <div className="flex flex-col items-center w-14 flex-shrink-0 z-10">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base border-2 ${isGoal ? 'bg-lime-glow/20 border-lime-glow' : 'bg-navy-accent border-white/15'}`}>{icon(e)}</div>
      <span className="text-[10px] text-text-disabled mt-1 font-bold">{e.elapsed}{e.extra ? `+${e.extra}` : ''}'</span>
    </div>
  );
  return (
    <div className="flex items-center">
      {isHome ? <>{content}{node}<div className="flex-1" /></> : <><div className="flex-1" />{node}{content}</>}
    </div>
  );
}

export const EventsTab: React.FC<Props> = ({ fixtureId, homeTeamId }) => {
  const { events, loading, error } = useMatchStatsEvents(fixtureId);
  if (loading) return <FormSkeleton />;
  if (error) return <p className="text-center text-text-disabled text-sm py-6">{error}</p>;

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-navy-accent flex items-center justify-center text-2xl mb-3">⏱️</div>
        <p className="text-text-secondary font-semibold">No events yet</p>
        <p className="text-text-disabled text-sm mt-1">Goals, cards and subs will appear here once the match starts.</p>
      </div>
    );
  }

  // running score for goals + half-time split
  let h = 0, a = 0; let htInserted = false;
  const items: React.ReactNode[] = [<Marker key="ko" label="Kick-off" />];
  events.forEach((e, i) => {
    const isHome = e.teamId === homeTeamId;
    if (!htInserted && e.elapsed > 45) { items.push(<Marker key="ht" label="Half-time" />); htInserted = true; }
    let score: string | undefined;
    if (e.type === 'Goal') { if (isHome) h++; else a++; score = `${h}-${a}`; }
    items.push(<Row key={i} e={e} isHome={isHome} score={score} />);
  });
  items.push(<Marker key="ft" label="Full-time" />);

  return (
    <div className="relative">
      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/10 -translate-x-1/2" />
      <div className="space-y-3 relative">{items}</div>
    </div>
  );
};
