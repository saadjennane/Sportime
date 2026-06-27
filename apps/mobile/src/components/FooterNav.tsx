import React from 'react';
import { Calendar, Gamepad2, Users, Activity, Flag } from 'lucide-react';
import { Page } from '../App';
import { useSport } from '../contexts/SportContext';

interface FooterNavProps {
  activePage: Page;
  onPageChange: (page: Page) => void;
  gamesBadge?: number; // count of games awaiting a user action
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}> = ({ icon, label, isActive, onClick, badge }) => {
  const dot = badge && badge > 0 ? (
    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-hot-red text-white text-[10px] font-bold leading-none">
      {badge > 9 ? '9+' : badge}
    </span>
  ) : null;
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center h-full"
    >
      {isActive ? (
        <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 border-electric-blue/50 bg-electric-blue/20">
          <span className="relative">{React.cloneElement(icon as React.ReactElement, { size: 26, className: "text-electric-blue" })}{dot}</span>
          <span className="text-xs text-electric-blue font-semibold">{label}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 text-white/70 font-medium">
          <span className="relative">{React.cloneElement(icon as React.ReactElement, { size: 26 })}{dot}</span>
          <span className="text-xs">{label}</span>
        </div>
      )}
    </button>
  );
};

export const FooterNav: React.FC<FooterNavProps> = ({ activePage, onPageChange, gamesBadge }) => {
  const { sport } = useSport();
  const isF1 = sport === 'f1';
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-deep-navy/95 backdrop-blur-md border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
      <nav className="w-full max-w-md mx-auto h-[58px] flex justify-around items-center">
        {/* Slot swaps Matches⇄Races by sport; Squads stays shared. */}
        <NavItem
          icon={isF1 ? <Flag /> : <Calendar />}
          label={isF1 ? 'Races' : 'Matches'}
          isActive={activePage === 'matches'}
          onClick={() => onPageChange('matches')}
        />
        <NavItem
          icon={<Gamepad2 />}
          label={isF1 ? 'F1 Games' : 'Games'}
          isActive={activePage === 'challenges'}
          onClick={() => onPageChange('challenges')}
          badge={gamesBadge}
        />
        <NavItem
          icon={<Users />}
          label="Squads"
          isActive={activePage === 'squads'}
          onClick={() => onPageChange('squads')}
        />
        <NavItem
          icon={<Activity />}
          label="Fan Pulse"
          isActive={activePage === 'funzone'}
          onClick={() => onPageChange('funzone')}
        />
      </nav>
    </div>
  );
};
