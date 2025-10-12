import React, { useMemo, useState } from 'react';
import { Challenge, ChallengeMatch, UserChallengeEntry, LeaderboardEntry, Profile, UserLeague, LeagueMember, LeagueGame, DailyChallengeEntry } from '../types';
import { Leaderboard } from '../components/Leaderboard';
import { ArrowLeft } from 'lucide-react';
import { LeaderboardLeagueSwitcher } from '../components/leagues/LeaderboardLeagueSwitcher';

interface LeaderboardPageProps {
  challenge: Challenge;
  matches: ChallengeMatch[];
  userEntry?: UserChallengeEntry;
  onBack: () => void;
  initialLeagueContext?: { leagueId: string; leagueName: string; fromLeague?: boolean };
  allUsers: Profile[];
  userLeagues: UserLeague[];
  leagueMembers: LeagueMember[];
  leagueGames: LeagueGame[];
  currentUserId: string;
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

const LeaderboardPage: React.FC<LeaderboardPageProps> = (props) => {
  const { challenge, matches, userEntry, onBack, initialLeagueContext, allUsers, userLeagues, leagueMembers, leagueGames, currentUserId } = props;
  
  const [activeFilterLeagueId, setActiveFilterLeagueId] = useState<string | null>(initialLeagueContext?.leagueId || null);

  const fullLeaderboard = useMemo(() => {
    const otherUsers = allUsers.filter(u => u.id !== currentUserId);
    const allEntries: Omit<LeaderboardEntry, 'rank'>[] = [];

    if (userEntry) {
      const userPoints = calculateChallengePoints(userEntry, matches);
      const userFinalCoins = challenge.challengeBalance + userPoints;
      allEntries.push({ username: 'You', finalCoins: userFinalCoins, points: userPoints, userId: currentUserId });
    }

    otherUsers.forEach(user => {
        const mockDailyEntries: DailyChallengeEntry[] = challenge.status === 'Finished'
            ? matches.map(m => ({ day: m.day, bets: [{ challengeMatchId: m.id, prediction: 'teamA', amount: 100 }] }))
            : [];
        
        const mockEntry: UserChallengeEntry = {
            challengeId: challenge.id,
            dailyEntries: mockDailyEntries.filter((value, index, self) => self.findIndex(t => t.day === value.day) === index)
        };

        const points = calculateChallengePoints(mockEntry, matches) + Math.floor(Math.random() * 500 - 250);
        const finalCoins = challenge.challengeBalance + points;
        allEntries.push({ username: user.username || 'Player', finalCoins, points, userId: user.id });
    });

    return allEntries
      .sort((a, b) => b.points - a.points)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [userEntry, matches, challenge, allUsers, currentUserId]);

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
        gameId={challenge.id}
        userLeagues={userLeagues}
        leagueGames={leagueGames}
        leagueMembers={leagueMembers}
        activeLeagueId={activeFilterLeagueId}
        onSelectLeague={setActiveFilterLeagueId}
      />

      <Leaderboard challenge={challenge} leaderboard={displayedLeaderboard} />
    </div>
  );
};

export default LeaderboardPage;
