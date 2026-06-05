import React, { useState, useMemo } from 'react';
import { X, Trophy, Loader2 } from 'lucide-react';
import { LeaderboardEntry, SwipeLeaderboardEntry, FantasyLeaderboardEntry, LeaderboardPeriod } from '../../types';
import { format } from 'date-fns';

type AnyLeaderboardEntry = LeaderboardEntry | SwipeLeaderboardEntry | FantasyLeaderboardEntry;

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (message: string) => void;
  leaderboard: AnyLeaderboardEntry[];
  period: LeaderboardPeriod;
  loading: boolean;
}

const getScore = (entry: AnyLeaderboardEntry) => 'points' in entry ? entry.points : entry.totalPoints;

export const CelebrationModal: React.FC<CelebrationModalProps> = ({ isOpen, onClose, onConfirm, leaderboard, period, loading }) => {
  const top3 = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);

  const defaultMessage = useMemo(() => {
    let msg = "🎉 Congratulations to the top 3 players!\n";
    top3.forEach((player, index) => {
      const emoji = ['🥇', '🥈', '🥉'][index];
      msg += `${emoji} ${player.username} — ${getScore(player)} pts\n`;
    });
    msg += `*(Ranking calculated between ${format(new Date(period.start_date), 'MMM d')} and ${format(new Date(period.end_date), 'MMM d')})*`;
    return msg;
  }, [top3, period]);

  const [message, setMessage] = useState(defaultMessage);

  if (!isOpen) return null;

  const charCount = message.length;
  const isOverLimit = charCount > 300;

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-scale-in">
      <div className="modal-base max-w-sm w-full p-6 space-y-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full">
          <X size={24} />
        </button>
        <div className="text-center">
          <div className="inline-block bg-warm-yellow/10 p-3 rounded-full mb-3">
            <Trophy className="w-8 h-8 text-warm-yellow" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">Celebrate the Winners</h2>
          <p className="text-text-secondary mt-1">Take a snapshot and post the winners in the feed.</p>
        </div>

        <div className="bg-deep-navy/50 p-3 rounded-lg space-y-2">
          <h4 className="text-sm font-semibold text-text-secondary">Top 3 Players:</h4>
          {top3.map((player, index) => (
            <div key={player.rank} className="flex items-center gap-2 text-sm">
              <span>{['🥇', '🥈', '🥉'][index]}</span>
              <span className="font-bold text-text-primary">{player.username}</span>
              <span className="text-warm-yellow">{getScore(player)} pts</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-secondary">Message (optional)</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="input-base h-32"
            maxLength={300}
          />
          <p className={`text-xs text-right ${isOverLimit ? 'text-hot-red' : 'text-text-disabled'}`}>
            {charCount} / 300
          </p>
        </div>

        <button
          onClick={() => onConfirm(message)}
          disabled={loading || isOverLimit}
          className="w-full primary-button"
        >
          {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Confirm & Celebrate'}
        </button>
      </div>
    </div>
  );
};
