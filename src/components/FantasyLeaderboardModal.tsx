import React, { useState, useMemo } from 'react';
import { X, Trophy, Medal, Award, User, Users, Shield } from 'lucide-react';
import { mockFantasyLeaderboard } from '../data/mockFantasy.tsx';
import { FantasyLeaderboardEntry, Profile } from '../types';

interface FantasyLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameWeekName: string;
  leagueContext?: { leagueId: string; leagueName: string; members: Profile[] };
}

type LeaderboardTab = 'global' | 'league' | 'friends';

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy size={20} className="text-yellow-500" />;
  if (rank === 2) return <Medal size={20} className="text-gray-400" />;
  if (rank === 3) return <Award size={20} className="text-orange-400" />;
  return <span className="font-bold text-text-secondary w-5 text-center">{rank}</span>;
};

const LeaderboardRow: React.FC<{ entry: FantasyLeaderboardEntry, isUser: boolean }> = ({ entry, isUser }) => (
  <div className={`flex items-center p-3 rounded-xl ${isUser ? 'bg-electric-blue/10 border-2 border-electric-blue/50' : 'bg-deep-navy'}`}>
    <div className="w-8 flex justify-center">{getRankIcon(entry.rank)}</div>
    <img src={entry.avatar} className="w-10 h-10 rounded-full mx-2" alt={entry.username} />
    <p className="flex-1 font-semibold text-text-primary">{entry.username}</p>
    <p className="font-bold text-warm-yellow">{entry.totalPoints} pts</p>
  </div>
);

export const FantasyLeaderboardModal: React.FC<FantasyLeaderboardModalProps> = ({ isOpen, onClose, gameWeekName, leagueContext }) => {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>(leagueContext ? 'league' : 'global');

  if (!isOpen) return null;

  const userEntry = mockFantasyLeaderboard.find(e => e.username === 'saadjennane');
  
  const displayedLeaderboard = useMemo(() => {
    if (activeTab === 'league' && leagueContext) {
      const leagueUsernames = new Set(leagueContext.members.map(m => m.username));
      leagueUsernames.add('saadjennane'); // Add current user
      return mockFantasyLeaderboard.filter(entry => leagueUsernames.has(entry.username));
    }
    // For this mock, we'll just return top 10 for global
    return mockFantasyLeaderboard.slice(0, 10);
  }, [activeTab, leagueContext]);

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="modal-base w-full max-w-sm h-[85vh] flex flex-col p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-text-primary">Leaderboard</h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
            <X size={24} />
          </button>
        </div>
        <p className="text-center text-sm text-text-secondary -mt-2 mb-4">{gameWeekName}</p>

        <div className="flex bg-deep-navy rounded-xl p-1 mb-4">
          <button onClick={() => setActiveTab('global')} className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold text-xs transition-all ${activeTab === 'global' ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}>
            <Users size={14} /> Global
          </button>
          {leagueContext && (
            <button onClick={() => setActiveTab('league')} className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold text-xs transition-all ${activeTab === 'league' ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}>
              <Shield size={14} /> {leagueContext.leagueName}
            </button>
          )}
          <button onClick={() => {}} disabled className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold text-xs transition-all disabled:opacity-50`}>
            <User size={14} /> Friends
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {userEntry && (activeTab !== 'league') && (
            <div className="space-y-2 mb-4">
                <p className="text-xs text-center font-semibold text-text-disabled uppercase">Your Position</p>
                <LeaderboardRow entry={userEntry} isUser={true} />
                <hr className="border-dashed border-disabled my-2" />
            </div>
          )}
          {displayedLeaderboard.map(entry => <LeaderboardRow key={entry.rank} entry={entry} isUser={entry.username === 'saadjennane'} />)}
        </div>
      </div>
    </div>
  );
};
