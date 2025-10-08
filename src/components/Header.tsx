import React, { useState } from 'react';
import { Coins, User, LogOut, LogIn } from 'lucide-react';
import { Profile } from '../types';

interface HeaderProps {
  profile: Profile | null;
  onSignOut: () => void;
  onSignIn: () => void;
}

export const Header: React.FC<HeaderProps> = ({ profile, onSignOut, onSignIn }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isGuest = !profile || profile.is_guest;

  return (
    <header className="flex items-center justify-between">
      <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
        Predict & Win
      </h1>
      <div className="flex items-center gap-3">
        {profile && (
          <div className="flex items-center gap-2 bg-white/70 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-white/80">
            <Coins className="w-5 h-5 text-amber-500" />
            <span className="font-bold text-gray-800 text-sm">{profile.coins_balance.toLocaleString()}</span>
          </div>
        )}
        <div className="relative">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-white/80"
          >
            <User className="w-5 h-5 text-gray-500" />
          </button>
          {isMenuOpen && (
            <div 
              className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-2 z-50 animate-scale-in"
              onMouseLeave={() => setIsMenuOpen(false)}
            >
              {isGuest ? (
                <button
                  onClick={onSignIn}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-purple-600 font-semibold hover:bg-purple-50"
                >
                  <LogIn size={16} />
                  Sign In / Sign Up
                </button>
              ) : (
                <>
                  <div className="px-4 py-2 text-sm text-gray-700">
                    Signed in as <br/>
                    <span className="font-semibold">{profile?.username || 'User'}</span>
                  </div>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button
                    onClick={onSignOut}
                    className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
