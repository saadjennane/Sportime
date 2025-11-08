import React from 'react';
import { Calendar, SlidersHorizontal, Gamepad2, Users, ToyBrick } from 'lucide-react';
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
}> = ({ icon, label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center h-full"
    >
      {isActive ? (
        <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 border-electric-blue/50 bg-electric-blue/20">
          {React.cloneElement(icon as React.ReactElement, { size: 26, className: "text-electric-blue" })}
          <span className="text-xs text-electric-blue font-semibold">{label}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 text-white/70 font-medium">
          {React.cloneElement(icon as React.ReactElement, { size: 26 })}
          <span className="text-xs">{label}</span>
        </div>
      )}
    </button>
  );
};

export const FooterNav: React.FC<FooterNavProps> = ({ activePage, onPageChange }) => {
  return (
    <div className="fixed bottom-[14px] left-4 right-4 h-[68px] max-w-md mx-auto">
      <nav className="w-full h-full bg-deep-navy/80 backdrop-blur-md rounded-[18px] border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.45)] flex justify-around items-center">
        <NavItem
          icon={<Gamepad2 />}
          label="Games"
          isActive={activePage === 'challenges'}
          onClick={() => onPageChange('challenges')}
        />
        <NavItem
          icon={<Calendar />}
          label="Matches"
          isActive={activePage === 'matches'}
          onClick={() => onPageChange('matches')}
        />
        <NavItem
          icon={<Users />}
          label="Leagues"
          isActive={activePage === 'leagues'}
          onClick={() => onPageChange('leagues')}
        />
        <NavItem
          icon={<ToyBrick />}
          label="FunZone"
          isActive={activePage === 'funzone'}
          onClick={() => onPageChange('funzone')}
        />
        <NavItem
          icon={<SlidersHorizontal />}
          label="Admin"
          isActive={activePage === 'admin'}
          onClick={() => onPageChange('admin')}
        />
      </nav>
    </div>
  );
};
