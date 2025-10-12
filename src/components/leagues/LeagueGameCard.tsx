import React from 'react';
import { LeagueGame } from '../../types';
import { Users, BarChart2 } from 'lucide-react';

interface LeagueGameCardProps {
  game: LeagueGame;
  onView: () => void;
}

const gameTypeDetails = {
  Betting: { color: 'bg-electric-blue/20 text-electric-blue' },
  Prediction: { color: 'bg-neon-cyan/20 text-neon-cyan' },
  Fantasy: { color: 'bg-lime-glow/20 text-lime-glow' },
};

export const LeagueGameCard: React.FC<LeagueGameCardProps> = ({ game, onView }) => {
  const details = gameTypeDetails[game.type];
  const progress = (game.members_joined / game.members_total) * 100;

  const formatRank = (rank: number) => {
    if (rank % 100 >= 11 && rank % 100 <= 13) return `${rank}th`;
    switch (rank % 10) {
      case 1: return `${rank}st`;
      case 2: return `${rank}nd`;
      case 3: return `${rank}rd`;
      default: return `${rank}th`;
    }
  };

  return (
    <div className="card-base p-4 space-y-4">
      {/* Top Section */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-md font-bold text-text-primary pr-2">{game.game_name}</h3>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${details.color}`}>
          {game.type}
        </span>
      </div>

      {/* Middle Section - Members */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-semibold text-text-secondary">
          <div className="flex items-center gap-1.5"><Users size={14} /> Members Joined</div>
          <span>{game.members_joined} / {game.members_total}</span>
        </div>
        <div className="w-full bg-disabled rounded-full h-2 overflow-hidden">
          <div className="bg-electric-blue h-full rounded-full" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Bottom Section - Rank & Action */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3 gap-4">
        <div className="text-sm text-text-secondary">
          <span>You are <b className="text-text-primary">{formatRank(game.user_rank_in_league)}</b> in your league</span>
          <br />
          <span className="text-xs">(Global: #{game.user_rank_global.toLocaleString()} / {game.total_players_global.toLocaleString()})</span>
        </div>
        
        <button 
          onClick={onView} 
          className="flex-shrink-0 flex items-center justify-center gap-2 font-bold rounded-lg transition-all bg-gradient-to-r from-electric-blue to-neon-cyan text-white text-sm py-2 px-4 shadow-lg hover:shadow-neon-cyan/30"
        >
          <BarChart2 size={16} />
          <span>View</span>
        </button>
      </div>
    </div>
  );
};
