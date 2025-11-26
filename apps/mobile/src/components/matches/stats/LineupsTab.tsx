import React from 'react';
import { Lineup } from '../../../types';
import { LineupSkeleton } from './SkeletonLoaders';
import { format } from 'date-fns';
import { UserMinus } from 'lucide-react';
import { LineupPitch } from './LineupPitch';

interface LineupsTabProps {
  data?: Lineup;
  loading: boolean;
}

const PlayerList: React.FC<{
  title: string;
  players: { name: string; position: string; number?: number }[];
}> = ({ title, players }) => (
  <div>
    <h4 className="font-semibold text-text-secondary mb-2 text-sm">{title}</h4>
    <div className="bg-deep-navy/50 p-2 rounded-lg space-y-1">
      {players.map((player, i) => (
        <div key={i} className="flex items-center gap-2 text-xs p-1">
          {player.number && (
            <span className="font-bold text-electric-blue w-5 text-right">{player.number}</span>
          )}
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

  // Check if we have grid data for pitch visualization
  const hasGridData = data.starters.some((p) => p.grid);

  return (
    <div className="space-y-4">
      {/* Formation header - only show if no pitch (pitch has its own badge) */}
      {!hasGridData && (
        <div className="bg-navy-accent p-3 rounded-lg text-center">
          <p className="text-xs text-text-disabled">Formation</p>
          <p className="text-lg font-bold text-electric-blue">{data.formation}</p>
        </div>
      )}

      {/* Pitch view if grid data available, otherwise list */}
      {hasGridData ? (
        <LineupPitch starters={data.starters} formation={data.formation} />
      ) : (
        <PlayerList title="Starters" players={data.starters} />
      )}

      {/* Bench always as list */}
      <PlayerList title="Bench" players={data.bench} />

      {/* Absentees */}
      {data.absentees.length > 0 && (
        <div>
          <h4 className="font-semibold text-text-secondary mb-2 text-sm">Absentees</h4>
          <div className="bg-deep-navy/50 p-2 rounded-lg space-y-1">
            {data.absentees.map((player, i) => (
              <div key={i} className="flex items-center gap-2 text-xs p-1 text-hot-red/80">
                <UserMinus size={14} />
                <span>
                  {player.name} ({player.reason})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last updated info */}
      <p className="text-[10px] text-text-disabled text-center">
        Last updated: {format(new Date(data.lastUpdated), 'p')} from {data.source}
      </p>
    </div>
  );
};
