import React from 'react';
import { LiveGame } from '../../../types';
import { Radio, Users, CheckCircle, ArrowRight } from 'lucide-react';

interface LiveGameCardProps {
  game: LiveGame;
  onView: () => void;
}

export const LiveGameCard: React.FC<LiveGameCardProps> = ({ game, onView }) => {
  const statusStyles = {
    Upcoming: 'bg-electric-blue/20 text-electric-blue',
    Ongoing: 'bg-hot-red/20 text-hot-red animate-pulse',
    Finished: 'bg-disabled text-text-disabled',
  };

  return (
    <div className="card-base p-4 space-y-3">
      <div className="flex justify-between items-start">
        <h3 className="text-md font-bold text-text-primary pr-2">{game.match_details.teamA.name} vs {game.match_details.teamB.name}</h3>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${statusStyles[game.status]}`}>
          {game.status === 'Ongoing' ? 'LIVE' : game.status}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm text-text-secondary border-t border-white/10 pt-3">
        <div className="flex items-center gap-2">
          <Radio size={14} />
          <span>Live Game</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Users size={14} />
          <span>{game.players.length} players</span>
        </div>
      </div>
      
      <div className="flex items-center justify-end border-t border-white/10 pt-3">
        <button onClick={onView} className="primary-button text-sm py-2 px-4 flex items-center gap-2">
          {game.status === 'Upcoming' ? 'Predict' : game.status === 'Ongoing' ? 'View Live' : 'View Results'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
