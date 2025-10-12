import React, { useMemo, useState } from 'react';
import { SwipeMatchDay, UserSwipeEntry, SwipeLeaderboardEntry, Profile, UserLeague, LeagueMember, LeagueGame } from '../types';
import { ArrowLeft, Trophy, Medal, Award } from 'lucide-react';
import { LeaderboardLeagueSwitcher } from '../components/leagues/LeaderboardLeagueSwitcher';

interface SwipeLeaderboardPageProps {
  matchDay: SwipeMatchDay;
  userEntry?: UserSwipeEntry;
  onBack: () => void;
  initialLeagueContext?: { leagueId: string; leagueName: string; fromLeague?: boolean };
  allUsers: Profile[];
  userLeagues: UserLeague[];
  leagueMembers: LeagueMember[];
  leagueGames: LeagueGame[];
  currentUserId: string;
}

const calculateSwipePoints = (entry: UserSwipeEntry, matchDay: SwipeMatchDay): number => {
  let totalPoints = 0;
  entry.predictions.forEach(prediction => {
    const match = matchDay.matches.find(m => m.id === prediction.matchId);
    if (match && match.result && match.result === prediction.prediction) {
      totalPoints += match.odds[prediction.prediction] * 100;
    }
  });
  return Math.round(totalPoints);
};

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy size={20} className="text-yellow-500" />;
  if (rank === 2) return <Medal size={20} className="text-gray-400" />;
  if (rank === 3) return <Award size={20} className="text-orange-400" />;
  return <span className="font-bold text-text-secondary w-5 text-center">{rank}</span>;
};

const SwipeLeaderboardPage: React.FC<SwipeLeaderboardPageProps> = (props) => {
  const { matchDay, userEntry, onBack, initialLeagueContext, allUsers, userLeagues, leagueMembers, leagueGames, currentUserId } = props;
  const [activeFilterLeagueId, setActiveFilterLeagueId] = useState<string | null>(initialLeagueContext?.leagueId || null);

  const fullLeaderboard = useMemo(() => {
    const otherUsers = allUsers.filter(u => u.id !== currentUserId);
    
    const allEntries: Omit<SwipeLeaderboardEntry, 'rank'>[] = [];

    if (userEntry) {
      const userPoints = calculateSwipePoints(userEntry, matchDay);
      allEntries.push({ username: 'You', points: userPoints, userId: currentUserId });
    }

    otherUsers.forEach(user => {
      allEntries.push({
        username: user.username || 'Player',
        points: Math.floor(Math.random() * 500),
        userId: user.id
      });
    });

    return allEntries
      .sort((a, b) => b.points - a.points)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [userEntry, matchDay, allUsers, currentUserId]);
  
  const displayedLeaderboard = useMemo(() => {
    if (activeFilterLeagueId) {
      const memberIds = new Set(leagueMembers.filter(m => m.league_id === activeFilterLeagueId).map(m => m.user_id));
      return fullLeaderboard.filter(entry => memberIds.has(entry.userId!));
    }
    return fullLeaderboard;
  }, [activeFilterLeagueId, leagueMembers, fullLeaderboard]);

  return (
    <div className="animate-scale-in space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-text-secondary font-semibold hover:text-electric-blue">
        <ArrowLeft size={20} /> Back
      </button>

      <LeaderboardLeagueSwitcher
        gameId={matchDay.id}
        userLeagues={userLeagues}
        leagueGames={leagueGames}
        leagueMembers={leagueMembers}
        activeLeagueId={activeFilterLeagueId}
        onSelectLeague={setActiveFilterLeagueId}
      />
      
      <div className="card-base p-5 space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-electric-blue">{matchDay.name}</h2>
          <p className="text-sm font-semibold text-text-secondary">Final Leaderboard</p>
        </div>
        <div className="space-y-2">
          {displayedLeaderboard.map(entry => (
            <div key={entry.rank} className={`flex items-center p-3 rounded-xl ${entry.username === 'You' ? 'bg-electric-blue/10 border-2 border-electric-blue/50' : 'bg-deep-navy'}`}>
              <div className="w-8 flex justify-center">{getRankIcon(entry.rank)}</div>
              <div className="flex-1 font-semibold text-text-primary">{entry.username}</div>
              <div className="text-right">
                <p className="font-bold text-warm-yellow">{entry.points.toLocaleString()} pts</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SwipeLeaderboardPage;
