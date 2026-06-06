import React from 'react';
import { Match } from '../../types';

const TeamLogo: React.FC<{ team: Match['teamA'] }> = ({ team }) =>
  team.logo ? (
    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
      <img src={team.logo} alt={team.name} className="w-6 h-6 object-contain" />
    </div>
  ) : (
    <span className="w-7 h-7 rounded-full bg-deep-navy flex items-center justify-center text-xs font-bold text-electric-blue flex-shrink-0">
      {team.emoji && team.emoji.length === 1 ? team.emoji : team.name?.charAt(0).toUpperCase() || '?'}
    </span>
  );

interface MatchHeaderRowProps {
  match: Match;
  /** Centre: heure (à venir) ou score "1 - 0" (live/terminé). */
  center: string;
  /** Badge à gauche (statut). Absent = match à venir. */
  badge?: { text: string; variant: 'live' | 'finished' };
  centerClass?: string;
}

/**
 * Single-line match header (FotMob style):
 * [badge]  HomeName (logo)   time/score   (logo) AwayName
 */
export const MatchHeaderRow: React.FC<MatchHeaderRowProps> = ({
  match,
  center,
  badge,
  centerClass,
}) => (
  <div className="flex items-center gap-2">
    <div className="w-9 flex-shrink-0">
      {badge && (
        <span
          className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${
            badge.variant === 'live'
              ? 'text-white bg-gradient-to-r from-hot-red to-electric-blue animate-pulse'
              : 'bg-disabled text-text-disabled'
          }`}
        >
          {badge.text}
        </span>
      )}
    </div>

    <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
      <span className="text-sm font-semibold text-text-primary truncate text-right">{match.teamA.name}</span>
      <TeamLogo team={match.teamA} />
    </div>

    <div className={`px-1 text-center text-base font-bold whitespace-nowrap ${centerClass ?? 'text-text-primary'}`}>
      {center}
    </div>

    <div className="flex-1 flex items-center gap-2 min-w-0">
      <TeamLogo team={match.teamB} />
      <span className="text-sm font-semibold text-text-primary truncate">{match.teamB.name}</span>
    </div>
  </div>
);

export default MatchHeaderRow;
