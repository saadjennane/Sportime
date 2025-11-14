import React, { useState, useRef, useEffect } from 'react';
import { LeagueGame, Game } from '../../types';
import { Users, BarChart2, MoreVertical } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface LeagueGameCardProps {
  game: LeagueGame & { status: Game['status'] };
  onView: () => void;
  isAdmin: boolean;
  onUnlink?: () => void;
}

const gameTypeDetails = {
  Betting: { color: 'bg-electric-blue/20 text-electric-blue' },
  Prediction: { color: 'bg-neon-cyan/20 text-neon-cyan' },
  Fantasy: { color: 'bg-lime-glow/20 text-lime-glow' },
  Private: { color: 'bg-warm-yellow/20 text-warm-yellow' },
};

export const LeagueGameCard: React.FC<LeagueGameCardProps> = ({ game, onView, isAdmin, onUnlink }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const isFinished = game.status === 'Finished';
  const details = gameTypeDetails[game.type];
  const progress = (game.members_joined / game.members_total) * 100;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <div className={`card-base p-4 space-y-4 transition-opacity ${isFinished ? 'opacity-70' : ''}`}>
      {/* Top Section */}
      <div className="flex justify-between items-start">
        <div className="flex-1 flex items-center gap-2">
          {isFinished && <span title="Finished Game">🏁</span>}
          <h3 className="text-md font-bold text-text-primary pr-2">{game.game_name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${details.color}`}>
            {game.type}
          </span>
          {isAdmin && !isFinished && onUnlink && (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setIsMenuOpen(p => !p)} className="p-1 text-text-secondary hover:bg-white/10 rounded-full">
                <MoreVertical size={18} />
              </button>
              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute top-full right-0 mt-1 w-40 bg-navy-accent border border-disabled rounded-lg shadow-xl z-10 p-1"
                  >
                    <button onClick={() => { onView(); setIsMenuOpen(false); }} className="w-full text-left text-sm p-2 rounded hover:bg-electric-blue/10 text-text-primary">View Leaderboard</button>
                    <button onClick={() => { onUnlink(); setIsMenuOpen(false); }} className="w-full text-left text-sm p-2 rounded hover:bg-hot-red/10 text-hot-red">Unlink Game</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
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
          {game.type !== 'Private' && (
            <br />
          )}
          {game.type !== 'Private' && (
            <span className="text-xs">(Global: #{game.user_rank_global.toLocaleString()} / {game.total_players_global.toLocaleString()})</span>
          )}
        </div>
        
        <button 
          onClick={onView} 
          className="flex-shrink-0 flex items-center justify-center gap-2 font-bold rounded-lg transition-all bg-gradient-to-r from-electric-blue to-neon-cyan text-white text-sm py-2 px-4 shadow-lg hover:shadow-neon-cyan/30"
        >
          <BarChart2 size={16} />
          <span>{isFinished ? 'Results' : 'View'}</span>
        </button>
      </div>
    </div>
  );
};
