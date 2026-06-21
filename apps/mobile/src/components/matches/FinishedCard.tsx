import React from 'react';
import { BarChart2, Medal } from 'lucide-react';
import { Match, Bet } from '../../types';
import { MatchHeaderRow } from './MatchHeaderRow';

interface FinishedCardProps {
  match: Match;
  bet?: Bet;
  onViewStats?: () => void;
  onViewResults?: (fixtureId: string, matchName: string) => void;
}

function statusLabel(raw?: string): string {
  const s = (raw || 'FT').toUpperCase();
  if (s === 'AET') return 'AET';
  if (s === 'PEN') return 'PEN';
  if (s === 'AWD' || s === 'AWARDED') return 'AWD';
  if (s === 'WO' || s === 'W.O') return 'W/O';
  if (s === 'ABD') return 'ABD';
  if (s === 'CANC') return 'CANC';
  if (s === 'POST' || s === 'PST') return 'POST';
  return 'FT';
}

export const FinishedCard: React.FC<FinishedCardProps> = ({ match, bet, onViewStats, onViewResults }) => {
  const result = match.result;
  // result is undefined only for void/technical matches (CANC/ABD/WO/AWD). AET/PEN
  // DO have a 1X2 result — a Draw, since the match was level at 90' (the odds settle
  // on regular time). Render the odds neutrally only when there's truly no result.
  const hasResult = result != null;
  const won = bet?.status === 'won';
  const lost = bet?.status === 'lost';
  const rawUpper = (match.rawStatus || 'FT').toUpperCase();
  const isVoid = ['CANC', 'ABD', 'WO', 'W.O', 'AWD', 'AWARDED'].includes(rawUpper);
  // Explain why an AET/PEN match settles as a Draw, or why a void match has no result.
  const note =
    rawUpper === 'AET' ? "After extra time · 1X2 settled at 90'" :
    rawUpper === 'PEN' ? "Penalty shootout · 1X2 settled at 90'" :
    isVoid ? 'Match void — bet refunded' : null;

  const center = `${match.score?.teamA ?? 0} - ${match.score?.teamB ?? 0}`;

  const outcomes = [
    { key: 'teamA', label: match.teamA.name.split(' ')[0], odds: match.odds?.teamA },
    { key: 'draw', label: 'Draw', odds: match.odds?.draw },
    { key: 'teamB', label: match.teamB.name.split(' ')[0], odds: match.odds?.teamB },
  ] as const;

  return (
    <div className="card-base p-3 space-y-3">
      <MatchHeaderRow match={match} center={center} status={{ text: statusLabel(match.rawStatus), variant: 'finished' }} />

      {/* Three odds — actual result in green, lost pick in red */}
      <div className="flex gap-2">
        {outcomes.map((o) => {
          const isResult = hasResult && result === o.key;
          const isPick = bet?.prediction === o.key;
          // Only paint the pick red when there's a real result it lost against.
          const pickLost = isPick && hasResult && !isResult;
          const cls = isResult
            ? 'border-lime-glow bg-lime-glow/10'
            : pickLost
              ? 'border-hot-red bg-hot-red/10'
              : isPick && !hasResult
                ? 'border-electric-blue/40 bg-deep-navy'
                : 'border-disabled bg-deep-navy opacity-50';
          const oddsCls = isResult ? 'text-lime-glow' : pickLost ? 'text-hot-red' : 'text-text-primary';
          const hasOdds = typeof o.odds === 'number' && o.odds > 0;
          return (
            <div key={o.key} className={`flex-1 p-2 rounded-lg border text-center ${cls}`}>
              <div className="text-[11px] text-text-secondary font-medium truncate">
                {o.label}
                {isPick && hasResult && <span className="ml-0.5">{isResult ? '✓' : '✗'}</span>}
              </div>
              <div className={`text-base font-bold ${oddsCls}`}>
                {hasOdds ? `${(o.odds as number).toFixed(2)}x` : '--'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Why no winner is highlighted (penalty shootout / void match). */}
      {note && <div className="text-[11px] text-text-secondary text-center -mt-1">{note}</div>}

      {/* Actions: WON/LOST · Play · Stats */}
      <div className="flex gap-2">
        {bet && (won || lost) && (
          <div
            className={`flex-1 flex items-center justify-center py-2 rounded-lg text-sm font-bold ${
              won ? 'bg-lime-glow/15 text-lime-glow' : 'bg-hot-red/15 text-hot-red'
            }`}
          >
            {won ? `WON +${((bet.winAmount ?? 0) - bet.amount).toLocaleString()}` : `LOST −${bet.amount.toLocaleString()}`}
          </div>
        )}
        {onViewResults && (
          <button
            onClick={() => onViewResults(match.id, `${match.teamA.name} vs ${match.teamB.name}`)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-navy-accent rounded-lg text-sm font-semibold text-warm-yellow hover:text-warm-yellow/80 transition-colors"
          >
            <Medal size={14} /> Results
          </button>
        )}
        <button
          onClick={onViewStats}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-navy-accent rounded-lg text-sm font-semibold text-text-secondary hover:text-electric-blue transition-colors"
        >
          <BarChart2 size={14} /> Stats
        </button>
      </div>
    </div>
  );
};

export default FinishedCard;
