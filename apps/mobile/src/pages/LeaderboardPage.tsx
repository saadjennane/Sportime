import React, { useMemo, useState } from 'react';
import { Challenge, ChallengeMatch, UserChallengeEntry, LeaderboardEntry, Profile, UserLeague, LeagueMember, LeagueGame, DailyChallengeEntry, LeaderboardPeriod } from '../types';
import { Leaderboard } from '../components/Leaderboard';
import { ArrowLeft, Info, Trophy } from 'lucide-react';
import { LeaderboardLeagueSwitcher } from '../components/leagues/LeaderboardLeagueSwitcher';
import { useMockStore } from '../store/useMockStore';
import { LeaderboardPeriodFilter } from '../components/leagues/LeaderboardPeriodFilter';
import { format, parseISO, addDays } from 'date-fns';
import { CelebrationModal } from '../components/leagues/CelebrationModal';
import { useChallengeLeaderboard } from '../features/challenges/useChallengeLeaderboard';

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

const LeaderboardPage: React.FC<LeaderboardPageProps> = (props) => {
  const { challenge, matches, onBack, initialLeagueContext, userLeagues, leagueMembers, leagueGames, currentUserId } = props;

  // Authoritative leaderboard from the server (settle-computed points/ranks).
  const { rows: serverRows } = useChallengeLeaderboard(challenge.id);
  
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

  const fullLeaderboard = useMemo(() => {
    return serverRows.map(r => ({
      username: r.userId === currentUserId ? 'You' : r.username,
      points: r.points,
      finalCoins: challenge.challengeBalance + r.points,
      rank: r.rank,
      userId: r.userId,
      isSubscriber: r.isSubscriber,
    }));
  }, [serverRows, currentUserId, challenge.challengeBalance]);

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
    if (!challenge.startDate) return [];
    try {
      const uniqueDays = [...new Set(matches.map(m => m.day))];
      return uniqueDays.map(day => ({
        startDate: addDays(parseISO(challenge.startDate), day - 1).toISOString()
      }));
    } catch (e) {
      console.error('[LeaderboardPage] challengeEvents date error:', e);
      return [];
    }
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
      
      {!isCurrentUserAdmin && activePeriod.start_date && activePeriod.end_date && (
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
