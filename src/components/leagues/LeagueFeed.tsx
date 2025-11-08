import React from 'react';
import { LeagueFeedPost, LeaderboardSnapshot, Profile } from '../../types';
import { LeagueFeedPostCard } from './LeagueFeedPostCard';

interface LeagueFeedProps {
  posts: LeagueFeedPost[];
  members: Profile[];
  currentUserId: string;
  onViewSnapshot: (snapshot: LeaderboardSnapshot) => void;
  onToggleLike: (postId: string) => void;
}

export const LeagueFeed: React.FC<LeagueFeedProps> = ({ posts, members, currentUserId, onViewSnapshot, onToggleLike }) => {
  if (posts.length === 0) {
    return (
      <div className="card-base p-8 text-center">
        <div className="text-6xl mb-4">🤫</div>
        <p className="text-text-secondary font-medium">The feed is quiet...</p>
        <p className="text-sm text-text-disabled mt-2">Create a celebration or link a game to get things started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map(post => {
        const author = members.find(m => m.id === post.author_id);
        const isLiked = post.likes.includes(currentUserId);
        return (
          <LeagueFeedPostCard
            key={post.id}
            post={post}
            author={author}
            isLiked={isLiked}
            onToggleLike={() => onToggleLike(post.id)}
            onViewSnapshot={onViewSnapshot}
          />
        );
      })}
    </div>
  );
};
