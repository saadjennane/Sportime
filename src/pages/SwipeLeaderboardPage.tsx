import React, { useMemo, useState } from 'react';
import { SwipeMatchDay, UserSwipeEntry, SwipeLeaderboardEntry, Profile, UserLeague, LeagueMember, LeagueGame, LeaderboardPeriod } from '../types';
import { ArrowLeft, Trophy, Medal, Award, Info } from 'lucide-react';
import { LeaderboardLeagueSwitcher } from '../components/leagues/LeaderboardLeagueSwitcher';
import { useMockStore } from '../store/useMockStore';
import { LeaderboardPeriodFilter } from '../components/leagues/LeaderboardPeriodFilter';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { CelebrationModal } from '../components/leagues/CelebrationModal';

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
  
  const { updateLeagueGameLeaderboardPeriod, celebrateWinners } = useMockStore();
  const [loading, setLoading] = useState(false);
  const [activeFilterLeagueId, setActiveFilterLeagueId] = useState<string | null>(initialLeagueContext?.leagueId || null);
  const [isCelebrationModalOpen, setIsCelebrationModalOpen] = useState(false);

  const { leagueGame, currentLeague, isCurrentUserAdmin } = useMemo(() => {
    if (!activeFilterLeagueId) return { leagueGame: null, currentLeague: null, isCurrentUserAdmin: false };
    const lg = leagueGames.find(lg => lg.league_id === activeFilterLeagueId && lg.game_id === matchDay.id) || null;
    const cl = userLeagues.find(ul => ul.id === activeFilterLeagueId) || null;
    const membership = leagueMembers.find(m => m.league_id === activeFilterLeagueId && m.user_id === currentUserId);
    const isAdmin = membership?.role === 'admin';
    return { leagueGame: lg, currentLeague: cl, isCurrentUserAdmin: isAdmin };
  }, [activeFilterLeagueId, leagueGames, matchDay.id, userLeagues, leagueMembers, currentUserId]);

  const activePeriod: LeaderboardPeriod = useMemo(() => {
    if (leagueGame?.leaderboard_period) return leagueGame.leaderboard_period;
    if (currentLeague) {
      return {
        start_type: 'season_start', end_type: 'season_end',
        start_date: currentLeague.season_start_date || matchDay.startDate,
        end_date: currentLeague.season_end_date || matchDay.endDate,
      };
    }
    return {
      start_type: 'season_start', end_type: 'season_end',
      start_date: matchDay.startDate,
      end_date: matchDay.endDate,
    };
  }, [leagueGame, currentLeague, matchDay]);

  const isGameInPeriod = useMemo(() => {
    const interval = { start: parseISO(activePeriod.start_date), end: parseISO(activePeriod.end_date) };
    return isWithinInterval(parseISO(matchDay.startDate), interval);
  }, [activePeriod, matchDay.startDate]);

  const fullLeaderboard = useMemo(() => {
    const otherUsers = allUsers.filter(u => u.id !== currentUserId);
    const allEntries: Omit<SwipeLeaderboardEntry, 'rank'>[] = [];

    if (userEntry) {
      const userPoints = isGameInPeriod ? calculateSwipePoints(userEntry, matchDay) : 0;
      allEntries.push({ username: 'You', points: userPoints, userId: currentUserId });
    }

    otherUsers.forEach(user => {
      const points = isGameInPeriod ? Math.floor(Math.random() * 500) : 0;
      allEntries.push({ username: user.username || 'Player', points, userId: user.id });
    });

    return allEntries
      .sort((a, b) => b.points - a.points)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [userEntry, matchDay, allUsers, currentUserId, isGameInPeriod]);
  
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
    const result = celebrateWinners(activeFilterLeagueId, matchDay, displayedLeaderboard, activePeriod, message, currentUserId);
    if (result.success) {
      // Potentially show a success toast
    } else {
      // Potentially show an error toast
      console.error(result.error);
    }
    setLoading(false);
    setIsCelebrationModalOpen(false);
  };

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
          events={[matchDay]}
          onApply={handleApplyFilter}
          loading={loading}
        />
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

export default SwipeLeaderboardPage;
