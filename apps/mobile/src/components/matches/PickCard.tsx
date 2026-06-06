import React from 'react';
import { Match, Bet } from '../../types';
import { Clock, Pencil, BarChart2, Lock } from 'lucide-react';
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
  if (isToday(d)) return time; // date already shown in the page header
  if (isTomorrow(d)) return `Tomorrow · ${time}`;
  return format(d, 'MMM d · HH:mm');
}

// Live status label, mirroring the Today match card (1H/HT/2H/ET/PEN…).
function liveLabel(raw?: string): string {
  const r = (raw || '').toUpperCase();
  if (r === '1H') return '1H';
  if (r === 'HT') return 'HT';
  if (r === '2H') return '2H';
  if (r === 'ET') return 'ET';
  if (r === 'P' || r === 'PEN') return 'PEN';
  if (r === 'BT') return 'BT';
  return 'Live';
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

  const isLive = !!match.isLive;
  const showEdit = !started && bet.status === 'pending' && !!onEdit;
  const showLocked = started; // match in progress / kicked off -> bet locked
  const hasScore = !!match.score;

  return (
    <div className="card-base p-5 space-y-4">
      {/* Header: kick-off + status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-text-secondary">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">{formatKickoff(match.kickoffTime)}</span>
        </div>
        {isLive ? (
          <span className="text-white text-xs px-3 py-1 rounded-full font-semibold whitespace-nowrap bg-gradient-to-r from-hot-red to-electric-blue animate-pulse">
            {liveLabel(match.rawStatus)}
          </span>
        ) : (
          <span className="bg-disabled text-text-secondary text-xs px-3 py-1 rounded-full font-semibold whitespace-nowrap">
            Upcoming
          </span>
        )}
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

      {/* The three outcomes, with the user's pick highlighted (read-only) */}
      <div className="flex gap-2">
        {([
          { key: 'teamA', label: match.teamA.name.split(' ')[0], odds: match.odds?.teamA },
          { key: 'draw', label: 'Draw', odds: match.odds?.draw },
          { key: 'teamB', label: match.teamB.name.split(' ')[0], odds: match.odds?.teamB },
        ] as const).map((o) => {
          const selected = bet.prediction === o.key;
          // Full class names (no interpolation) so Tailwind keeps them.
          const containerCls = !selected
            ? 'border-disabled bg-deep-navy opacity-50'
            : bet.status === 'won'
              ? 'border-lime-glow bg-lime-glow/10'
              : bet.status === 'lost'
                ? 'border-hot-red bg-hot-red/10'
                : 'border-electric-blue bg-electric-blue/10';
          const oddsCls = !selected
            ? 'text-text-primary'
            : bet.status === 'won'
              ? 'text-lime-glow'
              : bet.status === 'lost'
                ? 'text-hot-red'
                : 'text-electric-blue';
          const hasOdds = typeof o.odds === 'number' && o.odds > 0;
          return (
            <div key={o.key} className={`flex-1 p-3 rounded-xl border-2 text-center ${containerCls}`}>
              <div className="text-xs text-text-secondary mb-1 font-medium truncate">{o.label}</div>
              <div className={`text-xl font-bold ${oddsCls}`}>
                {hasOdds ? `${(o.odds as number).toFixed(2)}x` : '--'}
              </div>
            </div>
          );
        })}
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
        {showEdit ? (
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-navy-accent rounded-lg text-sm font-semibold text-text-secondary hover:text-electric-blue transition-colors"
          >
            <Pencil size={14} /> Edit
          </button>
        ) : showLocked ? (
          <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-navy-accent/50 rounded-lg text-sm font-semibold text-text-disabled cursor-not-allowed">
            <Lock size={14} /> Locked
          </div>
        ) : null}
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

export default PickCard;
