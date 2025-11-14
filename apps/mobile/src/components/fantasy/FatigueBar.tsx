import React from 'react';

interface FatigueBarProps {
  fatigue: number; // 0-100
}

export const FatigueBar: React.FC<FatigueBarProps> = ({ fatigue }) => {
  const getGradient = () => {
    if (fatigue >= 90) return 'from-lime-glow to-green-400';
    if (fatigue >= 70) return 'from-yellow-400 to-amber-500';
    if (fatigue >= 50) return 'from-orange-400 to-red-500';
    return 'from-hot-red to-red-600';
  };

  return (
    <div className="w-full bg-disabled rounded-full h-3.5 relative overflow-hidden" title={`Fatigue: ${fatigue}%`}>
      <div
        className={`h-full rounded-full transition-all duration-300 bg-gradient-to-r ${getGradient()}`}
        style={{ width: `${fatigue}%` }}
      ></div>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white mix-blend-difference">
        {fatigue}%
      </span>
    </div>
  );
};
