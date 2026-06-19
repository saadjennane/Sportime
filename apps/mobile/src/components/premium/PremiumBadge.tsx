import React from 'react';
import { Star } from 'lucide-react';

/** Small Premium marker shown next to a subscriber's name (profile, leaderboards). */
export const PremiumBadge: React.FC<{ size?: number; className?: string }> = ({ size = 11, className = '' }) => (
  <span
    title="Premium"
    className={`inline-flex items-center justify-center rounded-full bg-warm-yellow/20 flex-shrink-0 ${className}`}
    style={{ width: size + 6, height: size + 6 }}
  >
    <Star size={size} className="text-warm-yellow fill-current" />
  </span>
);
