import React, { useState } from 'react';
import { X, Trophy, Medal, Award, User, Users, Shield } from 'lucide-react';
import { mockFantasyLeaderboard } from '../data/mockFantasy';
import { FantasyLeaderboardEntry } from '../types';

interface FantasyLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameWeekName: string;
}

type LeaderboardTab = 'my_rank' | 'top_10' | 'friends';

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy size={20} className="text-yellow-500" />;
  if (rank === 2) return <Medal size={20} className="text-gray-400" />;
  if (rank === 3) return <Award size={20} className="text-orange-400" />;
  return <span className="font-bold text-gray-500 w-5 text-center">{rank}</span>;
};

const LeaderboardRow: React.FC<{ entry: FantasyLeaderboardEntry, isUser: boolean }> = ({ entry, isUser }) => (
  <div className={`flex items-center p-3 rounded-xl ${isUser ? 'bg-purple-50 border-2 border-purple-200' : 'bg-gray-50'}`}>
    <div className="w-8 flex justify-center">{getRankIcon(entry.rank)}</div>
    <img src={entry.avatar} className="w-10 h-10 rounded-full mx-2" alt={entry.username} />
    <p className="flex-1 font-semibold text-gray-800">{entry.username}</p>
    <p className="font-bold text-purple-700">{entry.totalPoints} pts</p>
  </div>
);

export const FantasyLeaderboardModal: React.FC<FantasyLeaderboardModalProps> = ({ isOpen, onClose, gameWeekName }) => {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('my_rank');

  if (!isOpen) return null;

  const userEntry = mockFantasyLeaderboard.find(e => e.username === 'saadjennane');
  const top10 = mockFantasyLeaderboard.slice(0, 10);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full h-[85vh] flex flex-col p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Leaderboard</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <X size={24} />
          </button>
        </div>
        <p className="text-center text-sm text-gray-500 -mt-2 mb-4">{gameWeekName}</p>

        <div className="flex bg-gray-200 rounded-xl p-1 mb-4">
          <button onClick={() => setActiveTab('my_rank')} className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold text-xs transition-all ${activeTab === 'my_rank' ? 'bg-white shadow text-purple-700' : 'text-gray-600'}`}>
            <User size={14} /> My Rank
          </button>
          <button onClick={() => setActiveTab('top_10')} className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold text-xs transition-all ${activeTab === 'top_10' ? 'bg-white shadow text-purple-700' : 'text-gray-600'}`}>
            <Users size={14} /> Top 10
          </button>
          <button onClick={() => setActiveTab('friends')} className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold text-xs transition-all ${activeTab === 'friends' ? 'bg-white shadow text-purple-700' : 'text-gray-600'}`}>
            <Shield size={14} /> Friends
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {activeTab === 'my_rank' && userEntry && (
            <div className="space-y-2">
                <p className="text-xs text-center font-semibold text-gray-500 uppercase">Your Position</p>
                <LeaderboardRow entry={userEntry} isUser={true} />
            </div>
          )}
          {activeTab === 'top_10' && (
            top10.map(entry => <LeaderboardRow key={entry.rank} entry={entry} isUser={entry.username === 'saadjennane'} />)
          )}
          {activeTab === 'friends' && (
             <div className="text-center py-10 text-gray-500">
                <p>Friend leaderboards coming soon!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
