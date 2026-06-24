import React, { useMemo } from 'react';
import { isToday, isYesterday } from 'date-fns';
import { Loader, Clock, ChevronRight } from 'lucide-react';
import { Match } from '../../types';
import { type PickWithMatch } from '../../features/matches/useUserPicks';
import { FinishedCard } from './FinishedCard';
import { PicksSummaryStats } from './PicksSummaryStats';
import { EmptyState } from '../EmptyState';

interface Props {
  picks: PickWithMatch[];
  isLoading: boolean;
  onViewStats: (match: Match) => void;
  onViewResults?: (fixtureId: string, matchName: string) => void;
  onOpenHistory: () => void;
}

const dayStats = (items: PickWithMatch[]) => {
  let won = 0, settled = 0, net = 0;
  for (const { bet } of items) {
    if (bet.status === 'won') { won++; settled++; net += (bet.winAmount ?? 0) - bet.amount; }
    else if (bet.status === 'lost') { settled++; net -= bet.amount; }
  }
  return { won, total: items.length, settled, net };
};

/** Finished = your settled picks for Today and Yesterday, each with Successful Picks +
 *  Results. Older results live behind "View full history". */
export const FinishedDigest: React.FC<Props> = ({ picks, isLoading, onViewStats, onViewResults, onOpenHistory }) => {
  // Only settled (played) picks belong here — pending ones stay in the Picks tab.
  const { today, yesterday } = useMemo(() => {
    const settled = picks.filter((p) => p.match.status === 'played');
    const inDay = (p: PickWithMatch, fn: (d: Date) => boolean) => {
      const d = new Date(p.match.kickoffTime);
      return Number.isFinite(d.getTime()) && fn(d);
    };
    return {
      today: settled.filter((p) => inDay(p, isToday)),
      yesterday: settled.filter((p) => inDay(p, isYesterday)),
    };
  }, [picks]);

  const hasAny = today.length > 0 || yesterday.length > 0;

  const HistoryButton = (
    <button onClick={onOpenHistory} className="w-full flex items-center justify-center gap-2 card-base py-3 text-sm font-bold text-electric-blue hover:bg-white/5 transition">
      <Clock size={16} /> View full history <ChevronRight size={16} />
    </button>
  );

  if (isLoading && picks.length === 0) {
    return <div className="flex items-center justify-center gap-2 py-10 text-text-disabled"><Loader className="w-5 h-5 animate-spin" /><span className="text-sm">Loading results…</span></div>;
  }

  if (!hasAny) {
    return (
      <div className="space-y-4">
        <EmptyState
          glyph="🏁"
          title="No results yet"
          subtitle="Your settled picks from today and yesterday will show here."
        />
        {HistoryButton}
      </div>
    );
  }

  const Day: React.FC<{ label: string; items: PickWithMatch[] }> = ({ label, items }) => {
    const s = dayStats(items);
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="text-sm font-bold text-text-primary">{label}</p>
          <PicksSummaryStats won={s.won} total={s.total} settled={s.settled} net={s.net} />
        </div>
        <div className="space-y-3">
          {items.map(({ match, bet }) => (
            <FinishedCard
              key={`${match.id}-${bet.prediction}`}
              match={match}
              bet={bet}
              onViewStats={() => onViewStats(match)}
              onViewResults={onViewResults}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {today.length > 0 && <Day label="Today" items={today} />}
      {yesterday.length > 0 && <Day label="Yesterday" items={yesterday} />}
      {HistoryButton}
    </div>
  );
};

export default FinishedDigest;
