import React from 'react';
import { Calendar, SlidersHorizontal, Gamepad2, Users, ToyBrick, Store } from 'lucide-react';
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
  badgeCount?: number;
}> = ({ icon, label, isActive, onClick, badgeCount }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-300 relative ${
      isActive
        ? 'text-neon-cyan'
        : 'text-text-secondary hover:text-neon-cyan'
    }`}
  >
    <div className="relative">
      {icon}
      {badgeCount && badgeCount > 0 && (
        <span className="absolute -top-1 -right-2 bg-hot-red text-white text-[10px] font-bold min-w-[1rem] h-4 px-1 flex items-center justify-center rounded-full">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </div>
    <span className={`text-xs font-semibold ${isActive ? 'text-neon-cyan' : ''}`}>{label}</span>
    {isActive && <div className="absolute bottom-0 h-1 w-8 bg-neon-cyan rounded-full shadow-[0_0_8px_theme('colors.neon-cyan')]"></div>}
  </button>
);

export const FooterNav: React.FC<FooterNavProps> = ({ activePage, onPageChange }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto">
      <div className="bg-navy-accent/80 backdrop-blur-lg m-4 p-1 rounded-2xl shadow-2xl shadow-neon-cyan/10 flex gap-1 border border-neon-cyan/20">
        <NavItem
          icon={<Gamepad2 className="w-6 h-6" />}
          label="Games"
          isActive={activePage === 'challenges'}
          onClick={() => onPageChange('challenges')}
        />
        <NavItem
          icon={<Users className="w-6 h-6" />}
          label="Leagues"
          isActive={activePage === 'leagues'}
          onClick={() => onPageChange('leagues')}
        />
        <NavItem
          icon={<ToyBrick className="w-6 h-6" />}
          label="FunZone"
          isActive={activePage === 'funzone'}
          onClick={() => onPageChange('funzone')}
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
