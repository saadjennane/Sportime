import React from 'react';
import { TeamStats } from '../../../types';
import { FormSkeleton } from './SkeletonLoaders';

interface FormTabProps {
  data?: { home: TeamStats; away: TeamStats };
  loading: boolean;
}

const TeamForm: React.FC<{ team: TeamStats }> = ({ team }) => {
  const { formSummary, formMatches } = team;
  const formBadges = formSummary.formString.split(' ');

  const getBadgeClass = (result: string) => {
    if (result === 'W') return 'bg-lime-glow/20 text-lime-glow';
    if (result === 'D') return 'bg-disabled text-text-disabled';
    return 'bg-hot-red/20 text-hot-red';
  };

  return (
    <div className="bg-navy-accent p-4 rounded-lg space-y-3">
      <h4 className="font-bold text-text-primary">{team.name}</h4>
      <div className="flex justify-between items-center">
        <p className="text-sm text-text-secondary">Last 5 Matches</p>
        <div className="flex gap-1">
          {formBadges.map((result, i) => (
            <span key={i} className={`w-5 h-5 flex items-center justify-center text-xs font-bold rounded ${getBadgeClass(result)}`}>
              {result}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2 text-center text-xs text-text-disabled pt-2 border-t border-disabled/50">
        <div><p>Played</p><p className="font-bold text-text-primary">{formSummary.played}</p></div>
        <div><p>Wins</p><p className="font-bold text-text-primary">{formSummary.wins}</p></div>
        <div><p>Draws</p><p className="font-bold text-text-primary">{formSummary.draws}</p></div>
        <div><p>Losses</p><p className="font-bold text-text-primary">{formSummary.losses}</p></div>
        <div><p>Goals</p><p className="font-bold text-text-primary">{formSummary.goalsFor}:{formSummary.goalsAgainst}</p></div>
      </div>
      <div className="space-y-2 pt-2 border-t border-disabled/50">
        {formMatches.map((match, i) => (
          <div key={i} className="flex items-center justify-between text-xs p-2 bg-deep-navy rounded">
            <span className="text-text-disabled">{match.homeTeam} vs {match.awayTeam}</span>
            <span className="font-bold text-text-primary">{match.homeScore}-{match.awayScore}</span>
            <span className={`font-bold w-6 text-center ${getBadgeClass(match.result)} rounded`}>{match.result}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const FormTab: React.FC<FormTabProps> = ({ data, loading }) => {
  if (loading) {
    return <FormSkeleton />;
  }

  if (!data) {
    return <div className="text-center text-text-disabled p-8">No form data available.</div>;
  }

  return (
    <div className="space-y-4">
      <TeamForm team={data.home} />
      <TeamForm team={data.away} />
    </div>
  );
};
