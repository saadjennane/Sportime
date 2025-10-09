import React from 'react';
import { Calendar, SlidersHorizontal, Gamepad2 } from 'lucide-react';
import { Page } from '../App';

interface FooterNavProps {
  activePage: Page;
  onPageChange: (page: Page) => void;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-300 ${
      isActive
        ? 'text-purple-600'
        : 'text-gray-500 hover:text-purple-600'
    }`}
  >
    {icon}
    <span className={`text-xs font-semibold ${isActive ? 'text-purple-600' : ''}`}>{label}</span>
  </button>
);

export const FooterNav: React.FC<FooterNavProps> = ({ activePage, onPageChange }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto">
      <div className="bg-white/80 backdrop-blur-lg m-4 p-1 rounded-2xl shadow-2xl shadow-purple-200/50 flex gap-1">
        <NavItem
          icon={<Gamepad2 className="w-6 h-6" />}
          label="Games"
          isActive={activePage === 'challenges'}
          onClick={() => onPageChange('challenges')}
        />
        <NavItem
          icon={<Calendar className="w-6 h-6" />}
          label="Matches"
          isActive={activePage === 'matches'}
          onClick={() => onPageChange('matches')}
        />
        <NavItem
          icon={<SlidersHorizontal className="w-6 h-6" />}
          label="Admin"
          isActive={activePage === 'admin'}
          onClick={() => onPageChange('admin')}
        />
      </div>
    </div>
  );
};
