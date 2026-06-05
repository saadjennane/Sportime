import React from 'react';
import { Challenge, LeaderboardEntry } from '../types';
import { Trophy, Medal, Award } from 'lucide-react';

interface LeaderboardProps {
  challenge: Challenge;
  leaderboard: LeaderboardEntry[];
}

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy size={20} className="text-yellow-500" />;
  if (rank === 2) return <Medal size={20} className="text-gray-400" />;
  if (rank === 3) return <Award size={20} className="text-orange-400" />;
  return <span className="font-bold text-gray-500 w-5 text-center">{rank}</span>;
};

export const Leaderboard: React.FC<LeaderboardProps> = ({ challenge, leaderboard }) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-5 space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-purple-700">{challenge.name}</h2>
        <p className="text-sm font-semibold text-gray-500">Final Leaderboard</p>
      </div>
      <div className="space-y-2">
        {leaderboard.map(entry => (
          <div key={entry.rank} className={`flex items-center p-3 rounded-xl ${entry.username === 'You' ? 'bg-purple-50 border-2 border-purple-200' : 'bg-gray-50'}`}>
            <div className="w-8 flex justify-center">{getRankIcon(entry.rank)}</div>
            <div className="flex-1 font-semibold text-gray-800">{entry.username}</div>
            <div className="text-right">
              <p className="font-bold text-purple-600">{entry.finalCoins.toLocaleString()} coins</p>
              <p className="text-xs text-gray-500">{entry.points} pts</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
