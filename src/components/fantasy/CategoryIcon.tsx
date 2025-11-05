import React from 'react';
import { PlayerCategory } from '../../types';
import { Key, Dices, Star as StarIcon } from 'lucide-react';

interface CategoryIconProps {
  category: PlayerCategory;
  size?: number;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ category, size = 12, className = '' }) => {
  switch (category) {
    case 'Star':
      return <StarIcon size={size} className={`text-yellow-400 fill-yellow-400 ${className}`} />;
    case 'Key':
      return <Key size={size} className={`text-gray-400 -rotate-90 ${className}`} />;
    case 'Wild':
      return <Dices size={size} className={`text-green-400 ${className}`} />;
    default:
      return null;
  }
};
