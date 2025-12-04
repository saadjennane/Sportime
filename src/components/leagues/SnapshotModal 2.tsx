import React from 'react';
import { X, Trophy, Medal, Award } from 'lucide-react';
import { LeaderboardSnapshot, Profile, LeaderboardEntry, SwipeLeaderboardEntry, FantasyLeaderboardEntry } from '../../types';
import { format } from 'date-fns';

type AnyLeaderboardEntry = LeaderboardEntry | SwipeLeaderboardEntry | FantasyLeaderboardEntry;

interface SnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: LeaderboardSnapshot;
  author?: Profile;
}

const getScore = (entry: AnyLeaderboardEntry) => 'points' in entry ? entry.points : entry.totalPoints;

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy size={20} className="text-yellow-500" />;
  if (rank === 2) return <Medal size={20} className="text-gray-400" />;
  if (rank === 3) return <Award size={20} className="text-orange-400" />;
  return <span className="font-bold text-text-secondary w-5 text-center">{rank}</span>;
};

export const SnapshotModal: React.FC<SnapshotModalProps> = ({ isOpen, onClose, snapshot, author }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-scale-in">
      <div className="modal-base w-full max-w-md h-[90vh] flex flex-col p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-text-primary">Leaderboard Snapshot</h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
            <X size={24} />
          </button>
        </div>
        
        <div className="bg-deep-navy/50 p-3 rounded-lg space-y-2 mb-4">
          <p className="text-sm text-text-secondary">
            Snapshot of <b className="text-text-primary">{snapshot.game_name}</b> taken on <b className="text-text-primary">{format(new Date(snapshot.created_at), 'MMM d, yyyy')}</b> by <b className="text-text-primary">{author?.username || 'Admin'}</b>.
          </p>
          <p className="text-xs text-text-disabled italic">"{snapshot.message}"</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {snapshot.data.map((entry: AnyLeaderboardEntry) => (
            <div key={entry.rank} className="flex items-center p-3 rounded-xl bg-deep-navy">
              <div className="w-8 flex justify-center">{getRankIcon(entry.rank)}</div>
              <p className="flex-1 font-semibold text-text-primary ml-2">{entry.username}</p>
              <p className="font-bold text-warm-yellow">{getScore(entry)} pts</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
