import React, { useMemo, useState } from 'react';
import { Challenge, ChallengeMatch, UserChallengeEntry, LeaderboardEntry, LeagueMember, Profile } from '../types';
import { Leaderboard } from '../components/Leaderboard';
import { ArrowLeft } from 'lucide-react';

interface LeaderboardPageProps {
  challenge: Challenge;
  matches: ChallengeMatch[];
  userEntry: UserChallengeEntry;
  onBack: () => void;
  leagueContext?: { leagueId: string; leagueName: string; members: Profile[] };
}

const calculateChallengePoints = (entry: UserChallengeEntry, matches: ChallengeMatch[]): number => {
  let totalPoints = 0;
  entry.dailyEntries.forEach(dailyEntry => {
    const booster = dailyEntry.booster;
    dailyEntry.bets.forEach(bet => {
      const match = matches.find(m => m.id === bet.challengeMatchId);
      if (!match || match.status !== 'played' || !match.result) return;
      const isWin = match.result === bet.prediction;
      const isBoosted = booster?.matchId === bet.challengeMatchId;
      if (isWin) {
        let profit = (bet.amount * match.odds[bet.prediction]) - bet.amount;
        if (isBoosted) {
          if (booster?.type === 'x2') profit *= 2;
          else if (booster?.type === 'x3') profit *= 3;
        }
        totalPoints += profit;
      } else if (isBoosted && booster?.type === 'x3') {
        totalPoints -= 200;
      }
    });
  });
  return Math.round(totalPoints);
};

const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ challenge, matches, userEntry, onBack, leagueContext }) => {
  const [activeTab, setActiveTab] = useState<'global' | 'league'>(leagueContext ? 'league' : 'global');

  const fullLeaderboard = useMemo(() => {
    const otherPlayers = Array.from({ length: 50 }, (_, i) => ({
      username: `Player_${i + 2}`,
      entry: {
        ...userEntry,
        dailyEntries: userEntry.dailyEntries.map(de => ({
          ...de,
          bets: de.bets.map(b => ({ ...b, prediction: ['teamA', 'draw', 'teamB'][Math.floor(Math.random() * 3)] as 'teamA'|'draw'|'teamB' }))
        }))
      }
    }));

    const userPoints = calculateChallengePoints(userEntry, matches);
    const userFinalCoins = challenge.challengeBalance + userPoints;

    const allEntries: Omit<LeaderboardEntry, 'rank'>[] = [
      { username: 'You', finalCoins: userFinalCoins, points: userPoints },
      ...otherPlayers.map(player => {
        const points = calculateChallengePoints(player.entry, matches);
        const finalCoins = challenge.challengeBalance + points;
        return { username: player.username, finalCoins, points };
      })
    ];

    return allEntries
      .sort((a, b) => b.points - a.points)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [userEntry, matches, challenge]);

  const displayedLeaderboard = useMemo(() => {
    if (activeTab === 'league' && leagueContext) {
      const leagueUsernames = new Set(leagueContext.members.map(m => m.username));
      leagueUsernames.add('You'); // Make sure the current user is included
      return fullLeaderboard.filter(entry => leagueUsernames.has(entry.username));
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

      <Leaderboard challenge={challenge} leaderboard={displayedLeaderboard} />
    </div>
  );
};

export default LeaderboardPage;
