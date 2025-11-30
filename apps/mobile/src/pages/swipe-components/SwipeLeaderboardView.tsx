/**
 * SwipeLeaderboardView - Presentational Component for Leaderboard
 *
 * IMPORTANT: This component is wrapped in memo() to prevent re-renders.
 * NO useMemo with Set/Map - filtering done inline with simple loops.
 */

import React, { useState, memo } from 'react';
import { ArrowLeft, Trophy, Medal, Award, Info } from 'lucide-react';
import type { SwipeLeaderboardEntry, UserLeague, LeagueMember, LeagueGame } from '../../types';
import { LeaderboardLeagueSwitcher } from '../../components/leagues/LeaderboardLeagueSwitcher';

interface Challenge {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface UserStats {
  totalPoints: number;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
}

interface SwipeLeaderboardViewProps {
  challenge: Challenge | null;
  leaderboard: SwipeLeaderboardEntry[];
  userStats: UserStats | null;
  userPosition: number | null;
  currentUserId: string | null;
  onBack: () => void;
  userLeagues: UserLeague[];
  leagueMembers: LeagueMember[];
  leagueGames: LeagueGame[];
}

// Helper to get rank icon
function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy size={20} className="text-yellow-500" />;
  if (rank === 2) return <Medal size={20} className="text-gray-400" />;
  if (rank === 3) return <Award size={20} className="text-orange-400" />;
  return <span className="font-bold text-text-secondary w-5 text-center">{rank}</span>;
}

export const SwipeLeaderboardView = memo<SwipeLeaderboardViewProps>(function SwipeLeaderboardView({
  challenge,
  leaderboard,
  userStats,
  userPosition,
  currentUserId,
  onBack,
  userLeagues,
  leagueMembers,
  leagueGames,
}) {
  const [activeFilterLeagueId, setActiveFilterLeagueId] = useState<string | null>(null);

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

  // Filter leaderboard by league members if filter is active
  // Simple iteration - NO Set creation in render!
  let displayedLeaderboard = leaderboard;

  if (activeFilterLeagueId) {
    // Build a lookup object instead of Set
    const memberLookup: Record<string, boolean> = {};
    for (const member of leagueMembers) {
      if (member.league_id === activeFilterLeagueId) {
        memberLookup[member.user_id] = true;
      }
    }

    // Filter using lookup
    displayedLeaderboard = leaderboard.filter(
      entry => entry.userId && memberLookup[entry.userId]
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
        gameId={challenge.id}
        userLeagues={userLeagues}
        leagueGames={leagueGames}
        leagueMembers={leagueMembers}
        activeLeagueId={activeFilterLeagueId}
        onSelectLeague={setActiveFilterLeagueId}
      />

      <div className="card-base p-5 space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-electric-blue">{challenge.name}</h2>
          <p className="text-sm font-semibold text-text-secondary">
            {challenge.status === 'finished' ? 'Final Leaderboard' : 'Current Standings'}
          </p>
          {userStats && (
            <div className="mt-2 text-sm text-text-secondary">
              <p>
                Your Position:{' '}
                <span className="font-bold text-electric-blue">#{userPosition || '-'}</span>
              </p>
              <p>
                Your Points:{' '}
                <span className="font-bold text-warm-yellow">{userStats.totalPoints}</span>
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
                  key={`${entry.rank}-${entry.userId}`}
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
    </div>
  );
});

SwipeLeaderboardView.displayName = 'SwipeLeaderboardView';

export default SwipeLeaderboardView;
