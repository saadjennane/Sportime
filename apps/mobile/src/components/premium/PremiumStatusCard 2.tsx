import React from 'react';
import { Star } from 'lucide-react';
import { format } from 'date-fns';

interface PremiumStatusCardProps {
  expiryDate: string;
}

export const PremiumStatusCard: React.FC<PremiumStatusCardProps> = ({ expiryDate }) => {
  return (
    <div className="bg-gradient-to-r from-warm-yellow/20 to-warm-yellow/5 p-4 rounded-2xl border-2 border-warm-yellow/50 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Star size={24} className="text-warm-yellow fill-current" />
        <div>
          <h4 className="font-bold text-warm-yellow">Premium Active</h4>
          <p className="text-xs text-text-secondary">Expires on {format(new Date(expiryDate), 'MMM d, yyyy')}</p>
        </div>
      </div>
      <button className="text-xs font-bold text-electric-blue hover:underline">
        Manage
      </button>
    </div>
  );
};
