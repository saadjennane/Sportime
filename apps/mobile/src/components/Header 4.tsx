import React from 'react';
import { Coins, LogIn, Ticket, Bell, Plus, Star } from 'lucide-react';
import { Profile } from '../types';
import { DisplayName } from './shared/DisplayName';

interface HeaderProps {
  profile: Profile | null;
  coinBalance: number;
  ticketCount: number;
  notificationCount: number;
  onViewProfile: () => void;
  onSignIn: () => void;
  onViewTickets: () => void;
  onViewNotifications: () => void;
  onGoToShop: () => void;
  onOpenPremiumModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ profile, coinBalance, ticketCount, notificationCount, onViewProfile, onSignIn, onViewTickets, onViewNotifications, onGoToShop, onOpenPremiumModal }) => {
  const isGuest = !profile || profile.is_guest;

  return (
    <header className="flex items-center justify-between">
      {/* Left side: Avatar */}
      <button 
        onClick={isGuest ? onSignIn : onViewProfile}
        className="flex items-center gap-2"
      >
        <div className="w-10 h-10 bg-navy-accent/70 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-neon-cyan/20">
          {isGuest ? (
            <LogIn className="w-5 h-5 text-electric-blue" />
          ) : profile?.profile_picture_url ? (
            <img src={profile.profile_picture_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
          ) : (
             <span className="font-bold text-lg text-electric-blue">
              {profile?.username ? profile.username.charAt(0).toUpperCase() : '?'}
            </span>
          )}
        </div>
      </button>

      {/* Right side: Balance, Tickets, Notifications */}
      <div className="flex items-center gap-2">
        {profile && !isGuest && (
          <>
            {/* Balance */}
            <div className="flex items-center gap-1 bg-navy-accent/70 backdrop-blur-sm pl-3 pr-1 py-1 rounded-full shadow-sm border border-neon-cyan/20">
              <Coins className="w-5 h-5 text-warm-yellow" />
              <span className="font-bold text-text-primary text-sm">{coinBalance.toLocaleString()}</span>
              <button 
                onClick={onGoToShop} 
                className="w-6 h-6 bg-lime-glow/20 rounded-full flex items-center justify-center text-lime-glow hover:bg-lime-glow/30 transition-colors"
                aria-label="Go to shop"
              >
                <Plus size={16} />
              </button>
            </div>
            
            {/* Tickets */}
            <button 
              onClick={onViewTickets} 
              className="flex items-center gap-2 bg-navy-accent/70 backdrop-blur-sm px-3 py-2 rounded-full shadow-sm border border-neon-cyan/20 transition-colors hover:bg-white/10"
              aria-label="View ticket wallet"
            >
              <Ticket className="w-5 h-5 text-lime-glow" />
              <span className="font-bold text-text-primary text-sm">{ticketCount}</span>
            </button>
            
            {/* Notifications */}
            <button 
              onClick={onViewNotifications}
              className="relative w-10 h-10 bg-navy-accent/70 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-neon-cyan/20"
            >
              <Bell className="w-5 h-5 text-text-secondary" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-hot-red text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  {notificationCount}
                </span>
              )}
            </button>

            {/* Premium Status */}
            <button
              onClick={onOpenPremiumModal}
              className="relative w-10 h-10 bg-navy-accent/70 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-neon-cyan/20"
              title={profile.is_subscriber ? "Premium Active" : "Become Premium"}
            >
              <Star className={`w-5 h-5 transition-colors ${profile.is_subscriber ? 'text-warm-yellow fill-current' : 'text-text-secondary'}`} />
            </button>
          </>
        )}
      </div>
    </header>
  );
};
