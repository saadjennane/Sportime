import React from 'react';

interface FatigueBarProps {
  fatigue: number; // 0-100
}

export const FatigueBar: React.FC<FatigueBarProps> = ({ fatigue }) => {
  const getColor = () => {
    if (fatigue > 80) return 'bg-green-500';
    if (fatigue > 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="w-full bg-gray-200 rounded-full h-3.5 relative overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${getColor()}`}
        style={{ width: `${fatigue}%` }}
      ></div>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white mix-blend-difference">
        {fatigue}%
      </span>
    </div>
  );
};
