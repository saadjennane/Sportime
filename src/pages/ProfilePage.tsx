import React, { useState, useMemo } from 'react';
import { Profile, LevelConfig, Badge, UserBadge, UserStreak, SpinTier } from '../types';
import { User, Star, Shield, Settings, Flame, Edit, Globe, Award, Target, Gift, BarChart2, List, Users as SquadIcon } from 'lucide-react';
import { ProfileSettingsModal } from '../components/profile/ProfileSettingsModal';
import { mockTeams } from '../data/mockTeams';
import { mockCountries } from '../data/mockCountries';
import { DailyStreakTracker } from '../components/DailyStreakTracker';
import { getLevelBetLimit } from '../config/constants';
import { useSpinStore } from '../store/useSpinStore';
import { UserProfileStats } from '../components/profile/UserProfileStats';
import { FrequentPlayersList } from '../components/squad/FrequentPlayersList';
import { useMockStore } from '../store/useMockStore';
import { DisplayName } from '../components/shared/DisplayName';
import { PremiumUnlockCard } from '../components/premium/PremiumUnlockCard';
import { PremiumStatusCard } from '../components/premium/PremiumStatusCard';
import { XPProgressBar } from '../components/progression/XPProgressBar';
import { BadgeDisplay } from '../components/progression/BadgeDisplay';
import RewardHistoryPage from './RewardHistoryPage';

interface ProfilePageProps {
  profile: Profile;
  levels: LevelConfig[];
  allBadges: Badge[];
  userBadges: UserBadge[];
  userStreaks: UserStreak[];
  onUpdateProfile: (updatedData: { username: string; displayName: string; newProfilePic: File | null; favoriteClub?: string | null; favoriteNationalTeam?: string | null; }) => void;
  onUpdateEmail: (newEmail: string) => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  onOpenSpinWheel: (tier: SpinTier) => void;
  onOpenPremiumModal: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = (props) => {
  const { profile, levels, allBadges, userBadges, userStreaks, onOpenSpinWheel, onOpenPremiumModal } = props;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'squad' | 'rewards'>('overview');
  
  const userSpinState = useSpinStore(state => state.userSpinStates[profile.id]);
  const { addNotification } = useMockStore();

  const currentLevel = levels.find(l => l.level_name === (profile.level ?? 'Amateur')) || levels[0];
  const nextLevel = levels.find(l => l.min_xp > (currentLevel?.min_xp || 0));
  
  const xpForNextLevel = nextLevel && currentLevel ? nextLevel.min_xp - currentLevel.min_xp : 0;
  const currentXpInLevel = currentLevel ? (profile.xp ?? 0) - currentLevel.min_xp : 0;
  const progressPercentage = xpForNextLevel > 0 ? (currentXpInLevel / xpForNextLevel) * 100 : 100;

  const earnedBadges = userBadges.map(ub => allBadges.find(b => b.id === ub.badge_id)).filter(Boolean) as Badge[];

  const favoriteClub = profile.favorite_club ? mockTeams.find(t => t.id === profile.favorite_club) : null;
  const favoriteNationalTeam = profile.favorite_national_team ? mockCountries.find(c => c.name === profile.favorite_national_team) : null;
  const preferencesSkipped = !profile.is_guest && !profile.favorite_club && !profile.favorite_national_team;
  
  const userStreak = userStreaks.find(s => s.user_id === profile.id);
  const levelBetLimit = getLevelBetLimit(profile.level ?? currentLevel?.level_name);
  const maxBetLabel =
    levelBetLimit === null ? 'No Limit' : `${levelBetLimit.toLocaleString()} coins`;

  const PreferenceItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    value?: string;
    valueIcon?: string | React.ReactNode;
    onClick: () => void;
  }> = ({ icon, label, value, valueIcon, onClick }) => (
    <div className="bg-deep-navy p-4 rounded-xl">
        <p className="text-xs font-semibold text-text-disabled mb-2 flex items-center gap-1.5">{icon} {label}</p>
        {value ? (
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-text-primary">
                    {typeof valueIcon === 'string' ? <img src={valueIcon} alt={value} className="w-6 h-6" /> : valueIcon}
                    <span>{value}</span>
                </div>
                <button onClick={onClick} className="text-xs font-bold text-electric-blue hover:underline">Change</button>
            </div>
        ) : (
            <button onClick={onClick} className="w-full text-left text-sm font-semibold text-text-disabled hover:text-electric-blue">
                Tap to choose
            </button>
        )}
    </div>
  );

  const SpinTierButton: React.FC<{ tier: 'rookie' | 'pro' | 'elite', spins: number }> = ({ tier, spins }) => {
    const colors = {
      rookie: 'border-lime-glow text-lime-glow',
      pro: 'border-warm-yellow text-warm-yellow',
      elite: 'border-hot-red text-hot-red',
    };
    return (
      <button
        onClick={() => onOpenSpinWheel(tier)}
        disabled={spins <= 0}
        className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 ${colors[tier]} bg-deep-navy/50 disabled:opacity-50 disabled:border-disabled disabled:text-text-disabled`}
      >
        <span className="font-bold capitalize">{tier}</span>
        <span className="text-xs">({spins} spins)</span>
      </button>
    );
  };

  const TabButton: React.FC<{ label: string; icon: React.ReactNode; isActive: boolean; onClick: () => void; }> = ({ label, icon, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold transition-all text-sm ${isActive ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}
    >
      {icon} {label}
    </button>
  );

  return (
    <>
      <div className="space-y-6 animate-scale-in">
        {/* Profile Header */}
        <div className="card-base p-5 flex flex-col items-center space-y-3 relative">
          <button onClick={() => setIsSettingsOpen(true)} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full">
            <Settings size={20} />
          </button>
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-br from-electric-blue to-neon-cyan p-1 rounded-full">
              {profile.profile_picture_url ? (
                <img src={profile.profile_picture_url} alt="Profile" className="w-full h-full rounded-full object-cover border-4 border-navy-accent" />
              ) : (
                <div className="w-full h-full rounded-full bg-navy-accent flex items-center justify-center">
                  <User className="w-12 h-12 text-electric-blue" />
                </div>
              )}
            </div>
            {currentLevel && <span className="absolute bottom-0 right-0 bg-navy-accent p-1.5 rounded-full text-2xl shadow-md border-2 border-neon-cyan/50">{currentLevel.level_icon_url}</span>}
          </div>
          <div className="text-center">
            <DisplayName profile={profile} className="text-2xl font-bold text-text-primary" />
            <p className="text-sm text-text-disabled">@{profile.username}</p>
            {currentLevel && <p className="text-sm font-semibold text-electric-blue mt-1">{currentLevel.level_name}</p>}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-navy-accent rounded-xl p-1 gap-1">
          <TabButton label="Overview" icon={<List size={16} />} isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <TabButton label="Stats" icon={<BarChart2 size={16} />} isActive={activeTab === 'stats'} onClick={() => setActiveTab('stats')} />
          <TabButton label="Squad" icon={<SquadIcon size={16} />} isActive={activeTab === 'squad'} onClick={() => setActiveTab('squad')} />
          <TabButton label="Rewards" icon={<Gift size={16} />} isActive={activeTab === 'rewards'} onClick={() => setActiveTab('rewards')} />
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            {profile.is_subscriber && profile.subscription_expires_at ? (
              <PremiumStatusCard expiryDate={profile.subscription_expires_at} />
            ) : (
              <PremiumUnlockCard onClick={onOpenPremiumModal} />
            )}
            {preferencesSkipped && (
              <div className="bg-gradient-to-r from-warm-yellow to-orange-500 text-deep-navy p-4 rounded-2xl shadow-lg flex items-center gap-3">
                <Flame className="flex-shrink-0" />
                <div>
                  <h4 className="font-bold">Complete your profile!</h4>
                  <p className="text-sm">Choose your fan preferences to unlock fan stats and community leagues.</p>
                </div>
              </div>
            )}
            <DailyStreakTracker streak={userStreak} />
            {userSpinState && (
              <div className="card-base p-5 space-y-3">
                <h3 className="text-lg font-bold text-text-secondary flex items-center gap-2"><Gift size={20} className="text-warm-yellow" /> Spin the Wheel</h3>
                <div className="flex gap-2">
                  <SpinTierButton tier="rookie" spins={userSpinState.availableSpins.rookie} />
                  <SpinTierButton tier="pro" spins={userSpinState.availableSpins.pro} />
                  <SpinTierButton tier="elite" spins={userSpinState.availableSpins.elite} />
                </div>
              </div>
            )}
            <div className="card-base p-5 space-y-3">
              <h3 className="text-lg font-bold text-text-secondary flex items-center gap-2"><Edit size={20} className="text-electric-blue" /> Fan Preferences</h3>
              <PreferenceItem 
                  icon={<Award size={16} />}
                  label="Favorite Club"
                  value={favoriteClub?.name}
                  valueIcon={favoriteClub?.logo}
                  onClick={() => setIsSettingsOpen(true)}
              />
              <PreferenceItem 
                  icon={<Globe size={16} />}
                  label="Favorite National Team"
                  value={favoriteNationalTeam?.name}
                  valueIcon={<span className="text-2xl">{favoriteNationalTeam?.flag}</span>}
                  onClick={() => setIsSettingsOpen(true)}
              />
            </div>

            {/* ✅ New XP Progress Component with real-time updates */}
            <XPProgressBar userId={profile.id} />
            <div className="card-base p-5">
              <h3 className="text-lg font-bold text-text-secondary flex items-center gap-2 mb-2">
                  <Target size={20} className="text-lime-glow" /> Betting Limit
              </h3>
              <div className="bg-deep-navy p-3 rounded-lg text-center">
                  <p className="text-sm text-text-secondary">Max bet per match</p>
                  <p className="text-2xl font-bold text-warm-yellow">
                      {maxBetLabel}
                  </p>
              </div>
              {nextLevel && (
                  <p className="text-xs text-text-disabled text-center mt-2">
                      Next level unlocks higher limits!
                  </p>
              )}
            </div>

            {/* ✅ New Badge Display Component with dynamic badge loading */}
            <div className="card-base p-5">
              <h3 className="text-lg font-bold text-text-secondary flex items-center gap-2 mb-4">
                <Shield size={20} className="text-neon-cyan" /> Badges
              </h3>
              <BadgeDisplay userId={profile.id} showLocked={true} />
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <UserProfileStats />
        )}

        {activeTab === 'squad' && (
          <FrequentPlayersList
            currentUserId={profile.id}
            onInvite={(username) => {
              addNotification({
                type: 'squad',
                title: 'Invite Sent',
                message: `You invited ${username} to a game.`,
              });
            }}
          />
        )}

        {activeTab === 'rewards' && (
          <RewardHistoryPage profile={profile} />
        )}
        
        <ProfileSettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          {...props}
        />
      </div>
    </>
  );
};

export default ProfilePage;
