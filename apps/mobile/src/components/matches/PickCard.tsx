import React from 'react';
import { Match, Bet } from '../../types';
import { Clock, Pencil, BarChart2 } from 'lucide-react';
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
        : { text: 'Bet Placed', cls: 'text-white bg-gradient-to-r from-electric-blue to-neon-cyan' };

  const isSettled = bet.status === 'won' || bet.status === 'lost';
  const canEdit = !started && bet.status === 'pending' && !!onEdit;
  const hasScore = !!match.score;

  return (
    <div className="card-base p-5 space-y-4">
      {/* Header: kick-off + status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-text-secondary">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">{formatKickoff(match.kickoffTime)}</span>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-semibold whitespace-nowrap ${badge.cls}`}>
          {badge.text}
        </span>
      </div>

      {/* Teams (same layout as the Today match card) */}
      <div className="flex items-center justify-between">
        <div className="flex-1 text-center">
          <TeamAvatar team={match.teamA} />
          <div className="text-sm font-semibold text-text-primary">{match.teamA.name}</div>
        </div>
        <div className="px-4 text-center">
          {hasScore ? (
            <div className="text-2xl font-bold text-text-primary">
              {match.score?.teamA ?? 0} - {match.score?.teamB ?? 0}
            </div>
          ) : (
            <div className="text-2xl font-bold text-disabled">VS</div>
          )}
        </div>
        <div className="flex-1 text-center">
          <TeamAvatar team={match.teamB} />
          <div className="text-sm font-semibold text-text-primary">{match.teamB.name}</div>
        </div>
      </div>

      {/* Selected pick with its locked odds */}
      <div
        className={`rounded-xl border-2 p-3 flex items-center justify-between ${
          bet.status === 'won'
            ? 'border-lime-glow bg-lime-glow/10'
            : bet.status === 'lost'
              ? 'border-hot-red bg-hot-red/10'
              : 'border-electric-blue bg-electric-blue/10'
        }`}
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-semibold text-text-disabled tracking-wide">Your pick</p>
          <p className="text-base font-bold text-text-primary truncate">{predictionLabel}</p>
        </div>
        <span
          className={`text-2xl font-bold whitespace-nowrap ${
            bet.status === 'won' ? 'text-lime-glow' : bet.status === 'lost' ? 'text-hot-red' : 'text-electric-blue'
          }`}
        >
          {safeOdds.toFixed(2)}x
        </span>
      </div>

      {/* Stake + Potential / Winnings */}
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

      {/* Actions at the bottom */}
      <div className="flex gap-2">
        {canEdit && (
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-navy-accent rounded-lg text-sm font-semibold text-text-secondary hover:text-electric-blue transition-colors"
          >
            <Pencil size={14} /> Edit
          </button>
        )}
        <button
          onClick={onViewStats}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-navy-accent rounded-lg text-sm font-semibold text-text-secondary hover:text-electric-blue transition-colors"
        >
          <BarChart2 size={14} /> Stats
        </button>
      </div>

      {started && !isSettled && (
        <p className="text-[11px] text-text-disabled text-center -mt-1">Match in progress — bet locked.</p>
      )}
    </div>
  );
};

export default PickCard;
