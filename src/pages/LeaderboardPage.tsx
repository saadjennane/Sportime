import React, { useMemo } from 'react';
import { Challenge, ChallengeMatch, UserChallengeEntry, LeaderboardEntry, ChallengeBet, DailyChallengeEntry } from '../types';
import { Leaderboard } from '../components/Leaderboard';
import { ArrowLeft } from 'lucide-react';

interface LeaderboardPageProps {
  challenge: Challenge;
  matches: ChallengeMatch[];
  userEntry: UserChallengeEntry;
  onBack: () => void;
}

const calculateChallengePoints = (entry: UserChallengeEntry, matches: ChallengeMatch[]): number => {
  let totalPoints = 0;

  entry.dailyEntries.forEach(dailyEntry => {
    const booster = dailyEntry.booster;

    dailyEntry.bets.forEach(bet => {
      const match = matches.find(m => m.id === bet.challengeMatchId);
      if (!match || match.status !== 'played' || !match.result) {
        return;
      }

      const isWin = match.result === bet.prediction;
      const isBoosted = booster?.matchId === bet.challengeMatchId;

      if (isWin) {
        let profit = (bet.amount * match.odds[bet.prediction]) - bet.amount;
        if (isBoosted) {
          if (booster?.type === 'x2') {
            profit *= 2;
          } else if (booster?.type === 'x3') {
            profit *= 3;
          }
        }
        totalPoints += profit;
      } else {
        if (isBoosted && booster?.type === 'x3') {
          totalPoints -= 200;
        }
      }
    });
  });

  return Math.round(totalPoints);
};

const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ challenge, matches, userEntry, onBack }) => {
  const leaderboard = useMemo(() => {
    const mockDailyEntries: DailyChallengeEntry[] = [
      { day: 1, bets: [{ challengeMatchId: 'cm-new-1', prediction: 'draw', amount: 1000 }], booster: { type: 'x2', matchId: 'cm-new-1' } },
      { day: 2, bets: [{ challengeMatchId: 'cm-new-3', prediction: 'teamA', amount: 1000 }] }
    ];
    const mockEntry: UserChallengeEntry = { challengeId: challenge.id, dailyEntries: mockDailyEntries };

    const otherPlayers = [
      { username: 'TopPlayer', entry: mockEntry },
      { username: 'SmartBettor', entry: { ...mockEntry, dailyEntries: [{ day: 1, bets: [{ challengeMatchId: 'cm-new-2', prediction: 'teamA', amount: 1000 }] }, { day: 2, bets: [] }] } },
      { username: 'Player1', entry: { ...mockEntry, dailyEntries: [{ day: 1, bets: [{ challengeMatchId: 'cm-new-1', prediction: 'teamB', amount: 1000 }] }, { day: 2, bets: [] }] } },
    ];

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

    const sortedLeaderboard = allEntries
      .sort((a, b) => b.points - a.points)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
    
    return sortedLeaderboard;
  }, [userEntry, matches, challenge]);

  return (
    <div className="animate-scale-in space-y-4">
       <button onClick={onBack} className="flex items-center gap-2 text-gray-600 font-semibold hover:text-purple-600">
        <ArrowLeft size={20} /> Back to Challenge
      </button>
      <Leaderboard challenge={challenge} leaderboard={leaderboard} />
    </div>
  );
};

export default LeaderboardPage;
