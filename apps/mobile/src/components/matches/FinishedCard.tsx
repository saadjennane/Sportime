import React from 'react';
import { Match, Bet } from '../../types';
import { Clock, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';

interface FinishedCardProps {
  match: Match;
  bet?: Bet;
  onViewStats?: () => void;
}

function formatFinished(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'HH:mm');
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

const TeamAvatar: React.FC<{ team: Match['teamA'] }> = ({ team }) =>
  team.logo ? (
    <div className="mx-auto w-14 h-14 mb-2 rounded-full bg-white/10 flex items-center justify-center">
      <img src={team.logo} alt={team.name} className="w-12 h-12 object-contain" />
    </div>
  ) : (
    <div className="mx-auto w-14 h-14 mb-2 flex items-center justify-center rounded-full bg-white/10 text-2xl font-bold text-electric-blue">
      {team.emoji && team.emoji.length === 1 ? team.emoji : team.name?.charAt(0).toUpperCase() || '?'}
    </div>
  );

export const FinishedCard: React.FC<FinishedCardProps> = ({ match, bet, onViewStats }) => {
  const result = match.result; // 'teamA' | 'draw' | 'teamB' | undefined
  const won = bet?.status === 'won';
  const lost = bet?.status === 'lost';

  const outcomes = [
    { key: 'teamA', label: match.teamA.name.split(' ')[0], odds: match.odds?.teamA },
    { key: 'draw', label: 'Draw', odds: match.odds?.draw },
    { key: 'teamB', label: match.teamB.name.split(' ')[0], odds: match.odds?.teamB },
  ] as const;

  return (
    <div className="card-base p-5 space-y-4">
      {/* Date + status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-text-secondary">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">{formatFinished(match.kickoffTime)}</span>
        </div>
        <span className="bg-disabled text-text-disabled text-xs px-3 py-1 rounded-full font-semibold whitespace-nowrap">
          {statusLabel(match.rawStatus)}
        </span>
      </div>

      {/* Teams + final score */}
      <div className="flex items-center justify-between">
        <div className="flex-1 text-center">
          <TeamAvatar team={match.teamA} />
          <div className="text-sm font-semibold text-text-primary">{match.teamA.name}</div>
        </div>
        <div className="px-4 text-center">
          <div className="text-2xl font-bold text-text-primary">
            {match.score?.teamA ?? 0} - {match.score?.teamB ?? 0}
          </div>
        </div>
        <div className="flex-1 text-center">
          <TeamAvatar team={match.teamB} />
          <div className="text-sm font-semibold text-text-primary">{match.teamB.name}</div>
        </div>
      </div>

      {/* Three odds — actual result in green, lost pick in red */}
      <div className="flex gap-2">
        {outcomes.map((o) => {
          const isResult = result === o.key;
          const isPick = bet?.prediction === o.key;
          // Full class names (no interpolation) so Tailwind keeps them.
          const containerCls = isResult
            ? 'border-lime-glow bg-lime-glow/10'
            : isPick
              ? 'border-hot-red bg-hot-red/10'
              : 'border-disabled bg-deep-navy opacity-50';
          const oddsCls = isResult ? 'text-lime-glow' : isPick ? 'text-hot-red' : 'text-text-primary';
          const hasOdds = typeof o.odds === 'number' && o.odds > 0;
          return (
            <div key={o.key} className={`flex-1 p-3 rounded-xl border-2 text-center ${containerCls}`}>
              <div className="text-xs text-text-secondary mb-1 font-medium truncate">{o.label}</div>
              <div className={`text-xl font-bold ${oddsCls}`}>{hasOdds ? `${(o.odds as number).toFixed(2)}x` : '--'}</div>
              {isPick && (
                <div className={`text-[10px] font-semibold mt-1 ${isResult ? 'text-lime-glow' : 'text-hot-red'}`}>
                  {isResult ? '✓ Your pick' : '✗ Your pick'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Result of the bet (only if the user bet on this match) */}
      {bet && (
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-text-disabled">Stake </span>
            <span className="font-semibold text-warm-yellow">{bet.amount.toLocaleString()} coins</span>
          </div>
          <div>
            {won ? (
              <span className="font-semibold text-lime-glow">Won +{(bet.winAmount ?? 0).toLocaleString()}</span>
            ) : lost ? (
              <span className="font-semibold text-hot-red">Lost −{bet.amount.toLocaleString()}</span>
            ) : (
              <span className="font-semibold text-text-secondary">Pending</span>
            )}
          </div>
        </div>
      )}

      {/* Stats — for every finished match */}
      <div className="flex">
        <button
          onClick={onViewStats}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-navy-accent rounded-lg text-sm font-semibold text-text-secondary hover:text-electric-blue transition-colors"
        >
          <BarChart2 size={14} /> Stats
        </button>
      </div>
    </div>
  );
};

export default FinishedCard;
