import React from 'react';
import { LeagueFeedPost, Profile, LeaderboardSnapshot } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageSquare, Trophy } from 'lucide-react';
import { useMockStore } from '../../store/useMockStore';
import { DisplayName } from '../shared/DisplayName';

interface LeagueFeedPostCardProps {
  post: LeagueFeedPost;
  author?: Profile;
  isLiked: boolean;
  onToggleLike: () => void;
  onViewSnapshot: (snapshot: LeaderboardSnapshot) => void;
}

export const LeagueFeedPostCard: React.FC<LeagueFeedPostCardProps> = ({ post, author, isLiked, onToggleLike, onViewSnapshot }) => {
  const { leaderboardSnapshots } = useMockStore();

  const handleViewSnapshot = () => {
    if (post.metadata.snapshot_id) {
      const snapshot = leaderboardSnapshots.find(s => s.id === post.metadata.snapshot_id);
      if (snapshot) {
        onViewSnapshot(snapshot);
      }
    }
  };

  const renderContent = () => {
    if (post.type === 'celebration' && post.metadata.top_players) {
      return (
        <div className="mt-2 space-y-1">
          {post.metadata.top_players.map((player, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <span>{['🥇', '🥈', '🥉'][index]}</span>
              <span className="font-bold text-text-primary">{player.name}</span>
              <span className="text-warm-yellow">{player.score} pts</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card-base p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <img
          src={author?.profile_picture_url || `https://api.dicebear.com/8.x/bottts/svg?seed=${post.author_id}`}
          alt={author?.username || 'user'}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div>
          <DisplayName profile={author} className="font-bold text-text-primary" fallback="A member" />
          <p className="text-xs text-text-disabled">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Message & Content */}
      <p className="text-text-secondary whitespace-pre-wrap">{post.message}</p>
      {renderContent()}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <button onClick={onToggleLike} className="flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-hot-red transition-colors">
          <Heart size={18} className={`${isLiked ? 'text-hot-red fill-current' : ''}`} />
          <span>{post.likes.length}</span>
        </button>
        {post.metadata.snapshot_id && (
          <button onClick={handleViewSnapshot} className="flex items-center gap-2 text-sm font-semibold text-electric-blue bg-electric-blue/10 px-3 py-1.5 rounded-lg hover:bg-electric-blue/20">
            <Trophy size={16} />
            View Snapshot
          </button>
        )}
      </div>
    </div>
  );
};
