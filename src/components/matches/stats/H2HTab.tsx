import React from 'react';
import { H2HMatch } from '../../../types';
import { H2HSkeleton } from './SkeletonLoaders';

interface H2HTabProps {
  data?: H2HMatch[];
  loading: boolean;
}

export const H2HTab: React.FC<H2HTabProps> = ({ data, loading }) => {
  if (loading) {
    return <H2HSkeleton />;
  }

  if (!data || data.length === 0) {
    return <div className="text-center text-text-disabled p-8">No head-to-head data available.</div>;
  }

  return (
    <div className="space-y-2">
      {data.map((match, i) => (
        <div key={i} className="bg-navy-accent p-3 rounded-lg flex items-center justify-between">
          <div className="text-xs text-text-disabled">
            <p>{match.date}</p>
            <p>{match.competition}</p>
          </div>
          <p className="text-sm text-text-secondary">{match.homeTeam} vs {match.awayTeam}</p>
          <p className="text-sm font-bold text-text-primary bg-deep-navy px-2 py-1 rounded">{match.score}</p>
        </div>
      ))}
    </div>
  );
};
