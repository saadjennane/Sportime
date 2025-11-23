import React, { useMemo } from 'react';
import { PredictionChallenge, Profile, UserSwipeEntry, SwipeMatchDay, SwipeLeaderboardEntry } from '../../types';
import { ArrowLeft, Trophy, Medal, Award } from 'lucide-react';
import { sortByPredictionRanking } from '../../lib/sorters';

interface PredictionChallengeOverviewPageProps {
  challenge: PredictionChallenge;
  onBack: () => void;
  allUsers: Profile[];
  userSwipeEntries: UserSwipeEntry[];
  swipeMatchDays: SwipeMatchDay[];
  currentUserId: string;
}

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy size={20} className="text-yellow-500" />;
  if (rank === 2) return <Medal size={20} className="text-gray-400" />;
  if (rank === 3) return <Award size={20} className="text-orange-400" />;
  return <span className="font-bold text-text-secondary w-5 text-center">{rank}</span>;
};

const PredictionChallengeOverviewPage: React.FC<PredictionChallengeOverviewPageProps> = ({
  challenge,
  onBack,
  allUsers,
  userSwipeEntries,
  swipeMatchDays,
  currentUserId,
}) => {
  const aggregatedLeaderboard = useMemo(() => {
    const challengeMatchDays = swipeMatchDays.filter(md => challenge.matchDayIds.includes(md.id));

    const playerStats = allUsers.map(user => {
      let total_points = 0;
      let nb_correct_picks = 0;
      let first_submission_ts = Infinity;
      const breakdownByDay: Record<string, number> = {};

      challengeMatchDays.forEach(matchDay => {
        const userEntry = userSwipeEntries.find(entry => entry.user_id === user.id && entry.matchDayId === matchDay.id);
        if (userEntry) {
          let dayPoints = 0;
          let dayCorrectPicks = 0;

          userEntry.predictions.forEach(p => {
            const match = matchDay.matches.find(m => m.id === p.matchId);
            if (match?.result && match.result === p.prediction) {
              dayPoints += match.odds[p.prediction] * 100;
              dayCorrectPicks++;
            }
          });
          
          total_points += Math.round(dayPoints);
          nb_correct_picks += dayCorrectPicks;
          breakdownByDay[matchDay.id] = Math.round(dayPoints);
          
          if (userEntry.submitted_at) {
            const submissionTime = new Date(userEntry.submitted_at).getTime();
            if (submissionTime < first_submission_ts) {
              first_submission_ts = submissionTime;
            }
          }
        }
      });
      
      return {
        userId: user.id,
        player_name: user.username || `User ${user.id.slice(0, 4)}`,
        total_points,
        nb_correct_picks,
        first_submission_ts: first_submission_ts === Infinity ? Date.now() : first_submission_ts,
        breakdownByDay,
      };
    });

    // Sort using the new sorter
    const sortedPlayers = playerStats.sort(sortByPredictionRanking);
    
    return sortedPlayers.map((player, index) => ({
      ...player,
      rank: index + 1,
    }));
  }, [challenge, allUsers, userSwipeEntries, swipeMatchDays]);

  return (
    <div className="animate-scale-in space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-text-secondary font-semibold hover:text-electric-blue">
        <ArrowLeft size={20} /> Back
      </button>

      <div className="card-base p-5 space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-electric-blue">{challenge.title}</h2>
          {challenge.season && <p className="text-sm font-semibold text-text-secondary">{challenge.season}</p>}
        </div>
        <div className="space-y-2">
          {aggregatedLeaderboard.map(entry => (
            <div key={entry.userId} className={`flex items-center p-3 rounded-xl ${entry.userId === currentUserId ? 'bg-electric-blue/10 border-2 border-electric-blue/50' : 'bg-deep-navy'}`}>
              <div className="w-8 flex justify-center">{getRankIcon(entry.rank)}</div>
              <p className="flex-1 font-semibold text-text-primary ml-2">{entry.userId === currentUserId ? 'You' : entry.player_name}</p>
              <div className="text-right">
                <p className="font-bold text-warm-yellow">{entry.total_points.toLocaleString()} pts</p>
                <p className="text-xs text-text-disabled">{entry.nb_correct_picks} correct</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PredictionChallengeOverviewPage;
