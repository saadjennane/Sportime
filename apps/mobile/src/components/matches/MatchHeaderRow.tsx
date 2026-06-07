import React from 'react';

interface TeamInfo {
  name: string;
  emoji?: string;
  logo?: string | null;
}

const TeamLogo: React.FC<{ team: TeamInfo }> = ({ team }) =>
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
  match: { teamA: TeamInfo; teamB: TeamInfo };
  /** Centre: heure (à venir) ou score "1 - 0" (live/terminé). */
  center: string;
  /** Statut affiché SOUS le score (live: 1H/HT…, terminé: FT/CANC…). */
  status?: { text: string; variant: 'live' | 'finished' };
  centerClass?: string;
}

/**
 * Single-line match header (FotMob style):
 * HomeName (logo)   score/time   (logo) AwayName
 *
 * Grid 1fr / auto / 1fr keeps the score geometrically centred. The status
 * (live minute / FT…) sits UNDER the score so it never overlaps the team names,
 * which get the full side columns and wrap on word boundaries when too long.
 */
export const MatchHeaderRow: React.FC<MatchHeaderRowProps> = ({
  match,
  center,
  status,
  centerClass,
}) => (
  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
    <div className="flex items-center justify-end gap-1.5 min-w-0">
      <span className="text-sm font-semibold text-text-primary text-right leading-tight break-words">
        {match.teamA.name}
      </span>
      <TeamLogo team={match.teamA} />
    </div>

    <div className="flex flex-col items-center px-1">
      <span className={`text-base font-bold whitespace-nowrap ${centerClass ?? 'text-text-primary'}`}>
        {center}
      </span>
      {status && (
        <span
          className={`mt-0.5 text-[9px] leading-none px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap ${
            status.variant === 'live'
              ? 'text-white bg-gradient-to-r from-hot-red to-electric-blue animate-pulse'
              : 'bg-disabled text-text-disabled'
          }`}
        >
          {status.text}
        </span>
      )}
    </div>

    <div className="flex items-center justify-start gap-1.5 min-w-0">
      <TeamLogo team={match.teamB} />
      <span className="text-sm font-semibold text-text-primary text-left leading-tight break-words">
        {match.teamB.name}
      </span>
    </div>
  </div>
);

export default MatchHeaderRow;
