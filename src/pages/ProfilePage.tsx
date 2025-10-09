import React, { useState } from 'react';
import { Profile, LevelConfig, Badge, UserBadge } from '../types';
import { User, Star, Shield, Settings } from 'lucide-react';
import { ProfileSettingsModal } from '../components/ProfileSettingsModal';

interface ProfilePageProps {
  profile: Profile;
  levels: LevelConfig[];
  allBadges: Badge[];
  userBadges: UserBadge[];
  onUpdateProfile: (updatedData: { username: string; newProfilePic: File | null; }) => void;
  onUpdateEmail: (newEmail: string) => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = (props) => {
  const { profile, levels, allBadges, userBadges } = props;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const currentLevel = levels.find(l => l.level_name === (profile.level ?? 'Amateur')) || levels[0];
  const nextLevel = levels.find(l => l.min_xp > currentLevel.min_xp);
  
  const xpForNextLevel = nextLevel ? nextLevel.min_xp - currentLevel.min_xp : 0;
  const currentXpInLevel = (profile.xp ?? 0) - currentLevel.min_xp;
  const progressPercentage = xpForNextLevel > 0 ? (currentXpInLevel / xpForNextLevel) * 100 : 100;

  const earnedBadges = userBadges.map(ub => allBadges.find(b => b.id === ub.badge_id)).filter(Boolean) as Badge[];

  return (
    <div className="space-y-6 animate-scale-in">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl shadow-lg p-5 flex flex-col items-center space-y-3 relative">
        <button onClick={() => setIsSettingsOpen(true)} className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 rounded-full">
          <Settings size={20} />
        </button>
        <div className="relative">
          <div className="w-24 h-24 bg-gradient-to-br from-purple-200 to-blue-200 rounded-full flex items-center justify-center">
            {profile.profile_picture_url ? (
              <img src={profile.profile_picture_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-12 h-12 text-purple-500" />
            )}
          </div>
          <span className="absolute bottom-0 right-0 bg-white p-1.5 rounded-full text-2xl shadow-md">{currentLevel.level_icon_url}</span>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">{profile.username}</h2>
          <p className="text-sm font-semibold text-purple-600">{currentLevel.level_name}</p>
        </div>
      </div>

      {/* XP Progress */}
      <div className="bg-white rounded-2xl shadow-lg p-5">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2"><Star size={20} className="text-yellow-500" /> XP Progress</h3>
          <span className="font-bold text-sm text-gray-600">
            {profile.xp?.toLocaleString()} / {nextLevel ? nextLevel.min_xp.toLocaleString() : 'Max'} XP
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className="bg-gradient-to-r from-yellow-400 to-amber-500 h-4 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        {nextLevel && (
           <p className="text-xs text-gray-500 text-center mt-2">
            {nextLevel.min_xp - (profile.xp ?? 0)} XP to reach {nextLevel.level_name}
          </p>
        )}
      </div>

      {/* Badges */}
      <div className="bg-white rounded-2xl shadow-lg p-5">
        <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2 mb-4"><Shield size={20} className="text-blue-500" /> Earned Badges</h3>
        {earnedBadges.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
            {earnedBadges.map(badge => (
              <div key={badge.id} className="flex flex-col items-center text-center space-y-2 group">
                <div className="bg-gray-100 group-hover:bg-purple-100 transition-colors w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-inner">
                  {badge.icon_url}
                </div>
                <p className="text-xs font-semibold text-gray-700">{badge.name}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <p className="text-gray-500 font-medium">No badges earned yet.</p>
            <p className="text-sm text-gray-400 mt-1">Keep playing to unlock them!</p>
          </div>
        )}
      </div>
      
      <ProfileSettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        profile={profile}
        onUpdateProfile={props.onUpdateProfile}
        onUpdateEmail={props.onUpdateEmail}
        onSignOut={props.onSignOut}
        onDeleteAccount={props.onDeleteAccount}
      />
    </div>
  );
};

export default ProfilePage;
