import React from 'react';
import { Ticket, CheckCircle, Lock } from 'lucide-react';
import { SpinTier } from '../../types';

interface SpinwheelCardProps {
  tier: SpinTier;
  onClick: () => void;
  isAvailable: boolean;
}

const tierDetails = {
  free: { title: "Free Spin", description: "Spin once daily!", color: "from-lime-glow/20 to-lime-glow/5", borderColor: "border-lime-glow" },
  rookie: { title: "Rookie Spin", description: "Requires Rookie Ticket", color: "from-lime-glow/40 to-lime-glow/10", borderColor: "border-lime-glow" },
  pro: { title: "Pro Spin", description: "Requires Pro Ticket", color: "from-warm-yellow/40 to-warm-yellow/10", borderColor: "border-warm-yellow" },
  elite: { title: "Elite Spin", description: "Requires Elite Ticket", color: "from-hot-red/40 to-hot-red/10", borderColor: "border-hot-red" },
  premium: { title: "Premium Spin", description: "Subscriber Exclusive", color: "from-electric-blue/40 to-neon-cyan/20", borderColor: "border-neon-cyan" },
};

export const SpinwheelCard: React.FC<SpinwheelCardProps> = ({ tier, onClick, isAvailable }) => {
  const details = tierDetails[tier];

  return (
    <div 
      onClick={onClick}
      className={`card-base p-3 flex flex-col justify-between space-y-2 text-center transition-all duration-300 cursor-pointer 
                 ${isAvailable ? 'opacity-100 hover:shadow-lg hover:border-neon-cyan/50' : 'opacity-60 hover:opacity-80'}`}
    >
      <div className="space-y-1">
        <div className={`w-12 h-12 rounded-full mx-auto bg-gradient-to-br ${details.color} flex items-center justify-center`}>
          <Ticket className="w-6 h-6 text-white/50" />
        </div>
        <h4 className="font-bold text-text-primary text-sm">{details.title}</h4>
        <p className="text-xs text-text-disabled truncate">{details.description}</p>
      </div>
      <div className="space-y-1">
        {tier === 'free' && (
          <div className={`flex items-center justify-center gap-1 text-[10px] font-semibold ${isAvailable ? 'text-lime-glow' : 'text-text-disabled'}`}>
            {isAvailable ? <CheckCircle size={12} /> : null}
            {isAvailable ? 'Available' : 'Spun'}
          </div>
        )}
        {tier !== 'free' && !isAvailable && (
          <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-text-disabled">
            <Lock size={12} />
            <span>Locked</span>
          </div>
        )}
        <button 
          onClick={onClick}
          className={`w-full py-1.5 text-xs font-bold rounded-lg transition-colors ${
            isAvailable 
              ? 'primary-button' 
              : 'bg-navy-accent border-2 border-disabled text-text-secondary hover:border-electric-blue/50'
          }`}
        >
          {isAvailable ? 'Spin' : 'Rewards'}
        </button>
      </div>
    </div>
  );
};
