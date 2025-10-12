import React, { useState, useMemo } from 'react';
import { X, Trophy, Medal, Award, Info } from 'lucide-react';
import { FantasyLeaderboardEntry, Profile, UserLeague, LeagueMember, LeagueGame, FantasyGame, FantasyGameWeek, LeaderboardPeriod, Game } from '../types';
import { LeaderboardLeagueSwitcher } from './leagues/LeaderboardLeagueSwitcher';
import { useMockStore } from '../store/useMockStore';
import { LeaderboardPeriodFilter } from './leagues/LeaderboardPeriodFilter';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { CelebrationModal } from './leagues/CelebrationModal';

interface FantasyLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: FantasyGame;
  initialLeagueContext?: { leagueId: string; leagueName: string };
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

const LeaderboardRow: React.FC<{ entry: FantasyLeaderboardEntry, isUser: boolean }> = ({ entry, isUser }) => (
  <div className={`flex items-center p-3 rounded-xl ${isUser ? 'bg-electric-blue/10 border-2 border-electric-blue/50' : 'bg-deep-navy'}`}>
    <div className="w-8 flex justify-center">{getRankIcon(entry.rank)}</div>
    <img src={entry.avatar} className="w-10 h-10 rounded-full mx-2" alt={entry.username} />
    <p className="flex-1 font-semibold text-text-primary">{entry.username}</p>
    <p className="font-bold text-warm-yellow">{entry.totalPoints} pts</p>
  </div>
);

export const FantasyLeaderboardModal: React.FC<FantasyLeaderboardModalProps> = (props) => {
  const { isOpen, onClose, game, initialLeagueContext, allUsers, userLeagues, leagueMembers, leagueGames, currentUserId } = props;
  
  const { leaderboardScores, updateLeagueGameLeaderboardPeriod, celebrateWinners } = useMockStore();
  const [loading, setLoading] = useState(false);
  const [isCelebrationModalOpen, setIsCelebrationModalOpen] = useState(false);

  const [activeFilterLeagueId, setActiveFilterLeagueId] = useState<string | null>(initialLeagueContext?.leagueId || null);

  const { leagueGame, currentLeague, isCurrentUserAdmin } = useMemo(() => {
    if (!activeFilterLeagueId) return { leagueGame: null, currentLeague: null, isCurrentUserAdmin: false };
    
    const lg = leagueGames.find(lg => lg.league_id === activeFilterLeagueId && lg.game_id === game.id) || null;
    const cl = userLeagues.find(ul => ul.id === activeFilterLeagueId) || null;
    const membership = leagueMembers.find(m => m.league_id === activeFilterLeagueId && m.user_id === currentUserId);
    const isAdmin = membership?.role === 'admin';

    return { leagueGame: lg, currentLeague: cl, isCurrentUserAdmin: isAdmin };
  }, [activeFilterLeagueId, leagueGames, game.id, userLeagues, leagueMembers, currentUserId]);

  const activePeriod: LeaderboardPeriod = useMemo(() => {
    if (leagueGame?.leaderboard_period) {
      return leagueGame.leaderboard_period;
    }
    if (currentLeague) {
      return {
        start_type: 'season_start',
        end_type: 'season_end',
        start_date: currentLeague.season_start_date || game.startDate,
        end_date: currentLeague.season_end_date || game.endDate,
      };
    }
    return {
      start_type: 'season_start',
      end_type: 'season_end',
      start_date: game.startDate,
      end_date: game.endDate,
    };
  }, [leagueGame, currentLeague, game.startDate, game.endDate]);

  const filteredGameWeeks = useMemo(() => {
    const interval = { start: parseISO(activePeriod.start_date), end: parseISO(activePeriod.end_date) };
    return game.gameWeeks.filter(gw => isWithinInterval(parseISO(gw.startDate), interval));
  }, [game.gameWeeks, activePeriod]);

  const displayedLeaderboard = useMemo(() => {
    const gameScores = leaderboardScores[game.id];
    if (!gameScores) return [];

    const userIdsToScore = activeFilterLeagueId 
      ? new Set(leagueMembers.filter(m => m.league_id === activeFilterLeagueId).map(m => m.user_id))
      : new Set(allUsers.map(u => u.id));

    const leaderboardEntries = Array.from(userIdsToScore).map(userId => {
      const user = allUsers.find(u => u.id === userId);
      if (!user) return null;

      const userGameScores = gameScores[userId] || {};
      const totalPoints = filteredGameWeeks.reduce((sum, gw) => sum + (userGameScores[gw.id] || 0), 0);
      
      return {
        userId: user.id,
        username: user.id === currentUserId ? 'You' : user.username || `Player ${user.id}`,
        avatar: user.profile_picture_url || `https://api.dicebear.com/8.x/bottts/svg?seed=${user.id}`,
        totalPoints,
      };
    }).filter(Boolean) as (Omit<FantasyLeaderboardEntry, 'rank' | 'boosterUsed'> & { totalPoints: number })[];

    return leaderboardEntries
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((entry, index) => ({ ...entry, rank: index + 1, boosterUsed: null }));

  }, [activeFilterLeagueId, leagueMembers, allUsers, currentUserId, leaderboardScores, game.id, filteredGameWeeks]);

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
    const result = celebrateWinners(activeFilterLeagueId, game, displayedLeaderboard, activePeriod, message, currentUserId);
    if (result.success) {
      // Potentially show a success toast
    } else {
      // Potentially show an error toast
      console.error(result.error);
    }
    setLoading(false);
    setIsCelebrationModalOpen(false);
  };

  if (!isOpen) return null;

  const userEntry = displayedLeaderboard.find(e => e.userId === currentUserId);

  return (
    <>
      <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
        <div className="modal-base w-full max-w-md h-[90vh] flex flex-col p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-text-primary">Leaderboard</h2>
            <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
              <X size={24} />
            </button>
          </div>
          <p className="text-center text-sm text-text-secondary -mt-2 mb-4">{game.name}</p>

          <LeaderboardLeagueSwitcher
              gameId={game.id}
              userLeagues={userLeagues}
              leagueGames={leagueGames}
              leagueMembers={leagueMembers}
              activeLeagueId={activeFilterLeagueId}
              onSelectLeague={setActiveFilterLeagueId}
          />

          {!isCurrentUserAdmin && (
            <div className="text-xs text-center text-text-disabled bg-deep-navy/50 p-2 rounded-lg mt-4 flex items-center justify-center gap-2">
              <Info size={14} />
              Showing results from {format(parseISO(activePeriod.start_date), 'MMM d')} to {format(parseISO(activePeriod.end_date), 'MMM d')}
            </div>
          )}

          {isCurrentUserAdmin && currentLeague && leagueGame && (
            <div className="mt-4">
              <LeaderboardPeriodFilter
                league={currentLeague}
                leagueGame={leagueGame}
                members={leagueMembers.filter(m => m.league_id === currentLeague.id)}
                events={game.gameWeeks}
                onApply={handleApplyFilter}
                loading={loading}
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 mt-4">
            {userEntry && (
              <div className="space-y-2 mb-4 sticky top-0 bg-navy-accent py-2 z-10">
                  <p className="text-xs text-center font-semibold text-text-disabled uppercase">Your Position</p>
                  <LeaderboardRow entry={userEntry} isUser={true} />
                  <hr className="border-dashed border-disabled my-2" />
              </div>
            )}
            {displayedLeaderboard.filter(e => e.userId !== currentUserId).map(entry => <LeaderboardRow key={entry.rank} entry={entry} isUser={false} />)}
          </div>

          {isCurrentUserAdmin && activeFilterLeagueId && (
            <div className="pt-4">
              <button onClick={() => setIsCelebrationModalOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 bg-warm-yellow/20 text-warm-yellow rounded-xl font-semibold hover:bg-warm-yellow/30 transition-colors">
                <Trophy size={16} /> Celebrate the Winners
              </button>
            </div>
          )}
        </div>
      </div>
      <CelebrationModal
        isOpen={isCelebrationModalOpen}
        onClose={() => setIsCelebrationModalOpen(false)}
        onConfirm={handleConfirmCelebration}
        leaderboard={displayedLeaderboard}
        period={activePeriod}
        loading={loading}
      />
    </>
  );
};
