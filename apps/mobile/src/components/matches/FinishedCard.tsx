import React from 'react';
import { BarChart2, Zap } from 'lucide-react';
import { Match, Bet } from '../../types';
import { MatchHeaderRow } from './MatchHeaderRow';

interface FinishedCardProps {
  match: Match;
  bet?: Bet;
  onViewStats?: () => void;
  onPlayGame?: (matchId: string, matchName: string) => void;
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

export const FinishedCard: React.FC<FinishedCardProps> = ({ match, bet, onViewStats, onPlayGame }) => {
  const result = match.result;
  const won = bet?.status === 'won';
  const lost = bet?.status === 'lost';

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
          const isResult = result === o.key;
          const isPick = bet?.prediction === o.key;
          const cls = isResult
            ? 'border-lime-glow bg-lime-glow/10'
            : isPick
              ? 'border-hot-red bg-hot-red/10'
              : 'border-disabled bg-deep-navy opacity-50';
          const oddsCls = isResult ? 'text-lime-glow' : isPick ? 'text-hot-red' : 'text-text-primary';
          const hasOdds = typeof o.odds === 'number' && o.odds > 0;
          return (
            <div key={o.key} className={`flex-1 p-2 rounded-lg border text-center ${cls}`}>
              <div className="text-[11px] text-text-secondary font-medium truncate">
                {o.label}
                {isPick && <span className="ml-0.5">{isResult ? '✓' : '✗'}</span>}
              </div>
              <div className={`text-base font-bold ${oddsCls}`}>
                {hasOdds ? `${(o.odds as number).toFixed(2)}x` : '--'}
              </div>
            </div>
          );
        })}
      </div>

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
        {onPlayGame && (
          <button
            onClick={() => onPlayGame(match.id, `${match.teamA.name} vs ${match.teamB.name}`)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-navy-accent rounded-lg text-sm font-semibold text-warm-yellow hover:text-warm-yellow/80 transition-colors"
          >
            <Zap size={14} /> Play
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
