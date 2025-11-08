import React from 'react';

interface BonusCardProps {
  icon: string;
  title: string;
  description: string;
  reward: string;
  isActive: boolean;
}

export const BonusCard: React.FC<BonusCardProps> = ({ icon, title, description, reward, isActive }) => {
  return (
    <div className={`flex-1 p-3 rounded-xl border-2 transition-all duration-300 ${isActive ? 'bg-green-50 border-green-400 shadow-lg shadow-green-500/10' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h4 className="font-bold text-sm">{title}</h4>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <div className={`text-center mt-2 text-sm font-bold ${isActive ? 'text-green-600' : 'text-gray-700'}`}>{reward}</div>
    </div>
  );
};
