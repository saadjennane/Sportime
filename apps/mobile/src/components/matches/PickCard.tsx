import React from 'react';
import { Pencil, BarChart2, Lock, Zap } from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import { Match, Bet } from '../../types';
import { MatchHeaderRow } from './MatchHeaderRow';

interface PickCardProps {
  match: Match;
  bet: Bet;
  onEdit?: () => void;
  onViewStats?: () => void;
  onPlayGame?: (matchId: string, matchName: string) => void;
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = format(d, 'HH:mm');
  if (isToday(d)) return time;
  if (isTomorrow(d)) return `Tom · ${time}`;
  return format(d, 'MMM d · HH:mm');
}

function liveLabel(raw?: string): string {
  const r = (raw || '').toUpperCase();
  if (r === '1H') return '1H';
  if (r === 'HT') return 'HT';
  if (r === '2H') return '2H';
  if (r === 'ET') return 'ET';
  if (r === 'P' || r === 'PEN') return 'PEN';
  if (r === 'BT') return 'BT';
  return 'LIVE';
}

export const PickCard: React.FC<PickCardProps> = ({ match, bet, onEdit, onViewStats, onPlayGame }) => {
  const started = new Date(match.kickoffTime).getTime() <= Date.now();
  const isLive = !!match.isLive;
  const safeOdds = typeof bet.odds === 'number' && Number.isFinite(bet.odds) ? bet.odds : 0;
  const potential = Math.ceil(bet.amount * safeOdds);

  const showEdit = !started && bet.status === 'pending' && !!onEdit;
  const showLocked = started;

  const center =
    started && match.score ? `${match.score.teamA} - ${match.score.teamB}` : formatKickoff(match.kickoffTime);
  const badge = isLive ? ({ text: liveLabel(match.rawStatus), variant: 'live' } as const) : undefined;

  const outcomes = [
    { key: 'teamA', label: match.teamA.name.split(' ')[0], odds: match.odds?.teamA },
    { key: 'draw', label: 'Draw', odds: match.odds?.draw },
    { key: 'teamB', label: match.teamB.name.split(' ')[0], odds: match.odds?.teamB },
  ] as const;

  return (
    <div className="card-base p-4 space-y-3">
      <MatchHeaderRow match={match} center={center} badge={badge} />

      {/* Three odds, user's pick highlighted */}
      <div className="flex gap-2">
        {outcomes.map((o) => {
          const selected = bet.prediction === o.key;
          const cls = selected
            ? 'border-electric-blue bg-electric-blue/10'
            : 'border-disabled bg-deep-navy opacity-50';
          const oddsCls = selected ? 'text-electric-blue' : 'text-text-primary';
          const hasOdds = typeof o.odds === 'number' && o.odds > 0;
          return (
            <div key={o.key} className={`flex-1 p-2 rounded-lg border text-center ${cls}`}>
              <div className="text-[11px] text-text-secondary font-medium truncate">{o.label}</div>
              <div className={`text-base font-bold ${oddsCls}`}>
                {hasOdds ? `${(o.odds as number).toFixed(2)}x` : '--'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stake + potential */}
      <div className="flex items-center justify-between text-sm">
        <div>
          <span className="text-text-disabled">Stake </span>
          <span className="font-semibold text-warm-yellow">{bet.amount.toLocaleString()} coins</span>
        </div>
        <div>
          <span className="text-text-disabled">Potential </span>
          <span className="font-semibold text-lime-glow">+{potential.toLocaleString()}</span>
        </div>
      </div>

      {/* Actions: Edit/Locked · Play · Stats */}
      <div className="flex gap-2">
        {showEdit ? (
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-navy-accent rounded-lg text-sm font-semibold text-text-secondary hover:text-electric-blue transition-colors"
          >
            <Pencil size={14} /> Edit
          </button>
        ) : showLocked ? (
          <div className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-navy-accent/50 rounded-lg text-sm font-semibold text-text-disabled">
            <Lock size={14} /> Locked
          </div>
        ) : null}
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

export default PickCard;
