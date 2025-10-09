import React from 'react';
import { Coins } from 'lucide-react';
import { Profile } from '../types';

interface HeaderProps {
  profile: Profile | null;
  onViewProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({ profile, onViewProfile }) => {
  return (
    <header className="flex items-center justify-between">
      {/* Left side: Avatar */}
      <div className="relative">
        <button 
          onClick={onViewProfile}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-white/80"
        >
          {profile?.profile_picture_url ? (
            <img src={profile.profile_picture_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
          ) : (
             <span className="font-bold text-lg text-purple-600">
              {profile?.username ? profile.username.charAt(0).toUpperCase() : 'G'}
            </span>
          )}
        </button>
      </div>

      {/* Right side: Coin Balance */}
      <div className="flex items-center gap-3">
        {profile && (
          <div className="flex items-center gap-2 bg-white/70 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-white/80">
            <Coins className="w-5 h-5 text-amber-500" />
            <span className="font-bold text-gray-800 text-sm">{profile.coins_balance.toLocaleString()}</span>
          </div>
        )}
      </div>
    </header>
  );
};
