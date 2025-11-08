import React, { useMemo, useState } from 'react';
import {
  Profile,
  UserLeague,
  LeagueMember,
  LeagueGame,
  LeaderboardPeriod,
} from '../types';
import { ArrowLeft, Trophy, Medal, Award, Info, Loader2 } from 'lucide-react';
import { LeaderboardLeagueSwitcher } from '../components/leagues/LeaderboardLeagueSwitcher';
import { useMockStore } from '../store/useMockStore';
import { LeaderboardPeriodFilter } from '../components/leagues/LeaderboardPeriodFilter';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { CelebrationModal } from '../components/leagues/CelebrationModal';
import { useSwipeGame } from '../features/swipe/useSwipeGame';
import { useSwipeLeaderboard } from '../features/swipe/useSwipeLeaderboard';

interface SwipeLeaderboardPageProps {
  challengeId: string;
  userId: string | null;
  onBack: () => void;
  initialLeagueContext?: { leagueId: string; leagueName: string; fromLeague?: boolean };
  allUsers: Profile[];
  userLeagues: UserLeague[];
  leagueMembers: LeagueMember[];
  leagueGames: LeagueGame[];
  currentUserId: string;
}

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy size={20} className="text-yellow-500" />;
  if (rank === 2) return <Medal size={20} className="text-gray-400" />;
  if (rank === 3) return <Award size={20} className="text-orange-400" />;
  return <span className="font-bold text-text-secondary w-5 text-center">{rank}</span>;
};

const SwipeLeaderboardPage: React.FC<SwipeLeaderboardPageProps> = (props) => {
  const {
    challengeId,
    userId,
    onBack,
    initialLeagueContext,
    userLeagues,
    leagueMembers,
    leagueGames,
    currentUserId,
  } = props;

  const { updateLeagueGameLeaderboardPeriod, celebrateWinners } = useMockStore();
  const [loading, setLoading] = useState(false);
  const [activeFilterLeagueId, setActiveFilterLeagueId] = useState<string | null>(
    initialLeagueContext?.leagueId || null
  );
  const [isCelebrationModalOpen, setIsCelebrationModalOpen] = useState(false);

  // Load game data
  const { challenge, isLoading: isLoadingGame } = useSwipeGame(challengeId, userId);

  // Load leaderboard
  const {
    leaderboard,
    userStats,
    userPosition,
    isLoading: isLoadingLeaderboard,
  } = useSwipeLeaderboard(challengeId, userId);

  const { leagueGame, currentLeague, isCurrentUserAdmin } = useMemo(() => {
    if (!activeFilterLeagueId || !challenge)
      return { leagueGame: null, currentLeague: null, isCurrentUserAdmin: false };
    const lg =
      leagueGames.find(
        lg => lg.league_id === activeFilterLeagueId && lg.game_id === challengeId
      ) || null;
    const cl = userLeagues.find(ul => ul.id === activeFilterLeagueId) || null;
    const membership = leagueMembers.find(
      m => m.league_id === activeFilterLeagueId && m.user_id === currentUserId
    );
    const isAdmin = membership?.role === 'admin';
    return { leagueGame: lg, currentLeague: cl, isCurrentUserAdmin: isAdmin };
  }, [activeFilterLeagueId, leagueGames, challengeId, userLeagues, leagueMembers, currentUserId, challenge]);

  const activePeriod: LeaderboardPeriod = useMemo(() => {
    if (!challenge) return { start_type: 'season_start', end_type: 'season_end', start_date: '', end_date: '' };

    if (leagueGame?.leaderboard_period) return leagueGame.leaderboard_period;
    if (currentLeague) {
      return {
        start_type: 'season_start',
        end_type: 'season_end',
        start_date: currentLeague.season_start_date || challenge.start_date,
        end_date: currentLeague.season_end_date || challenge.end_date,
      };
    }
    return {
      start_type: 'season_start',
      end_type: 'season_end',
      start_date: challenge.start_date,
      end_date: challenge.end_date,
    };
  }, [leagueGame, currentLeague, challenge]);

  const isGameInPeriod = useMemo(() => {
    if (!challenge || !activePeriod.start_date || !activePeriod.end_date) return true;
    const interval = {
      start: parseISO(activePeriod.start_date),
      end: parseISO(activePeriod.end_date),
    };
    return isWithinInterval(parseISO(challenge.start_date), interval);
  }, [activePeriod, challenge]);

  const displayedLeaderboard = useMemo(() => {
    if (activeFilterLeagueId) {
      const memberIds = new Set(
        leagueMembers.filter(m => m.league_id === activeFilterLeagueId).map(m => m.user_id)
      );
      return leaderboard.filter(entry => entry.userId && memberIds.has(entry.userId));
    }
    return leaderboard;
  }, [activeFilterLeagueId, leagueMembers, leaderboard]);

  const handleApplyFilter = (period: LeaderboardPeriod) => {
    if (leagueGame) {
      setLoading(true);
      updateLeagueGameLeaderboardPeriod(leagueGame.id, period);
      setTimeout(() => setLoading(false), 300);
    }
  };

  const handleConfirmCelebration = (message: string) => {
    if (!activeFilterLeagueId || !challenge) return;
    setLoading(true);
    const result = celebrateWinners(
      activeFilterLeagueId,
      challenge as any,
      displayedLeaderboard,
      activePeriod,
      message,
      currentUserId
    );
    if (result.success) {
      // Success
    } else {
      console.error(result.error);
    }
    setLoading(false);
    setIsCelebrationModalOpen(false);
  };

  if (isLoadingGame || isLoadingLeaderboard) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-electric-blue" size={48} />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="space-y-4 text-center p-8">
        <p className="font-semibold text-text-secondary">Game not found.</p>
        <button onClick={onBack} className="text-electric-blue font-semibold hover:underline">
          Return to Games
        </button>
      </div>
    );
  }

  return (
    <div className="animate-scale-in space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-text-secondary font-semibold hover:text-electric-blue"
      >
        <ArrowLeft size={20} /> Back
      </button>

      <LeaderboardLeagueSwitcher
        gameId={challengeId}
        userLeagues={userLeagues}
        leagueGames={leagueGames}
        leagueMembers={leagueMembers}
        activeLeagueId={activeFilterLeagueId}
        onSelectLeague={setActiveFilterLeagueId}
      />

      {!isCurrentUserAdmin && activePeriod.start_date && activePeriod.end_date && (
        <div className="text-xs text-center text-text-disabled bg-deep-navy/50 p-2 rounded-lg flex items-center justify-center gap-2">
          <Info size={14} />
          Showing results from {format(parseISO(activePeriod.start_date), 'MMM d')} to{' '}
          {format(parseISO(activePeriod.end_date), 'MMM d')}
        </div>
      )}

      {isCurrentUserAdmin && currentLeague && leagueGame && (
        <LeaderboardPeriodFilter
          league={currentLeague}
          leagueGame={leagueGame}
          members={leagueMembers.filter(m => m.league_id === currentLeague.id)}
          events={[challenge as any]}
          onApply={handleApplyFilter}
          loading={loading}
        />
      )}

      <div className="card-base p-5 space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-electric-blue">{challenge.name}</h2>
          <p className="text-sm font-semibold text-text-secondary">
            {challenge.status === 'finished' ? 'Final Leaderboard' : 'Current Standings'}
          </p>
          {userStats && (
            <div className="mt-2 text-sm text-text-secondary">
              <p>
                Your Position: <span className="font-bold text-electric-blue">#{userPosition || '-'}</span>
              </p>
              <p>
                Your Points: <span className="font-bold text-warm-yellow">{userStats.totalPoints}</span>
              </p>
              <p className="text-xs">
                {userStats.correctPredictions}/{userStats.totalPredictions} correct (
                {userStats.accuracy.toFixed(1)}%)
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {displayedLeaderboard.length === 0 ? (
            <div className="text-center py-8 text-text-disabled">
              <p>No participants yet</p>
            </div>
          ) : (
            displayedLeaderboard.map(entry => {
              const isCurrentUser = entry.userId === currentUserId;
              return (
                <div
                  key={entry.rank}
                  className={`flex items-center p-3 rounded-xl ${
                    isCurrentUser
                      ? 'bg-electric-blue/10 border-2 border-electric-blue/50'
                      : 'bg-deep-navy'
                  }`}
                >
                  <div className="w-8 flex justify-center">{getRankIcon(entry.rank)}</div>
                  <div className="flex-1 font-semibold text-text-primary">
                    {isCurrentUser ? 'You' : entry.username}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-warm-yellow">{entry.points.toLocaleString()} pts</p>
                    {entry.correct_picks > 0 && (
                      <p className="text-xs text-text-disabled">{entry.correct_picks} correct</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {isCurrentUserAdmin && activeFilterLeagueId && (
        <div className="pt-4">
          <button
            onClick={() => setIsCelebrationModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-warm-yellow/20 text-warm-yellow rounded-xl font-semibold hover:bg-warm-yellow/30 transition-colors"
          >
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
