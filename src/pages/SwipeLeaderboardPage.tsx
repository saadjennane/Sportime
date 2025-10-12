import React, { useMemo, useState } from 'react';
import { SwipeMatchDay, UserSwipeEntry, SwipeLeaderboardEntry, Profile } from '../types';
import { ArrowLeft, Trophy, Medal, Award } from 'lucide-react';

interface SwipeLeaderboardPageProps {
  matchDay: SwipeMatchDay;
  userEntry: UserSwipeEntry;
  onBack: () => void;
  leagueContext?: { leagueId: string; leagueName: string; members: Profile[] };
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

const SwipeLeaderboardPage: React.FC<SwipeLeaderboardPageProps> = ({ matchDay, userEntry, onBack, leagueContext }) => {
  const [activeTab, setActiveTab] = useState<'global' | 'league'>(leagueContext ? 'league' : 'global');

  const fullLeaderboard = useMemo(() => {
    const otherPlayers = Array.from({ length: 50 }, (_, i) => ({
      username: `Player_${i + 2}`,
      entry: {
        ...userEntry,
        predictions: matchDay.matches.map(m => ({
          matchId: m.id,
          prediction: ['teamA', 'draw', 'teamB'][Math.floor(Math.random() * 3)] as 'teamA'|'draw'|'teamB',
        }))
      }
    }));

    const userPoints = calculateSwipePoints(userEntry, matchDay);

    const allEntries: Omit<SwipeLeaderboardEntry, 'rank'>[] = [
      { username: 'You', points: userPoints },
      ...otherPlayers.map(player => ({
        username: player.username,
        points: calculateSwipePoints(player.entry, matchDay),
      }))
    ];

    return allEntries
      .sort((a, b) => b.points - a.points)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [userEntry, matchDay]);
  
  const displayedLeaderboard = useMemo(() => {
    if (activeTab === 'league' && leagueContext) {
      const leagueUsernames = new Set(leagueContext.members.map(m => m.username));
      leagueUsernames.add('You');
      // This is a simulation. In a real app, you'd fetch the correct leaderboard entries.
      return fullLeaderboard.filter(entry => leagueUsernames.has(entry.username) || entry.rank <= 5).slice(0, leagueContext.members.length);
    }
    return fullLeaderboard;
  }, [activeTab, leagueContext, fullLeaderboard]);

  return (
    <div className="animate-scale-in space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-text-secondary font-semibold hover:text-electric-blue">
        <ArrowLeft size={20} /> Back to Game
      </button>

      {leagueContext && (
        <div className="flex bg-navy-accent rounded-xl p-1">
          <button
            onClick={() => setActiveTab('global')}
            className={`flex-1 p-2 rounded-lg font-semibold transition-all ${activeTab === 'global' ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}
          >
            Global
          </button>
          <button
            onClick={() => setActiveTab('league')}
            className={`flex-1 p-2 rounded-lg font-semibold transition-all ${activeTab === 'league' ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}
          >
            {leagueContext.leagueName}
          </button>
        </div>
      )}
      
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
