import React from 'react';
import { Match } from '../../types';

const TeamLogo: React.FC<{ team: Match['teamA'] }> = ({ team }) =>
  team.logo ? (
    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
      <img src={team.logo} alt={team.name} className="w-5 h-5 object-contain" />
    </div>
  ) : (
    <span className="w-6 h-6 rounded-full bg-deep-navy flex items-center justify-center text-[10px] font-bold text-electric-blue flex-shrink-0">
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
 *
 * Grid 1fr / auto / 1fr keeps the score geometrically centred whatever the team
 * names. The status badge is absolutely positioned on the left (out of flow) so
 * it never shifts the score; the side columns reserve room for it (pl/pr).
 * Names wrap on word boundaries (never mid-word) when too long.
 */
export const MatchHeaderRow: React.FC<MatchHeaderRowProps> = ({
  match,
  center,
  badge,
  centerClass,
}) => (
  <div className="relative">
    {badge && (
      <span
        className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 text-[10px] px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap ${
          badge.variant === 'live'
            ? 'text-white bg-gradient-to-r from-hot-red to-electric-blue animate-pulse'
            : 'bg-disabled text-text-disabled'
        }`}
      >
        {badge.text}
      </span>
    )}

    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
      <div className="flex items-center justify-end gap-1.5 min-w-0 pl-8">
        <span className="text-[13px] font-semibold text-text-primary text-right leading-tight break-words">
          {match.teamA.name}
        </span>
        <TeamLogo team={match.teamA} />
      </div>

      <span className={`px-1 text-base font-bold whitespace-nowrap ${centerClass ?? 'text-text-primary'}`}>
        {center}
      </span>

      <div className="flex items-center justify-start gap-1.5 min-w-0 pr-8">
        <TeamLogo team={match.teamB} />
        <span className="text-[13px] font-semibold text-text-primary text-left leading-tight break-words">
          {match.teamB.name}
        </span>
      </div>
    </div>
  </div>
);

export default MatchHeaderRow;
