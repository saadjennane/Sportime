import React, { useState } from 'react';
import type { MatchLineups, LineupPlayer } from '../../../types';
import { LineupSkeleton } from './SkeletonLoaders';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { LineupPitch } from './LineupPitch';

interface LineupsTabProps {
  data?: MatchLineups;
  loading: boolean;
}

const PlayerListItem: React.FC<{ player: LineupPlayer; showPhoto?: boolean }> = ({
  player,
  showPhoto = true,
}) => {
  const positionColors: Record<string, string> = {
    G: 'text-amber-400',
    D: 'text-emerald-400',
    M: 'text-blue-400',
    F: 'text-red-400',
  };

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-white/5 rounded">
      {showPhoto && (
        <div className="w-8 h-8 rounded-full overflow-hidden bg-navy-accent flex-shrink-0">
          {player.photo ? (
            <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-disabled text-xs">
              {player.number ?? '?'}
            </div>
          )}
        </div>
      )}
      <span className={`font-bold w-5 text-right ${positionColors[player.position] || 'text-gray-400'}`}>
        {player.number}
      </span>
      <span className="font-medium text-text-disabled w-5">{player.position}</span>
      <span className="text-text-primary text-sm flex-1 truncate">{player.name}</span>
    </div>
  );
};

const BenchSection: React.FC<{
  homeBench: LineupPlayer[];
  awayBench: LineupPlayer[];
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
}> = ({ homeBench, awayBench, homeTeamName, awayTeamName, homeTeamLogo, awayTeamLogo }) => {
  const [expanded, setExpanded] = useState(false);

  if (homeBench.length === 0 && awayBench.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-navy-accent rounded-lg hover:bg-navy-accent/80 transition-colors"
      >
        <span className="text-sm font-semibold text-text-secondary">
          Substitutes ({homeBench.length + awayBench.length})
        </span>
        {expanded ? (
          <ChevronUp size={18} className="text-text-disabled" />
        ) : (
          <ChevronDown size={18} className="text-text-disabled" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {/* Home bench */}
          <div className="bg-deep-navy/50 rounded-lg p-2">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-disabled">
              {homeTeamLogo && (
                <img src={homeTeamLogo} alt={homeTeamName} className="w-4 h-4 object-contain" />
              )}
              <span className="text-xs font-semibold text-text-secondary">{homeTeamName}</span>
            </div>
            <div className="space-y-0.5">
              {homeBench.map((player, i) => (
                <PlayerListItem key={i} player={player} showPhoto={false} />
              ))}
            </div>
          </div>

          {/* Away bench */}
          <div className="bg-deep-navy/50 rounded-lg p-2">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-disabled">
              {awayTeamLogo && (
                <img src={awayTeamLogo} alt={awayTeamName} className="w-4 h-4 object-contain" />
              )}
              <span className="text-xs font-semibold text-text-secondary">{awayTeamName}</span>
            </div>
            <div className="space-y-0.5">
              {awayBench.map((player, i) => (
                <PlayerListItem key={i} player={player} showPhoto={false} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const LineupsTab: React.FC<LineupsTabProps> = ({ data, loading }) => {
  if (loading) {
    return <LineupSkeleton />;
  }

  if (!data) {
    return (
      <div className="text-center text-text-disabled p-8">
        <div className="text-4xl mb-2">⚽</div>
        <p>Lineups are not yet confirmed.</p>
        <p className="text-xs mt-1">Usually available ~1 hour before kickoff</p>
      </div>
    );
  }

  // Check if we have grid data for pitch visualization
  const hasGridData =
    data.home.starters.some((p) => p.grid) || data.away.starters.some((p) => p.grid);

  return (
    <div className="space-y-4">
      {/* Pitch visualization */}
      {hasGridData ? (
        <LineupPitch data={data} />
      ) : (
        // Fallback to list view if no grid data
        <div className="grid grid-cols-2 gap-3">
          {/* Home team */}
          <div className="bg-deep-navy/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-disabled">
              {data.home.teamLogo && (
                <img
                  src={data.home.teamLogo}
                  alt={data.home.teamName}
                  className="w-6 h-6 object-contain"
                />
              )}
              <div>
                <p className="text-sm font-bold text-text-primary">{data.home.teamName}</p>
                <p className="text-xs text-electric-blue">{data.home.formation}</p>
              </div>
            </div>
            <div className="space-y-0.5">
              {data.home.starters.map((player, i) => (
                <PlayerListItem key={i} player={player} />
              ))}
            </div>
          </div>

          {/* Away team */}
          <div className="bg-deep-navy/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-disabled">
              {data.away.teamLogo && (
                <img
                  src={data.away.teamLogo}
                  alt={data.away.teamName}
                  className="w-6 h-6 object-contain"
                />
              )}
              <div>
                <p className="text-sm font-bold text-text-primary">{data.away.teamName}</p>
                <p className="text-xs text-hot-red">{data.away.formation}</p>
              </div>
            </div>
            <div className="space-y-0.5">
              {data.away.starters.map((player, i) => (
                <PlayerListItem key={i} player={player} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bench section */}
      <BenchSection
        homeBench={data.home.bench}
        awayBench={data.away.bench}
        homeTeamName={data.home.teamName}
        awayTeamName={data.away.teamName}
        homeTeamLogo={data.home.teamLogo}
        awayTeamLogo={data.away.teamLogo}
      />

      {/* Last updated info */}
      <p className="text-[10px] text-text-disabled text-center">
        Last updated: {format(new Date(data.lastUpdated), 'p')} • {data.source}
      </p>
    </div>
  );
};
