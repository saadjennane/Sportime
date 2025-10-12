import React, { useMemo, useState } from 'react';
import { Challenge, ChallengeMatch, UserChallengeEntry, LeaderboardEntry, Profile, UserLeague, LeagueMember, LeagueGame, DailyChallengeEntry, LeaderboardPeriod } from '../types';
import { Leaderboard } from '../components/Leaderboard';
import { ArrowLeft, Info, Trophy } from 'lucide-react';
import { LeaderboardLeagueSwitcher } from '../components/leagues/LeaderboardLeagueSwitcher';
import { useMockStore } from '../store/useMockStore';
import { LeaderboardPeriodFilter } from '../components/leagues/LeaderboardPeriodFilter';
import { format, parseISO, isWithinInterval, addDays } from 'date-fns';
import { CelebrationModal } from '../components/leagues/CelebrationModal';

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
  
  const { updateLeagueGameLeaderboardPeriod, celebrateWinners } = useMockStore();
  const [loading, setLoading] = useState(false);
  const [activeFilterLeagueId, setActiveFilterLeagueId] = useState<string | null>(initialLeagueContext?.leagueId || null);
  const [isCelebrationModalOpen, setIsCelebrationModalOpen] = useState(false);

  const { leagueGame, currentLeague, isCurrentUserAdmin } = useMemo(() => {
    if (!activeFilterLeagueId) return { leagueGame: null, currentLeague: null, isCurrentUserAdmin: false };
    const lg = leagueGames.find(lg => lg.league_id === activeFilterLeagueId && lg.game_id === challenge.id) || null;
    const cl = userLeagues.find(ul => ul.id === activeFilterLeagueId) || null;
    const membership = leagueMembers.find(m => m.league_id === activeFilterLeagueId && m.user_id === currentUserId);
    const isAdmin = membership?.role === 'admin';
    return { leagueGame: lg, currentLeague: cl, isCurrentUserAdmin: isAdmin };
  }, [activeFilterLeagueId, leagueGames, challenge.id, userLeagues, leagueMembers, currentUserId]);

  const activePeriod: LeaderboardPeriod = useMemo(() => {
    if (leagueGame?.leaderboard_period) return leagueGame.leaderboard_period;
    if (currentLeague) {
      return {
        start_type: 'season_start', end_type: 'season_end',
        start_date: currentLeague.season_start_date || challenge.startDate,
        end_date: currentLeague.season_end_date || challenge.endDate,
      };
    }
    return {
      start_type: 'season_start', end_type: 'season_end',
      start_date: challenge.startDate,
      end_date: challenge.endDate,
    };
  }, [leagueGame, currentLeague, challenge]);

  const filteredMatches = useMemo(() => {
    const interval = { start: parseISO(activePeriod.start_date), end: parseISO(activePeriod.end_date) };
    return matches.filter(match => {
      const matchDate = addDays(parseISO(challenge.startDate), match.day - 1);
      return isWithinInterval(matchDate, interval);
    });
  }, [matches, activePeriod, challenge.startDate]);

  const fullLeaderboard = useMemo(() => {
    const otherUsers = allUsers.filter(u => u.id !== currentUserId);
    const allEntries: Omit<LeaderboardEntry, 'rank'>[] = [];

    if (userEntry) {
      const userPoints = calculateChallengePoints(userEntry, filteredMatches);
      const userFinalCoins = challenge.challengeBalance + userPoints;
      allEntries.push({ username: 'You', finalCoins: userFinalCoins, points: userPoints, userId: currentUserId });
    }

    otherUsers.forEach(user => {
        const mockDailyEntries: DailyChallengeEntry[] = challenge.status === 'Finished'
            ? filteredMatches.map(m => ({ day: m.day, bets: [{ challengeMatchId: m.id, prediction: 'teamA', amount: 100 }] }))
            : [];
        
        const mockEntry: UserChallengeEntry = {
            challengeId: challenge.id,
            dailyEntries: mockDailyEntries.filter((value, index, self) => self.findIndex(t => t.day === value.day) === index)
        };

        const points = calculateChallengePoints(mockEntry, filteredMatches) + Math.floor(Math.random() * 500 - 250);
        const finalCoins = challenge.challengeBalance + points;
        allEntries.push({ username: user.username || 'Player', finalCoins, points, userId: user.id });
    });

    return allEntries
      .sort((a, b) => b.points - a.points)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [userEntry, filteredMatches, challenge, allUsers, currentUserId]);

  const displayedLeaderboard = useMemo(() => {
    if (activeFilterLeagueId) {
      const memberIds = new Set(leagueMembers.filter(m => m.league_id === activeFilterLeagueId).map(m => m.user_id));
      return fullLeaderboard.filter(entry => memberIds.has(entry.userId!));
    }
    return fullLeaderboard;
  }, [activeFilterLeagueId, leagueMembers, fullLeaderboard]);
  
  const handleApplyFilter = (period: LeaderboardPeriod) => {
    if (leagueGame) {
      setLoading(true);
      updateLeagueGameLeaderboardPeriod(leagueGame.id, period);
      setTimeout(() => setLoading(false), 300);
    }
  };

  const handleConfirmCelebration = (message: string) => {
    if (!activeFilterLeagueId) return;
    setLoading(true);
    const result = celebrateWinners(activeFilterLeagueId, challenge, displayedLeaderboard, activePeriod, message, currentUserId);
    if (result.success) {
      // Potentially show a success toast
    } else {
      // Potentially show an error toast
      console.error(result.error);
    }
    setLoading(false);
    setIsCelebrationModalOpen(false);
  };

  const challengeEvents = useMemo(() => {
    const uniqueDays = [...new Set(matches.map(m => m.day))];
    return uniqueDays.map(day => ({
      startDate: addDays(parseISO(challenge.startDate), day - 1).toISOString()
    }));
  }, [matches, challenge.startDate]);


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
      
      {!isCurrentUserAdmin && (
        <div className="text-xs text-center text-text-disabled bg-deep-navy/50 p-2 rounded-lg flex items-center justify-center gap-2">
          <Info size={14} />
          Showing results from {format(parseISO(activePeriod.start_date), 'MMM d')} to {format(parseISO(activePeriod.end_date), 'MMM d')}
        </div>
      )}

      {isCurrentUserAdmin && currentLeague && leagueGame && (
        <LeaderboardPeriodFilter
          league={currentLeague}
          leagueGame={leagueGame}
          members={leagueMembers.filter(m => m.league_id === currentLeague.id)}
          events={challengeEvents}
          onApply={handleApplyFilter}
          loading={loading}
        />
      )}

      <Leaderboard challenge={challenge} leaderboard={displayedLeaderboard} />

      {isCurrentUserAdmin && activeFilterLeagueId && (
        <div className="pt-4">
          <button onClick={() => setIsCelebrationModalOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 bg-warm-yellow/20 text-warm-yellow rounded-xl font-semibold hover:bg-warm-yellow/30 transition-colors">
            <Trophy size={16} /> Celebrate the Winners
          </button>
        </div>
      )}

      <CelebrationModal
        isOpen={isCelebrationModalOpen}
        onClose={() => setIsCelebrationModalOpen(false)}
        onConfirm={handleConfirmCelebration}
        leaderboard={displayedLeaderboard}
        period={activePeriod}
        loading={loading}
      />
    </div>
  );
};

export default LeaderboardPage;
