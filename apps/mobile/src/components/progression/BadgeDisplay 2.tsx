/**
 * Badge Display Component
 *
 * Shows user's earned badges with visual effects and descriptions.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { Award, Loader2, Lock } from 'lucide-react';

interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  xp_bonus: number;
  earned_at?: string;
}

interface BadgeDisplayProps {
  userId: string | null;
  showLocked?: boolean; // Show unearned badges as locked
}

// Helper to check if userId is a valid UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Mock badges for non-UUID users (dev/testing)
const mockEarnedBadges: Badge[] = [
  {
    id: 'mock-1',
    name: 'First Victory',
    description: 'Win your first prediction',
    icon_url: '🏆',
    xp_bonus: 150,
    earned_at: new Date().toISOString(),
  },
];

const mockLockedBadges: Badge[] = [
  {
    id: 'mock-2',
    name: 'Prediction Master',
    description: 'Win 10 predictions',
    icon_url: '🎯',
    xp_bonus: 300,
  },
  {
    id: 'mock-3',
    name: 'Sharp Eye',
    description: 'Maintain 75% accuracy',
    icon_url: '👁️',
    xp_bonus: 500,
  },
];

export const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ userId, showLocked = false }) => {
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [lockedBadges, setLockedBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    loadBadges();
  }, [userId]);

  const loadBadges = async () => {
    if (!userId) return;

    setIsLoading(true);

    // If not a valid UUID, use mock data (for development with mock users)
    if (!isValidUUID(userId)) {
      setEarnedBadges(mockEarnedBadges);
      setLockedBadges(mockLockedBadges);
      setIsLoading(false);
      return;
    }

    try {
      // Get user's earned badges
      const { data: userBadgesData, error: userBadgesError } = await supabase
        .from('user_badges')
        .select(
          `
          badge_id,
          earned_at,
          badge:badges (
            id,
            name,
            description,
            icon_url,
            xp_bonus
          )
        `
        )
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });

      if (userBadgesError) throw userBadgesError;

      const earned = (userBadgesData || []).map((ub: any) => ({
        ...ub.badge,
        earned_at: ub.earned_at,
      }));

      setEarnedBadges(earned);

      // If showLocked, get unearned badges
      if (showLocked) {
        const earnedBadgeIds = new Set(earned.map((b: Badge) => b.id));

        const { data: allBadgesData, error: allBadgesError } = await supabase
          .from('badges')
          .select('*')
          .eq('is_active', true);

        if (allBadgesError) throw allBadgesError;

        const locked = (allBadgesData || []).filter((b: Badge) => !earnedBadgeIds.has(b.id));
        setLockedBadges(locked);
      }
    } catch (err) {
      console.error('Error loading badges:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!userId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-electric-blue" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Earned Badges */}
      {earnedBadges.length > 0 && (
        <div>
          <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2">
            <Award size={18} className="text-warm-yellow" />
            Earned Badges ({earnedBadges.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {earnedBadges.map(badge => (
              <BadgeCard key={badge.id} badge={badge} isEarned />
            ))}
          </div>
        </div>
      )}

      {/* Locked Badges */}
      {showLocked && lockedBadges.length > 0 && (
        <div>
          <h3 className="font-bold text-text-disabled mb-3 flex items-center gap-2">
            <Lock size={18} />
            Locked Badges ({lockedBadges.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {lockedBadges.map(badge => (
              <BadgeCard key={badge.id} badge={badge} isEarned={false} />
            ))}
          </div>
        </div>
      )}

      {earnedBadges.length === 0 && (!showLocked || lockedBadges.length === 0) && (
        <div className="card-base p-8 text-center">
          <Award size={48} className="mx-auto text-text-disabled mb-2" />
          <p className="text-text-disabled">No badges yet. Keep playing to earn your first badge!</p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// BADGE CARD
// ============================================================================

const BadgeCard: React.FC<{ badge: Badge; isEarned: boolean }> = ({ badge, isEarned }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      onClick={() => setShowDetails(!showDetails)}
      className={`card-base p-3 cursor-pointer transition-all hover:scale-105 ${
        isEarned ? '' : 'opacity-40 grayscale'
      }`}
    >
      <div className="flex flex-col items-center text-center space-y-2">
        {/* Icon */}
        <div className={`text-4xl ${isEarned ? 'animate-bounce' : ''}`}>
          {badge.icon_url || <Award className="text-warm-yellow" />}
        </div>

        {/* Name */}
        <div>
          <p className="font-bold text-text-primary text-sm">{badge.name}</p>
          <p className="text-xs text-warm-yellow font-semibold">+{badge.xp_bonus} XP</p>
        </div>

        {/* Description (if expanded) */}
        {showDetails && badge.description && (
          <p className="text-xs text-text-secondary pt-2 border-t border-white/10">{badge.description}</p>
        )}

        {/* Earned Date */}
        {isEarned && badge.earned_at && (
          <p className="text-xs text-text-disabled">
            Earned {new Date(badge.earned_at).toLocaleDateString()}
          </p>
        )}

        {/* Locked Icon */}
        {!isEarned && (
          <div className="absolute top-2 right-2">
            <Lock size={14} className="text-text-disabled" />
          </div>
        )}
      </div>
    </div>
  );
};
