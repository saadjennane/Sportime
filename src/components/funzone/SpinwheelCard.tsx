import React from 'react';
import { Ticket, CheckCircle } from 'lucide-react';

interface SpinwheelCardProps {
  tier: 'free' | 'rookie' | 'pro' | 'elite' | 'premium';
  onSpin: () => void;
  isAvailable?: boolean;
}

const tierDetails = {
  free: { title: "Free Spin", description: "Spin once daily!", color: "from-lime-glow/20 to-lime-glow/5" },
  rookie: { title: "Rookie Spin", description: "Requires Rookie Ticket", color: "from-lime-glow/40 to-lime-glow/10" },
  pro: { title: "Pro Spin", description: "Requires Pro Ticket", color: "from-warm-yellow/40 to-warm-yellow/10" },
  elite: { title: "Elite Spin", description: "Requires Elite Ticket", color: "from-hot-red/40 to-hot-red/10" },
  premium: { title: "Premium Spin", description: "Subscriber Exclusive", color: "from-electric-blue/40 to-neon-cyan/20" },
};

export const SpinwheelCard: React.FC<SpinwheelCardProps> = ({ tier, onSpin, isAvailable = false }) => {
  const details = tierDetails[tier];
  const isDisabled = tier !== 'free';

  return (
    <div className={`flex-shrink-0 w-48 card-base p-4 flex flex-col justify-between space-y-4 text-center snap-start ${isDisabled ? 'opacity-60' : ''}`}>
      <div className="space-y-1">
        <div className={`w-16 h-16 rounded-full mx-auto bg-gradient-to-br ${details.color} flex items-center justify-center`}>
          <Ticket className="w-8 h-8 text-white/50" />
        </div>
        <h4 className="font-bold text-text-primary">{details.title}</h4>
        <p className="text-xs text-text-disabled">{details.description}</p>
      </div>
      <div className="space-y-2">
        {tier === 'free' && (
          <div className={`flex items-center justify-center gap-1 text-xs font-semibold ${isAvailable ? 'text-lime-glow' : 'text-text-disabled'}`}>
            {isAvailable ? <CheckCircle size={14} /> : null}
            {isAvailable ? 'Available Today' : 'Already Spun'}
          </div>
        )}
        <button onClick={onSpin} disabled={isDisabled} className="w-full primary-button py-2 text-sm">
          Spin Now
        </button>
      </div>
    </div>
  );
};
