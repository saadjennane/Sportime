import React from 'react';
import { Profile } from '../../types';

interface DisplayNameProps {
  profile?: Profile | null;
  className?: string;
  fallback?: string;
}

export const DisplayName: React.FC<DisplayNameProps> = ({ profile, className, fallback = 'Player' }) => {
  const name = profile?.display_name || profile?.username || fallback;
  return <span className={className}>{name}</span>;
};
