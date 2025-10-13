import React from 'react';
import { Coins, LogIn, Ticket } from 'lucide-react';
import { Profile } from '../types';

interface HeaderProps {
  profile: Profile | null;
  ticketCount: number;
  onViewProfile: () => void;
  onSignIn: () => void;
  onViewTickets: () => void;
}

export const Header: React.FC<HeaderProps> = ({ profile, ticketCount, onViewProfile, onSignIn, onViewTickets }) => {
  const isGuest = profile?.is_guest;

  return (
    <header className="flex items-center justify-between">
      {/* Left side: App Title */}
      <div className="relative">
        <h1 className="text-2xl font-extrabold text-electric-blue">Sportime</h1>
        <div className="absolute -bottom-1 left-0 w-1/2 h-0.5 bg-warm-yellow"></div>
      </div>

      {/* Right side: Coin Balance & Profile */}
      <div className="flex items-center gap-2">
        {profile && (
          <>
            <div className="flex items-center gap-2 bg-navy-accent/70 backdrop-blur-sm px-3 py-2 rounded-full shadow-sm border border-neon-cyan/20">
              <Coins className="w-5 h-5 text-warm-yellow" />
              <span className="font-bold text-text-primary text-sm">{profile.coins_balance.toLocaleString()}</span>
            </div>
            <button 
              onClick={onViewTickets} 
              className="flex items-center gap-2 bg-navy-accent/70 backdrop-blur-sm px-3 py-2 rounded-full shadow-sm border border-neon-cyan/20 transition-colors hover:bg-white/10"
              aria-label="View ticket wallet"
            >
              <Ticket className="w-5 h-5 text-lime-glow" />
              <span className="font-bold text-text-primary text-sm">{ticketCount}</span>
            </button>
          </>
        )}
        <button 
          onClick={isGuest ? onSignIn : onViewProfile}
          className="w-10 h-10 bg-navy-accent/70 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-neon-cyan/20"
        >
          {isGuest ? (
            <LogIn className="w-5 h-5 text-electric-blue" />
          ) : profile?.profile_picture_url ? (
            <img src={profile.profile_picture_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
          ) : (
             <span className="font-bold text-lg text-electric-blue">
              {profile?.username ? profile.username.charAt(0).toUpperCase() : '?'}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
