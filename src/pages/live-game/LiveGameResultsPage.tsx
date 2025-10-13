import React, { useMemo, useState } from 'react';
import { LiveGame, LiveGamePlayerEntry, LeagueMember } from '../../types';
import { ArrowLeft, Trophy, CheckCircle, XCircle } from 'lucide-react';
import { useMockStore } from '../../store/useMockStore';
import { CelebrationModal } from '../../components/leagues/CelebrationModal';

interface LiveGameResultsPageProps {
  game: LiveGame;
  playerEntry?: LiveGamePlayerEntry;
  onBack: () => void;
  currentUserId: string;
  leagueMembers: LeagueMember[];
}

const LiveGameResultsPage: React.FC<LiveGameResultsPageProps> = ({ game, playerEntry, onBack, currentUserId, leagueMembers }) => {
  const { celebrateWinners } = useMockStore();
  const [isCelebrationModalOpen, setIsCelebrationModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const sortedPlayers = [...game.players].sort((a, b) => {
    if ((b.total_points ?? 0) !== (a.total_points ?? 0)) {
      return (b.total_points ?? 0) - (a.total_points ?? 0);
    }
    if ((a.goal_diff_error ?? 99) !== (b.goal_diff_error ?? 99)) {
      return (a.goal_diff_error ?? 99) - (b.goal_diff_error ?? 99);
    }
    return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
  }).map((p, index) => ({ ...p, rank: index + 1 }));

  const isCurrentUserAdmin = useMemo(() => {
    const membership = leagueMembers.find(m => m.league_id === game.league_id && m.user_id === currentUserId);
    return membership?.role === 'admin';
  }, [leagueMembers, game.league_id, currentUserId]);

  const handleConfirmCelebration = (message: string) => {
    setLoading(true);
    const leaderboardForSnapshot = sortedPlayers.map(p => ({
        rank: p.rank,
        username: p.user_id === currentUserId ? 'You' : `Player ${p.user_id.substring(0, 4)}`,
        points: p.total_points || 0,
        userId: p.user_id,
        finalCoins: 0, // Not applicable for this game type
    }));
    
    // Period is just the match day for this game type
    const period = {
        start_type: 'custom' as const,
        end_type: 'custom' as const,
        start_date: game.match_details.status === 'played' ? game.match_details.kickoffTime : new Date().toISOString(),
        end_date: game.match_details.status === 'played' ? game.match_details.kickoffTime : new Date().toISOString(),
    };

    celebrateWinners(game.league_id, game, leaderboardForSnapshot, period, message, currentUserId);
    setLoading(false);
    setIsCelebrationModalOpen(false);
  };

  return (
    <>
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-text-secondary font-semibold hover:text-electric-blue">
          <ArrowLeft size={20} /> Back to League
        </button>

        <div className="card-base p-4 flex items-center gap-4">
          <div className="text-4xl">{game.match_details.teamA.emoji}</div>
          <div className="flex-1 text-center">
            <p className="text-sm text-lime-glow font-bold">FINAL</p>
            <h2 className="text-3xl font-bold text-text-primary">
              {game.match_details.score?.teamA ?? 0} - {game.match_details.score?.teamB ?? 0}
            </h2>
            <p className="text-sm text-text-secondary">{game.match_details.teamA.name} vs {game.match_details.teamB.name}</p>
          </div>
          <div className="text-4xl">{game.match_details.teamB.emoji}</div>
        </div>

        <div className="card-base p-4 space-y-3">
          <h3 className="text-lg font-bold text-text-primary flex items-center gap-2"><Trophy size={18} /> Final Leaderboard</h3>
          <div className="space-y-2">
            {sortedPlayers.map((p) => (
              <div key={p.user_id} className={`flex items-center p-3 rounded-lg ${p.user_id === currentUserId ? 'bg-electric-blue/10' : 'bg-deep-navy'}`}>
                <span className="w-6 font-bold text-text-secondary text-sm">{p.rank}</span>
                <div className="flex-1">
                  <p className="font-semibold text-text-primary">{p.user_id === currentUserId ? 'You' : `Player ${p.user_id.substring(0, 4)}`}</p>
                  <p className="text-xs text-text-disabled">Prediction: {p.predicted_score?.home}-{p.predicted_score?.away}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-warm-yellow">{p.total_points || 0} pts</p>
                  <p className="text-xs text-text-disabled">Score: {p.score_final} / Bonus: {p.bonus_total}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {isCurrentUserAdmin && (
            <div className="pt-4">
              <button onClick={() => setIsCelebrationModalOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 bg-warm-yellow/20 text-warm-yellow rounded-xl font-semibold hover:bg-warm-yellow/30 transition-colors">
                <Trophy size={16} /> Celebrate the Winners
              </button>
            </div>
        )}
      </div>
      <CelebrationModal
        isOpen={isCelebrationModalOpen}
        onClose={() => setIsCelebrationModalOpen(false)}
        onConfirm={handleConfirmCelebration}
        leaderboard={sortedPlayers.map(p => ({...p, username: p.user_id === currentUserId ? 'You' : `Player ${p.user_id.substring(0,4)}`, points: p.total_points || 0, finalCoins: 0}))}
        period={{ start_date: game.match_details.kickoffTime, end_date: game.match_details.kickoffTime, start_type: 'custom', end_type: 'custom' }}
        loading={loading}
      />
    </>
  );
};

export default LiveGameResultsPage;
