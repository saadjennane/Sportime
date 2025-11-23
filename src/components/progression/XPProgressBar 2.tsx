/**
 * XP Progress Bar Component
 *
 * Displays user's current level, XP progress, and progress to next level.
 * Updates in real-time via useProgression hook.
 *
 * Usage:
 *   <XPProgressBar userId={userId} />
 */

import React from 'react';
import { useProgression } from '../../hooks/useProgression';
import { Loader2, Trophy, TrendingUp, AlertCircle } from 'lucide-react';

interface XPProgressBarProps {
  userId: string | null;
  compact?: boolean;
}

const LEVEL_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 5000,
  3: 15000,
  4: 35000,
  5: 70000,
  6: 120000,
};

export const XPProgressBar: React.FC<XPProgressBarProps> = ({ userId, compact = false }) => {
  const { progression, isLoading } = useProgression(userId);

  if (!userId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="animate-spin text-electric-blue" size={24} />
      </div>
    );
  }

  if (!progression) return null;

  const currentLevelThreshold = LEVEL_THRESHOLDS[progression.current_level] || 0;
  const nextLevelThreshold = LEVEL_THRESHOLDS[progression.current_level + 1] || currentLevelThreshold;
  const isMaxLevel = progression.current_level === 6;

  const progressPercent = isMaxLevel
    ? 100
    : ((progression.xp_total - currentLevelThreshold) / (nextLevelThreshold - currentLevelThreshold)) * 100;

  const clampedProgress = Math.min(Math.max(progressPercent, 0), 100);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Trophy size={16} className="text-warm-yellow" />
          <span className="font-bold text-text-primary text-sm">{progression.level_name}</span>
        </div>
        <div className="flex-1 bg-gray-700 rounded-full h-2 max-w-[120px]">
          <div
            className="bg-gradient-to-r from-electric-blue to-lime-glow h-2 rounded-full transition-all duration-500"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
        <span className="text-xs text-text-secondary">{progression.xp_total.toLocaleString()} XP</span>
      </div>
    );
  }

  return (
    <div className="card-base p-4 space-y-3">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Trophy size={20} className="text-warm-yellow" />
          <div>
            <h3 className="font-bold text-text-primary">{progression.level_name}</h3>
            <p className="text-xs text-text-disabled">Level {progression.current_level}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-electric-blue">{progression.xp_total.toLocaleString()} XP</p>
          {!isMaxLevel && (
            <p className="text-xs text-text-disabled">
              {progression.xp_to_next_level.toLocaleString()} to next
            </p>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="w-full bg-deep-navy rounded-full h-4 overflow-hidden shadow-inner">
          <div
            className="bg-gradient-to-r from-electric-blue via-neon-cyan to-lime-glow h-4 rounded-full transition-all duration-500 relative"
            style={{ width: `${clampedProgress}%` }}
          >
            <div className="absolute inset-0 bg-white/10 animate-pulse" />
          </div>
        </div>
        <div className="flex justify-between mt-1 text-xs text-text-disabled">
          <span>{currentLevelThreshold.toLocaleString()} XP</span>
          {!isMaxLevel && <span>{progression.progress_percentage.toFixed(1)}%</span>}
          <span>{isMaxLevel ? 'MAX' : `${nextLevelThreshold.toLocaleString()} XP`}</span>
        </div>
      </div>

      {/* GOAT Bonus Badge */}
      {progression.goat_bonus_active && (
        <div className="flex items-center gap-2 bg-warm-yellow/10 border border-warm-yellow/20 rounded-lg p-2">
          <TrendingUp size={16} className="text-warm-yellow" />
          <p className="text-xs font-semibold text-warm-yellow">GOAT Bonus Active: +5% XP</p>
        </div>
      )}

      {/* Decay Warning */}
      {progression.will_decay && progression.weeks_inactive > 0 && (
        <div className="flex items-center gap-2 bg-hot-red/10 border border-hot-red/20 rounded-lg p-2">
          <AlertCircle size={16} className="text-hot-red" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-hot-red">Inactivity Warning</p>
            <p className="text-xs text-text-disabled">
              {progression.weeks_inactive} week{progression.weeks_inactive > 1 ? 's' : ''} inactive - XP decay
              active
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
