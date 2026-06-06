import React from 'react';
import { Challenge, LeaderboardEntry } from '../types';
import { Trophy, Medal, Award } from 'lucide-react';

interface LeaderboardProps {
  challenge: Challenge;
  leaderboard: LeaderboardEntry[];
}

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy size={20} className="text-warm-yellow" />;
  if (rank === 2) return <Medal size={20} className="text-text-secondary" />;
  if (rank === 3) return <Award size={20} className="text-orange-400" />;
  return <span className="font-bold text-text-disabled w-5 text-center">{rank}</span>;
};

export const Leaderboard: React.FC<LeaderboardProps> = ({ challenge, leaderboard }) => {
  return (
    <div className="card-base p-5 space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text-primary">{challenge.name}</h2>
        <p className="text-sm font-semibold text-text-secondary">Leaderboard</p>
      </div>

      <div className="space-y-2">
        {leaderboard.length === 0 ? (
          <p className="text-center text-sm text-text-disabled py-6">No players yet.</p>
        ) : (
          leaderboard.map(entry => {
            const isYou = entry.username === 'You';
            return (
              <div
                key={`${entry.rank}-${entry.userId ?? entry.username}`}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  isYou ? 'bg-electric-blue/10 border-electric-blue' : 'bg-deep-navy border-disabled'
                }`}
              >
                <div className="w-7 flex justify-center flex-shrink-0">{getRankIcon(entry.rank)}</div>
                <div className={`flex-1 font-semibold truncate ${isYou ? 'text-electric-blue' : 'text-text-primary'}`}>
                  {entry.username}
                </div>
                <div className="text-right">
                  <p className="font-bold text-lime-glow">{entry.points.toLocaleString()} pts</p>
                  <p className="text-xs text-text-disabled">{entry.finalCoins.toLocaleString()} coins</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
