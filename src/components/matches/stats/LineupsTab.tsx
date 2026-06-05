import React from 'react';
import { Lineup } from '../../../types';
import { LineupSkeleton } from './SkeletonLoaders';
import { format } from 'date-fns';
import { Shirt, UserMinus } from 'lucide-react';

interface LineupsTabProps {
  data?: Lineup;
  loading: boolean;
}

const PlayerList: React.FC<{ title: string; players: { name: string; position: string }[] }> = ({ title, players }) => (
  <div>
    <h4 className="font-semibold text-text-secondary mb-2 text-sm">{title}</h4>
    <div className="bg-deep-navy/50 p-2 rounded-lg space-y-1">
      {players.map((player, i) => (
        <div key={i} className="flex items-center gap-2 text-xs p-1">
          <span className="font-bold text-text-disabled w-6">{player.position}</span>
          <span className="text-text-primary">{player.name}</span>
        </div>
      ))}
    </div>
  </div>
);

export const LineupsTab: React.FC<LineupsTabProps> = ({ data, loading }) => {
  if (loading) {
    return <LineupSkeleton />;
  }

  if (!data) {
    return <div className="text-center text-text-disabled p-8">Lineups are not yet confirmed.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-navy-accent p-3 rounded-lg text-center">
        <p className="text-xs text-text-disabled">Formation</p>
        <p className="text-lg font-bold text-electric-blue">{data.formation}</p>
        <p className="text-[10px] text-text-disabled mt-1">Last updated: {format(new Date(data.lastUpdated), 'p')} from {data.source}</p>
      </div>

      <div className="space-y-4">
        <PlayerList title="Starters" players={data.starters} />
        <PlayerList title="Bench" players={data.bench} />
        
        {data.absentees.length > 0 && (
          <div>
            <h4 className="font-semibold text-text-secondary mb-2 text-sm">Absentees</h4>
            <div className="bg-deep-navy/50 p-2 rounded-lg space-y-1">
              {data.absentees.map((player, i) => (
                <div key={i} className="flex items-center gap-2 text-xs p-1 text-hot-red/80">
                  <UserMinus size={14} />
                  <span>{player.name} ({player.reason})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
