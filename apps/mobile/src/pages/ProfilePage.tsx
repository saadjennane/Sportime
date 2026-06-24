import React, { useState, useEffect } from 'react';
import { Profile, LevelConfig, Badge, UserBadge, UserStreak, SpinTier } from '../types';
import { User, Shield, Settings, Target, Gift, BarChart2, List, Ticket, Coins, ChevronRight, Plus, LogOut, Clock } from 'lucide-react';
import { ProfileSettingsModal } from '../components/profile/ProfileSettingsModal';
import ErrorBoundary from '../components/ErrorBoundary';
import { getLevelBetLimit } from '../config/constants';
import { useSpinStore } from '../store/useSpinStore';
import { UserProfileStats } from '../components/profile/UserProfileStats';
import { DisplayName } from '../components/shared/DisplayName';
import { PremiumUnlockCard } from '../components/premium/PremiumUnlockCard';
import { PremiumStatusCard } from '../components/premium/PremiumStatusCard';
import { PremiumStatsModal } from '../components/premium/PremiumStatsModal';
import { PremiumBadge } from '../components/premium/PremiumBadge';
import { BadgeDisplay } from '../components/progression/BadgeDisplay';
import { useProgression } from '../hooks/useProgression';
import { getTicketCounts, TicketCounts } from '../services/ticketService';
import { supabase } from '../services/supabase';

// Level name -> icon (real levels_config has no icon column).
const LEVEL_ICONS: Record<string, string> = {
  'Rookie': '🌱', 'Rising Star': '⭐', 'Pro': '🎯', 'Elite': '💎', 'Legend': '🔥', 'GOAT': '🐐',
};
const LEVEL_ORDER = ['Rookie', 'Rising Star', 'Pro', 'Elite', 'Legend', 'GOAT'];

// Tier colors shared by tickets & spins.
const TIER_STYLE: Record<'amateur' | 'master' | 'apex', { ring: string; text: string; dot: string }> = {
  amateur: { ring: 'border-lime-glow/40', text: 'text-lime-glow', dot: 'bg-lime-glow' },
  master: { ring: 'border-warm-yellow/40', text: 'text-warm-yellow', dot: 'bg-warm-yellow' },
  apex: { ring: 'border-hot-red/40', text: 'text-hot-red', dot: 'bg-hot-red' },
};

interface ProfilePageProps {
  profile: Profile;
  levels: LevelConfig[];
  allBadges: Badge[];
  userBadges: UserBadge[];
  userStreaks: UserStreak[];
  onUpdateProfile: (updatedData: { username: string; displayName: string; newProfilePic: File | null; sports?: string[]; }) => void;
  onUpdateEmail: (newEmail: string) => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  onOpenSpinWheel: (tier: SpinTier) => void;
  onOpenPremiumModal: () => void;
  onGoToShop?: () => void;
  onOpenHistory?: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = (props) => {
  const { profile, onOpenSpinWheel, onOpenPremiumModal, onGoToShop, onOpenHistory } = props;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'stats'>('overview');
  const [showPredStats, setShowPredStats] = useState(false);

  const userSpinState = useSpinStore(state => state.userSpinStates[profile.id]);
  const spins = userSpinState?.availableSpins;

  // Real progression — single source of truth for level + XP.
  const { progression } = useProgression(profile.id);
  const levelName = progression?.level_name ?? 'Rookie';
  const levelIcon = LEVEL_ICONS[levelName] ?? '🌱';
  const currentLevel = progression?.current_level ?? 1;
  const nextLevelName = currentLevel < LEVEL_ORDER.length ? LEVEL_ORDER[currentLevel] : null;
  const xpTotal = progression?.xp_total ?? 0;
  const xpToNext = progression?.xp_to_next_level ?? 0;
  const progressPct = Math.min(Math.max(progression?.progress_percentage ?? 0, 0), 100);

  // Tournament tickets (amateur / master / apex) — real inventory.
  const [tickets, setTickets] = useState<TicketCounts>({ amateur: 0, master: 0, apex: 0 });
  useEffect(() => {
    let cancelled = false;
    getTicketCounts(profile.id).then(t => { if (!cancelled) setTickets(t); }).catch(() => {});
    return () => { cancelled = true; };
  }, [profile.id]);

  const levelBetLimit = getLevelBetLimit(levelName);
  const maxBetLabel = levelBetLimit === null ? 'No Limit' : levelBetLimit.toLocaleString();

  const TabButton: React.FC<{ label: string; icon: React.ReactNode; isActive: boolean; onClick: () => void; }> = ({ label, icon, isActive, onClick }) => (
    <button onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold transition-all text-sm ${isActive ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}>
      {icon} {label}
    </button>
  );

  // A small tier chip used for both tickets and spins; tappable when actionable.
  const TierChip: React.FC<{ tier: 'amateur' | 'master' | 'apex'; count: number; onClick?: () => void }> = ({ tier, count, onClick }) => {
    const s = TIER_STYLE[tier];
    const active = count > 0;
    return (
      <button onClick={onClick} disabled={!onClick || !active}
        className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 transition
          ${active ? `${s.ring} bg-deep-navy` : 'border-white/5 bg-deep-navy/40 opacity-50'}
          ${onClick && active ? 'active:scale-95 hover:bg-white/5' : ''}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${active ? s.dot : 'bg-text-disabled'}`} />
        <span className={`text-xs font-semibold capitalize ${active ? 'text-text-primary' : 'text-text-disabled'}`}>{tier}</span>
        <span className={`text-sm font-bold ${active ? s.text : 'text-text-disabled'}`}>{count}</span>
      </button>
    );
  };

  return (
    <>
      <div className="space-y-4 animate-scale-in">
        {/* 1 — Identity + Level + XP (merged, no redundancy) */}
        <div className="card-base p-5 relative">
          <button onClick={() => setIsSettingsOpen(true)} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full">
            <Settings size={20} />
          </button>
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 bg-gradient-to-br from-electric-blue to-neon-cyan p-1 rounded-full">
                {profile.profile_picture_url ? (
                  <img src={profile.profile_picture_url} alt="Profile" className="w-full h-full rounded-full object-cover border-4 border-navy-accent" />
                ) : (
                  <div className="w-full h-full rounded-full bg-navy-accent flex items-center justify-center">
                    <User className="w-10 h-10 text-electric-blue" />
                  </div>
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 bg-navy-accent p-1 rounded-full text-xl shadow-md border-2 border-neon-cyan/50">{levelIcon}</span>
            </div>
            <div className="min-w-0 flex-1 pr-8">
              <div className="flex items-center gap-1.5">
                <DisplayName profile={profile} className="text-xl font-bold text-text-primary truncate" />
                {profile.is_subscriber && <PremiumBadge size={13} />}
              </div>
              <p className="text-xs text-text-disabled truncate">@{profile.username}</p>
              <p className="text-sm font-semibold text-electric-blue mt-0.5">{levelIcon} {levelName}</p>
            </div>
          </div>

          {/* Inline XP bar */}
          <div className="mt-4">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-sm font-bold text-text-primary">{xpTotal.toLocaleString()} XP</span>
              {nextLevelName
                ? <span className="text-xs text-text-secondary">{xpToNext.toLocaleString()} XP to <span className="font-semibold text-text-primary">{nextLevelName}</span></span>
                : <span className="text-xs font-bold text-warm-yellow">MAX LEVEL 🐐</span>}
            </div>
            <div className="w-full bg-deep-navy rounded-full h-2.5 overflow-hidden shadow-inner">
              <div className="bg-gradient-to-r from-electric-blue via-neon-cyan to-lime-glow h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${nextLevelName ? progressPct : 100}%` }} />
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-navy-accent rounded-xl p-1 gap-1">
          <TabButton label="Overview" icon={<List size={16} />} isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <TabButton label="Stats" icon={<BarChart2 size={16} />} isActive={activeTab === 'stats'} onClick={() => setActiveTab('stats')} />
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Premium */}
            {profile.is_subscriber && profile.subscription_expires_at ? (
              <>
                <PremiumStatusCard expiryDate={profile.subscription_expires_at} />
                <button onClick={() => setShowPredStats(true)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl card-base active:scale-[0.99] transition-transform text-left">
                  <div className="w-9 h-9 rounded-xl bg-warm-yellow/15 flex items-center justify-center"><Target size={18} className="text-warm-yellow" /></div>
                  <span className="flex-1 font-bold text-text-primary text-sm">Prediction stats</span>
                  <ChevronRight size={18} className="text-text-disabled" />
                </button>
              </>
            ) : (
              <PremiumUnlockCard onClick={onOpenPremiumModal} />
            )}

            {/* 2 — Wallet & limit (compact 2-tile row) */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={onGoToShop} disabled={!onGoToShop}
                className="card-base p-3.5 flex items-center gap-3 text-left relative hover:bg-white/5 transition disabled:hover:bg-transparent">
                <Coins size={22} className="text-warm-yellow flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-text-disabled uppercase tracking-wide">Coins</p>
                  <p className="text-lg font-bold text-text-primary truncate">{(profile.coins_balance ?? 0).toLocaleString()}</p>
                </div>
                {onGoToShop && (
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-electric-blue text-white flex items-center justify-center shadow"><Plus size={16} /></span>
                )}
              </button>
              <div className="card-base p-3.5 flex items-center gap-3">
                <Target size={22} className="text-lime-glow flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-text-disabled uppercase tracking-wide">Max bet</p>
                  <p className="text-lg font-bold text-text-primary truncate">{maxBetLabel}</p>
                </div>
              </div>
            </div>

            {/* Picks History */}
            {onOpenHistory && (
              <button onClick={onOpenHistory}
                className="w-full card-base p-3.5 flex items-center gap-3 text-left hover:bg-white/5 transition">
                <Clock size={22} className="text-electric-blue flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-text-disabled uppercase tracking-wide">Pick History</p>
                  <p className="text-sm font-bold text-text-primary">Your past results</p>
                </div>
                <ChevronRight size={18} className="text-text-disabled flex-shrink-0" />
              </button>
            )}

            {/* 3 — Play credits: tickets + spins */}
            <div className="card-base p-4 space-y-3">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-text-secondary flex items-center gap-1.5"><Ticket size={14} /> Tournament tickets</p>
                <div className="flex gap-2">
                  <TierChip tier="amateur" count={tickets.amateur} />
                  <TierChip tier="master" count={tickets.master} />
                  <TierChip tier="apex" count={tickets.apex} />
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-text-secondary flex items-center gap-1.5"><Gift size={14} /> Spins ready <span className="text-text-disabled font-normal">· tap to play</span></p>
                <div className="flex gap-2">
                  <TierChip tier="amateur" count={spins?.amateur ?? 0} onClick={() => onOpenSpinWheel('amateur')} />
                  <TierChip tier="master" count={spins?.master ?? 0} onClick={() => onOpenSpinWheel('master')} />
                  <TierChip tier="apex" count={spins?.apex ?? 0} onClick={() => onOpenSpinWheel('apex')} />
                </div>
              </div>
            </div>

            {/* 4 — Badges */}
            <div className="card-base p-4">
              <h3 className="text-sm font-bold text-text-secondary flex items-center gap-2 mb-3">
                <Shield size={16} className="text-neon-cyan" /> Badges
              </h3>
              <BadgeDisplay userId={profile.id} showLocked={true} />
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <UserProfileStats userId={profile.id} sports={profile.sports} />
        )}

        {/* Settings is isolated so a crash there can never blank the whole app,
            and Sign Out stays reachable even if the form fails to render. */}
        <ErrorBoundary
          key={isSettingsOpen ? 'settings-open' : 'settings-closed'}
          fallback={isSettingsOpen ? (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-sm bg-deep-navy rounded-2xl p-6 space-y-4 text-center border border-white/10">
                <h2 className="text-lg font-bold text-text-primary">Settings unavailable</h2>
                <p className="text-sm text-text-secondary">Something went wrong opening settings. You can still sign out.</p>
                <button onClick={props.onSignOut} className="w-full py-3 rounded-xl font-bold bg-hot-red/15 text-hot-red flex items-center justify-center gap-2">
                  <LogOut size={16} /> Sign Out
                </button>
                <button onClick={() => setIsSettingsOpen(false)} className="w-full py-2 text-sm font-semibold text-text-secondary">Close</button>
              </div>
            </div>
          ) : <></>}
        >
          <ProfileSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} {...props} />
        </ErrorBoundary>
        {showPredStats && <PremiumStatsModal userId={profile.id} onClose={() => setShowPredStats(false)} />}
      </div>
    </>
  );
};

// (Fan preferences — favorite club / national team — now live only in Fan Pulse.)

export default ProfilePage;
