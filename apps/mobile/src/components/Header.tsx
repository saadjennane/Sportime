import React, { useState } from 'react';
import { Coins, LogIn, Ticket, Bell, Plus, Disc3, X, ChevronRight, ShoppingBag } from 'lucide-react';
import { Profile } from '../types';

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
  onOpenPremiumModal: () => void; // kept for API compat — Premium now lives on the Profile page
  freeSpinReady?: boolean;
  onOpenSpin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ profile, coinBalance, ticketCount, notificationCount, onViewProfile, onSignIn, onViewTickets, onViewNotifications, onGoToShop, freeSpinReady, onOpenSpin }) => {
  const isGuest = !profile || profile.is_guest;
  const [walletOpen, setWalletOpen] = useState(false);

  const go = (fn: () => void) => { setWalletOpen(false); fn(); };

  return (
    <header className="flex items-center justify-between">
      {/* Left: Avatar */}
      <button onClick={isGuest ? onSignIn : onViewProfile} className="flex items-center gap-2">
        <div className="w-10 h-10 bg-navy-accent/70 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-neon-cyan/20">
          {isGuest ? (
            <LogIn className="w-5 h-5 text-electric-blue" />
          ) : profile?.profile_picture_url ? (
            <img src={profile.profile_picture_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="font-bold text-lg text-electric-blue">{profile?.username ? profile.username.charAt(0).toUpperCase() : '?'}</span>
          )}
        </div>
      </button>

      {/* Right: Wallet (coins + tickets) · conditional Spin · Notifications */}
      {profile && !isGuest && (
        <div className="flex items-center gap-2">
          {/* One wallet pill — coins + tickets, opens the wallet sheet */}
          <button
            onClick={() => setWalletOpen(true)}
            className="flex items-center gap-2 bg-navy-accent/70 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-neon-cyan/20 hover:bg-white/10 transition-colors"
            aria-label="Open wallet"
          >
            <span className="flex items-center gap-1"><Coins className="w-[18px] h-[18px] text-warm-yellow" /><span className="font-bold text-text-primary text-sm tabular-nums">{coinBalance.toLocaleString()}</span></span>
            <span className="w-px h-4 bg-white/15" />
            <span className="flex items-center gap-1"><Ticket className="w-[17px] h-[17px] text-lime-glow" /><span className="font-bold text-text-primary text-sm tabular-nums">{ticketCount}</span></span>
          </button>

          {/* Daily spin — only shown when a free spin is ready (otherwise it lives in FunZone) */}
          {onOpenSpin && freeSpinReady && (
            <button
              onClick={onOpenSpin}
              className="relative w-10 h-10 bg-navy-accent/70 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-warm-yellow/40"
              aria-label="Free spin ready" title="Free spin ready!"
            >
              <Disc3 className="w-5 h-5 text-warm-yellow" />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-lime-glow rounded-full border-2 border-deep-navy animate-pulse" />
            </button>
          )}

          {/* Notifications */}
          <button
            onClick={onViewNotifications}
            className="relative w-10 h-10 bg-navy-accent/70 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-neon-cyan/20"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-text-secondary" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-hot-red text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{notificationCount}</span>
            )}
          </button>
        </div>
      )}

      {/* Wallet sheet — coins, tickets, shop in one place */}
      {walletOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60" onClick={() => setWalletOpen(false)}>
          <div className="w-full max-w-md bg-deep-navy rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-text-primary">Wallet</h2>
              <button onClick={() => setWalletOpen(false)} className="p-1 text-text-secondary"><X size={20} /></button>
            </div>

            {/* Coins */}
            <button onClick={() => go(onGoToShop)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-navy-accent mb-2 text-left">
              <div className="w-10 h-10 rounded-full bg-warm-yellow/15 flex items-center justify-center"><Coins className="w-5 h-5 text-warm-yellow" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-text-disabled font-semibold">Coins</div>
                <div className="text-lg font-bold text-text-primary tabular-nums leading-tight">{coinBalance.toLocaleString()}</div>
              </div>
              <span className="flex items-center gap-1 text-electric-blue text-sm font-semibold"><ShoppingBag size={15} /> Get coins <ChevronRight size={16} /></span>
            </button>

            {/* Tickets */}
            <button onClick={() => go(onViewTickets)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-navy-accent text-left">
              <div className="w-10 h-10 rounded-full bg-lime-glow/15 flex items-center justify-center"><Ticket className="w-5 h-5 text-lime-glow" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-text-disabled font-semibold">Tickets</div>
                <div className="text-lg font-bold text-text-primary tabular-nums leading-tight">{ticketCount}</div>
              </div>
              <span className="flex items-center gap-1 text-electric-blue text-sm font-semibold">View <ChevronRight size={16} /></span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
