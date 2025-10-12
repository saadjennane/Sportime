import React, { useState, useMemo } from 'react';
import { X, Trophy, Medal, Award } from 'lucide-react';
import { FantasyLeaderboardEntry, Profile, UserLeague, LeagueMember, LeagueGame } from '../types';
import { LeaderboardLeagueSwitcher } from './leagues/LeaderboardLeagueSwitcher';

interface FantasyLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameWeekName: string;
  initialLeagueContext?: { leagueId: string; leagueName: string; members: Profile[] };
  allUsers: Profile[];
  userLeagues: UserLeague[];
  leagueMembers: LeagueMember[];
  leagueGames: LeagueGame[];
  currentUserId: string;
  gameId: string;
}

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

export const FantasyLeaderboardModal: React.FC<FantasyLeaderboardModalProps> = (props) => {
  const { isOpen, onClose, gameWeekName, initialLeagueContext, allUsers, userLeagues, leagueMembers, leagueGames, currentUserId, gameId } = props;
  const [activeFilterLeagueId, setActiveFilterLeagueId] = useState<string | null>(initialLeagueContext?.leagueId || null);

  const fullLeaderboard = useMemo(() => {
    return allUsers.map((user, index) => ({
      rank: index + 1,
      username: user.id === currentUserId ? 'You' : user.username || `Player ${user.id}`,
      userId: user.id,
      avatar: user.profile_picture_url || `https://api.dicebear.com/8.x/bottts/svg?seed=${user.id}`,
      totalPoints: 1250 - (index * 20) + Math.floor(Math.random() * 20),
      boosterUsed: null,
    })).sort((a, b) => b.totalPoints - a.totalPoints)
     .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [allUsers, currentUserId]);

  const displayedLeaderboard = useMemo(() => {
    if (activeFilterLeagueId) {
      const memberIds = new Set(leagueMembers.filter(m => m.league_id === activeFilterLeagueId).map(m => m.user_id));
      return fullLeaderboard.filter(entry => memberIds.has(entry.userId!));
    }
    return fullLeaderboard;
  }, [activeFilterLeagueId, leagueMembers, fullLeaderboard]);

  if (!isOpen) return null;

  const userEntry = displayedLeaderboard.find(e => e.userId === currentUserId);

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

        <LeaderboardLeagueSwitcher
            gameId={gameId}
            userLeagues={userLeagues}
            leagueGames={leagueGames}
            leagueMembers={leagueMembers}
            activeLeagueId={activeFilterLeagueId}
            onSelectLeague={setActiveFilterLeagueId}
        />

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 mt-4">
          {userEntry && (
            <div className="space-y-2 mb-4 sticky top-0 bg-navy-accent py-2">
                <p className="text-xs text-center font-semibold text-text-disabled uppercase">Your Position</p>
                <LeaderboardRow entry={userEntry} isUser={true} />
                <hr className="border-dashed border-disabled my-2" />
            </div>
          )}
          {displayedLeaderboard.filter(e => e.userId !== currentUserId).map(entry => <LeaderboardRow key={entry.rank} entry={entry} isUser={false} />)}
        </div>
      </div>
    </div>
  );
};
