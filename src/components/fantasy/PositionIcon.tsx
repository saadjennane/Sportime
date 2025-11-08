import React from 'react';
import { PlayerPosition } from '../../types';
import { Shield, User, Circle } from 'lucide-react'; // Using Circle for Midfielder

interface PositionIconProps {
  position: PlayerPosition;
  size?: number;
  className?: string;
}

export const PositionIcon: React.FC<PositionIconProps> = ({ position, size = 12, className = '' }) => {
  switch (position) {
    case 'Goalkeeper':
      return <Shield size={size} className={className} />; // Placeholder, maybe a hand icon would be better
    case 'Defender':
      return <Shield size={size} className={className} />;
    case 'Midfielder':
      return <Circle size={size} className={className} />;
    case 'Attacker':
      return <User size={size} className={className} />; // Placeholder, maybe a boot icon
    default:
      return null;
  }
};
