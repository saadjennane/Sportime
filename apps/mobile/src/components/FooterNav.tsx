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
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-deep-navy/95 backdrop-blur-md border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
      <nav className="w-full max-w-md mx-auto h-[58px] flex justify-around items-center">
        <NavItem
          icon={<Calendar />}
          label="Matches"
          isActive={activePage === 'matches'}
          onClick={() => onPageChange('matches')}
        />
        <NavItem
          icon={<Gamepad2 />}
          label="Games"
          isActive={activePage === 'challenges'}
          onClick={() => onPageChange('challenges')}
        />
        <NavItem
          icon={<Users />}
          label="Squads"
          isActive={activePage === 'squads'}
          onClick={() => onPageChange('squads')}
        />
        <NavItem
          icon={<ToyBrick />}
          label="FunZone"
          isActive={activePage === 'funzone'}
          onClick={() => onPageChange('funzone')}
        />
      </nav>
    </div>
  );
};
