import React from 'react';
import { Match, Bet } from '../../types';
import { Pencil, BarChart3 } from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';

interface PickCardProps {
  match: Match;
  bet: Bet;
  /** Reopen the bet modal to edit/cancel. Only offered before kick-off. */
  onEdit?: () => void;
  onViewStats?: () => void;
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = format(d, 'HH:mm');
  if (isToday(d)) return `Today · ${time}`;
  if (isTomorrow(d)) return `Tomorrow · ${time}`;
  return format(d, 'MMM d · HH:mm');
}

const TeamLogo: React.FC<{ team: Match['teamA'] }> = ({ team }) =>
  team.logo ? (
    <img src={team.logo} alt={team.name} className="w-8 h-8 object-contain flex-shrink-0" />
  ) : (
    <span className="w-8 h-8 rounded-full bg-deep-navy flex items-center justify-center text-sm font-bold text-electric-blue flex-shrink-0">
      {team.name?.charAt(0)?.toUpperCase() || '?'}
    </span>
  );

export const PickCard: React.FC<PickCardProps> = ({ match, bet, onEdit, onViewStats }) => {
  const started = new Date(match.kickoffTime).getTime() <= Date.now();
  const safeOdds = typeof bet.odds === 'number' && Number.isFinite(bet.odds) ? bet.odds : 0;
  const potential = Math.ceil(bet.amount * safeOdds);

  const predictionLabel =
    bet.prediction === 'teamA'
      ? match.teamA.name
      : bet.prediction === 'teamB'
        ? match.teamB.name
        : 'Draw';

  const badge =
    bet.status === 'won'
      ? { text: 'Won', cls: 'bg-lime-glow/20 text-lime-glow' }
      : bet.status === 'lost'
        ? { text: 'Lost', cls: 'bg-hot-red/20 text-hot-red' }
        : { text: 'Bet Placed', cls: 'bg-electric-blue/20 text-electric-blue' };

  const isSettled = bet.status === 'won' || bet.status === 'lost';
  const canEdit = !started && bet.status === 'pending' && !!onEdit;

  return (
    <div className="card-base p-4 space-y-3">
      {/* Teams + status badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TeamLogo team={match.teamA} />
          <span className="text-sm font-bold text-text-primary truncate">{match.teamA.name}</span>
          <span className="text-xs text-text-disabled">vs</span>
          <span className="text-sm font-bold text-text-primary truncate">{match.teamB.name}</span>
          <TeamLogo team={match.teamB} />
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${badge.cls}`}>
          {badge.text}
        </span>
      </div>

      {/* Kick-off */}
      <div className="text-xs text-text-secondary">{formatKickoff(match.kickoffTime)}</div>

      {/* Selected pick + locked odds */}
      <div className="bg-deep-navy rounded-xl p-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-semibold text-text-disabled tracking-wide">Your pick</p>
          <p className="text-sm font-bold text-text-primary truncate">{predictionLabel}</p>
        </div>
        <span className="text-sm font-semibold text-electric-blue whitespace-nowrap">@ {safeOdds.toFixed(2)}</span>
      </div>

      {/* Stake + potential / winnings */}
      <div className="flex items-center justify-between text-sm">
        <div>
          <span className="text-text-disabled">Stake </span>
          <span className="font-semibold text-warm-yellow">{bet.amount.toLocaleString()} coins</span>
        </div>
        <div>
          <span className="text-text-disabled">{bet.status === 'won' ? 'Won ' : 'Potential '}</span>
          <span className={`font-semibold ${bet.status === 'lost' ? 'text-text-disabled line-through' : 'text-lime-glow'}`}>
            +{(bet.status === 'won' && bet.winAmount ? bet.winAmount : potential).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {canEdit && (
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-navy-accent rounded-lg text-sm font-semibold text-text-secondary hover:text-electric-blue transition-colors"
          >
            <Pencil size={14} /> Edit
          </button>
        )}
        <button
          onClick={onViewStats}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-navy-accent rounded-lg text-sm font-semibold text-text-secondary hover:text-electric-blue transition-colors"
        >
          <BarChart3 size={14} /> Stats
        </button>
      </div>

      {started && !isSettled && (
        <p className="text-[11px] text-text-disabled text-center">Match in progress — bet locked.</p>
      )}
    </div>
  );
};

export default PickCard;
